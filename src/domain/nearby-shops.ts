import { distanceMeters } from "@/src/domain/geo";
import type { ShopDetail } from "@/src/domain/shop-detail";
import type { ShopType } from "@/src/domain/shops";

/**
 * Nearby pen shops, as trip-planning context.
 *
 * `docs/milestone-1-5-product-refinement.md` asks for "walking time between
 * them: trip-shaped without being an itinerary". Walking time needs a routing
 * source this repository does not have, and no catalogue coordinate is surveyed,
 * so this derives what the data can honestly support: which other catalogue
 * shops are in reach, and a straight-line distance **only** where both points
 * were placed from a sourced street address.
 *
 * Locality centroids cannot establish walking proximity and are omitted.
 * No walking-time estimate is inferred from straight-line distance.
 */
export interface NearbyShop {
  readonly shop: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly localityName: string;
    readonly primaryType: ShopType;
    readonly primaryTypeLabel?: string;
  };
  /** Metres between the two mapped points, or `null` when not measurable. */
  readonly distanceMeters: number | null;
  readonly sameLocality: boolean;
}

/** Nearby on a shop page uses a short radius, with a sparse-area fallback. */
export const NEARBY_RADIUS_METERS = 800;
export const NEARBY_FALLBACK_RADIUS_METERS = 1_700;
export const NEARBY_LIMIT = 5;
export const NEARBY_MIN_COUNT = 3;

/** Select from one bounded fetch; never present a distant or imprecise point as walkable. */
export function selectNearbyShops(
  candidates: readonly NearbyShop[],
  relatedIds: ReadonlySet<string> = new Set(),
  limit = NEARBY_LIMIT,
): readonly NearbyShop[] {
  const eligible = candidates
    .filter(item => item.distanceMeters !== null && item.distanceMeters <= NEARBY_FALLBACK_RADIUS_METERS
      && !relatedIds.has(item.shop.id))
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0) || a.shop.id.localeCompare(b.shop.id));
  const close = eligible.filter(item => (item.distanceMeters ?? Infinity) <= NEARBY_RADIUS_METERS);
  return (close.length >= NEARBY_MIN_COUNT ? close : eligible).slice(0, limit);
}

/**
 * Rounded to the precision the coordinates deserve.
 *
 * 50 m steps under a kilometre, one decimal above it. `Approx.` is not
 * decoration: both endpoints are approximate, so a metre-accurate figure would
 * be a lie about the input. It also carries the qualification on its own, which
 * is what let the separate straight-line paragraph go after the founder's
 * staging review.
 */
export function distanceLabel(metres: number): string {
  if (metres < 1_000) {
    const rounded = Math.max(50, Math.round(metres / 50) * 50);

    return `Approx. ${rounded} m away`;
  }

  return `Approx. ${(metres / 1_000).toFixed(1)} km away`;
}

function measurable(a: ShopDetail, b: ShopDetail): boolean {
  return a.positionPrecision === "street" && b.positionPrecision === "street";
}

export function nearbyPenShops(
  shop: ShopDetail,
  catalogue: readonly ShopDetail[],
  limit: number = NEARBY_LIMIT,
): readonly NearbyShop[] {
  if (shop.positionPrecision !== "street") return [];
  const candidates: NearbyShop[] = [];
  for (const other of catalogue) {
    if (other.id === shop.id || other.operationalStatus === "permanently_closed" || !measurable(shop, other)) continue;
    const metres = distanceMeters(shop.position, other.position);
    if (metres > NEARBY_FALLBACK_RADIUS_METERS) continue;
    candidates.push({ shop: other, distanceMeters: metres, sameLocality: other.localityName === shop.localityName });
  }
  return selectNearbyShops(candidates, new Set(shop.relatedShops?.map(item => item.id)), limit);
}
