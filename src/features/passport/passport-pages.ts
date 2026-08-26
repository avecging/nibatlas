import type { CountryCode } from "@/src/domain/geo";
import type { PassportOverview, StampCollection } from "@/src/domain/passport";
import type { CountrySealProgress, EarnedSeal } from "@/src/domain/seals";

/**
 * The Passport's logical pages.
 *
 * The book is a presentation of this list, never the other way round: the pages
 * are ordinary semantic content, and the 3D treatment renders whichever ones are
 * currently on screen. A reader with 3D transforms unavailable, reduced motion
 * on, or a screen reader gets the same pages in the same order.
 *
 * One Passport, one volume. The multiple-volume Library in
 * `docs/future/passport-library.md` is deliberately absent.
 */
export const STAMPS_PER_PAGE = 4;

export type PassportPage =
  | {
      readonly kind: "identity";
      readonly id: string;
      readonly number: number;
      readonly runningHead: string;
      readonly runningFoot: string;
      readonly stampCount: number;
      readonly countryCount: number;
      readonly localityCount: number;
      readonly paletteVersion: number | null;
    }
  | {
      readonly kind: "seals";
      readonly id: string;
      readonly number: number;
      readonly runningHead: string;
      readonly runningFoot: string;
      readonly countries: readonly CountrySealProgress[];
      readonly countrySeals: readonly EarnedSeal[];
    }
  | {
      readonly kind: "locality";
      readonly id: string;
      readonly number: number;
      readonly runningHead: string;
      readonly runningFoot: string;
      readonly countryCode: CountryCode;
      readonly countryLabel: string;
      readonly localityName: string;
      readonly localitySlug: string;
      /** Present on a locality's first page only. */
      readonly seal?: EarnedSeal;
      readonly collections: readonly StampCollection[];
      readonly continued: boolean;
    }
  | {
      readonly kind: "blank";
      readonly id: string;
      readonly number: number;
      readonly runningHead: string;
      readonly runningFoot: string;
    };

export interface BuildPassportPagesOptions {
  readonly passport: PassportOverview;
  readonly seals: readonly EarnedSeal[];
  readonly countryProgress: readonly CountrySealProgress[];
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  if (items.length === 0) {
    return [[]];
  }

  const out: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }

  return out;
}

export function buildPassportPages({
  passport,
  seals,
  countryProgress,
}: BuildPassportPagesOptions): readonly PassportPage[] {
  const pages: PassportPage[] = [];
  const localitySeals = seals.filter((seal) => seal.scope === "locality");
  const countrySeals = seals.filter((seal) => seal.scope === "country");

  const nextNumber = () => pages.length + 1;

  pages.push({
    kind: "identity",
    id: "page-identity",
    number: nextNumber(),
    runningHead: "Nib Atlas",
    runningFoot: "PASSPORT OF IMPRESSIONS",
    stampCount: passport.stampCount,
    countryCount: passport.countryCount,
    localityCount: passport.localityCount,
    paletteVersion:
      passport.countries[0]?.localities[0]?.collections[0]?.stamp.paletteVersion ??
      null,
  });

  pages.push({
    kind: "seals",
    id: "page-seals",
    number: nextNumber(),
    runningHead: "Seals",
    runningFoot: "DERIVED FROM VERIFIED VISITS",
    countries: countryProgress,
    countrySeals,
  });

  for (const country of passport.countries) {
    for (const locality of country.localities) {
      const seal = localitySeals.find(
        (candidate) =>
          candidate.countryCode === country.countryCode &&
          candidate.localitySlug === locality.slug,
      );

      chunk(locality.collections, STAMPS_PER_PAGE).forEach((group, groupIndex) => {
        pages.push({
          kind: "locality",
          id: `page-${country.slug}-${locality.slug}-${groupIndex}`,
          number: nextNumber(),
          runningHead: locality.name,
          runningFoot: country.countryLabel.toUpperCase(),
          countryCode: country.countryCode,
          countryLabel: country.countryLabel,
          localityName: locality.name,
          localitySlug: locality.slug,
          ...(groupIndex === 0 && seal ? { seal } : {}),
          collections: group,
          continued: groupIndex > 0,
        });
      });
    }
  }

  // A book always ends on a fresh page: the next impression has somewhere to go,
  // and the spread never shows a dangling single leaf.
  pages.push({
    kind: "blank",
    id: "page-blank-end",
    number: nextNumber(),
    runningHead: "",
    runningFoot: "",
  });

  // Spreads pair pages two at a time, so an even count keeps the final spread
  // complete rather than leaving a half-open book.
  if (pages.length % 2 !== 0) {
    pages.push({
      kind: "blank",
      id: "page-blank-pad",
      number: nextNumber(),
      runningHead: "",
      runningFoot: "",
    });
  }

  return pages;
}

/**
 * Locates the page holding a shop's impression, so returning from that shop
 * reopens the Passport where the reader left it.
 */
export function pageIndexForShop(
  pages: readonly PassportPage[],
  shopSlug: string,
): number | null {
  const index = pages.findIndex(
    (page) =>
      page.kind === "locality" &&
      page.collections.some((collection) => collection.shopSlug === shopSlug),
  );

  return index === -1 ? null : index;
}

export function pageIndexForLocality(
  pages: readonly PassportPage[],
  countryCode: CountryCode,
  localitySlug: string,
): number | null {
  const index = pages.findIndex(
    (page) =>
      page.kind === "locality" &&
      page.countryCode === countryCode &&
      page.localitySlug === localitySlug,
  );

  return index === -1 ? null : index;
}
