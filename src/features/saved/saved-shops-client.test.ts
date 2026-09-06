import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchSavedShops,
  setSavedShop,
} from "@/src/features/saved/saved-shops-client";

const SHOP = {
  id: "00000000-0000-4000-8000-000000000301",
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
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saved-shop browser client", () => {
  it("reads and decodes the private saved list without caching it", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ savedShopIds: [SHOP.id], shops: [SHOP] }),
    );

    await expect(fetchSavedShops()).resolves.toEqual({
      ok: true,
      value: { savedShopIds: [SHOP.id], shops: [SHOP] },
    });
    expect(request).toHaveBeenCalledWith("/api/v1/saved-shops", {
      credentials: "same-origin",
      cache: "no-store",
    });
  });

  it("rejects a successful response whose identifiers and shops do not align", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ savedShopIds: [SHOP.id], shops: [] }),
    );

    await expect(fetchSavedShops()).resolves.toEqual({
      ok: false,
      reason: "invalid-response",
    });
  });

  it("classifies a missing session without exposing server copy", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { ok: false, error: { code: "authentication_required" } },
        { status: 401 },
      ),
    );

    await expect(fetchSavedShops()).resolves.toEqual({
      ok: false,
      reason: "authentication-required",
    });
  });

  it("uses idempotent PUT and reconciles the returned saved shop", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, shopId: SHOP.id, saved: true, shop: SHOP }),
    );

    await expect(setSavedShop(SHOP.id, true)).resolves.toEqual({
      ok: true,
      value: { ok: true, shopId: SHOP.id, saved: true, shop: SHOP },
    });
    expect(request).toHaveBeenCalledWith(
      `/api/v1/saved-shops/${SHOP.id}`,
      {
        credentials: "same-origin",
        cache: "no-store",
        method: "PUT",
      },
    );
  });

  it("uses idempotent DELETE and rejects a contradictory response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, shopId: SHOP.id, saved: true, shop: SHOP }),
    );

    await expect(setSavedShop(SHOP.id, false)).resolves.toEqual({
      ok: false,
      reason: "invalid-response",
    });
  });
});
