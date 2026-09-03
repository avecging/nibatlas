import type { NearbyShop } from "@/src/domain/nearby-shops";
import { nearbyPenShops } from "@/src/domain/nearby-shops";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";

/**
 * The shop-detail seam.
 *
 * `/shops/[slug]` is a server-rendered page, so the detail it renders is
 * resolved through this interface rather than fetched inside a component. The
 * fixture implementation is the Milestone 1 lookup; the API implementation lives
 * in `server-shop-detail-source.ts` because it reaches the database RPC and must
 * never be pulled into a browser bundle.
 *
 * Three outcomes, deliberately distinct:
 *
 * - `found` — render the page.
 * - `missing` — a real 404. Unknown, draft, and malformed slugs are
 *   indistinguishable here, exactly as the API keeps them.
 * - `unavailable` — the catalogue could not answer. The URL stays valid and the
 *   page says the detail is unavailable; it never degrades into a 404 (which
 *   would tell the reader the shop does not exist) and never falls back to a
 *   fixture record (which would invent one).
 */
export type ShopDetailUnavailableReason =
  /** The catalogue mode itself is not configured. */
  | "configuration"
  /** The upstream answered with something the v1 contract rejects. */
  | "contract"
  /** The upstream could not be reached, or failed. */
  | "upstream";

export type ShopDetailResult =
  | {
      readonly status: "found";
      readonly shop: ShopDetail;
      /** Trip-planning context, already derived and ordered. */
      readonly nearby: readonly NearbyShop[];
    }
  | { readonly status: "missing" }
  | {
      readonly status: "unavailable";
      readonly reason: ShopDetailUnavailableReason;
    };

export interface ShopDetailSource {
  fetchDetail(slug: string, signal?: AbortSignal): Promise<ShopDetailResult>;
}

/**
 * The slug shape the read API accepts.
 *
 * Checked before any lookup so a malformed slug is one `missing` answer rather
 * than a request, and so the two are indistinguishable from outside.
 */
export const SHOP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createFixtureShopDetailSource(
  catalogue: readonly ShopDetail[] = prototypeShopDetails,
): ShopDetailSource {
  return {
    async fetchDetail(slug) {
      if (!SHOP_SLUG_PATTERN.test(slug)) {
        return { status: "missing" };
      }

      const shop = catalogue.find((candidate) => candidate.slug === slug);

      if (!shop) {
        return { status: "missing" };
      }

      return {
        status: "found",
        shop,
        // Derived from the same catalogue the map reads, so nothing here is a
        // separate structure that could drift out of step with the records.
        nearby: nearbyPenShops(shop, catalogue),
      };
    },
  };
}
