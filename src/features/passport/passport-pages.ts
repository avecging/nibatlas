import type { CountryCode } from "@/src/domain/geo";
import {
  countriesByRecency,
  localitiesByRecency,
  type PassportOverview,
  type StampCollection,
} from "@/src/domain/passport";
import type { CountrySealProgress, EarnedSeal } from "@/src/domain/seals";
import type { PassportPlace } from "@/src/features/passport/passport-view-state";

/**
 * The Passport's logical pages.
 *
 * The book is a presentation of this list, never the other way round: the pages
 * are ordinary semantic content, and the 3D treatment renders whichever ones are
 * currently on screen. A reader with 3D transforms unavailable, reduced motion
 * on, or a screen reader gets the same pages in the same order.
 *
 * ## Order, and why it changed in WP3
 *
 * Milestone 1 opened on identity and seals, so a reader with six stamps opened
 * their Passport and saw no stamps at all. The approved order puts content
 * first:
 *
 * ```
 *   0  identity   inside front cover — who the volume belongs to
 *   1  contents   the country / locality index
 *   2  seals      country seals
 *   3  locality   the most recently collected locality   ← opening spread
 *   4… locality   the rest, newest locality first
 *   n  blank      room for the next impression
 * ```
 *
 * {@link OPENING_PAGE_INDEX} is 3, so the opening spread is pages 2 and 3 —
 * country seals on the left, the most recent locality on the right — and the
 * front matter is one turn back, where a passport keeps it. Portrait reading
 * opens on page 3 as well, which is the same promise in one page: the reader's
 * newest impressions.
 *
 * Locality pages are ordered by recency rather than alphabetically, because a
 * passport fills up in the order it was stamped. List mode keeps the
 * alphabetical grouping `buildPassport` produces, which is also what Me shows.
 *
 * One Passport, one volume. The multiple-volume Library in
 * `docs/future/passport-library.md` is deliberately absent.
 */
export const STAMPS_PER_PAGE = 4;

/** Page indices of the fixed front matter. */
export const IDENTITY_PAGE_INDEX = 0;
export const INDEX_PAGE_INDEX = 1;
export const SEALS_PAGE_INDEX = 2;
/** First locality page, and the routine landing page. */
export const OPENING_PAGE_INDEX = 3;

export interface PassportIndexLocality {
  readonly slug: string;
  readonly name: string;
  readonly stampCount: number;
  /** Where the book has to open to show it. */
  readonly pageIndex: number;
  readonly sealEarned: boolean;
}

export interface PassportIndexCountry {
  readonly countryCode: CountryCode;
  readonly countryLabel: string;
  readonly slug: string;
  readonly stampCount: number;
  readonly sealEarned: boolean;
  readonly pageIndex: number;
  readonly localities: readonly PassportIndexLocality[];
}

export type PassportPage =
  | {
      readonly kind: "identity";
      readonly id: string;
      readonly number: number;
      readonly runningHead: string;
      readonly runningFoot: string;
      /** The reader's chosen name, or `null` for the Your Passport fallback. */
      readonly displayName: string | null;
      readonly stampCount: number;
      readonly countryCount: number;
      readonly localityCount: number;
      readonly paletteVersion: number | null;
    }
  | {
      readonly kind: "index";
      readonly id: string;
      readonly number: number;
      readonly runningHead: string;
      readonly runningFoot: string;
      readonly countries: readonly PassportIndexCountry[];
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
  /** From the account seam. `null` renders the Your Passport fallback. */
  readonly displayName?: string | null;
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
  displayName = null,
}: BuildPassportPagesOptions): readonly PassportPage[] {
  const localitySeals = seals.filter((seal) => seal.scope === "locality");
  const countrySeals = seals.filter((seal) => seal.scope === "country");
  const earnedCountries = new Set(countrySeals.map((seal) => seal.countryCode));

  /*
   * Locality pages are built first because the contents page has to name the
   * page each locality starts on, and page numbers only exist once the order
   * is fixed. The front matter is a constant three pages, so the first locality
   * page is always OPENING_PAGE_INDEX.
   */
  const localityPages: PassportPage[] = [];
  const indexCountries: PassportIndexCountry[] = [];

  for (const country of countriesByRecency(passport)) {
    const countryFirstPage = OPENING_PAGE_INDEX + localityPages.length;
    const indexLocalities: PassportIndexLocality[] = [];

    for (const locality of localitiesByRecency(country)) {
      const seal = localitySeals.find(
        (candidate) =>
          candidate.countryCode === country.countryCode &&
          candidate.localitySlug === locality.slug,
      );
      const localityFirstPage = OPENING_PAGE_INDEX + localityPages.length;

      chunk(locality.collections, STAMPS_PER_PAGE).forEach((group, groupIndex) => {
        localityPages.push({
          kind: "locality",
          id: `page-${country.slug}-${locality.slug}-${groupIndex}`,
          number: 0,
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

      indexLocalities.push({
        slug: locality.slug,
        name: locality.name,
        stampCount: locality.collections.length,
        pageIndex: localityFirstPage,
        sealEarned: seal !== undefined,
      });
    }

    indexCountries.push({
      countryCode: country.countryCode,
      countryLabel: country.countryLabel,
      slug: country.slug,
      stampCount: country.stampCount,
      sealEarned: earnedCountries.has(country.countryCode),
      pageIndex: countryFirstPage,
      localities: indexLocalities,
    });
  }

  const pages: PassportPage[] = [
    {
      kind: "identity",
      id: "page-identity",
      number: 0,
      runningHead: "Nib Atlas",
      runningFoot: "VOLUME I",
      displayName,
      stampCount: passport.stampCount,
      countryCount: passport.countryCount,
      localityCount: passport.localityCount,
      paletteVersion:
        passport.countries[0]?.localities[0]?.collections[0]?.stamp.paletteVersion ??
        null,
    },
    {
      kind: "index",
      id: "page-index",
      number: 0,
      runningHead: "Contents",
      runningFoot: "VOLUME I",
      countries: indexCountries,
    },
    {
      kind: "seals",
      id: "page-seals",
      number: 0,
      runningHead: "Seals",
      runningFoot: "DERIVED FROM VERIFIED VISITS",
      countries: countryProgress,
      countrySeals,
    },
    ...localityPages,
    // A book always ends on a fresh page: the next impression has somewhere to
    // go, and the spread never shows a dangling single leaf.
    {
      kind: "blank",
      id: "page-blank-end",
      number: 0,
      runningHead: "",
      runningFoot: "",
    },
  ];

  // Spreads pair pages two at a time, so an even count keeps the final spread
  // complete rather than leaving a half-open book.
  if (pages.length % 2 !== 0) {
    pages.push({
      kind: "blank",
      id: "page-blank-pad",
      number: 0,
      runningHead: "",
      runningFoot: "",
    });
  }

  // Numbered last and in one place, so an inserted page can never leave the
  // printed numbers disagreeing with the order.
  return pages.map((page, index) => ({ ...page, number: index + 1 }));
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

/**
 * Locates the page an impression sits on, by its collection id.
 *
 * The anchor that distinguishes a locality's continuation pages from each other.
 * `pageIndexForShop` answers the same question from a shop slug and is kept for
 * the return-from-shop path; this one takes the identifier the remembered place
 * actually stores.
 */
export function pageIndexForCollection(
  pages: readonly PassportPage[],
  collectionId: string,
): number | null {
  const index = pages.findIndex(
    (page) =>
      page.kind === "locality" &&
      page.collections.some((collection) => collection.id === collectionId),
  );

  return index === -1 ? null : index;
}

export function pageIndexForCountry(
  pages: readonly PassportPage[],
  countryCode: CountryCode,
): number | null {
  const index = pages.findIndex(
    (page) => page.kind === "locality" && page.countryCode === countryCode,
  );

  return index === -1 ? null : index;
}

/** What a page means, for remembering where the reader was. */
export function placeForPage(page: PassportPage | undefined): PassportPlace | null {
  if (!page) {
    return null;
  }

  if (page.kind === "locality") {
    /*
     * The first impression on the page anchors it.
     *
     * Country and locality alone cannot tell a locality's continuation pages
     * apart, so a reader on page two of Ginza would be returned to page one.
     * Every page holds a different set of impressions, so any one of them
     * identifies the page — the first is simply the stable choice. A page with
     * no impressions on it has nothing to anchor to and falls back to the
     * locality.
     */
    const anchor = page.collections[0]?.id;

    return {
      kind: "locality",
      countryCode: page.countryCode,
      localitySlug: page.localitySlug,
      ...(anchor === undefined ? {} : { collectionId: anchor }),
    };
  }

  if (page.kind === "seals") {
    return { kind: "seals" };
  }

  if (page.kind === "identity" || page.kind === "index") {
    return { kind: "front" };
  }

  // A blank end page is not a place worth returning to.
  return null;
}

/**
 * Turns a remembered place back into a page index.
 *
 * Returns `null` when the place no longer exists — a locality whose stamps were
 * cleared, or a record written against a different collection — so the caller
 * lands the reader on the opening spread instead of on a page that is not there.
 */
export function pageIndexForPlace(
  pages: readonly PassportPage[],
  place: PassportPlace | null,
): number | null {
  if (!place) {
    return null;
  }

  if (place.kind === "front") {
    return INDEX_PAGE_INDEX;
  }

  if (place.kind === "seals") {
    return SEALS_PAGE_INDEX;
  }

  const localityIndex = pageIndexForLocality(
    pages,
    place.countryCode as CountryCode,
    place.localitySlug,
  );

  if (place.collectionId === undefined) {
    // A record written before the anchor existed. The locality's first page is
    // the honest answer, not an error.
    return localityIndex;
  }

  const anchored = pageIndexForCollection(pages, place.collectionId);
  const anchoredPage = anchored === null ? undefined : pages[anchored];

  /*
   * The anchor has to agree with the locality it was recorded under. An
   * impression that has been re-collected, or a record carried across from the
   * other audience's collection, could otherwise send the reader to an
   * unrelated page. When it does not agree, the locality still does.
   */
  if (
    anchored !== null &&
    anchoredPage?.kind === "locality" &&
    anchoredPage.countryCode === place.countryCode &&
    anchoredPage.localitySlug === place.localitySlug
  ) {
    return anchored;
  }

  return localityIndex;
}
