import { describe, expect, it, vi } from "vitest";

import type { ShopReadClient } from "@/src/api/v1/shop-read-client";
import { ShopReadAbortedError, ShopReadHttpError } from "@/src/api/v1/shop-read-errors";
import {
  createApiGeocoder,
  createEmptyDestinationSupplier,
} from "@/src/features/map/api-destination-geocoder";

const HIT = {
  id: "00000000-0000-4000-8000-000000000301",
  slug: "contract-shop",
  name: "Contract Shop",
  countryCode: "JP" as const,
  localityName: "Kobe",
  matchedAlias: "コントラクト",
};

function client(searchCanonicalShops: ShopReadClient["searchCanonicalShops"]): ShopReadClient {
  return {
    fetchViewport: vi.fn(),
    searchCanonicalShops,
    fetchShopDetail: vi.fn(),
    fetchNearbyShops: vi.fn(),
  } as ShopReadClient;
}

describe("api destination geocoder", () => {
  it("keeps canonical shops while API-mode place search is disabled", async () => {
    const geocoder = createApiGeocoder({
      client: client(vi.fn(async () => ({ shops: [HIT], query: "Kobe" }))),
    });
    const results = await geocoder.search("Kobe");

    expect(results.destinations).toEqual([]);
    expect(results.shops).toEqual([
      {
        id: HIT.id,
        slug: HIT.slug,
        name: HIT.name,
        countryCode: HIT.countryCode,
        localityName: HIT.localityName,
        matchedAlias: HIT.matchedAlias,
      },
    ]);
  });

  it("never invents a position for a canonical hit", async () => {
    const geocoder = createApiGeocoder({
      client: client(vi.fn(async () => ({ shops: [HIT], query: "Kobe" }))),
    });
    const results = await geocoder.search("Kobe");

    expect(results.shops[0]?.target).toBeUndefined();
  });

  it("ignores a query shorter than the minimum without calling the API", async () => {
    const searchCanonicalShops = vi.fn();
    const geocoder = createApiGeocoder({ client: client(searchCanonicalShops) });

    expect(await geocoder.search("K")).toEqual({ destinations: [], shops: [] });
    expect(searchCanonicalShops).not.toHaveBeenCalled();
  });

  it("returns no results when canonical search fails and place search is disabled", async () => {
    const geocoder = createApiGeocoder({
      client: client(
        vi.fn(async () => {
          throw new ShopReadHttpError("http", 502);
        }),
      ),
    });
    const results = await geocoder.search("Kobe");

    expect(results).toEqual({ destinations: [], shops: [] });
  });

  it("keeps canonical shops when an injected place supplier fails", async () => {
    const geocoder = createApiGeocoder({
      client: client(vi.fn(async () => ({ shops: [HIT], query: "Kobe" }))),
      destinations: {
        suggest: vi.fn(async () => {
          throw new Error("place supplier unavailable");
        }),
      },
    });

    const results = await geocoder.search("Kobe");

    expect(results.destinations).toEqual([]);
    expect(results.shops).toHaveLength(1);
  });

  it("propagates cancellation rather than returning a half-empty search", async () => {
    const geocoder = createApiGeocoder({
      client: client(
        vi.fn(async () => {
          throw new ShopReadAbortedError();
        }),
      ),
    });

    await expect(geocoder.search("Kobe")).rejects.toBeInstanceOf(ShopReadAbortedError);
  });

  it("propagates place-supplier cancellation rather than returning canonical shops", async () => {
    const geocoder = createApiGeocoder({
      client: client(vi.fn(async () => ({ shops: [HIT], query: "Kobe" }))),
      destinations: {
        suggest: vi.fn(async () => {
          throw new ShopReadAbortedError();
        }),
      },
    });

    await expect(geocoder.search("Kobe")).rejects.toBeInstanceOf(ShopReadAbortedError);
  });

  it("passes the query and limit to the canonical search endpoint", async () => {
    const searchCanonicalShops = vi.fn(async () => ({ shops: [], query: "Kobe" }));
    const geocoder = createApiGeocoder({
      client: client(searchCanonicalShops),
      shopLimit: 3,
    });

    await geocoder.search("  Kobe  ");

    expect(searchCanonicalShops).toHaveBeenCalledWith(
      { query: "Kobe", limit: 3 },
      undefined,
    );
  });
});

describe("empty destination supplier", () => {
  it("returns no place results", async () => {
    await expect(createEmptyDestinationSupplier().suggest("Ginza")).resolves.toEqual([]);
  });
});
