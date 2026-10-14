import { describe, expect, it, vi } from "vitest";

import { resolveCatalogueMode } from "@/src/features/catalogue/catalogue-mode";
import { resolveShopIdentity } from "@/src/features/shops/server-shop-identity-source";

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    slug: "api-shop",
    name: "API Shop",
    countryCode: "SG",
    localityName: "Singapore",
    position: { latitude: 1.29, longitude: 103.85 },
    primaryType: "fountain_pen_specialist",
    specialtyLine: null,
    operationalStatus: "open",
    markerState: "unvisited",
    sourceQuality: "sourced",
    timezone: "Asia/Singapore",
    positionPrecision: "street",
    shopTypes: ["fountain_pen_specialist"],
    specialties: [],
    services: [],
    brands: [],
    links: [],
    sources: [],
    ...overrides,
  };
}

describe("server shop identity source", () => {
  it("resolves fixture identity without an API request", async () => {
    const rpc = vi.fn();
    const result = await resolveShopIdentity("ty-lee-pen-shop", {
      resolution: resolveCatalogueMode("fixture"),
      rpc,
    });

    expect(result).toMatchObject({
      status: "found",
      shop: { name: "TY Lee Pen Shop" },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("resolves API identity from the public read contract", async () => {
    const result = await resolveShopIdentity("api-shop", {
      resolution: resolveCatalogueMode("api"),
      rpc: async () => detail(),
    });

    expect(result).toEqual({
      status: "found",
      shop: {
        slug: "api-shop",
        name: "API Shop",
        localityName: "Singapore",
      },
    });
  });

  it("distinguishes a missing listing from an unavailable catalogue", async () => {
    await expect(
      resolveShopIdentity("no-shop", {
        resolution: resolveCatalogueMode("api"),
        rpc: async () => null,
      }),
    ).resolves.toEqual({ status: "missing" });

    await expect(
      resolveShopIdentity("api-shop", {
        resolution: resolveCatalogueMode("api"),
        rpc: async () => {
          throw new Error("upstream unavailable");
        },
      }),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("accepts demo identity only in api-demo mode", async () => {
    const rpc = async () => detail({
      sourceQuality: "demo",
      fixtureNotice: "Demo data",
    });

    await expect(
      resolveShopIdentity("api-shop", {
        resolution: resolveCatalogueMode("api"),
        rpc,
      }),
    ).resolves.toEqual({ status: "unavailable" });

    await expect(
      resolveShopIdentity("api-shop", {
        resolution: resolveCatalogueMode("api-demo"),
        rpc,
      }),
    ).resolves.toMatchObject({ status: "found" });
  });
});
