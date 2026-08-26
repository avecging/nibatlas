import type { CountryCode } from "@/src/domain/geo";
import type { StampCollection } from "@/src/domain/passport";
import type { ShopStampDesign } from "@/src/domain/shop-detail";

/**
 * Derived geographic seals.
 *
 * Seals are never collected directly. They fall out of verified shop stamps, so
 * a future check-in feature can emit the same canonical verified-visit event
 * rather than becoming a second unlock system.
 *
 * The two rules, from `PRODUCT.md` and `BRAND.md`:
 *
 * - a locality seal derives from the first verified shop stamp in that locality;
 * - a country seal derives after five verified shop stamps in that country, or
 *   after the complete eligible curated set when that versioned set holds fewer
 *   than five shops.
 *
 * And the rule that shapes the whole module: once earned, a seal is never
 * revoked because the curated catalogue later expands.
 */
export const COUNTRY_SEAL_STAMP_THRESHOLD = 5;

/**
 * A versioned curated coverage set.
 *
 * `version` is what makes a country seal durable. The threshold that earned a
 * seal is computed from the set version recorded at the moment it was earned, so
 * adding shops to the catalogue afterwards cannot retroactively raise the bar.
 *
 * It is also the only thing that licenses an `x / y` count anywhere in the
 * interface. Without an explicit eligible set and version, the UI shows plain
 * counts and never a denominator.
 */
export interface CountryCoverageSet {
  readonly countryCode: CountryCode;
  readonly version: string;
  readonly eligibleShopIds: readonly string[];
}

export type SealScope = "locality" | "country";

export interface EarnedSeal {
  readonly id: string;
  readonly scope: SealScope;
  readonly countryCode: CountryCode;
  readonly countryLabel: string;
  /** Present for locality seals only. */
  readonly localitySlug?: string;
  readonly localityName?: string;
  /** Local date of the verified visit that derived the seal. */
  readonly earnedOn: string;
  /** The shop stamp whose collection derived it. */
  readonly derivedFromShopId: string;
  /** Coverage-set version in force when a country seal was earned. */
  readonly coverageSetVersion?: string;
  readonly stamp: ShopStampDesign;
}

/**
 * How close a country is to its seal, expressed only in terms an explicit
 * versioned set supports.
 */
export interface CountrySealProgress {
  readonly countryCode: CountryCode;
  readonly countryLabel: string;
  /** Every verified stamp in the country. The five-stamp rule's own metric. */
  readonly stampCount: number;
  /** Collected shops that are members of the curated eligible set. */
  readonly eligibleCollected: number;
  /** Size of the curated eligible set, or `null` when none is defined. */
  readonly eligibleTotal: number | null;
  /** `min(5, eligible set size)`. */
  readonly required: number;
  /**
   * The count that pairs with `required`, so the interface never has to work out
   * which rule is in force. Eligible members for a small curated set, total
   * verified stamps otherwise.
   */
  readonly progressCount: number;
  readonly coverageSetVersion: string | null;
  /**
   * True only when the requirement came from completing a curated set smaller
   * than five, which is the one case where the interface may say "complete".
   */
  readonly requirementFromCuratedSet: boolean;
  readonly earned: boolean;
}

export function countrySealRequirement(
  coverageSet: CountryCoverageSet | undefined,
): { readonly required: number; readonly fromCuratedSet: boolean } {
  // An empty curated set licenses nothing: without it, `required` would be 0 and
  // a country seal would be handed out before a single stamp was collected.
  if (
    !coverageSet ||
    coverageSet.eligibleShopIds.length === 0 ||
    coverageSet.eligibleShopIds.length >= COUNTRY_SEAL_STAMP_THRESHOLD
  ) {
    return { required: COUNTRY_SEAL_STAMP_THRESHOLD, fromCuratedSet: false };
  }

  return { required: coverageSet.eligibleShopIds.length, fromCuratedSet: true };
}

function byCollectedAsc(a: StampCollection, b: StampCollection): number {
  if (a.collectedOn === b.collectedOn) {
    return a.shopNameSnapshot.localeCompare(b.shopNameSnapshot);
  }

  return a.collectedOn < b.collectedOn ? -1 : 1;
}

export function localitySealId(countryCode: CountryCode, localitySlug: string): string {
  return `seal-locality-${countryCode.toLowerCase()}-${localitySlug}`;
}

export function countrySealId(countryCode: CountryCode): string {
  return `seal-country-${countryCode.toLowerCase()}`;
}

export interface DeriveSealsOptions {
  readonly collections: readonly StampCollection[];
  readonly coverageSets: readonly CountryCoverageSet[];
  /**
   * Seals already earned in an earlier session. They are carried through
   * unchanged, which is how "never revoked" is implemented: a seal survives a
   * catalogue expansion, a coverage-set version bump, and even the removal of
   * the shop that derived it.
   */
  readonly alreadyEarned?: readonly EarnedSeal[];
  /** Design factory, so the ink and motif rules stay in one place. */
  readonly designSeal: (input: SealDesignInput) => ShopStampDesign;
}

export interface SealDesignInput {
  readonly scope: SealScope;
  readonly countryCode: CountryCode;
  readonly countryLabel: string;
  readonly localitySlug?: string;
  readonly localityName?: string;
  readonly key: string;
}

export interface DerivedSeals {
  readonly seals: readonly EarnedSeal[];
  readonly countryProgress: readonly CountrySealProgress[];
}

export function deriveSeals({
  collections,
  coverageSets,
  alreadyEarned = [],
  designSeal,
}: DeriveSealsOptions): DerivedSeals {
  const ordered = [...collections].sort(byCollectedAsc);
  const kept = new Map<string, EarnedSeal>();

  for (const seal of alreadyEarned) {
    kept.set(seal.id, seal);
  }

  const coverageByCountry = new Map(
    coverageSets.map((set) => [set.countryCode, set] as const),
  );

  // Locality seals: the first verified stamp in a locality derives it.
  for (const collection of ordered) {
    const id = localitySealId(collection.countryCode, collection.localitySlug);

    if (kept.has(id)) {
      continue;
    }

    kept.set(id, {
      id,
      scope: "locality",
      countryCode: collection.countryCode,
      countryLabel: collection.countryLabel,
      localitySlug: collection.localitySlug,
      localityName: collection.localityName,
      earnedOn: collection.collectedOn,
      derivedFromShopId: collection.shopId,
      stamp: designSeal({
        scope: "locality",
        countryCode: collection.countryCode,
        countryLabel: collection.countryLabel,
        localitySlug: collection.localitySlug,
        localityName: collection.localityName,
        key: id,
      }),
    });
  }

  // Country seals: the stamp that reaches the requirement derives it.
  const perCountry = new Map<CountryCode, StampCollection[]>();

  for (const collection of ordered) {
    perCountry.set(collection.countryCode, [
      ...(perCountry.get(collection.countryCode) ?? []),
      collection,
    ]);
  }

  const countryProgress: CountrySealProgress[] = [];

  for (const [countryCode, countryCollections] of perCountry) {
    const coverageSet = coverageByCountry.get(countryCode);
    const { required, fromCuratedSet } = countrySealRequirement(coverageSet);
    const id = countrySealId(countryCode);
    const countryLabel = countryCollections[0]?.countryLabel ?? countryCode;
    const existing = kept.get(id);
    const eligibleIds = new Set(coverageSet?.eligibleShopIds ?? []);

    /*
     * Two independent rules, and the seal derives from whichever a stamp
     * satisfies first in collection order:
     *
     *   1. five verified stamps in the country, whatever they are;
     *   2. every shop in a curated set smaller than five, by membership.
     *
     * Rule 2 is membership, not arithmetic. Four stamps from shops outside a
     * four-shop curated set leave that set incomplete and must not award the
     * seal, however many of them there are.
     */
    const collectedEligible = new Set<string>();
    let deriving: StampCollection | undefined;

    for (const [index, collection] of countryCollections.entries()) {
      if (eligibleIds.has(collection.shopId)) {
        collectedEligible.add(collection.shopId);
      }

      const byStampCount = index + 1 >= COUNTRY_SEAL_STAMP_THRESHOLD;
      const bySetCompletion =
        fromCuratedSet && collectedEligible.size === eligibleIds.size;

      if (byStampCount || bySetCompletion) {
        deriving = collection;
        break;
      }
    }

    // Counted over every collection, not just up to the deriving stamp, so
    // progress keeps rising after the seal is earned.
    const eligibleCollected = new Set(
      countryCollections
        .filter((collection) => eligibleIds.has(collection.shopId))
        .map((collection) => collection.shopId),
    ).size;

    if (!existing && deriving) {
      kept.set(id, {
        id,
        scope: "country",
        countryCode,
        countryLabel,
        earnedOn: deriving.collectedOn,
        derivedFromShopId: deriving.shopId,
        ...(coverageSet ? { coverageSetVersion: coverageSet.version } : {}),
        stamp: designSeal({
          scope: "country",
          countryCode,
          countryLabel,
          key: id,
        }),
      });
    }

    countryProgress.push({
      countryCode,
      countryLabel,
      stampCount: countryCollections.length,
      eligibleCollected,
      eligibleTotal: coverageSet ? coverageSet.eligibleShopIds.length : null,
      required,
      progressCount: fromCuratedSet ? eligibleCollected : countryCollections.length,
      coverageSetVersion: coverageSet?.version ?? null,
      requirementFromCuratedSet: fromCuratedSet,
      earned: kept.has(id),
    });
  }

  // A country whose seal was carried over but which has no stamps in this
  // session still reports progress, so the UI never loses an earned seal.
  for (const seal of kept.values()) {
    if (seal.scope !== "country") {
      continue;
    }

    if (countryProgress.some((progress) => progress.countryCode === seal.countryCode)) {
      continue;
    }

    const coverageSet = coverageByCountry.get(seal.countryCode);
    const { required, fromCuratedSet } = countrySealRequirement(coverageSet);

    countryProgress.push({
      countryCode: seal.countryCode,
      countryLabel: seal.countryLabel,
      stampCount: 0,
      eligibleCollected: 0,
      eligibleTotal: coverageSet ? coverageSet.eligibleShopIds.length : null,
      required,
      progressCount: 0,
      coverageSetVersion: seal.coverageSetVersion ?? coverageSet?.version ?? null,
      requirementFromCuratedSet: fromCuratedSet,
      earned: true,
    });
  }

  countryProgress.sort((a, b) => a.countryLabel.localeCompare(b.countryLabel));

  const seals = [...kept.values()].sort((a, b) => {
    if (a.earnedOn !== b.earnedOn) {
      return a.earnedOn < b.earnedOn ? -1 : 1;
    }

    return a.id.localeCompare(b.id);
  });

  return { seals, countryProgress };
}

export function localitySealFor(
  seals: readonly EarnedSeal[],
  countryCode: CountryCode,
  localitySlug: string,
): EarnedSeal | undefined {
  return seals.find((seal) => seal.id === localitySealId(countryCode, localitySlug));
}

export function countrySealFor(
  seals: readonly EarnedSeal[],
  countryCode: CountryCode,
): EarnedSeal | undefined {
  return seals.find((seal) => seal.id === countrySealId(countryCode));
}
