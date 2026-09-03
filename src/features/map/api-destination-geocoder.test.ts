import { describe, expect, it, vi } from "vitest";

import type { ShopReadClient } from "@/src/api/v1/shop-read-client";
import { ShopReadAbortedError, ShopReadHttpError } from "@/src/api/v1/shop-read-errors";
import {
  createApiGeocoder,
  createCuratedDestinationSupplier,
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
  it("keeps canonical shops and places in separate groups", async () => {
    const geocoder = createApiGeocoder({
      client: client(vi.fn(async () => ({ shops: [HIT], query: "Kobe" }))),
    });
    const results = await geocoder.search("Kobe");

    expect(results.shops).toHaveLength(1);
    expect(results.destinations.length).toBeGreaterThan(0);
    // No place is ever presented as a catalogue record, and no wire-shaped value
    // reaches the interface: a canonical hit is the projected domain shape.
    expect(results.shops[0]).toEqual({
      id: HIT.id,
      slug: HIT.slug,
      name: HIT.name,
      countryCode: HIT.countryCode,
      localityName: HIT.localityName,
      matchedAlias: HIT.matchedAlias,
    });
    expect(results.destinations.every((place) => !("slug" in place))).toBe(true);
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

  it("keeps one group when the other supplier fails", async () => {
    const geocoder = createApiGeocoder({
      client: client(
        vi.fn(async () => {
          throw new ShopReadHttpError("http", 502);
        }),
      ),
    });
    const results = await geocoder.search("Kobe");

    expect(results.shops).toEqual([]);
    expect(results.destinations.length).toBeGreaterThan(0);
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

describe("curated destination supplier", () => {
  it("projects destinations into place results with a framing viewport", async () => {
    const places = await createCuratedDestinationSupplier().suggest("Ginza");

    expect(places.length).toBeGreaterThan(0);
    expect(places[0]?.viewport.zoom).toBeGreaterThan(0);
  });
});
