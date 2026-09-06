import {
  decodeSavedShopsV1,
  decodeSavedShopV1,
  isShopId,
  SavedShopContractError,
  type SavedShopMutationV1,
} from "@/src/api/v1/saved-shops";
import {
  clearPendingIntent,
  readPendingIntent,
  type AuthCookieStore,
} from "@/src/server/auth/continuation";

export interface SavedShopFailure {
  readonly code?: string | undefined;
  readonly status?: number | undefined;
}

export interface SavedShopGateway {
  getClaims(): Promise<{
    data: { claims: Record<string, unknown> } | null;
    error: SavedShopFailure | null;
  }>;
  list(): Promise<{ data: unknown; error: SavedShopFailure | null }>;
  save(shopId: string): Promise<{ data: unknown; error: SavedShopFailure | null }>;
  unsave(shopId: string): Promise<{ data: unknown; error: SavedShopFailure | null }>;
}

const NO_STORE = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
} as const;

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: NO_STORE });
}

function fail(status: number, code: string): Response {
  return json({ ok: false, error: { code } }, status);
}

function trustedMutation(request: Request): boolean {
  const origin = request.headers.get("Origin");

  return origin !== null && origin === new URL(request.url).origin;
}

async function authenticated(gateway: SavedShopGateway): Promise<Response | null> {
  let result: Awaited<ReturnType<SavedShopGateway["getClaims"]>>;

  try {
    result = await gateway.getClaims();
  } catch {
    return fail(503, "session_unavailable");
  }

  const { data, error } = result;

  if (error) {
    return fail(503, "session_unavailable");
  }

  if (!data?.claims || typeof data.claims["sub"] !== "string") {
    return fail(401, "authentication_required");
  }

  return null;
}

function upstreamFailure(error: SavedShopFailure | null): Response | null {
  if (!error) return null;

  // A provider-side 401 can occur when a token expires after the claims check.
  if (error.status === 401 || error.code === "42501") {
    return fail(401, "authentication_required");
  }

  return fail(502, "saved_shop_upstream_failed");
}

export async function listSavedShops(
  _request: Request,
  gateway: SavedShopGateway,
): Promise<Response> {
  const authFailure = await authenticated(gateway);
  if (authFailure) return authFailure;

  let result: Awaited<ReturnType<SavedShopGateway["list"]>>;

  try {
    result = await gateway.list();
  } catch {
    return fail(502, "saved_shop_upstream_failed");
  }
  const failure = upstreamFailure(result.error);
  if (failure) return failure;

  try {
    return json(decodeSavedShopsV1(result.data));
  } catch (cause) {
    return cause instanceof SavedShopContractError
      ? fail(502, "invalid_upstream_contract")
      : fail(500, "internal_error");
  }
}

export async function saveShop(
  request: Request,
  shopId: string,
  gateway: SavedShopGateway,
): Promise<Response> {
  if (!trustedMutation(request)) return fail(403, "untrusted_origin");
  if (!isShopId(shopId)) return fail(400, "invalid_shop_id");
  const canonicalShopId = shopId.toLowerCase();

  const authFailure = await authenticated(gateway);
  if (authFailure) return authFailure;

  let result: Awaited<ReturnType<SavedShopGateway["save"]>>;

  try {
    result = await gateway.save(canonicalShopId);
  } catch {
    return fail(502, "saved_shop_upstream_failed");
  }
  const failure = upstreamFailure(result.error);
  if (failure) return failure;
  if (result.data === null) return fail(404, "shop_not_found");

  try {
    const shop = decodeSavedShopV1(result.data);

    if (shop.id !== canonicalShopId) {
      return fail(502, "invalid_upstream_contract");
    }

    const payload: SavedShopMutationV1 = {
      ok: true,
      shopId: canonicalShopId,
      saved: true,
      shop,
    };

    return json(payload);
  } catch (cause) {
    return cause instanceof SavedShopContractError
      ? fail(502, "invalid_upstream_contract")
      : fail(500, "internal_error");
  }
}

/**
 * Completes the action promoted by a successful authentication callback.
 *
 * The pending cookie is HTTP-only, so completion stays server-authoritative.
 * Save itself is idempotent; the cookie is cleared only after a valid upstream
 * result, which makes a retry safe without losing the action on a transient
 * failure. Collect deliberately performs no operation here: returning to the
 * shop is its preflight, and location remains behind the reader's Collect tap.
 */
export async function completePendingSave(
  request: Request,
  gateway: SavedShopGateway,
  cookies: AuthCookieStore,
): Promise<Response> {
  if (!trustedMutation(request)) return fail(403, "untrusted_origin");

  const authFailure = await authenticated(gateway);
  if (authFailure) return authFailure;

  const intent = readPendingIntent(cookies);

  if (!intent || intent.type === "collect-shop") {
    clearPendingIntent(cookies);
    return new Response(null, { status: 204, headers: NO_STORE });
  }

  const canonicalShopId = intent.shopId.toLowerCase();
  let result: Awaited<ReturnType<SavedShopGateway["save"]>>;

  try {
    result = await gateway.save(canonicalShopId);
  } catch {
    return fail(502, "saved_shop_upstream_failed");
  }

  const failure = upstreamFailure(result.error);
  if (failure) return failure;
  if (result.data === null) {
    // Missing is terminal rather than transient: the requested catalogue record
    // cannot be saved, so retire the continuation and report the honest 404.
    clearPendingIntent(cookies);
    return fail(404, "shop_not_found");
  }

  try {
    const shop = decodeSavedShopV1(result.data);

    if (shop.id !== canonicalShopId) {
      return fail(502, "invalid_upstream_contract");
    }

    const payload: SavedShopMutationV1 = {
      ok: true,
      shopId: canonicalShopId,
      saved: true,
      shop,
    };

    clearPendingIntent(cookies);
    return json(payload);
  } catch (cause) {
    return cause instanceof SavedShopContractError
      ? fail(502, "invalid_upstream_contract")
      : fail(500, "internal_error");
  }
}

export async function unsaveShop(
  request: Request,
  shopId: string,
  gateway: SavedShopGateway,
): Promise<Response> {
  if (!trustedMutation(request)) return fail(403, "untrusted_origin");
  if (!isShopId(shopId)) return fail(400, "invalid_shop_id");
  const canonicalShopId = shopId.toLowerCase();

  const authFailure = await authenticated(gateway);
  if (authFailure) return authFailure;

  let result: Awaited<ReturnType<SavedShopGateway["unsave"]>>;

  try {
    result = await gateway.unsave(canonicalShopId);
  } catch {
    return fail(502, "saved_shop_upstream_failed");
  }
  const failure = upstreamFailure(result.error);
  if (failure) return failure;
  if (result.data === null) return fail(404, "shop_not_found");
  if (result.data !== true) return fail(502, "invalid_upstream_contract");

  const payload: SavedShopMutationV1 = {
    ok: true,
    shopId: canonicalShopId,
    saved: false,
  };
  return json(payload);
}
