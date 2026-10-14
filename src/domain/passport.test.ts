import { describe, expect, it } from "vitest";

import {
  buildPassport,
  countriesByRecency,
  findPassportCountry,
  findPassportLocality,
  localitiesByRecency,
} from "@/src/domain/passport";
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

  it("groups alphabetically, which is the order Me and List mode show", () => {
    const labels = passport.countries.map((country) => country.countryLabel);

    expect([...labels].sort()).toEqual(labels);

    for (const country of passport.countries) {
      const names = country.localities.map((locality) => locality.name);

      expect([...names].sort()).toEqual(names);
    }
  });

  it("carries a recency key so the book can fill up chronologically", () => {
    for (const country of passport.countries) {
      for (const locality of country.localities) {
        expect(locality.mostRecentOn).toBe(locality.collections[0]?.collectedOn);
      }

      expect(country.mostRecentOn).toBe(
        [...country.localities]
          .map((locality) => locality.mostRecentOn)
          .sort()
          .reverse()[0],
      );
    }
  });

  it("orders by recency without disturbing the grouping order", () => {
    const byRecency = countriesByRecency(passport);
    const dates = byRecency.map((country) => country.mostRecentOn);

    expect([...dates].sort().reverse()).toEqual(dates);
    // Singapore holds the newest impression in the seed.
    expect(byRecency[0]?.countryCode).toBe("SG");
    // The projection itself is untouched.
    expect(passport.countries[0]?.countryLabel).toBe("Japan");

    const japan = findPassportCountry(passport, "jp");
    const localityDates = localitiesByRecency(japan!).map(
      (locality) => locality.mostRecentOn,
    );

    expect([...localityDates].sort().reverse()).toEqual(localityDates);
  });

  it("breaks a recency tie on the label, so the order is total", () => {
    const sameDay = buildPassport([
      { ...prototypeSeedCollections[0]!, collectedOn: "2026-05-01" },
      { ...prototypeSeedCollections[2]!, collectedOn: "2026-05-01" },
      { ...prototypeSeedCollections[4]!, collectedOn: "2026-05-01" },
    ]);
    const once = countriesByRecency(sameDay).map((country) => country.countryLabel);
    const twice = countriesByRecency(sameDay).map((country) => country.countryLabel);

    expect(once).toEqual(twice);
    expect(once).toEqual([...once].sort());
  });

  it("is empty when nothing has been collected", () => {
    const empty = buildPassport([]);

    expect(empty.stampCount).toBe(0);
    expect(empty.countries).toEqual([]);
  });
});
