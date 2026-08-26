import { describe, expect, it } from "vitest";

import { buildPassport, findPassportCountry, findPassportLocality } from "@/src/domain/passport";
import { prototypeSeedCollections } from "@/src/fixtures/prototype-passport";

describe("buildPassport", () => {
  const passport = buildPassport(prototypeSeedCollections);

  it("counts stamps, countries, and localities", () => {
    expect(passport.stampCount).toBe(prototypeSeedCollections.length);
    expect(passport.countryCount).toBe(3);
    expect(passport.localityCount).toBeGreaterThanOrEqual(3);
  });

  it("exposes no recent-impressions projection at all", () => {
    // Recent Impressions is deferred, so the shape it would need is absent.
    expect("recent" in passport).toBe(false);
  });

  it("orders a locality's impressions newest first", () => {
    const locality = passport.countries
      .flatMap((country) => country.localities)
      .find((candidate) => candidate.collections.length > 1);
    const dates = (locality?.collections ?? []).map(
      (collection) => collection.collectedOn,
    );

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
