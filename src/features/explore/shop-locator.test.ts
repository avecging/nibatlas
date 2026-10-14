import { describe, expect, it, vi } from "vitest";

import type { ShopReadClient } from "@/src/api/v1/shop-read-client";
import { ShopReadAbortedError } from "@/src/api/v1/shop-read-errors";
import {
  createFixtureShopLocator,
  createHttpShopLocator,
} from "@/src/features/explore/shop-locator";

const DETAIL = {
  id: "00000000-0000-4000-8000-000000000301",
  slug: "contract-shop",
  name: "Contract Shop",
  countryCode: "JP" as const,
  localityName: "Kobe",
  position: { latitude: 34.69, longitude: 135.19 },
  primaryType: "fountain_pen_specialist" as const,
  specialtyLine: null,
  operationalStatus: "open" as const,
  markerState: "visited" as const,
  sourceQuality: "sourced" as const,
  timezone: "Asia/Tokyo",
  positionPrecision: "street" as const,
  shopTypes: ["fountain_pen_specialist" as const],
  specialties: [],
  services: [],
  brands: [],
  links: [],
  sources: [],
};

function client(overrides: Partial<ShopReadClient> = {}): ShopReadClient {
  return {
    fetchViewport: vi.fn(),
    searchCanonicalShops: vi.fn(),
    fetchShopDetail: vi.fn(),
    fetchNearbyShops: vi.fn(),
    ...overrides,
  } as ShopReadClient;
}

describe("shop locator", () => {
  it("places a fixture shop by slug", async () => {
    const shop = await createFixtureShopLocator().locate("aesthetic-bay");

    expect(shop?.name).toBe("Aesthetic Bay");
  });

  it("answers null for a slug the fixture catalogue does not hold", async () => {
    expect(await createFixtureShopLocator().locate("no-such-shop")).toBeNull();
  });

  it("projects an API detail down to the public map summary", async () => {
    const locator = createHttpShopLocator(
      client({ fetchShopDetail: vi.fn(async () => DETAIL) }),
    );
    const shop = await locator.locate("contract-shop");

    expect(shop?.slug).toBe("contract-shop");
    // Public projection only: no user state and no detail-only field travels.
    expect(shop?.markerState).toBe("unvisited");
    expect(shop).not.toHaveProperty("sources");
    expect(shop).not.toHaveProperty("timezone");
  });

  it("answers null for a shop the API does not have", async () => {
    const locator = createHttpShopLocator(
      client({ fetchShopDetail: vi.fn(async () => null) }),
    );

    expect(await locator.locate("contract-shop")).toBeNull();
  });

  it("passes the caller's signal through and lets cancellation propagate", async () => {
    const fetchShopDetail = vi.fn(async () => {
      throw new ShopReadAbortedError();
    });
    const locator = createHttpShopLocator(client({ fetchShopDetail }));
    const controller = new AbortController();

    await expect(locator.locate("contract-shop", controller.signal)).rejects.toBeInstanceOf(
      ShopReadAbortedError,
    );
    expect(fetchShopDetail).toHaveBeenCalledWith("contract-shop", controller.signal);
  });
});
