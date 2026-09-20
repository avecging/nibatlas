import { describe, expect, it } from "vitest";
import { countryChoices, countryName, matchCountries } from "./countries";

describe("country choices", () => {
  it("offers the runtime's whole region set, not a five-country sample", () => {
    const choices = countryChoices();
    expect(choices.length).toBeGreaterThan(150);
    for (const code of ["SG", "JP", "TW", "MY", "KR", "GB", "BR", "ZA"])
      expect(choices.some((c) => c.code === code)).toBe(true);
  });

  it("names each choice and keeps its code", () => {
    const singapore = countryChoices().find((c) => c.code === "SG")!;
    expect(singapore.name).toBe("Singapore");
    expect(countryName("SG")).toBe("Singapore");
    expect(countryName("JP")).toBe("Japan");
  });

  it("is sorted by name so the list reads alphabetically", () => {
    const names = countryChoices().map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("offers no entry the runtime cannot name", () => {
    expect(countryChoices().every((c) => c.name && c.name !== c.code)).toBe(true);
    expect(countryChoices().some((c) => c.code === "ZZ")).toBe(false);
  });

  it("returns an unknown or malformed code unchanged rather than guessing", () => {
    expect(countryName("ZZ")).toBe("ZZ");
    expect(countryName("sg")).toBe("sg");
    expect(countryName("XYZ")).toBe("XYZ");
    expect(countryName("")).toBe("");
  });
});

describe("country search", () => {
  it("finds a country by name or code", () => {
    expect(matchCountries("japan")[0]?.code).toBe("JP");
    expect(matchCountries("JP")[0]?.code).toBe("JP");
    expect(matchCountries("singa")[0]?.code).toBe("SG");
  });

  it("ranks an exact code above a name that merely contains the letters", () => {
    expect(matchCountries("in")[0]?.code).toBe("IN");
  });

  it("is case-insensitive", () => {
    expect(matchCountries("TAIWAN")[0]?.code).toBe("TW");
    expect(matchCountries("taiwan")[0]?.code).toBe("TW");
  });

  it("returns nothing rather than a wrong guess", () => {
    expect(matchCountries("zzzz-no-such-country")).toEqual([]);
  });

  it("bounds its result so a phone never renders the whole world at once", () => {
    expect(matchCountries("").length).toBeLessThanOrEqual(60);
  });
});
