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
 * A shop mapped to its locality centroid gets no number at all — a distance
 * measured from a city centroid would read as precision the record does not
 * have. It still appears, because "also in Kobe" is genuinely useful when
 * planning a day.
 *
 * Nothing here is an itinerary: no ordering, no route, no schedule.
 */
export interface NearbyShop {
  readonly shop: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly localityName: string;
    readonly primaryType: ShopType;
  };
  /** Metres between the two mapped points, or `null` when not measurable. */
  readonly distanceMeters: number | null;
  readonly sameLocality: boolean;
}

/** Different-locality shops are only offered when they are genuinely close. */
export const NEARBY_RADIUS_METERS = 5_000;

export const NEARBY_LIMIT = 4;

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
  const candidates: NearbyShop[] = [];

  for (const other of catalogue) {
    if (other.id === shop.id || other.operationalStatus === "permanently_closed") {
      continue;
    }

    const sameLocality = other.localityName === shop.localityName;
    const metres = measurable(shop, other)
      ? distanceMeters(shop.position, other.position)
      : null;

    // Same locality is always trip-relevant. A different locality qualifies only
    // on a measured distance inside the radius — never on an unmeasurable pair,
    // which would be a guess dressed as a recommendation.
    if (!sameLocality && (metres === null || metres > NEARBY_RADIUS_METERS)) {
      continue;
    }

    candidates.push({ shop: other, distanceMeters: metres, sameLocality });
  }

  return candidates
    .sort((a, b) => {
      // Measured pairs first, nearest first; then same-locality pairs we cannot
      // measure, alphabetically so the order is stable.
      if (a.distanceMeters !== null && b.distanceMeters !== null) {
        return a.distanceMeters - b.distanceMeters;
      }

      if (a.distanceMeters !== null) {
        return -1;
      }

      if (b.distanceMeters !== null) {
        return 1;
      }

      return a.shop.name.localeCompare(b.shop.name);
    })
    .slice(0, limit);
}
