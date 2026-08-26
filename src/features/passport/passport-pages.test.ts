import { describe, expect, it } from "vitest";

import { buildPassport } from "@/src/domain/passport";
import { deriveSeals } from "@/src/domain/seals";
import { designSeal, prototypeCoverageSets } from "@/src/fixtures/prototype-catalogue";
import { prototypeSeedCollections } from "@/src/fixtures/prototype-passport";
import {
  buildPassportPages,
  pageIndexForLocality,
  pageIndexForShop,
  STAMPS_PER_PAGE,
} from "@/src/features/passport/passport-pages";

function build() {
  const passport = buildPassport(prototypeSeedCollections);
  const { seals, countryProgress } = deriveSeals({
    collections: prototypeSeedCollections,
    coverageSets: prototypeCoverageSets,
    designSeal,
  });

  return buildPassportPages({ passport, seals, countryProgress });
}

describe("buildPassportPages", () => {
  const pages = build();

  it("opens on the identity page and follows it with the seals page", () => {
    expect(pages[0]?.kind).toBe("identity");
    expect(pages[1]?.kind).toBe("seals");
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

  it("still produces a readable book with nothing collected", () => {
    const empty = buildPassportPages({
      passport: buildPassport([]),
      seals: [],
      countryProgress: [],
    });

    expect(empty.length % 2).toBe(0);
    expect(empty[0]?.kind).toBe("identity");
    expect(empty.some((page) => page.kind === "locality")).toBe(false);
  });
});
