import {
  decodeSavedShopImportV1,
  decodeSavedShopV1,
  decodeSavedShopsV1,
  isShopId,
  SavedShopContractError,
  type LocalSavedShopCandidateV1,
  type SavedShopImportV1,
  type SavedShopMutationV1,
  type SavedShopsV1,
} from "@/src/api/v1/saved-shops";

export type SavedShopClientFailure =
  | "authentication-required"
  | "shop-not-found"
  | "unavailable"
  | "invalid-response";

export type SavedShopClientResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: SavedShopClientFailure };

const REQUEST_INIT = {
  credentials: "same-origin",
  cache: "no-store",
} as const satisfies RequestInit;

async function errorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();

    if (typeof body !== "object" || body === null) {
      return null;
    }

    const error = (body as { error?: unknown }).error;

    return typeof error === "object" && error !== null
      ? ((error as { code?: unknown }).code as string | undefined) ?? null
      : null;
  } catch {
    return null;
  }
}

async function classify(response: Response): Promise<SavedShopClientFailure> {
  const code = await errorCode(response);

  if (response.status === 401 || code === "authentication_required") {
    return "authentication-required";
  }

  if (response.status === 404 || code === "shop_not_found") {
    return "shop-not-found";
  }

  return "unavailable";
}

function decodeMutation(
  value: unknown,
  shopId: string,
  saved: boolean,
): SavedShopMutationV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SavedShopContractError("saved shop mutation must be an object");
  }

  const item = value as Record<string, unknown>;
  const canonicalShopId = shopId.toLowerCase();

  if (
    item["ok"] !== true ||
    typeof item["shopId"] !== "string" ||
    item["shopId"].toLowerCase() !== canonicalShopId ||
    item["saved"] !== saved
  ) {
    throw new SavedShopContractError("saved shop mutation does not match the request");
  }

  if (!saved) {
    return { ok: true, shopId: canonicalShopId, saved: false };
  }

  return {
    ok: true,
    shopId: canonicalShopId,
    saved: true,
    shop: decodeSavedShopV1(item["shop"], "saved shop mutation.shop"),
  };
}

export async function fetchSavedShops(
  signal?: AbortSignal,
): Promise<SavedShopClientResult<SavedShopsV1>> {
  let response: Response;

  try {
    response = await fetch("/api/v1/saved-shops", {
      ...REQUEST_INIT,
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, reason: await classify(response) };
  }

  try {
    return { ok: true, value: decodeSavedShopsV1(await response.json()) };
  } catch {
    return { ok: false, reason: "invalid-response" };
  }
}

export async function setSavedShop(
  shopId: string,
  saved: boolean,
): Promise<SavedShopClientResult<SavedShopMutationV1>> {
  let response: Response;

  try {
    response = await fetch(`/api/v1/saved-shops/${encodeURIComponent(shopId)}`, {
      ...REQUEST_INIT,
      method: saved ? "PUT" : "DELETE",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, reason: await classify(response) };
  }

  try {
    return { ok: true, value: decodeMutation(await response.json(), shopId, saved) };
  } catch {
    return { ok: false, reason: "invalid-response" };
  }
}

/**
 * Asks the server to finish the HTTP-only Save continuation.
 *
 * A 204 means there was no Save to complete (including a Collect, whose return
 * page is intentionally only preflight). A successful Save uses the same
 * reconciliation payload as an ordinary PUT.
 */
export async function completePendingSave(): Promise<
  SavedShopClientResult<SavedShopMutationV1 | null>
> {
  let response: Response;

  try {
    response = await fetch("/api/v1/saved-shops/pending", {
      ...REQUEST_INIT,
      method: "POST",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 204) {
    return { ok: true, value: null };
  }

  if (!response.ok) {
    return { ok: false, reason: await classify(response) };
  }

  try {
    const body: unknown = await response.json();
    const shopId =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)["shopId"]
        : null;

    if (typeof shopId !== "string" || !isShopId(shopId)) {
      throw new SavedShopContractError(
        "pending saved shop response must carry a canonical shop id",
      );
    }

    return {
      ok: true,
      value: decodeMutation(body, shopId, true),
    };
  } catch {
    return { ok: false, reason: "invalid-response" };
  }
}

export async function importLocalSavedShops(
  candidates: readonly LocalSavedShopCandidateV1[],
): Promise<SavedShopClientResult<SavedShopImportV1>> {
  let response: Response;

  try {
    response = await fetch("/api/v1/saved-shops/import", {
      ...REQUEST_INIT,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates }),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, reason: await classify(response) };
  }

  try {
    const decoded = decodeSavedShopImportV1(await response.json());
    const requested = candidates.map((candidate) => candidate.localId);
    const returned = [
      ...decoded.reconciled.map((result) => result.localId),
      ...decoded.skipped.map((result) => result.localId),
      ...decoded.failed.map((result) => result.localId),
    ];

    if (
      returned.length !== requested.length ||
      returned.some((localId) => !requested.includes(localId))
    ) {
      throw new SavedShopContractError(
        "saved shop import response must account for every candidate",
      );
    }

    return { ok: true, value: decoded };
  } catch {
    return { ok: false, reason: "invalid-response" };
  }
}
