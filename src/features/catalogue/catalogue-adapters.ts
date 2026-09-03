import { createHttpShopReadClient } from "@/src/api/v1/shop-read-client";
import {
  createFixtureShopLocator,
  createHttpShopLocator,
  type ShopLocator,
} from "@/src/features/explore/shop-locator";
import {
  createFixtureShopSource,
  type ShopSource,
} from "@/src/features/explore/shop-source";
import { createHttpShopSource } from "@/src/features/explore/http-shop-source";
import { createApiGeocoder } from "@/src/features/map/api-destination-geocoder";
import {
  createFixtureGeocoder,
  type DestinationGeocoder,
} from "@/src/features/map/destination-geocoder";
import type { CatalogueModeResolution } from "@/src/features/catalogue/catalogue-mode";

/**
 * Every data seam the client surfaces read through, resolved once.
 *
 * Components never construct a source and never fetch. They are handed these
 * adapters, which is what lets one screen render fixtures in a test and the v1
 * read API in staging without a component change.
 */
export interface CatalogueAdapters {
  readonly resolution: CatalogueModeResolution;
  /** `null` when the catalogue mode itself is unusable. */
  readonly shopSource: ShopSource | null;
  readonly geocoder: DestinationGeocoder;
  readonly locator: ShopLocator;
  /**
   * Whether the simulated stamp collection may be offered.
   *
   * Issue #25: the simulated flow is fixture/reviewer-only, because a simulated
   * impression beside real catalogue records would read as a real collection.
   * Real issuance is Milestone 5.
   */
  readonly simulatedCollection: boolean;
  /**
   * Whether device-local prototype saves can be resolved against the catalogue.
   *
   * Prototype saved/visited state is a set of fixture record ids held on the
   * device. It is not user-state read from the catalogue, and Milestone 3
   * explicitly excludes user-state reads, so in API mode the two are kept apart
   * instead of joined across id spaces.
   */
  readonly prototypeCatalogueJoin: boolean;
}

/** A geocoder that finds nothing, for a mode with no usable supplier. */
const UNAVAILABLE_GEOCODER: DestinationGeocoder = {
  search() {
    return Promise.resolve({ destinations: [], shops: [] });
  },
};

const UNAVAILABLE_LOCATOR: ShopLocator = {
  locate() {
    return Promise.resolve(null);
  },
};

export interface CatalogueAdapterOptions {
  /** Test seam; production uses the platform `fetch`. */
  readonly fetch?: typeof fetch;
  /** Fixture latency, so the loading states are reviewable. */
  readonly fixtureLatencyMs?: number;
}

export function createCatalogueAdapters(
  resolution: CatalogueModeResolution,
  options: CatalogueAdapterOptions = {},
): CatalogueAdapters {
  if (resolution.mode === "api") {
    const client = createHttpShopReadClient(
      options.fetch === undefined ? {} : { fetch: options.fetch },
    );

    return {
      resolution,
      shopSource: createHttpShopSource(
        options.fetch === undefined ? {} : { fetch: options.fetch },
      ),
      geocoder: createApiGeocoder({ client }),
      locator: createHttpShopLocator(client),
      simulatedCollection: false,
      prototypeCatalogueJoin: false,
    };
  }

  if (resolution.mode === "fixture") {
    return {
      resolution,
      shopSource: createFixtureShopSource(
        options.fixtureLatencyMs === undefined
          ? {}
          : { latencyMs: options.fixtureLatencyMs },
      ),
      geocoder: createFixtureGeocoder(),
      locator: createFixtureShopLocator(),
      simulatedCollection: true,
      prototypeCatalogueJoin: true,
    };
  }

  // Misconfigured. No supplier, and no fixture stand-in: a deployment that asked
  // for something unrecognised must not be handed demonstration data that looks
  // like a working catalogue.
  return {
    resolution,
    shopSource: null,
    geocoder: UNAVAILABLE_GEOCODER,
    locator: UNAVAILABLE_LOCATOR,
    simulatedCollection: false,
    prototypeCatalogueJoin: false,
  };
}
