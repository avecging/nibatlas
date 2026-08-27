import { describe, expect, it } from "vitest";

import { buildPassport } from "@/src/domain/passport";
import { deriveSeals } from "@/src/domain/seals";
import { designSeal, prototypeCoverageSets } from "@/src/fixtures/prototype-catalogue";
import { prototypeSeedCollections } from "@/src/fixtures/prototype-passport";
import type { StampCollection } from "@/src/domain/passport";
import {
  buildPassportPages,
  IDENTITY_PAGE_INDEX,
  INDEX_PAGE_INDEX,
  OPENING_PAGE_INDEX,
  pageIndexForCollection,
  pageIndexForCountry,
  pageIndexForLocality,
  pageIndexForPlace,
  pageIndexForShop,
  placeForPage,
  SEALS_PAGE_INDEX,
  STAMPS_PER_PAGE,
} from "@/src/features/passport/passport-pages";

function build(displayName: string | null = null) {
  const passport = buildPassport(prototypeSeedCollections);
  const { seals, countryProgress } = deriveSeals({
    collections: prototypeSeedCollections,
    coverageSets: prototypeCoverageSets,
    designSeal,
  });

  return buildPassportPages({ passport, seals, countryProgress, displayName });
}

describe("buildPassportPages", () => {
  const pages = build();

  it("keeps identity and contents as front matter, not as the opening spread", () => {
    expect(pages[IDENTITY_PAGE_INDEX]?.kind).toBe("identity");
    expect(pages[INDEX_PAGE_INDEX]?.kind).toBe("index");
  });

  it("opens on country seals facing the most recently collected locality", () => {
    // The seed's newest impression is Fook Hing Trading in Singapore on
    // 2026-06-03, so Singapore's locality is the right-hand page.
    expect(pages[SEALS_PAGE_INDEX]?.kind).toBe("seals");

    const opening = pages[OPENING_PAGE_INDEX];

    expect(opening?.kind).toBe("locality");
    expect(opening?.kind === "locality" ? opening.countryCode : null).toBe("SG");
    expect(
      opening?.kind === "locality"
        ? opening.collections[0]?.shopSlug
        : null,
    ).toBe("fook-hing-trading");
  });

  it("orders locality pages newest first, the way a passport fills up", () => {
    const dates = pages
      .filter((page) => page.kind === "locality")
      .map((page) =>
        page.kind === "locality" ? (page.collections[0]?.collectedOn ?? "") : "",
      );

    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("shows the reader's display name, and Your Passport without one", () => {
    const named = build("Ada Lovelace")[IDENTITY_PAGE_INDEX];
    const anonymous = pages[IDENTITY_PAGE_INDEX];

    expect(named?.kind === "identity" ? named.displayName : "").toBe("Ada Lovelace");
    expect(anonymous?.kind === "identity" ? anonymous.displayName : "x").toBeNull();
  });

  it("indexes every collected country and locality with its own page", () => {
    const index = pages[INDEX_PAGE_INDEX];

    expect(index?.kind).toBe("index");

    if (index?.kind !== "index") {
      return;
    }

    expect(index.countries).toHaveLength(3);

    for (const country of index.countries) {
      expect(pages[country.pageIndex]?.kind).toBe("locality");

      for (const locality of country.localities) {
        const page = pages[locality.pageIndex];

        expect(page?.kind).toBe("locality");
        expect(page?.kind === "locality" ? page.localitySlug : null).toBe(
          locality.slug,
        );
      }
    }
  });

  it("counts the country seal separately from the countries it indexes", () => {
    const index = pages[INDEX_PAGE_INDEX];
    const earned =
      index?.kind === "index"
        ? index.countries.filter((country) => country.sealEarned)
        : [];

    // Three countries are visited; only Singapore's curated set is complete.
    expect(earned.map((country) => country.countryCode)).toEqual(["SG"]);
  });

  it("keeps an even page count so no spread is left half-open", () => {
    expect(pages.length % 2).toBe(0);
  });

  it("ends on a page with room for the next impression", () => {
    expect(pages[pages.length - 1]?.kind).toBe("blank");
  });

  it("numbers pages in order from one", () => {
    pages.forEach((page, index) => {
      expect(page.number).toBe(index + 1);
    });
  });

  it("gives each collected locality at least one page", () => {
    const localities = new Set(
      prototypeSeedCollections.map(
        (collection) => `${collection.countryCode}:${collection.localitySlug}`,
      ),
    );

    const paged = new Set(
      pages
        .filter((page) => page.kind === "locality")
        .map((page) =>
          page.kind === "locality" ? `${page.countryCode}:${page.localitySlug}` : "",
        ),
    );

    for (const key of localities) {
      expect(paged).toContain(key);
    }
  });

  it("puts the locality seal on the locality's first page only", () => {
    const localityPages = pages.filter((page) => page.kind === "locality");

    for (const page of localityPages) {
      if (page.kind !== "locality") {
        continue;
      }

      if (page.continued) {
        expect(page.seal).toBeUndefined();
      }
    }
  });

  it("never puts more than four impressions on a page", () => {
    for (const page of pages) {
      if (page.kind === "locality") {
        expect(page.collections.length).toBeLessThanOrEqual(STAMPS_PER_PAGE);
      }
    }
  });

  it("has no page that lists recent impressions", () => {
    for (const page of pages) {
      expect(page.runningHead.toLowerCase()).not.toContain("recent");
    }
  });

  it("locates the page holding a given shop's impression", () => {
    const index = pageIndexForShop(pages, "ginza-itoya-main-store");

    expect(index).not.toBeNull();

    const page = pages[index as number];

    expect(page?.kind).toBe("locality");
    expect(
      page?.kind === "locality"
        ? page.collections.some(
            (collection) => collection.shopSlug === "ginza-itoya-main-store",
          )
        : false,
    ).toBe(true);
  });

  it("locates a locality's first page", () => {
    const index = pageIndexForLocality(pages, "TW", "east-tainan");

    expect(index).not.toBeNull();
    expect(pages[index as number]?.runningHead).toBe("East District, Tainan");
  });

  it("returns null for something the Passport does not hold", () => {
    expect(pageIndexForShop(pages, "not-a-shop")).toBeNull();
    expect(pageIndexForLocality(pages, "JP", "nowhere")).toBeNull();
  });

  it("locates a country's first page", () => {
    const index = pageIndexForCountry(pages, "JP");

    expect(index).not.toBeNull();
    expect(pages[index as number]?.kind).toBe("locality");
    expect(
      pages[index as number]?.kind === "locality"
        ? (pages[index as number] as { readonly countryCode: string }).countryCode
        : null,
    ).toBe("JP");
  });

  it("still produces a readable book with nothing collected", () => {
    const empty = buildPassportPages({
      passport: buildPassport([]),
      seals: [],
      countryProgress: [],
    });

    expect(empty.length % 2).toBe(0);
    expect(empty[IDENTITY_PAGE_INDEX]?.kind).toBe("identity");
    expect(empty.some((page) => page.kind === "locality")).toBe(false);
  });
});

describe("remembering a place in the book", () => {
  const pages = build();

  it("describes a page as content rather than as a page number", () => {
    expect(placeForPage(pages[SEALS_PAGE_INDEX])).toEqual({ kind: "seals" });
    expect(placeForPage(pages[IDENTITY_PAGE_INDEX])).toEqual({ kind: "front" });
    expect(placeForPage(pages[INDEX_PAGE_INDEX])).toEqual({ kind: "front" });
    expect(placeForPage(pages[OPENING_PAGE_INDEX])).toMatchObject({
      kind: "locality",
      countryCode: "SG",
    });
  });

  it("has no place for the blank end page or for nothing", () => {
    expect(placeForPage(pages[pages.length - 1])).toBeNull();
    expect(placeForPage(undefined)).toBeNull();
  });

  it("resolves a remembered locality back to its page", () => {
    const place = placeForPage(pages[OPENING_PAGE_INDEX]);

    expect(pageIndexForPlace(pages, place)).toBe(OPENING_PAGE_INDEX);
  });

  it("resolves the front matter and the seals page by kind", () => {
    expect(pageIndexForPlace(pages, { kind: "front" })).toBe(INDEX_PAGE_INDEX);
    expect(pageIndexForPlace(pages, { kind: "seals" })).toBe(SEALS_PAGE_INDEX);
  });

  it("returns nothing for a locality the collection no longer holds", () => {
    // The case that matters: a record written before the reader cleared their
    // data, or one carried over from the other mode's collection.
    expect(
      pageIndexForPlace(pages, {
        kind: "locality",
        countryCode: "JP",
        localitySlug: "nowhere",
      }),
    ).toBeNull();
    expect(pageIndexForPlace(pages, null)).toBeNull();
  });
});

/**
 * A locality that spans more than one page.
 *
 * The catalogue has no locality with more than two shops, and the behaviour under
 * test only exists past `STAMPS_PER_PAGE`. Six seeded impressions are gathered
 * into one locality, with descending dates so the newest-first order — and
 * therefore the page split — is fixed.
 */
const PAGED_COUNTRY = "JP" as const;
const PAGED_SLUG = "one-locality";

function pagedCollections(): readonly StampCollection[] {
  return prototypeSeedCollections
    .concat(prototypeSeedCollections)
    .slice(0, STAMPS_PER_PAGE + 2)
    .map((collection, index) => ({
      ...collection,
      id: `paged-${index}`,
      shopId: `paged-shop-${index}`,
      shopSlug: `paged-shop-${index}`,
      collectedOn: `2026-05-0${6 - index}`,
      countryCode: PAGED_COUNTRY,
      countryLabel: "Japan",
      localityName: "One Locality",
      localitySlug: PAGED_SLUG,
    }));
}

function pagedPages() {
  const collections = pagedCollections();
  const passport = buildPassport(collections);
  const { seals, countryProgress } = deriveSeals({
    collections,
    coverageSets: prototypeCoverageSets,
    designSeal,
  });

  return buildPassportPages({ passport, seals, countryProgress });
}

describe("a locality that spans more than one page", () => {
  const pages = pagedPages();
  const localityPages = pages.filter((page) => page.kind === "locality");

  it("splits into a first page and a continuation page", () => {
    expect(localityPages).toHaveLength(2);
    expect(
      localityPages[0]?.kind === "locality" ? localityPages[0].continued : true,
    ).toBe(false);
    expect(
      localityPages[1]?.kind === "locality" ? localityPages[1].continued : false,
    ).toBe(true);
  });

  it("anchors each page to an impression that is on it", () => {
    for (const page of localityPages) {
      if (page.kind !== "locality") {
        continue;
      }

      const place = placeForPage(page);

      expect(place).toMatchObject({
        kind: "locality",
        countryCode: PAGED_COUNTRY,
        localitySlug: PAGED_SLUG,
        collectionId: page.collections[0]?.id,
      });
    }

    // And the two anchors differ, which is the whole point.
    const first = placeForPage(localityPages[0]);
    const second = placeForPage(localityPages[1]);

    expect(first).not.toEqual(second);
  });

  it("resolves a continuation page back to itself, not to the first page", () => {
    const continuationIndex = pages.findIndex(
      (page) => page.kind === "locality" && page.continued,
    );
    const place = placeForPage(pages[continuationIndex]);

    expect(pageIndexForPlace(pages, place)).toBe(continuationIndex);
  });

  it("resolves an anchor to whichever page holds that impression", () => {
    for (const page of localityPages) {
      if (page.kind !== "locality") {
        continue;
      }

      for (const collection of page.collections) {
        expect(pages[pageIndexForCollection(pages, collection.id) as number]).toBe(
          page,
        );
      }
    }
  });

  it("falls back to the first page for a record written without an anchor", () => {
    // Every WP3 record stored before the anchor existed looks like this.
    const legacy = pageIndexForPlace(pages, {
      kind: "locality",
      countryCode: PAGED_COUNTRY,
      localitySlug: PAGED_SLUG,
    });

    expect(legacy).toBe(pageIndexForLocality(pages, PAGED_COUNTRY, PAGED_SLUG));
    expect(
      pages[legacy as number]?.kind === "locality"
        ? (pages[legacy as number] as { readonly continued: boolean }).continued
        : true,
    ).toBe(false);
  });

  it("falls back to the first page when the impression no longer exists", () => {
    expect(
      pageIndexForPlace(pages, {
        kind: "locality",
        countryCode: PAGED_COUNTRY,
        localitySlug: PAGED_SLUG,
        collectionId: "collection-that-was-cleared",
      }),
    ).toBe(pageIndexForLocality(pages, PAGED_COUNTRY, PAGED_SLUG));
  });

  it("refuses an anchor that belongs to a different locality", () => {
    // A record carried across from the other audience's collection, or a
    // hand-edited one. The locality it was recorded under still decides.
    expect(
      pageIndexForPlace(pages, {
        kind: "locality",
        countryCode: PAGED_COUNTRY,
        localitySlug: "somewhere-else",
        collectionId: "paged-0",
      }),
    ).toBeNull();
  });

  it("returns nothing for an anchor with no locality at all", () => {
    expect(pageIndexForCollection(pages, "not-a-collection")).toBeNull();
  });
});
