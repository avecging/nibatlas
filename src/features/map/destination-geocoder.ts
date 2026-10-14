import type { CountryCode, Viewport } from "@/src/domain/geo";
import type { LanguageTag } from "@/src/domain/language";
import { prototypeDestinations, type PrototypeDestination } from "@/src/fixtures/prototype-destinations";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";
import type { ShopMapSummary } from "@/src/domain/shops";
import { shopFocusViewport } from "@/src/features/map/shop-focus";

export interface DestinationResult {
  readonly id: string;
  readonly name: string;
  readonly localName?: string;
  readonly localNameLang?: LanguageTag;
  readonly context: string;
  readonly viewport: Viewport;
}

/** Where the map goes for a shop the supplier can already place. */
export interface ShopSearchTarget {
  readonly shop: ShopMapSummary;
  readonly viewport: Viewport;
}

/**
 * A canonical Nib Atlas shop record.
 *
 * `target` is present only when the supplier already knows where the shop is.
 * The fixture catalogue always does. `GET /api/v1/shops/search` deliberately
 * does not return coordinates, so an API-mode hit carries none, and choosing it
 * resolves the position through the shop locator before the map moves. A hit is
 * never given a guessed position so that it can behave like a placed one.
 */
export interface CanonicalShopHit {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly localityName: string;
  readonly countryCode: CountryCode;
  /** The alias the query matched, where the supplier reports one. */
  readonly matchedAlias?: string;
  readonly target?: ShopSearchTarget;
}

export interface SearchResults {
  /** Places from the geocoder. Never merged with canonical shop results. */
  readonly destinations: readonly DestinationResult[];
  /** Canonical Nib Atlas shop records. */
  readonly shops: readonly CanonicalShopHit[];
}

/**
 * `DestinationGeocoder` isolates the place-search supplier. Milestone 1 uses the
 * fixture list; Milestone 3 swaps in MapTiler geocoding behind the same
 * interface. Supplier payloads never enter domain state.
 */
export interface DestinationGeocoder {
  search(query: string, signal?: AbortSignal): Promise<SearchResults>;
}

/** The shortest query either supplier will act on. */
export const MIN_SEARCH_QUERY_LENGTH = 2;

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

/** Projects a fixture record into a placed canonical hit. */
export function toPlacedShopHit(shop: ShopMapSummary): CanonicalShopHit {
  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    localityName: shop.localityName,
    countryCode: shop.countryCode,
    target: { shop, viewport: shopFocusViewport(shop) },
  };
}

export function createFixtureGeocoder(
  shops: readonly ShopMapSummary[] = prototypeShopSummaries,
  destinations: readonly PrototypeDestination[] = prototypeDestinations,
): DestinationGeocoder {
  return {
    async search(query) {
      const trimmed = query.trim();

      if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
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
            : {
                localName: destination.localName,
                ...(destination.localNameLang === undefined
                  ? {}
                  : { localNameLang: destination.localNameLang }),
              }),
          context: destination.context,
          viewport: destinationViewport(destination),
        }));

      const matchedShops = shops
        .filter((shop) => matches(trimmed, shop.name, shop.localName, shop.localityName))
        .slice(0, 5)
        .map(toPlacedShopHit);

      return { destinations: matchedDestinations, shops: matchedShops };
    },
  };
}
