import type { ShopReadClient } from "@/src/api/v1/shop-read-client";
import type { ShopMapSummary } from "@/src/domain/shops";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";

/**
 * Slug to map summary.
 *
 * Two callers need a shop's position from nothing but its slug: the `?shop=`
 * deep link that restores the map after shop-detail navigation, and a canonical
 * search hit, which the search endpoint returns without coordinates.
 *
 * In fixture mode this is a lookup. In API mode it is one detail read, whose
 * response is already cached by the API's own `s-maxage`, projected down to the
 * public map summary — nothing user-owned, and `markerState` always `unvisited`.
 */
export interface ShopLocator {
  locate(slug: string, signal?: AbortSignal): Promise<ShopMapSummary | null>;
}

export function createFixtureShopLocator(
  shops: readonly ShopMapSummary[] = prototypeShopSummaries,
): ShopLocator {
  return {
    locate(slug) {
      return Promise.resolve(shops.find((shop) => shop.slug === slug) ?? null);
    },
  };
}

export function createHttpShopLocator(client: ShopReadClient): ShopLocator {
  return {
    async locate(slug, signal) {
      const detail = await client.fetchShopDetail(slug, signal);

      if (detail === null) {
        return null;
      }

      return {
        id: detail.id,
        slug: detail.slug,
        name: detail.name,
        ...(detail.localName === undefined
          ? {}
          : {
              localName: detail.localName,
              ...(detail.localNameLang === undefined
                ? {}
                : { localNameLang: detail.localNameLang }),
            }),
        countryCode: detail.countryCode,
        localityName: detail.localityName,
        position: detail.position,
        primaryType: detail.primaryType,
    ...(detail.primaryTypeLabel === undefined ? {} : {primaryTypeLabel:detail.primaryTypeLabel}),
        specialtyLine: detail.specialtyLine,
        operationalStatus: detail.operationalStatus,
        markerState: "unvisited",
        sourceQuality: detail.sourceQuality,
        ...(detail.fixtureNotice === undefined
          ? {}
          : { fixtureNotice: detail.fixtureNotice }),
      };
    },
  };
}
