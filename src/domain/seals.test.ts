import { describe, expect, it } from "vitest";

import type { StampCollection } from "@/src/domain/passport";
import {
  COUNTRY_SEAL_STAMP_THRESHOLD,
  countrySealFor,
  countrySealRequirement,
  deriveSeals,
  localitySealFor,
  type CountryCoverageSet,
  type SealDesignInput,
} from "@/src/domain/seals";
import { STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";
import type { ShopStampDesign } from "@/src/domain/shop-detail";

function designSeal(input: SealDesignInput): ShopStampDesign {
  return {
    id: input.key,
    tier: input.scope,
    motif: "arcade",
    ink: "teal",
    localityLabel: input.localityName ?? input.countryLabel,
    countryLabel: input.countryLabel,
    designVersion: 1,
    paletteVersion: STAMP_PALETTE_VERSION,
  };
}

function collection(
  slug: string,
  localitySlug: string,
  collectedOn: string,
  countryCode: "JP" | "SG" | "TW" = "JP",
): StampCollection {
  return {
    id: `collection-${slug}`,
    shopId: `shop-${slug}`,
    shopSlug: slug,
    shopNameSnapshot: slug,
    collectedOn,
    shopTimezone: "Asia/Tokyo",
    countryCode,
    countryLabel: countryCode === "JP" ? "Japan" : countryCode === "SG" ? "Singapore" : "Taiwan",
    localityName: localitySlug,
    localitySlug,
    stamp: designSeal({
      scope: "locality",
      countryCode,
      countryLabel: "Japan",
      key: `stamp-${slug}`,
    }),
    simulated: true,
  };
}

const wideSet: CountryCoverageSet = {
  countryCode: "JP",
  version: "jp-1",
  eligibleShopIds: [
    "shop-a",
    "shop-b",
    "shop-c",
    "shop-d",
    "shop-e",
    "shop-f",
    "shop-g",
  ],
};

const smallSet: CountryCoverageSet = {
  countryCode: "SG",
  version: "sg-1",
  eligibleShopIds: ["shop-s1", "shop-s2"],
};

describe("countrySealRequirement", () => {
  it("asks for five stamps when the curated set is at least that large", () => {
    expect(countrySealRequirement(wideSet)).toEqual({
      required: COUNTRY_SEAL_STAMP_THRESHOLD,
      fromCuratedSet: false,
    });
  });

  it("asks for the whole curated set when it holds fewer than five shops", () => {
    expect(countrySealRequirement(smallSet)).toEqual({
      required: 2,
      fromCuratedSet: true,
    });
  });

  it("falls back to five when no curated set is defined", () => {
    expect(countrySealRequirement(undefined)).toEqual({
      required: COUNTRY_SEAL_STAMP_THRESHOLD,
      fromCuratedSet: false,
    });
  });

  it("falls back to five when the curated set is empty", () => {
    // Otherwise `required` would be 0 and the set would read as already complete.
    expect(
      countrySealRequirement({
        countryCode: "TW",
        version: "tw-empty",
        eligibleShopIds: [],
      }),
    ).toEqual({ required: COUNTRY_SEAL_STAMP_THRESHOLD, fromCuratedSet: false });
  });
});

describe("deriveSeals", () => {
  it("derives a locality seal from the first verified stamp there", () => {
    const { seals } = deriveSeals({
      collections: [
        collection("second", "ginza", "2026-03-20"),
        collection("first", "ginza", "2026-03-14"),
      ],
      coverageSets: [wideSet],
      designSeal,
    });

    const seal = localitySealFor(seals, "JP", "ginza");

    expect(seal).toBeDefined();
    // The earlier visit derived it, not the first one in the input array.
    expect(seal?.earnedOn).toBe("2026-03-14");
    expect(seal?.derivedFromShopId).toBe("shop-first");
    expect(seals.filter((candidate) => candidate.scope === "locality")).toHaveLength(1);
  });

  it("derives one locality seal per locality", () => {
    const { seals } = deriveSeals({
      collections: [
        collection("a", "ginza", "2026-03-14"),
        collection("b", "kobe", "2026-03-16"),
      ],
      coverageSets: [wideSet],
      designSeal,
    });

    expect(seals.filter((seal) => seal.scope === "locality")).toHaveLength(2);
  });

  it("withholds a country seal below the requirement", () => {
    const { seals, countryProgress } = deriveSeals({
      collections: [
        collection("a", "ginza", "2026-03-14"),
        collection("b", "kobe", "2026-03-16"),
      ],
      coverageSets: [wideSet],
      designSeal,
    });

    expect(countrySealFor(seals, "JP")).toBeUndefined();
    expect(countryProgress[0]).toMatchObject({
      countryCode: "JP",
      stampCount: 2,
      required: 5,
      progressCount: 2,
      eligibleCollected: 2,
      eligibleTotal: 7,
      earned: false,
      requirementFromCuratedSet: false,
      coverageSetVersion: "jp-1",
    });
  });

  it("derives a country seal at five stamps, dated by the stamp that reached it", () => {
    const { seals } = deriveSeals({
      collections: [
        collection("a", "ginza", "2026-03-10"),
        collection("b", "ginza", "2026-03-11"),
        collection("c", "kobe", "2026-03-12"),
        collection("d", "kobe", "2026-03-13"),
        collection("e", "naka", "2026-03-14"),
        collection("f", "naka", "2026-03-15"),
      ],
      coverageSets: [wideSet],
      designSeal,
    });

    const seal = countrySealFor(seals, "JP");

    expect(seal?.earnedOn).toBe("2026-03-14");
    expect(seal?.coverageSetVersion).toBe("jp-1");
  });

  it("derives a country seal on completing a curated set smaller than five", () => {
    const { seals, countryProgress } = deriveSeals({
      collections: [
        collection("s1", "singapore", "2026-06-02", "SG"),
        collection("s2", "singapore", "2026-06-03", "SG"),
      ],
      coverageSets: [smallSet],
      designSeal,
    });

    expect(countrySealFor(seals, "SG")?.earnedOn).toBe("2026-06-03");
    expect(countryProgress[0]).toMatchObject({
      required: 2,
      requirementFromCuratedSet: true,
      earned: true,
      stampCount: 2,
      eligibleCollected: 2,
      eligibleTotal: 2,
      progressCount: 2,
    });
  });

  it("requires the eligible shops themselves, not merely that many stamps", () => {
    /*
     * The curated set holds two specific shops. Two stamps from elsewhere in the
     * same country are two stamps, but they do not complete the set — and two is
     * below the independent five-stamp rule, so no country seal is due.
     */
    const { seals, countryProgress } = deriveSeals({
      collections: [
        collection("outsider-1", "singapore", "2026-06-02", "SG"),
        collection("outsider-2", "singapore", "2026-06-03", "SG"),
      ],
      coverageSets: [smallSet],
      designSeal,
    });

    expect(countrySealFor(seals, "SG")).toBeUndefined();
    expect(countryProgress[0]).toMatchObject({
      required: 2,
      requirementFromCuratedSet: true,
      earned: false,
      stampCount: 2,
      eligibleCollected: 0,
      eligibleTotal: 2,
      progressCount: 0,
    });
  });

  it("completes a small curated set from a mixture of eligible and other shops", () => {
    const { seals, countryProgress } = deriveSeals({
      collections: [
        collection("outsider", "singapore", "2026-06-01", "SG"),
        collection("s1", "singapore", "2026-06-02", "SG"),
        collection("s2", "singapore", "2026-06-04", "SG"),
      ],
      coverageSets: [smallSet],
      designSeal,
    });

    // Derived by the stamp that completed the set, not by the third stamp overall.
    expect(countrySealFor(seals, "SG")?.earnedOn).toBe("2026-06-04");
    expect(countryProgress[0]).toMatchObject({
      stampCount: 3,
      eligibleCollected: 2,
      progressCount: 2,
      earned: true,
    });
  });

  it("still honours the five-stamp rule where the curated set is small", () => {
    // Five ineligible stamps satisfy rule one on their own.
    const { seals, countryProgress } = deriveSeals({
      collections: [
        collection("o1", "singapore", "2026-06-01", "SG"),
        collection("o2", "singapore", "2026-06-02", "SG"),
        collection("o3", "singapore", "2026-06-03", "SG"),
        collection("o4", "singapore", "2026-06-04", "SG"),
        collection("o5", "singapore", "2026-06-05", "SG"),
      ],
      coverageSets: [smallSet],
      designSeal,
    });

    expect(countrySealFor(seals, "SG")?.earnedOn).toBe("2026-06-05");
    expect(countryProgress[0]).toMatchObject({ earned: true, eligibleCollected: 0 });
  });

  it("awards nothing from an empty curated set", () => {
    const { seals, countryProgress } = deriveSeals({
      collections: [collection("t1", "tainan", "2026-03-19", "TW")],
      coverageSets: [{ countryCode: "TW", version: "tw-empty", eligibleShopIds: [] }],
      designSeal,
    });

    expect(countrySealFor(seals, "TW")).toBeUndefined();
    expect(countryProgress[0]).toMatchObject({
      required: COUNTRY_SEAL_STAMP_THRESHOLD,
      requirementFromCuratedSet: false,
      eligibleTotal: 0,
      progressCount: 1,
      earned: false,
    });
  });

  it("never revokes a seal when the curated set later expands", () => {
    const collections = [
      collection("s1", "singapore", "2026-06-02", "SG"),
      collection("s2", "singapore", "2026-06-03", "SG"),
    ];

    const earned = deriveSeals({
      collections,
      coverageSets: [smallSet],
      designSeal,
    });

    const expandedSet: CountryCoverageSet = {
      countryCode: "SG",
      version: "sg-2",
      eligibleShopIds: [
        "shop-s1",
        "shop-s2",
        "shop-s3",
        "shop-s4",
        "shop-s5",
        "shop-s6",
      ],
    };

    const later = deriveSeals({
      collections,
      coverageSets: [expandedSet],
      alreadyEarned: earned.seals,
      designSeal,
    });

    const seal = countrySealFor(later.seals, "SG");

    expect(seal).toBeDefined();
    // The version recorded at the moment it was earned survives the expansion.
    expect(seal?.coverageSetVersion).toBe("sg-1");
    expect(seal?.earnedOn).toBe("2026-06-03");
    expect(
      later.countryProgress.find((progress) => progress.countryCode === "SG")?.earned,
    ).toBe(true);
  });

  it("keeps an earned seal even when its deriving shop leaves the collection", () => {
    const earned = deriveSeals({
      collections: [
        collection("s1", "singapore", "2026-06-02", "SG"),
        collection("s2", "singapore", "2026-06-03", "SG"),
      ],
      coverageSets: [smallSet],
      designSeal,
    });

    const later = deriveSeals({
      collections: [],
      coverageSets: [smallSet],
      alreadyEarned: earned.seals,
      designSeal,
    });

    expect(countrySealFor(later.seals, "SG")).toBeDefined();
    expect(localitySealFor(later.seals, "SG", "singapore")).toBeDefined();
    expect(
      later.countryProgress.find((progress) => progress.countryCode === "SG"),
    ).toMatchObject({ earned: true, stampCount: 0 });
  });

  it("derives nothing from an empty collection", () => {
    const { seals, countryProgress } = deriveSeals({
      collections: [],
      coverageSets: [wideSet, smallSet],
      designSeal,
    });

    expect(seals).toEqual([]);
    expect(countryProgress).toEqual([]);
  });
});
