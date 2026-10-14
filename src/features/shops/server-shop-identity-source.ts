import { cache } from "react";

import { decodeShopDetailV1 } from "@/src/api/v1/shop-read";
import {
  readCatalogueMode,
  type CatalogueModeResolution,
} from "@/src/features/catalogue/catalogue-mode";
import { SHOP_SLUG_PATTERN } from "@/src/features/shops/shop-detail-source";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";
import { callShopReadRpc } from "@/src/server/adapters/supabase-shop-reads";

export interface ShopIdentity {
  readonly slug: string;
  readonly name: string;
  readonly localityName: string;
}

export type ShopIdentityResult =
  | { readonly status: "found"; readonly shop: ShopIdentity }
  | { readonly status: "missing" }
  | { readonly status: "unavailable" };

export type ShopIdentityRpc = (
  slug: string,
  signal?: AbortSignal,
) => Promise<unknown>;

const defaultRpc: ShopIdentityRpc = (slug, signal) =>
  callShopReadRpc("shop_detail", { p_slug: slug }, signal);

/**
 * Resolve the server-trusted identity used by the correction page and intake.
 * The browser never supplies the shop name, and API mode never validates a live
 * slug against the deterministic fixture catalogue.
 */
export async function resolveShopIdentity(
  slug: string,
  {
    resolution = readCatalogueMode(),
    rpc = defaultRpc,
  }: {
    readonly resolution?: CatalogueModeResolution;
    readonly rpc?: ShopIdentityRpc;
  } = {},
  signal?: AbortSignal,
): Promise<ShopIdentityResult> {
  if (!SHOP_SLUG_PATTERN.test(slug)) {
    return { status: "missing" };
  }

  if (resolution.mode === "misconfigured") {
    return { status: "unavailable" };
  }

  if (resolution.mode === "fixture") {
    const shop = findPrototypeShop(slug);

    return shop === undefined
      ? { status: "missing" }
      : {
          status: "found",
          shop: {
            slug: shop.slug,
            name: shop.name,
            localityName: shop.localityName,
          },
        };
  }

  try {
    const detail = decodeShopDetailV1(await rpc(slug, signal));

    if (detail === null) {
      return { status: "missing" };
    }

    if (detail.sourceQuality === "demo" && !resolution.demoRecords) {
      return { status: "unavailable" };
    }

    return {
      status: "found",
      shop: {
        slug: detail.slug,
        name: detail.name,
        localityName: detail.localityName,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

/** Metadata and body share one identity read within a server request. */
export const shopIdentityForRequest = cache((slug: string) => resolveShopIdentity(slug));
