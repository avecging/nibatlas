import type { CountryCode } from "@/src/domain/geo";
import type { ShopStampDesign } from "@/src/domain/shop-detail";

/**
 * Passport projections for Milestone 1.
 *
 * Collections are simulated in the browser. Milestone 5 replaces the source with
 * server-issued `stamp_collections` rows without changing these shapes.
 */
export interface StampCollection {
  readonly id: string;
  readonly shopId: string;
  readonly shopSlug: string;
  readonly shopNameSnapshot: string;
  readonly shopLocalNameSnapshot?: string;
  /** ISO date in the shop timezone, e.g. `2026-04-11`. */
  readonly collectedOn: string;
  readonly shopTimezone: string;
  readonly countryCode: CountryCode;
  readonly countryLabel: string;
  readonly localityName: string;
  readonly localitySlug: string;
  readonly stamp: ShopStampDesign;
  readonly simulated: true;
}

export interface PassportLocality {
  readonly slug: string;
  readonly name: string;
  readonly countryCode: CountryCode;
  readonly collections: readonly StampCollection[];
  /**
   * Local date of the newest impression here.
   *
   * The book fills up the way a passport does — the most recent locality first —
   * so page order needs a recency key that does not depend on the grouping
   * order below.
   */
  readonly mostRecentOn: string;
}

export interface PassportCountry {
  readonly countryCode: CountryCode;
  readonly countryLabel: string;
  readonly slug: string;
  readonly localities: readonly PassportLocality[];
  readonly stampCount: number;
  /** Local date of the newest impression anywhere in the country. */
  readonly mostRecentOn: string;
}

export interface PassportOverview {
  readonly stampCount: number;
  readonly countryCount: number;
  readonly localityCount: number;
  readonly countries: readonly PassportCountry[];
}

/*
 * There is no `recent` projection.
 *
 * Recent Impressions is deferred: the acceptance brief asks for it to be absent
 * because a running list of where someone has just been reads as tracking. The
 * shape is left out here so no surface can quietly reintroduce it.
 */

function byCollectedDesc(a: StampCollection, b: StampCollection): number {
  if (a.collectedOn === b.collectedOn) {
    return a.shopNameSnapshot.localeCompare(b.shopNameSnapshot);
  }

  return a.collectedOn < b.collectedOn ? 1 : -1;
}

export function countrySlug(countryCode: CountryCode): string {
  return countryCode.toLowerCase();
}

export function buildPassport(collections: readonly StampCollection[]): PassportOverview {
  const ordered = [...collections].sort(byCollectedDesc);
  const countries = new Map<CountryCode, StampCollection[]>();

  for (const collection of ordered) {
    const bucket = countries.get(collection.countryCode) ?? [];
    bucket.push(collection);
    countries.set(collection.countryCode, bucket);
  }

  const countryViews: PassportCountry[] = [...countries.entries()].map(
    ([countryCode, countryCollections]) => {
      const localities = new Map<string, StampCollection[]>();

      for (const collection of countryCollections) {
        const bucket = localities.get(collection.localitySlug) ?? [];
        bucket.push(collection);
        localities.set(collection.localitySlug, bucket);
      }

      const localityViews: PassportLocality[] = [...localities.entries()]
        .map(([slug, localityCollections]) => ({
          slug,
          name: localityCollections[0]?.localityName ?? slug,
          countryCode,
          collections: localityCollections,
          // `countryCollections` is already newest-first, and bucketing
          // preserves that, so the first entry is the newest.
          mostRecentOn: localityCollections[0]?.collectedOn ?? "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        countryCode,
        countryLabel: countryCollections[0]?.countryLabel ?? countryCode,
        slug: countrySlug(countryCode),
        localities: localityViews,
        stampCount: countryCollections.length,
        mostRecentOn: countryCollections[0]?.collectedOn ?? "",
      };
    },
  );

  countryViews.sort((a, b) => a.countryLabel.localeCompare(b.countryLabel));

  return {
    stampCount: ordered.length,
    countryCount: countryViews.length,
    localityCount: countryViews.reduce(
      (total, country) => total + country.localities.length,
      0,
    ),
    countries: countryViews,
  };
}

/**
 * Recency ordering, for the presentations that read chronologically.
 *
 * `buildPassport` groups alphabetically, which is what Me and List mode show
 * and what keeps those surfaces stable as the collection grows. The book is the
 * other case: a passport fills up in the order it was stamped, and WP3 requires
 * the most recently collected locality to be the opening spread's right-hand
 * page. Sorting a copy here keeps both true without either surface reordering
 * the other.
 *
 * The label tiebreak makes it total: two localities collected on the same date
 * always come out in the same order.
 */
export function byMostRecent<
  T extends { readonly mostRecentOn: string },
>(key: (value: T) => string) {
  return (a: T, b: T): number => {
    if (a.mostRecentOn !== b.mostRecentOn) {
      return a.mostRecentOn < b.mostRecentOn ? 1 : -1;
    }

    return key(a).localeCompare(key(b));
  };
}

export function countriesByRecency(
  passport: PassportOverview,
): readonly PassportCountry[] {
  return [...passport.countries].sort(
    byMostRecent<PassportCountry>((country) => country.countryLabel),
  );
}

export function localitiesByRecency(
  country: PassportCountry,
): readonly PassportLocality[] {
  return [...country.localities].sort(
    byMostRecent<PassportLocality>((locality) => locality.name),
  );
}

export function findPassportCountry(
  passport: PassportOverview,
  slug: string,
): PassportCountry | undefined {
  return passport.countries.find((country) => country.slug === slug.toLowerCase());
}

export function findPassportLocality(
  country: PassportCountry,
  slug: string,
): PassportLocality | undefined {
  return country.localities.find((locality) => locality.slug === slug.toLowerCase());
}
