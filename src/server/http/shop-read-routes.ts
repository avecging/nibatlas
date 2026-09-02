import {
  decodeNearbyShopsV1,
  decodeShopDetailV1,
  decodeShopSearchV1,
  decodeViewportShopsV1,
  ShopReadContractError,
} from "@/src/api/v1/shop-read";
import { SHOP_TYPES, type OperationalStatus, type ShopType } from "@/src/domain/shops";
import {
  callShopReadRpc,
  ShopReadConfigurationError,
} from "@/src/server/adapters/supabase-shop-reads";

const PUBLIC_LIST_CACHE = "public, max-age=30, s-maxage=300, stale-while-revalidate=600";
const PUBLIC_DETAIL_CACHE = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";
const PRIVATE_NO_STORE = "private, no-store";
const OPERATIONAL_STATUSES = [
  "open",
  "temporarily_closed",
  "permanently_closed",
  "unknown",
] as const satisfies readonly OperationalStatus[];

class InputError extends Error {}

function error(status: number, code: string): Response {
  return Response.json(
    { ok: false, error: { code } },
    { status, headers: { "Cache-Control": PRIVATE_NO_STORE } },
  );
}

function success(data: unknown, cacheControl: string): Response {
  return Response.json(data, {
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function one(params: URLSearchParams, name: string, required = true): string | undefined {
  const values = params.getAll(name);

  if (values.length > 1 || (required && values.length === 0)) {
    throw new InputError();
  }

  return values[0];
}

function finiteNumber(
  params: URLSearchParams,
  name: string,
  min: number,
  max: number,
  fallback?: number,
): number {
  const raw = one(params, name, fallback === undefined);

  if (raw === undefined) return fallback!;
  if (raw.trim() === "" || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) throw new InputError();

  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) throw new InputError();

  return value;
}

function integer(
  params: URLSearchParams,
  name: string,
  min: number,
  max: number,
  fallback?: number,
): number {
  const value = finiteNumber(params, name, min, max, fallback);
  if (!Number.isInteger(value)) throw new InputError();
  return value;
}

function enumList<T extends string>(
  params: URLSearchParams,
  name: string,
  allowed: readonly T[],
): readonly T[] | null {
  const raw = one(params, name, false);
  if (raw === undefined || raw === "") return null;

  const values = raw.split(",");
  if (values.some((value) => !allowed.includes(value as T))) throw new InputError();

  return [...new Set(values)] as T[];
}

async function execute(
  rpc: Parameters<typeof callShopReadRpc>[0],
  args: Readonly<Record<string, unknown>>,
  decode: (value: unknown) => unknown,
  signal: AbortSignal,
  cacheControl: string,
): Promise<Response> {
  try {
    const raw = await callShopReadRpc(rpc, args, signal);
    return success(decode(raw), cacheControl);
  } catch (cause) {
    if (cause instanceof ShopReadConfigurationError) return error(503, "read_service_unavailable");
    if (cause instanceof ShopReadContractError) return error(502, "invalid_upstream_contract");
    return error(502, "read_upstream_failed");
  }
}

export async function getViewportShops(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const west = finiteNumber(params, "west", -180, 180);
    const south = finiteNumber(params, "south", -90, 90);
    const east = finiteNumber(params, "east", -180, 180);
    const north = finiteNumber(params, "north", -90, 90);
    const zoom = integer(params, "zoom", 0, 24);
    const limit = integer(params, "limit", 1, 500, 500);

    if (south >= north || west === east) throw new InputError();

    const operationalStatuses = enumList(params, "operationalStatus", OPERATIONAL_STATUSES);
    const shopTypes = enumList(params, "shopType", SHOP_TYPES) as readonly ShopType[] | null;

    return execute("viewport_shops", {
      p_west: west,
      p_south: south,
      p_east: east,
      p_north: north,
      p_zoom: zoom,
      p_operational_statuses: operationalStatuses,
      p_shop_type_codes: shopTypes,
      p_limit: limit,
    }, decodeViewportShopsV1, request.signal, PUBLIC_LIST_CACHE);
  } catch (cause) {
    return cause instanceof InputError ? error(400, "invalid_viewport") : error(500, "internal_error");
  }
}

export async function getShopSearch(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const query = one(params, "q")!.trim();
    const limit = integer(params, "limit", 1, 50, 20);

    if (query.length < 1 || query.length > 120) throw new InputError();

    return execute("search_shops", { p_query: query, p_limit: limit }, decodeShopSearchV1, request.signal, PUBLIC_LIST_CACHE);
  } catch (cause) {
    return cause instanceof InputError ? error(400, "invalid_search") : error(500, "internal_error");
  }
}

export async function getShopDetail(request: Request, slug: string): Promise<Response> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return error(400, "invalid_shop_slug");

  try {
    const raw = await callShopReadRpc("shop_detail", { p_slug: slug }, request.signal);
    const detail = decodeShopDetailV1(raw);
    return detail === null ? error(404, "shop_not_found") : success(detail, PUBLIC_DETAIL_CACHE);
  } catch (cause) {
    if (cause instanceof ShopReadConfigurationError) return error(503, "read_service_unavailable");
    if (cause instanceof ShopReadContractError) return error(502, "invalid_upstream_contract");
    return error(502, "read_upstream_failed");
  }
}

export async function postNearbyShops(request: Request): Promise<Response> {
  try {
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      throw new InputError();
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new InputError();
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new InputError();

    const body = raw as Record<string, unknown>;
    const allowed = new Set(["latitude", "longitude", "radiusMeters", "limit"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) throw new InputError();

    const bodyNumber = (name: string, min: number, max: number, fallback?: number) => {
      const candidate = body[name] === undefined ? fallback : body[name];
      if (typeof candidate !== "number" || !Number.isFinite(candidate)
        || candidate < min || candidate > max) throw new InputError();
      return candidate;
    };
    const latitude = bodyNumber("latitude", -90, 90);
    const longitude = bodyNumber("longitude", -180, 180);
    const radius = bodyNumber("radiusMeters", 1, 100_000, 10_000);
    const limit = bodyNumber("limit", 1, 100, 50);
    if (!Number.isInteger(radius) || !Number.isInteger(limit)) throw new InputError();

    return execute("nearby_shops", {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_m: radius,
      p_limit: limit,
    }, decodeNearbyShopsV1, request.signal, PRIVATE_NO_STORE);
  } catch (cause) {
    return cause instanceof InputError ? error(400, "invalid_nearby_search") : error(500, "internal_error");
  }
}

