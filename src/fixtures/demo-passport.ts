import type { StampCollection } from "@/src/domain/passport";
import {
  demoLocalitySlugById,
  demoShopDetails,
} from "@/src/fixtures/demo-catalogue";
import type { ShopDetail } from "@/src/domain/shop-detail";

/**
 * Simulated starting collection for Milestone 1.
 *
 * Dates are fixed so Passport screenshots and visual baselines stay stable.
 * Milestone 5 replaces this with server-issued `stamp_collections` rows.
 */
const SEED_DATES: Record<string, string> = {
  "demo-tiong-bahru-nib-clinic": "2026-05-02",
  "demo-ginza-fountain-pen-salon": "2026-06-12",
  "demo-kyoto-machiya-ink-studio": "2026-04-28",
  "demo-taiwan-nib-workshop": "2026-03-19",
  "demo-tainan-west-central-nib-bench": "2026-02-08",
};

export function toStampCollection(shop: ShopDetail, collectedOn: string): StampCollection {
  return {
    id: `collection-${shop.slug}`,
    shopId: shop.id,
    shopSlug: shop.slug,
    shopNameSnapshot: shop.name,
    ...(shop.localName === undefined
      ? {}
      : { shopLocalNameSnapshot: shop.localName }),
    collectedOn,
    shopTimezone: shop.timezone,
    countryCode: shop.countryCode,
    countryLabel: shop.stamp.countryLabel,
    localityName: shop.localityName,
    localitySlug: demoLocalitySlugById.get(shop.id) ?? shop.localityName.toLowerCase(),
    stamp: shop.stamp,
    simulated: true,
  };
}

export const demoSeedCollections: readonly StampCollection[] = demoShopDetails
  .filter((shop) => SEED_DATES[shop.slug] !== undefined)
  .map((shop) => toStampCollection(shop, SEED_DATES[shop.slug] as string));

export const demoSeedSavedShopIds: readonly string[] = demoShopDetails
  .filter((shop) => shop.markerState === "saved")
  .map((shop) => shop.id);
