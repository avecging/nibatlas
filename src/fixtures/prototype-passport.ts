import type { StampCollection } from "@/src/domain/passport";
import type { ShopDetail } from "@/src/domain/shop-detail";
import {
  prototypeLocalitySlugById,
  prototypeShopDetails,
} from "@/src/fixtures/prototype-catalogue";

/**
 * Simulated starting collection for Milestone 1.
 *
 * Nothing here is a real verified visit. Dates are fixed so Passport
 * screenshots and visual baselines stay stable, and they are chosen to exercise
 * every seal rule at once:
 *
 * - Singapore's curated set holds two shops and both are collected, so its
 *   country seal is earned by *completing a curated set smaller than five* —
 *   the only case where the interface may say "complete";
 * - Japan and Taiwan each hold four eligible shops with two collected, so both
 *   show honest progress against an explicit versioned denominator;
 * - five localities are collected, so five locality seals derive from a first
 *   verified stamp each.
 *
 * Milestone 5 replaces all of this with server-issued `stamp_collections` rows.
 */
const SEED_DATES: Record<string, string> = {
  "ginza-itoya-main-store": "2026-03-14",
  "ginza-itoya-yokohama-motomachi": "2026-03-16",
  "pen-house-tainan": "2026-03-19",
  "skb-kaohsiung": "2026-03-20",
  "aesthetic-bay": "2026-06-02",
  "fook-hing-trading": "2026-06-03",
};

/** Saved-but-not-visited seeds, deliberately in two different countries so the
 *  global Saved mode has something to find outside any single viewport. */
const SEED_SAVED_SLUGS: readonly string[] = [
  "ty-lee-pen-shop",
  "nagasawa-penstyle-den",
];

export function toStampCollection(
  shop: ShopDetail,
  collectedOn: string,
): StampCollection {
  return {
    id: `collection-${shop.slug}`,
    shopId: shop.id,
    shopSlug: shop.slug,
    shopNameSnapshot: shop.name,
    ...(shop.localName === undefined
      ? {}
      : {
          shopLocalNameSnapshot: shop.localName,
          ...(shop.localNameLang === undefined
            ? {}
            : { shopLocalNameLangSnapshot: shop.localNameLang }),
        }),
    collectedOn,
    shopTimezone: shop.timezone,
    countryCode: shop.countryCode,
    countryLabel: shop.stamp.countryLabel,
    localityName: shop.localityName,
    localitySlug:
      prototypeLocalitySlugById.get(shop.id) ?? shop.localityName.toLowerCase(),
    stamp: shop.stamp,
    simulated: true,
  };
}

export const prototypeSeedCollections: readonly StampCollection[] = prototypeShopDetails
  .filter((shop) => SEED_DATES[shop.slug] !== undefined)
  .map((shop) => toStampCollection(shop, SEED_DATES[shop.slug] as string));

export const prototypeSeedSavedShopIds: readonly string[] = prototypeShopDetails
  .filter((shop) => SEED_SAVED_SLUGS.includes(shop.slug))
  .map((shop) => shop.id);
