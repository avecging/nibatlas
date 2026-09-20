import { cache } from "react";

import {
  decodeNearbyShopsV1,
  decodeShopDetailV1,
  ShopReadContractError,
  type NearbyShopV1,
} from "@/src/api/v1/shop-read";
import {
  NEARBY_LIMIT,
  NEARBY_RADIUS_METERS,
  type NearbyShop,
} from "@/src/domain/nearby-shops";
import type { ShopDetail } from "@/src/domain/shop-detail";
import {
  projectShopDetail,
  ShopDetailProjectionError,
} from "@/src/features/shops/shop-detail-projection";
import {
  createFixtureShopDetailSource,
  SHOP_SLUG_PATTERN,
  type ShopDetailResult,
  type ShopDetailSource,
} from "@/src/features/shops/shop-detail-source";
import {
  readCatalogueMode,
  type CatalogueModeResolution,
} from "@/src/features/catalogue/catalogue-mode";
import {
  callShopReadRpc,
  ShopReadConfigurationError,
} from "@/src/server/adapters/supabase-shop-reads";

/**
 * Server-only detail source.
 *
 * `/shops/[slug]` renders on the server, and a server render cannot issue the
 * same-origin relative request the browser uses. It therefore reads the shop
 * through the *same* security-definer RPC and the *same* v1 decoder that
 * `GET /api/v1/shops/[slug]` uses, then applies the one frontend projection
 * step. Nothing here widens the contract: the browser still reads catalogue data
 * only through `/api/v1/shops/*`, no service-role key is involved, and no
 * provider-shaped value escapes this module.
 */
export type ShopDetailRpc = (
  slug: string,
  signal?: AbortSignal,
) => Promise<unknown>;

const defaultRpc: ShopDetailRpc = (slug, signal) =>
  callShopReadRpc("shop_detail", { p_slug: slug }, signal);

export type ShopNearbyRpc = (
  shop: Pick<ShopDetail, "position">,
  signal?: AbortSignal,
) => Promise<unknown>;

const defaultNearbyRpc: ShopNearbyRpc = (shop, signal) =>
  callShopReadRpc("nearby_shops", {
    p_latitude: shop.position.latitude,
    p_longitude: shop.position.longitude,
    p_radius_m: NEARBY_RADIUS_METERS,
    // The current shop is normally the first result and is removed below.
    p_limit: NEARBY_LIMIT + 1,
  }, signal);

function projectNearbyCandidate(
  current: ShopDetail,
  candidate: NearbyShopV1,
): NearbyShop | null {
  if (
    candidate.id === current.id ||
    candidate.operationalStatus === "permanently_closed"
  ) {
    return null;
  }

  return {
    shop: {
      id: candidate.id,
      slug: candidate.slug,
      name: candidate.name,
      localityName: candidate.localityName,
      primaryType: candidate.primaryType,
    ...(candidate.primaryTypeLabel === undefined ? {} : {primaryTypeLabel:candidate.primaryTypeLabel}),
    },
    distanceMeters:
      current.positionPrecision === "street" &&
      candidate.positionPrecision === "street"
        ? candidate.distanceMeters
        : null,
    sameLocality: candidate.localityName === current.localityName,
  };
}

async function nearbyFor(
  shop: ShopDetail,
  rpc: ShopNearbyRpc,
  signal?: AbortSignal,
): Promise<readonly NearbyShop[]> {
  try {
    const response = decodeNearbyShopsV1(await rpc(shop, signal));

    return response.shops
      .map((candidate) => projectNearbyCandidate(shop, candidate))
      .filter((candidate): candidate is NearbyShop => candidate !== null)
      .slice(0, NEARBY_LIMIT);
  } catch {
    // Nearby is secondary trip context. Its outage must not take down a valid
    // shop detail page; omission is the honest degraded state.
    return [];
  }
}

export function createApiShopDetailSource({
  demoRecords,
  rpc = defaultRpc,
  nearbyRpc = defaultNearbyRpc,
}: {
  readonly demoRecords: boolean;
  readonly rpc?: ShopDetailRpc;
  readonly nearbyRpc?: ShopNearbyRpc;
}): ShopDetailSource {
  return {
    async fetchDetail(slug, signal) {
      if (!SHOP_SLUG_PATTERN.test(slug)) {
        return { status: "missing" };
      }

      let raw: unknown;

      try {
        raw = await rpc(slug, signal);
      } catch (cause) {
        return {
          status: "unavailable",
          reason:
            cause instanceof ShopReadConfigurationError ? "configuration" : "upstream",
        };
      }

      try {
        const wire = decodeShopDetailV1(raw);

        if (wire === null) {
          return { status: "missing" };
        }

        const shop = projectShopDetail(wire, { demoRecords });

        return {
          status: "found",
          shop,
          nearby: await nearbyFor(shop, nearbyRpc, signal),
        };
      } catch (cause) {
        if (
          cause instanceof ShopReadContractError ||
          cause instanceof ShopDetailProjectionError
        ) {
          return { status: "unavailable", reason: "contract" };
        }

        return { status: "unavailable", reason: "upstream" };
      }
    },
  };
}

/** A source that answers every slug as unavailable, for a misconfigured mode. */
function createUnavailableShopDetailSource(): ShopDetailSource {
  return {
    fetchDetail(): Promise<ShopDetailResult> {
      return Promise.resolve({ status: "unavailable", reason: "configuration" });
    },
  };
}

export function createShopDetailSourceFor(
  resolution: CatalogueModeResolution,
): ShopDetailSource {
  switch (resolution.mode) {
    case "api":
      return createApiShopDetailSource({ demoRecords: resolution.demoRecords });
    case "fixture":
      return createFixtureShopDetailSource();
    default:
      return createUnavailableShopDetailSource();
  }
}

/** The source the shop route uses, chosen from the deployment's mode. */
export function shopDetailSource(): ShopDetailSource {
  return createShopDetailSourceFor(readCatalogueMode());
}

/**
 * One read per slug per request.
 *
 * `generateMetadata` and the page body both need the record, and the RPC is a
 * POST, which Next's request-scoped fetch cache does not deduplicate. Without
 * this the API mode would issue two identical catalogue reads for every shop
 * page view, and a title could describe a record the body then failed to load.
 */
export const shopDetailForRequest = cache(
  (slug: string): Promise<ShopDetailResult> => shopDetailSource().fetchDetail(slug),
);
