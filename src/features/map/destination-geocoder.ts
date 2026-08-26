import type { Viewport } from "@/src/domain/geo";
import { prototypeDestinations, type PrototypeDestination } from "@/src/fixtures/prototype-destinations";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";
import type { ShopMapSummary } from "@/src/domain/shops";

export interface DestinationResult {
  readonly id: string;
  readonly name: string;
  readonly localName?: string;
  readonly context: string;
  readonly viewport: Viewport;
}

export interface ShopSearchResult {
  readonly shop: ShopMapSummary;
  readonly viewport: Viewport;
}

export interface SearchResults {
  /** Places from the geocoder. Never merged with canonical shop results. */
  readonly destinations: readonly DestinationResult[];
  /** Canonical Nib Atlas shop records. */
  readonly shops: readonly ShopSearchResult[];
}

/**
 * `DestinationGeocoder` isolates the place-search supplier. Milestone 1 uses the
 * fixture list; Milestone 3 swaps in MapTiler geocoding behind the same
 * interface. Supplier payloads never enter domain state.
 */
export interface DestinationGeocoder {
  search(query: string): Promise<SearchResults>;
}

const SHOP_ZOOM = 16;

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function matches(query: string, ...candidates: readonly (string | undefined)[]): boolean {
  const needle = normalize(query);

  return candidates.some(
    (candidate) => candidate !== undefined && normalize(candidate).includes(needle),
  );
}

function destinationViewport(destination: PrototypeDestination): Viewport {
  return { bounds: destination.bounds, zoom: destination.zoom };
}

function shopViewport(shop: ShopMapSummary): Viewport {
  const padding = 0.006;

  return {
    bounds: {
      west: shop.position.longitude - padding,
      south: shop.position.latitude - padding,
      east: shop.position.longitude + padding,
      north: shop.position.latitude + padding,
    },
    zoom: SHOP_ZOOM,
  };
}

export function createFixtureGeocoder(
  shops: readonly ShopMapSummary[] = prototypeShopSummaries,
  destinations: readonly PrototypeDestination[] = prototypeDestinations,
): DestinationGeocoder {
  return {
    async search(query) {
      const trimmed = query.trim();

      if (trimmed.length < 2) {
        return { destinations: [], shops: [] };
      }

      const matchedDestinations = destinations
        .filter((destination) =>
          matches(trimmed, destination.name, destination.localName, destination.context),
        )
        .slice(0, 5)
        .map<DestinationResult>((destination) => ({
          id: destination.id,
          name: destination.name,
          ...(destination.localName === undefined
            ? {}
            : { localName: destination.localName }),
          context: destination.context,
          viewport: destinationViewport(destination),
        }));

      const matchedShops = shops
        .filter((shop) => matches(trimmed, shop.name, shop.localName, shop.localityName))
        .slice(0, 5)
        .map<ShopSearchResult>((shop) => ({ shop, viewport: shopViewport(shop) }));

      return { destinations: matchedDestinations, shops: matchedShops };
    },
  };
}
