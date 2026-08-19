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
}

export interface PassportCountry {
  readonly countryCode: CountryCode;
  readonly countryLabel: string;
  readonly slug: string;
  readonly localities: readonly PassportLocality[];
  readonly stampCount: number;
}

export interface PassportOverview {
  readonly stampCount: number;
  readonly countryCount: number;
  readonly localityCount: number;
  readonly countries: readonly PassportCountry[];
  readonly recent: readonly StampCollection[];
}

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
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        countryCode,
        countryLabel: countryCollections[0]?.countryLabel ?? countryCode,
        slug: countrySlug(countryCode),
        localities: localityViews,
        stampCount: countryCollections.length,
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
    recent: ordered.slice(0, 4),
  };
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
