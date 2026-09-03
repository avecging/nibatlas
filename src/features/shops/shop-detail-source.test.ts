import { describe, expect, it, vi } from "vitest";

import { ShopReadConfigurationError } from "@/src/server/adapters/supabase-shop-reads";
import { createApiShopDetailSource } from "@/src/features/shops/server-shop-detail-source";
import { createFixtureShopDetailSource } from "@/src/features/shops/shop-detail-source";

const SOURCE_ID = "00000000-0000-4000-8000-000000000501";

function detailPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    slug: "contract-shop",
    name: "Contract Shop",
    countryCode: "JP",
    localityName: "Kobe",
    position: { latitude: 34.69, longitude: 135.19 },
    primaryType: "fountain_pen_specialist",
    specialtyLine: null,
    operationalStatus: "open",
    markerState: "unvisited",
    sourceQuality: "sourced",
    timezone: "Asia/Tokyo",
    positionPrecision: "street",
    shopTypes: ["fountain_pen_specialist"],
    specialties: [],
    services: [],
    brands: [],
    links: [],
    sources: [
      {
        id: SOURCE_ID,
        label: "The shop's own site",
        kind: "official",
        retrievedOn: "2026-09-02",
        confirms: ["Local-script name"],
      },
    ],
    ...overrides,
  };
}

describe("fixture shop detail source", () => {
  it("finds a catalogue record and derives its nearby context", async () => {
    const result = await createFixtureShopDetailSource().fetchDetail("aesthetic-bay");

    expect(result.status).toBe("found");
    expect(result.status === "found" && result.shop.name).toBe("Aesthetic Bay");
  });

  it("answers an unknown or malformed slug identically", async () => {
    const source = createFixtureShopDetailSource();

    expect((await source.fetchDetail("no-such-shop")).status).toBe("missing");
    expect((await source.fetchDetail("Not_A_Slug")).status).toBe("missing");
  });
});

describe("api shop detail source", () => {
  it("projects a decoded record into domain state", async () => {
    const source = createApiShopDetailSource({
      demoRecords: false,
      rpc: async () => detailPayload(),
      nearbyRpc: async () => ({
        radiusMeters: 5000,
        shops: [
          {
            id: "00000000-0000-4000-8000-000000000302",
            slug: "nearby-shop",
            name: "Nearby Shop",
            countryCode: "JP",
            localityName: "Kobe",
            position: { latitude: 34.691, longitude: 135.191 },
            positionPrecision: "street",
            primaryType: "stationery_store",
            operationalStatus: "open",
            distanceMeters: 150,
          },
        ],
      }),
    });
    const result = await source.fetchDetail("contract-shop");

    expect(result.status).toBe("found");
    expect(result.status === "found" && result.shop.stamp.id).toBe("stamp-contract-shop");
    expect(result.status === "found" && result.nearby[0]).toMatchObject({
      shop: { slug: "nearby-shop", primaryType: "stationery_store" },
      distanceMeters: 150,
      sameLocality: true,
    });
  });

  it("withholds distance for an imprecise candidate and excludes closed/self results", async () => {
    const source = createApiShopDetailSource({
      demoRecords: false,
      rpc: async () => detailPayload(),
      nearbyRpc: async () => ({
        radiusMeters: 5000,
        shops: [
          {
            id: "00000000-0000-4000-8000-000000000301",
            slug: "contract-shop",
            name: "Contract Shop",
            countryCode: "JP",
            localityName: "Kobe",
            position: { latitude: 34.69, longitude: 135.19 },
            positionPrecision: "street",
            primaryType: "fountain_pen_specialist",
            operationalStatus: "open",
            distanceMeters: 0,
          },
          {
            id: "00000000-0000-4000-8000-000000000302",
            slug: "closed-shop",
            name: "Closed Shop",
            countryCode: "JP",
            localityName: "Kobe",
            position: { latitude: 34.691, longitude: 135.191 },
            positionPrecision: "street",
            primaryType: "stationery_store",
            operationalStatus: "permanently_closed",
            distanceMeters: 150,
          },
          {
            id: "00000000-0000-4000-8000-000000000303",
            slug: "centroid-shop",
            name: "Centroid Shop",
            countryCode: "JP",
            localityName: "Kobe",
            position: { latitude: 34.7, longitude: 135.2 },
            positionPrecision: "locality",
            primaryType: "stationery_store",
            operationalStatus: "open",
            distanceMeters: 900,
          },
        ],
      }),
    });

    const result = await source.fetchDetail("contract-shop");

    expect(result.status === "found" && result.nearby).toEqual([
      expect.objectContaining({
        shop: expect.objectContaining({ slug: "centroid-shop" }),
        distanceMeters: null,
      }),
    ]);
  });

  it("keeps detail usable when the secondary nearby read fails", async () => {
    const source = createApiShopDetailSource({
      demoRecords: false,
      rpc: async () => detailPayload(),
      nearbyRpc: async () => {
        throw new Error("nearby unavailable");
      },
    });

    const result = await source.fetchDetail("contract-shop");

    expect(result.status).toBe("found");
    expect(result.status === "found" && result.nearby).toEqual([]);
  });

  it("treats a null record as missing, not as a failure", async () => {
    const source = createApiShopDetailSource({
      demoRecords: false,
      rpc: async () => null,
    });

    expect((await source.fetchDetail("contract-shop")).status).toBe("missing");
  });

  it("never issues a request for a malformed slug", async () => {
    const rpc = vi.fn();
    const source = createApiShopDetailSource({ demoRecords: false, rpc });

    expect((await source.fetchDetail("Not_A_Slug")).status).toBe("missing");
    expect(rpc).not.toHaveBeenCalled();
  });

  /*
   * A failed read is never a 404 and never a fixture. Each failure keeps the URL
   * valid and reports why, so the page can say the listing is unavailable.
   */
  it("reports an unconfigured catalogue as unavailable", async () => {
    const source = createApiShopDetailSource({
      demoRecords: false,
      rpc: async () => {
        throw new ShopReadConfigurationError();
      },
    });

    expect(await source.fetchDetail("contract-shop")).toEqual({
      status: "unavailable",
      reason: "configuration",
    });
  });

  it("reports an unreachable upstream as unavailable", async () => {
    const source = createApiShopDetailSource({
      demoRecords: false,
      rpc: async () => {
        throw new Error("socket hang up");
      },
    });

    expect(await source.fetchDetail("contract-shop")).toEqual({
      status: "unavailable",
      reason: "upstream",
    });
  });

  it("makes a record the v1 decoder rejects unavailable", async () => {
    const source = createApiShopDetailSource({
      demoRecords: false,
      rpc: async () => detailPayload({ sources: {} }),
    });

    expect(await source.fetchDetail("contract-shop")).toEqual({
      status: "unavailable",
      reason: "contract",
    });
  });

  it("ignores internal unsourced practical columns outside the public v1 contract", async () => {
    const source = createApiShopDetailSource({
      demoRecords: false,
      rpc: async () => detailPayload({
        appointmentRequired: true,
        accessibilityNotes: "Step-free entrance",
      }),
      nearbyRpc: async () => ({ shops: [], radiusMeters: 5000 }),
    });

    expect((await source.fetchDetail("contract-shop")).status).toBe("found");
  });

  it("makes a demo record unavailable outside a demo-accepting mode", async () => {
    const demo = detailPayload({
      sourceQuality: "demo",
      fixtureNotice: "Demo fixture — not a verified business listing",
      sources: [
        {
          id: SOURCE_ID,
          label: "Demo evidence",
          kind: "demo_fixture",
          retrievedOn: "2026-09-02",
          confirms: ["Local-script name"],
        },
      ],
    });

    expect(
      await createApiShopDetailSource({ demoRecords: false, rpc: async () => demo }).fetchDetail(
        "contract-shop",
      ),
    ).toEqual({ status: "unavailable", reason: "contract" });

    expect(
      (
        await createApiShopDetailSource({
          demoRecords: true,
          rpc: async () => demo,
        }).fetchDetail("contract-shop")
      ).status,
    ).toBe("found");
  });
});
