import { cache } from "react";

import { decodeShopDetailV1, ShopReadContractError } from "@/src/api/v1/shop-read";
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

export function createApiShopDetailSource({
  demoRecords,
  rpc = defaultRpc,
}: {
  readonly demoRecords: boolean;
  readonly rpc?: ShopDetailRpc;
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

        return {
          status: "found",
          shop: projectShopDetail(wire, { demoRecords }),
          /*
           * No nearby section in API mode.
           *
           * `NearbyShop` needs each candidate's `positionPrecision` to decide
           * whether a distance may be shown at all, and its
           * `operationalStatus` to keep a permanently closed shop out of a
           * suggestion list. The v1 nearby projection carries neither, so the
           * section is omitted rather than shown with a distance the data does
           * not support or a shop that has closed. Recorded as a contract gap
           * for Codex in the WP2 pull request.
           */
          nearby: [],
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
