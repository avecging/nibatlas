import type { ShopReadClient } from "@/src/api/v1/shop-read-client";
import type { ShopSearchV1 } from "@/src/api/v1/shop-read";
import { ShopReadAbortedError } from "@/src/api/v1/shop-read-errors";
import {
  MIN_SEARCH_QUERY_LENGTH,
  type CanonicalShopHit,
  type DestinationGeocoder,
  type DestinationResult,
  type SearchResults,
} from "@/src/features/map/destination-geocoder";

/**
 * API-mode search.
 *
 * Two suppliers, two groups, one panel — never one ranked list:
 *
 * - **Shops** are canonical Nib Atlas records from
 *   `GET /api/v1/shops/search`, decoded by the v1 decoder before this module
 *   sees them and projected here into `CanonicalShopHit`. No wire field reaches
 *   the interface directly.
 * - **Places** are optional map-framing results supplied behind
 *   `DestinationSupplier`. API mode uses MapTiler when its map key is configured, and an empty
 *   supplier otherwise.
 */
export interface DestinationSupplier {
  suggest(query: string, signal?: AbortSignal): Promise<readonly DestinationResult[]>;
}

export function createEmptyDestinationSupplier(): DestinationSupplier {
  return {
    suggest() {
      return Promise.resolve([]);
    },
  };
}

/** Projects the decoded canonical search response. No coordinates are invented. */
export function projectCanonicalHits(
  response: ShopSearchV1,
): readonly CanonicalShopHit[] {
  return response.shops.map((hit) => ({
    id: hit.id,
    slug: hit.slug,
    name: hit.name,
    localityName: hit.localityName,
    countryCode: hit.countryCode,
    ...(hit.matchedAlias === undefined ? {} : { matchedAlias: hit.matchedAlias }),
  }));
}

const EMPTY: SearchResults = { destinations: [], shops: [] };

export interface ApiGeocoderOptions {
  readonly client: ShopReadClient;
  readonly destinations?: DestinationSupplier;
  readonly shopLimit?: number;
}

export function createApiGeocoder({
  client,
  destinations = createEmptyDestinationSupplier(),
  shopLimit = 5,
}: ApiGeocoderOptions): DestinationGeocoder {
  return {
    async search(query, signal) {
      const trimmed = query.trim();

      if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
        return EMPTY;
      }

      /*
       * The two suppliers are independent, so one failing must not take the
       * other's group with it. Cancellation is not a failure and is re-thrown,
       * so the caller drops the whole result rather than rendering half of a
       * search the reader has already moved on from.
       */
      const [places, shops] = await Promise.all([
        destinations.suggest(trimmed, signal).catch((cause: unknown) => {
          if (cause instanceof ShopReadAbortedError) throw cause;
          return [];
        }),
        client
          .searchCanonicalShops({ query: trimmed, limit: shopLimit }, signal)
          .then(projectCanonicalHits)
          .catch((cause: unknown) => {
            if (cause instanceof ShopReadAbortedError) throw cause;
            return [];
          }),
      ]);

      return { destinations: places, shops };
    },
  };
}
