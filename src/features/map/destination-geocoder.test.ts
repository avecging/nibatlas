import { describe, expect, it } from "vitest";

import { createFixtureGeocoder } from "@/src/features/map/destination-geocoder";

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
    expect(results.shops.every((item) => item.shop.slug.startsWith("demo-"))).toBe(true);
  });

  it("matches local-script names", async () => {
    const japanese = await geocoder.search("銀座");
    const traditionalChinese = await geocoder.search("臺北");

    expect(japanese.destinations.length).toBeGreaterThan(0);
    expect(traditionalChinese.destinations.length).toBeGreaterThan(0);
  });

  it("returns a viewport for a matched shop", async () => {
    const results = await geocoder.search("Kyoto Machiya");

    expect(results.shops[0]?.viewport.zoom).toBeGreaterThan(12);
  });
});
