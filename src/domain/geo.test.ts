import { describe, expect, it } from "vitest";

import {
  countryLabel,
  isAntimeridianCrossing,
  isCountryCode,
} from "@/src/domain/geo";

describe("isAntimeridianCrossing", () => {
  it("returns false for ordinary bounds", () => {
    expect(
      isAntimeridianCrossing({ west: 103, south: 1, east: 104, north: 2 }),
    ).toBe(false);
  });

  it("returns true when west is numerically east of east", () => {
    expect(
      isAntimeridianCrossing({ west: 170, south: -20, east: -170, north: 20 }),
    ).toBe(true);
  });
});


describe("international country support", () => {
  it("accepts alpha-2 country codes without a frontend allowlist", () => {
    expect(isCountryCode("SG")).toBe(true);
    expect(isCountryCode("KR")).toBe(true);
    expect(isCountryCode("MY")).toBe(true);
    expect(isCountryCode("KOR")).toBe(false);
    expect(isCountryCode("my")).toBe(false);
  });

  it("derives English country names from runtime locale data", () => {
    expect(countryLabel("KR")).toBe("South Korea");
    expect(countryLabel("MY")).toBe("Malaysia");
  });
});
