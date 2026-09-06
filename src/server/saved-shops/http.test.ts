import { describe, expect, it, vi } from "vitest";

import {
  finishAuthContinuation,
  readPendingIntent,
  writeAuthContinuation,
  type AuthCookieStore,
  type PendingAuthIntent,
} from "@/src/server/auth/continuation";
import type { SavedShopGateway } from "@/src/server/saved-shops/http";
import {
  completePendingSave,
  importSavedShops,
  listSavedShops,
  saveShop,
  unsaveShop,
} from "@/src/server/saved-shops/http";

const SHOP_ID = "00000000-0000-4000-8000-000000000301";
const OTHER_SHOP_ID = "00000000-0000-4000-8000-000000000302";
const SAVED_SHOP = {
  id: SHOP_ID,
  slug: "m2-singapore-demo-fixture",
  name: "M2 Singapore Demo Fixture",
  countryCode: "SG",
  localityName: "Singapore",
  position: { latitude: 1.29027, longitude: 103.851959 },
  primaryType: "fountain_pen_specialist",
  specialtyLine: null,
  operationalStatus: "unknown",
  markerState: "saved",
  sourceQuality: "demo",
  fixtureNotice: "Demo data",
  savedAt: "2026-09-04T16:30:00+00:00",
};

function gateway(overrides: Partial<SavedShopGateway> = {}): SavedShopGateway {
  return {
    getClaims: vi.fn(async () => ({
      data: { claims: { sub: "10000000-0000-4000-8000-000000000001" } },
      error: null,
    })),
    list: vi.fn(async () => ({
      data: { savedShopIds: [SHOP_ID], shops: [SAVED_SHOP] },
      error: null,
    })),
    resolveSlug: vi.fn(async () => ({ data: null, error: null })),
    save: vi.fn(async () => ({ data: SAVED_SHOP, error: null })),
    unsave: vi.fn(async () => ({ data: true, error: null })),
    ...overrides,
  };
}

function mutation(method: "PUT" | "DELETE", origin = "https://nibatlas.test") {
  return new Request(`https://nibatlas.test/api/v1/saved-shops/${SHOP_ID}`, {
    method,
    headers: { Origin: origin },
  });
}


function pendingCookies(intent: PendingAuthIntent) {
  const values = new Map<string, string>();
  const store: AuthCookieStore = {
    get: (name) => {
      const value = values.get(name);
      return value === undefined ? undefined : { value };
    },
    set: (name, value) => {
      values.set(name, value);
    },
    delete: (name) => {
      values.delete(name);
    },
  };
  const now = Date.now();

  writeAuthContinuation(store, { returnTo: "/saved", intent }, now);
  finishAuthContinuation(store, now);

  return store;
}

function importMutation(candidates: unknown) {
  return new Request("https://nibatlas.test/api/v1/saved-shops/import", {
    method: "POST",
    headers: {
      Origin: "https://nibatlas.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ candidates }),
  });
}

function pendingMutation() {
  return new Request("https://nibatlas.test/api/v1/saved-shops/pending", {
    method: "POST",
    headers: { Origin: "https://nibatlas.test" },
  });
}

async function errorCode(response: Response): Promise<string> {
  const body = await response.json() as { error: { code: string } };
  return body.error.code;
}

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
}

describe("saved-shop HTTP contract", () => {
  it("lists owner-scoped identifiers and compact details without public caching", async () => {
    const response = await listSavedShops(
      new Request("https://nibatlas.test/api/v1/saved-shops"),
      gateway(),
    );

    expect(response.status).toBe(200);
    expectPrivate(response);
    await expect(response.json()).resolves.toEqual({
      savedShopIds: [SHOP_ID],
      shops: [SAVED_SHOP],
    });
  });

  it("derives authorization from claims and never calls storage when signed out", async () => {
    const store = gateway({
      getClaims: vi.fn(async () => ({ data: null, error: null })),
    });
    const response = await listSavedShops(
      new Request("https://nibatlas.test/api/v1/saved-shops?userId=someone-else"),
      store,
    );

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("authentication_required");
    expect(store.list).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it("distinguishes session, upstream and invalid-contract failures", async () => {
    const sessionFailure = await listSavedShops(new Request("https://nibatlas.test"), gateway({
      getClaims: vi.fn(async () => ({ data: null, error: { status: 503 } })),
    }));
    const upstreamFailure = await listSavedShops(new Request("https://nibatlas.test"), gateway({
      list: vi.fn(async () => ({ data: null, error: { status: 500 } })),
    }));
    const contractFailure = await listSavedShops(new Request("https://nibatlas.test"), gateway({
      list: vi.fn(async () => ({ data: { savedShopIds: [], shops: "bad" }, error: null })),
    }));
    const thrownFailure = await listSavedShops(new Request("https://nibatlas.test"), gateway({
      list: vi.fn(async () => {
        throw new Error("network failed");
      }),
    }));

    expect([sessionFailure.status, await errorCode(sessionFailure)]).toEqual([503, "session_unavailable"]);
    expect([upstreamFailure.status, await errorCode(upstreamFailure)]).toEqual([502, "saved_shop_upstream_failed"]);
    expect([contractFailure.status, await errorCode(contractFailure)]).toEqual([502, "invalid_upstream_contract"]);
    expect([thrownFailure.status, await errorCode(thrownFailure)]).toEqual([502, "saved_shop_upstream_failed"]);
  });

  it("rejects malformed identifiers and cross-origin mutations before session access", async () => {
    const store = gateway();
    const malformed = await saveShop(mutation("PUT"), "not-a-uuid", store);
    const untrusted = await unsaveShop(mutation("DELETE", "https://attacker.test"), SHOP_ID, store);

    expect([malformed.status, await errorCode(malformed)]).toEqual([400, "invalid_shop_id"]);
    expect([bodyTooLarge.status, await errorCode(bodyTooLarge)]).toEqual([
      400,
      "invalid_import_request",
    ]);
    expect([untrusted.status, await errorCode(untrusted)]).toEqual([403, "untrusted_origin"]);
    expect(store.getClaims).not.toHaveBeenCalled();
  });

  it("distinguishes a missing or unpublished shop", async () => {
    const saveResponse = await saveShop(mutation("PUT"), SHOP_ID, gateway({
      save: vi.fn(async () => ({ data: null, error: null })),
    }));
    const unsaveResponse = await unsaveShop(mutation("DELETE"), SHOP_ID, gateway({
      unsave: vi.fn(async () => ({ data: null, error: null })),
    }));

    expect([saveResponse.status, await errorCode(saveResponse)]).toEqual([404, "shop_not_found"]);
    expect([unsaveResponse.status, await errorCode(unsaveResponse)]).toEqual([404, "shop_not_found"]);
  });

  it("rejects a save response for a different shop", async () => {
    const response = await saveShop(mutation("PUT"), SHOP_ID, gateway({
      save: vi.fn(async () => ({ data: { ...SAVED_SHOP, id: OTHER_SHOP_ID }, error: null })),
    }));

    expect([response.status, await errorCode(response)]).toEqual([502, "invalid_upstream_contract"]);
  });

  it("canonicalizes uppercase UUID paths before persistence and reconciliation", async () => {
    const store = gateway();
    const uppercase = SHOP_ID.toUpperCase();
    const saveResponse = await saveShop(mutation("PUT"), uppercase, store);
    const unsaveResponse = await unsaveShop(mutation("DELETE"), uppercase, store);

    expect(store.save).toHaveBeenCalledWith(SHOP_ID);
    expect(store.unsave).toHaveBeenCalledWith(SHOP_ID);
    await expect(saveResponse.json()).resolves.toMatchObject({ shopId: SHOP_ID, saved: true });
    await expect(unsaveResponse.json()).resolves.toEqual({ ok: true, shopId: SHOP_ID, saved: false });
  });

  it("returns stable reconciliation payloads for repeated save and unsave", async () => {
    const store = gateway();
    const firstSave = await saveShop(mutation("PUT"), SHOP_ID, store);
    const secondSave = await saveShop(mutation("PUT"), SHOP_ID, store);
    const firstUnsave = await unsaveShop(mutation("DELETE"), SHOP_ID, store);
    const secondUnsave = await unsaveShop(mutation("DELETE"), SHOP_ID, store);

    expect(await firstSave.json()).toEqual(await secondSave.json());
    expect(await firstUnsave.json()).toEqual(await secondUnsave.json());
    expect(firstSave.status).toBe(200);
    expect(firstUnsave.status).toBe(200);
  });


  it("reconciles canonical ids and skips invalid or unmatched local records", async () => {
    const store = gateway();
    const response = await importSavedShops(
      importMutation([
        { localId: SHOP_ID.toUpperCase() },
        { localId: "obsolete-record" },
        { localId: "prototype-record", slug: "missing-prototype-shop" },
      ]),
      store,
    );

    expect(response.status).toBe(200);
    expectPrivate(response);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reconciled: [{ localId: SHOP_ID.toUpperCase(), shop: SAVED_SHOP }],
      skipped: [
        { localId: "obsolete-record", reason: "invalid-id" },
        { localId: "prototype-record", reason: "unknown-shop" },
      ],
      failed: [],
    });
    expect(store.save).toHaveBeenCalledWith(SHOP_ID);
    expect(store.resolveSlug).toHaveBeenCalledWith("missing-prototype-shop");
  });

  it("keeps transient import failures separate for safe retry", async () => {
    const response = await importSavedShops(
      importMutation([{ localId: SHOP_ID }]),
      gateway({
        save: vi.fn(async () => ({ data: null, error: { status: 500 } })),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reconciled: [],
      skipped: [],
      failed: [{ localId: SHOP_ID, reason: "unavailable" }],
    });
  });

  it("rejects duplicate, oversized and cross-origin import requests", async () => {
    const duplicate = await importSavedShops(
      importMutation([{ localId: "same" }, { localId: "same" }]),
      gateway(),
    );
    const oversized = await importSavedShops(
      importMutation(Array.from({ length: 101 }, (_, index) => ({ localId: `old-${index}` }))),
      gateway(),
    );
    const bodyTooLarge = await importSavedShops(
      importMutation([{ localId: "x".repeat(33_000) }]),
      gateway(),
    );
    const untrustedRequest = importMutation([]);
    untrustedRequest.headers.set("Origin", "https://attacker.test");
    const untrusted = await importSavedShops(untrustedRequest, gateway());

    expect([duplicate.status, await errorCode(duplicate)]).toEqual([
      400,
      "invalid_import_request",
    ]);
    expect([oversized.status, await errorCode(oversized)]).toEqual([
      400,
      "invalid_import_request",
    ]);
    expect([untrusted.status, await errorCode(untrusted)]).toEqual([
      403,
      "untrusted_origin",
    ]);
  });

  it("completes a promoted Save once and clears it only after success", async () => {
    const cookies = pendingCookies({ type: "save-shop", shopId: SHOP_ID });
    const store = gateway();

    const first = await completePendingSave(pendingMutation(), store, cookies);
    const second = await completePendingSave(pendingMutation(), store, cookies);

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      ok: true,
      shopId: SHOP_ID,
      saved: true,
      shop: SAVED_SHOP,
    });
    expect(second.status).toBe(204);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(readPendingIntent(cookies)).toBeNull();
  });

  it("retains a promoted Save across a transient persistence failure", async () => {
    const cookies = pendingCookies({ type: "save-shop", shopId: SHOP_ID });
    const response = await completePendingSave(
      pendingMutation(),
      gateway({
        save: vi.fn(async () => ({ data: null, error: { status: 500 } })),
      }),
      cookies,
    );

    expect([response.status, await errorCode(response)]).toEqual([
      502,
      "saved_shop_upstream_failed",
    ]);
    expect(readPendingIntent(cookies)).toEqual({
      type: "save-shop",
      shopId: SHOP_ID,
    });
  });

  it("returns a Collect to preflight without saving or retaining the action", async () => {
    const cookies = pendingCookies({
      type: "collect-shop",
      shopSlug: "m2-singapore-demo-fixture",
    });
    const store = gateway();
    const response = await completePendingSave(
      pendingMutation(),
      store,
      cookies,
    );

    expect(response.status).toBe(204);
    expect(store.save).not.toHaveBeenCalled();
    expect(readPendingIntent(cookies)).toBeNull();
  });

  it("keeps concurrent mutations isolated by requested shop identifier", async () => {
    const saved = new Map<string, typeof SAVED_SHOP>();
    const store = gateway({
      save: vi.fn(async (shopId) => {
        const shop = { ...SAVED_SHOP, id: shopId };
        saved.set(shopId, shop);
        return { data: shop, error: null };
      }),
      unsave: vi.fn(async (shopId) => {
        saved.delete(shopId);
        return { data: true, error: null };
      }),
    });

    const [first, second] = await Promise.all([
      saveShop(mutation("PUT"), SHOP_ID, store),
      saveShop(mutation("PUT"), OTHER_SHOP_ID, store),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(saved.size).toBe(2);
    expect(store.save).toHaveBeenCalledWith(SHOP_ID);
    expect(store.save).toHaveBeenCalledWith(OTHER_SHOP_ID);
  });
});
