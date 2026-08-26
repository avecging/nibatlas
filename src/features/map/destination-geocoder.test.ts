import { describe, expect, it } from "vitest";

import { createFixtureGeocoder } from "@/src/features/map/destination-geocoder";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";
import { prototypeDestinations } from "@/src/fixtures/prototype-destinations";

const geocoder = createFixtureGeocoder();

describe("fixture destination geocoder", () => {
  it("ignores very short queries", async () => {
    const results = await geocoder.search("t");

    expect(results.destinations).toEqual([]);
    expect(results.shops).toEqual([]);
  });

  it("keeps destinations and canonical shops in separate lists", async () => {
    const results = await geocoder.search("Ginza");

    expect(results.destinations.map((item) => item.name)).toContain("Ginza");
    // Shop hits come from the canonical catalogue, never from the place list.
    expect(results.shops.length).toBeGreaterThan(0);
    expect(
      results.shops.every((item) =>
        prototypeShopSummaries.some((shop) => shop.id === item.shop.id),
      ),
    ).toBe(true);
    expect(
      results.destinations.every((item) =>
        prototypeDestinations.some((destination) => destination.id === item.id),
      ),
    ).toBe(true);
  });

  it("matches local-script names", async () => {
    const japanese = await geocoder.search("銀座");
    const traditionalChinese = await geocoder.search("臺北");

    expect(japanese.destinations.length).toBeGreaterThan(0);
    expect(traditionalChinese.destinations.length).toBeGreaterThan(0);
  });

  it("returns a close viewport for a matched shop", async () => {
    const results = await geocoder.search("Pen House");

    expect(results.shops[0]?.shop.slug).toBe("pen-house-tainan");
    expect(results.shops[0]?.viewport.zoom).toBeGreaterThan(12);
  });

  it("matches a shop by its local-script name", async () => {
    const results = await geocoder.search("文寶房");

    expect(results.shops.map((item) => item.shop.slug)).toContain("pen-house-tainan");
  });
});
