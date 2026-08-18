import { describe, expect, it } from "vitest";

import { buildPassport, findPassportCountry, findPassportLocality } from "@/src/domain/passport";
import { demoSeedCollections } from "@/src/fixtures/demo-passport";

describe("buildPassport", () => {
  const passport = buildPassport(demoSeedCollections);

  it("counts stamps, countries, and localities", () => {
    expect(passport.stampCount).toBe(demoSeedCollections.length);
    expect(passport.countryCount).toBe(3);
    expect(passport.localityCount).toBeGreaterThanOrEqual(3);
  });

  it("orders recent impressions newest first", () => {
    const dates = passport.recent.map((collection) => collection.collectedOn);

    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("groups by country and locality", () => {
    const japan = findPassportCountry(passport, "jp");

    expect(japan?.countryLabel).toBe("Japan");
    expect(japan?.localities.length).toBeGreaterThan(0);
    expect(findPassportLocality(japan!, japan!.localities[0]!.slug)).toBeDefined();
  });

  it("is empty when nothing has been collected", () => {
    const empty = buildPassport([]);

    expect(empty.stampCount).toBe(0);
    expect(empty.countries).toEqual([]);
  });
});
