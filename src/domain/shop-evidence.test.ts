import { describe, expect, it } from "vitest";

import type { ShopDetail } from "@/src/domain/shop-detail";
import { hasSourcedValueLayer, shopEvidenceIssues } from "@/src/domain/shop-evidence";
import { shopValueSpecimen } from "@/src/fixtures/shop-value-specimen";

const SOURCE = shopValueSpecimen.sources[0]!.label;

/**
 * The specimen with claims replaced, or removed by passing `undefined`.
 *
 * `exactOptionalPropertyTypes` treats an explicit `undefined` as distinct from an
 * absent key, and a spread cannot express "drop this key". The cast is confined
 * to this helper; every assertion below still reads a real `ShopDetail`.
 */
type ShopOverrides = {
  readonly [K in keyof ShopDetail]?: ShopDetail[K] | undefined;
};

function withClaims(patch: ShopOverrides): ShopDetail {
  return { ...shopValueSpecimen, ...patch } as ShopDetail;
}

describe("shopEvidenceIssues", () => {
  it("accepts a record whose every claim names one of its own sources", () => {
    // The specimen carries a service, an experience, an exclusive, an access
    // block and a practical block, all pointing at its single source.
    expect(shopEvidenceIssues(shopValueSpecimen)).toEqual([]);
  });

  it("rejects a claim whose source is not on the record", () => {
    const shop = withClaims({
      services: [
        { label: "Nib grinding", confirmedBy: "A source nobody attached" },
      ],
    });

    expect(shopEvidenceIssues(shop)).toEqual([
      {
        path: "services[0]",
        claim: "Nib grinding",
        confirmedBy: "A source nobody attached",
      },
    ]);
  });

  it("names the position of the claim, so a failure is findable", () => {
    const shop = withClaims({
      services: [
        { label: "Fine", confirmedBy: SOURCE },
        { label: "Broken", confirmedBy: "missing" },
      ],
      experiences: [{ label: "Also broken", confirmedBy: "missing" }],
      exclusives: [{ label: "Broken too", confirmedBy: "missing" }],
    });

    expect(shopEvidenceIssues(shop).map((issue) => issue.path)).toEqual([
      "services[1]",
      "experiences[0]",
      "exclusives[0]",
    ]);
  });

  it("checks the access and practical blocks, and describes them legibly", () => {
    const shop = withClaims({
      services: undefined,
      experiences: undefined,
      exclusives: undefined,
      access: { nearestStation: "Somewhere", confirmedBy: "missing" },
      practical: { languages: ["English"], confirmedBy: "missing" },
    });

    expect(shopEvidenceIssues(shop)).toEqual([
      { path: "access", claim: "Somewhere", confirmedBy: "missing" },
      { path: "practical", claim: "English", confirmedBy: "missing" },
    ]);
  });

  it("has nothing to check on a record with no pen-specific claims", () => {
    const bare = withClaims({
      services: undefined,
      experiences: undefined,
      exclusives: undefined,
      access: undefined,
      practical: undefined,
    });

    expect(shopEvidenceIssues(bare)).toEqual([]);
  });
});

describe("hasSourcedValueLayer", () => {
  it("is true when the record answers what you can do there", () => {
    expect(hasSourcedValueLayer(shopValueSpecimen)).toBe(true);
  });

  it("is true on an exclusive alone — that is a reason to travel by itself", () => {
    const shop = withClaims({
      services: undefined,
      experiences: undefined,
      exclusives: [{ label: "House ink", confirmedBy: SOURCE }],
    });

    expect(hasSourcedValueLayer(shop)).toBe(true);
  });

  it("is false when only ordinary directory fields are known", () => {
    // An address, hours and a brand list do not answer the question the section
    // exists to answer, so this is the gap state.
    const shop = withClaims({
      services: undefined,
      experiences: undefined,
      exclusives: undefined,
      brands: ["Sailor"],
    });

    expect(hasSourcedValueLayer(shop)).toBe(false);
  });

  it("does not count an empty list as an answer", () => {
    const shop = withClaims({ services: [], experiences: [], exclusives: [] });

    expect(hasSourcedValueLayer(shop)).toBe(false);
  });
});
