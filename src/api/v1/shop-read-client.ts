import {
  decodeNearbyShopsV1,
  decodeShopDetailV1,
  decodeShopSearchV1,
  decodeViewportShopsV1,
  ShopReadContractError,
  type NearbyShopsV1,
  type ShopDetailReadV1,
  type ShopSearchV1,
} from "@/src/api/v1/shop-read";
import type { ViewportShopRequest, ViewportShopResponse } from "@/src/domain/shops";
import {
  ShopReadAbortedError,
  ShopReadHttpError,
} from "@/src/api/v1/shop-read-errors";

export { ShopReadAbortedError, ShopReadHttpError } from "@/src/api/v1/shop-read-errors";

export interface CanonicalShopSearchRequest {
  readonly query: string;
  readonly limit?: number;
}

export interface NearbyShopsRequest {
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusMeters?: number;
  readonly limit?: number;
}

export interface ShopReadClient {
  fetchViewport(
    request: ViewportShopRequest,
    signal?: AbortSignal,
  ): Promise<ViewportShopResponse>;
  searchCanonicalShops(
    request: CanonicalShopSearchRequest,
    signal?: AbortSignal,
  ): Promise<ShopSearchV1>;
  fetchShopDetail(
    slug: string,
    signal?: AbortSignal,
  ): Promise<ShopDetailReadV1 | null>;
  fetchNearbyShops(
    request: NearbyShopsRequest,
    signal?: AbortSignal,
  ): Promise<NearbyShopsV1>;
}

export interface HttpShopReadClientOptions {
  /** Omit in the browser to use the same-origin `/api/v1/shops/*` routes. */
  readonly baseUrl?: string;
  /** Test seam; production uses the platform `fetch`. */
  readonly fetch?: typeof fetch;
}

function isAbort(cause: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (cause instanceof Error && cause.name === "AbortError")
  );
}

function coordinate(value: number): string {
  return value.toFixed(7);
}

function endpoint(baseUrl: string | undefined, path: string, query?: URLSearchParams): string {
  const pathname = baseUrl === undefined ? path : new URL(path, baseUrl).toString();
  const suffix = query?.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

async function responseCode(response: Response): Promise<string | undefined> {
  try {
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const error = (value as Record<string, unknown>)["error"];
    if (typeof error !== "object" || error === null || Array.isArray(error)) return undefined;
    const code = (error as Record<string, unknown>)["code"];
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

async function requestJson(
  fetcher: typeof fetch,
  input: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  if (signal?.aborted) throw new ShopReadAbortedError();

  let response: Response;

  try {
    response = await fetcher(input, init);
  } catch (cause) {
    if (isAbort(cause, signal)) throw new ShopReadAbortedError();
    throw new ShopReadHttpError("network", null, undefined, { cause });
  }

  if (signal?.aborted) throw new ShopReadAbortedError();

  if (!response.ok) {
    const code = await responseCode(response);
    if (signal?.aborted) throw new ShopReadAbortedError();
    throw new ShopReadHttpError("http", response.status, code);
  }

  try {
    const value: unknown = await response.json();
    if (signal?.aborted) throw new ShopReadAbortedError();
    return value;
  } catch (cause) {
    if (cause instanceof ShopReadAbortedError) throw cause;
    if (isAbort(cause, signal)) throw new ShopReadAbortedError();
    throw new ShopReadContractError("shop read response must be valid JSON");
  }
}

export function createHttpShopReadClient(
  options: HttpShopReadClientOptions = {},
): ShopReadClient {
  const fetcher = options.fetch ?? globalThis.fetch;

  return {
    async fetchViewport(request, signal) {
      const query = new URLSearchParams({
        west: coordinate(request.bounds.west),
        south: coordinate(request.bounds.south),
        east: coordinate(request.bounds.east),
        north: coordinate(request.bounds.north),
        zoom: String(request.zoom),
      });

      if (request.operationalStatuses && request.operationalStatuses.length > 0) {
        query.set("operationalStatus", request.operationalStatuses.join(","));
      }
      if (request.shopTypes && request.shopTypes.length > 0) {
        query.set("shopType", request.shopTypes.join(","));
      }
      if (request.limit !== undefined) query.set("limit", String(request.limit));

      const value = await requestJson(
        fetcher,
        endpoint(options.baseUrl, "/api/v1/shops/viewport", query),
        { method: "GET", ...(signal === undefined ? {} : { signal }) },
        signal,
      );
      return decodeViewportShopsV1(value);
    },

    async searchCanonicalShops(request, signal) {
      const query = new URLSearchParams({ q: request.query });
      if (request.limit !== undefined) query.set("limit", String(request.limit));
      const value = await requestJson(
        fetcher,
        endpoint(options.baseUrl, "/api/v1/shops/search", query),
        { method: "GET", ...(signal === undefined ? {} : { signal }) },
        signal,
      );
      return decodeShopSearchV1(value);
    },

    async fetchShopDetail(slug, signal) {
      try {
        const value = await requestJson(
          fetcher,
          endpoint(options.baseUrl, `/api/v1/shops/${encodeURIComponent(slug)}`),
          { method: "GET", ...(signal === undefined ? {} : { signal }) },
          signal,
        );
        return decodeShopDetailV1(value);
      } catch (cause) {
        if (
          cause instanceof ShopReadHttpError &&
          cause.status === 404 &&
          cause.code === "shop_not_found"
        ) {
          return null;
        }
        throw cause;
      }
    },

    async fetchNearbyShops(request, signal) {
      const body = {
        latitude: request.latitude,
        longitude: request.longitude,
        ...(request.radiusMeters === undefined ? {} : { radiusMeters: request.radiusMeters }),
        ...(request.limit === undefined ? {} : { limit: request.limit }),
      };
      const value = await requestJson(
        fetcher,
        endpoint(options.baseUrl, "/api/v1/shops/nearby"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          ...(signal === undefined ? {} : { signal }),
        },
        signal,
      );
      return decodeNearbyShopsV1(value);
    },
  };
}
