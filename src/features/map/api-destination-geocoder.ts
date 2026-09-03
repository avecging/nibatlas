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
import {
  prototypeDestinations,
  type PrototypeDestination,
} from "@/src/fixtures/prototype-destinations";

/**
 * API-mode search.
 *
 * Two suppliers, two groups, one panel — never one ranked list:
 *
 * - **Shops** are canonical Nib Atlas records from
 *   `GET /api/v1/shops/search`, decoded by the v1 decoder before this module
 *   sees them and projected here into `CanonicalShopHit`. No wire field reaches
 *   the interface directly.
 * - **Places** are destinations, used only to frame the map. They come from the
 *   curated destination list in both modes today. A provider geocoder
 *   (MapTiler) is a later supplier behind {@link DestinationSupplier}, and its
 *   payload must be projected at that boundary for the same reason: a
 *   provider-shaped place must never become domain state.
 */
export interface DestinationSupplier {
  suggest(query: string, signal?: AbortSignal): Promise<readonly DestinationResult[]>;
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function matches(query: string, ...candidates: readonly (string | undefined)[]): boolean {
  const needle = normalize(query);

  return candidates.some(
    (candidate) => candidate !== undefined && normalize(candidate).includes(needle),
  );
}

/** The curated destination list, projected into the domain place shape. */
export function createCuratedDestinationSupplier(
  destinations: readonly PrototypeDestination[] = prototypeDestinations,
  limit = 5,
): DestinationSupplier {
  return {
    suggest(query) {
      const trimmed = query.trim();

      return Promise.resolve(
        destinations
          .filter((destination) =>
            matches(trimmed, destination.name, destination.localName, destination.context),
          )
          .slice(0, limit)
          .map<DestinationResult>((destination) => ({
            id: destination.id,
            name: destination.name,
            ...(destination.localName === undefined
              ? {}
              : {
                  localName: destination.localName,
                  ...(destination.localNameLang === undefined
                    ? {}
                    : { localNameLang: destination.localNameLang }),
                }),
            context: destination.context,
            viewport: { bounds: destination.bounds, zoom: destination.zoom },
          })),
      );
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
  destinations = createCuratedDestinationSupplier(),
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
       * other's group with it: a places list is still useful while canonical
       * search is down, and vice versa. Cancellation is not a failure and is
       * re-thrown, so the caller drops the whole result rather than rendering
       * half of a search the reader has already moved on from.
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
