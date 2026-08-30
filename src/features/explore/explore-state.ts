import {
  DEFAULT_MOVEMENT_THRESHOLD,
  hasMovedMeaningfully,
  type Viewport,
} from "@/src/domain/geo";
import {
  EMPTY_FILTERS,
  toggleShopType,
  type AvailabilityFilter,
  type ShopFilters,
  type StatusFilter,
} from "@/src/domain/filters";
import type { ViewportBounds } from "@/src/domain/geo";
import type { ShopMapSummary, ShopType } from "@/src/domain/shops";

export type SheetState = "peek" | "half" | "full";
export const SHEET_STATES: readonly SheetState[] = ["peek", "half", "full"];

export type ExploreStatus = "idle" | "loading" | "error";

/**
 * The committed query. It changes only when the user commits a search or changes
 * a filter the source itself resolves, so adopting a renderer-resolved camera can
 * never trigger a refetch.
 */
export interface CommittedQuery {
  readonly requestId: number;
  readonly bounds: ViewportBounds;
  readonly zoom: number;
  readonly shopTypes: readonly ShopType[];
}

export interface ExploreState {
  readonly committed: Viewport;
  readonly camera: Viewport;
  /**
   * One filter set, applied as soon as it is changed.
   *
   * Milestone 1 held a draft set that only took effect on the next committed
   * search. On staging that made the filter controls look broken: a reader
   * pressed `Saved` and the results did not move. `Search this area` exists for
   * *movement* — a filter is not movement, so it applies at once and, when the
   * source itself resolves the criterion, re-queries the bounds already
   * committed rather than wherever the camera happens to be.
   */
  readonly filters: ShopFilters;
  /** Public projection for the committed viewport; user state is merged for display. */
  readonly results: readonly ShopMapSummary[];
  readonly truncated: boolean;
  readonly status: ExploreStatus;
  readonly selectedShopId: string | null;
  readonly sheetState: SheetState;
  readonly requestId: number;
  readonly query: CommittedQuery;
  readonly lastCommittedLabel: string | null;
}

export type ExploreAction =
  | { readonly type: "cameraMoved"; readonly camera: Viewport }
  | { readonly type: "adoptCamera"; readonly camera: Viewport }
  | { readonly type: "reframeCamera"; readonly camera: Viewport }
  | {
      readonly type: "commitSearch";
      readonly viewport?: Viewport;
      readonly label?: string;
    }
  | {
      readonly type: "resultsLoaded";
      readonly requestId: number;
      readonly shops: readonly ShopMapSummary[];
      readonly truncated: boolean;
    }
  | { readonly type: "resultsFailed"; readonly requestId: number }
  | { readonly type: "selectShop"; readonly shopId: string | null }
  | { readonly type: "setStatusFilter"; readonly status: StatusFilter }
  | { readonly type: "setAvailabilityFilter"; readonly availability: AvailabilityFilter }
  | { readonly type: "toggleShopType"; readonly shopType: ShopType }
  | { readonly type: "clearFilters" }
  | { readonly type: "setSheetState"; readonly sheetState: SheetState };

export interface CreateExploreStateOptions {
  readonly viewport: Viewport;
  readonly filters?: ShopFilters;
  readonly sheetState?: SheetState;
}

export function createExploreState({
  viewport,
  filters = EMPTY_FILTERS,
  sheetState = "peek",
}: CreateExploreStateOptions): ExploreState {
  return {
    committed: viewport,
    camera: viewport,
    filters,
    results: [],
    truncated: false,
    status: "loading",
    selectedShopId: null,
    sheetState,
    requestId: 1,
    query: {
      requestId: 1,
      bounds: viewport.bounds,
      zoom: viewport.zoom,
      shopTypes: filters.shopTypes,
    },
    lastCommittedLabel: null,
  };
}

/**
 * Re-run the *committed* query under a new filter set.
 *
 * Only criteria the source resolves reach this — today, shop type. The reader
 * asked to narrow the results they are looking at, not to search somewhere else,
 * so the bounds are the committed ones and an outstanding `Search this area`
 * for a moved camera survives untouched.
 */
function requery(state: ExploreState, filters: ShopFilters): ExploreState {
  const requestId = state.requestId + 1;

  return {
    ...state,
    filters,
    status: "loading",
    requestId,
    query: {
      requestId,
      bounds: state.committed.bounds,
      zoom: state.committed.zoom,
      shopTypes: filters.shopTypes,
    },
  };
}

export function exploreReducer(
  state: ExploreState,
  action: ExploreAction,
): ExploreState {
  switch (action.type) {
    case "cameraMoved": {
      return { ...state, camera: action.camera };
    }

    case "adoptCamera": {
      // The renderer resolves requested bounds to its own aspect ratio and zoom.
      // Adopting that first camera keeps `Search this area` hidden until the
      // user actually moves the map.
      return { ...state, camera: action.camera, committed: action.camera };
    }

    case "reframeCamera": {
      // A container resize shows the same place through a different window. It
      // must not invent movement the user did not make, and it must not erase an
      // outstanding `Search this area` they have not acted on yet.
      const next = { ...state, camera: action.camera };

      return shouldOfferSearchArea(state) ? next : { ...next, committed: action.camera };
    }

    case "commitSearch": {
      const viewport = action.viewport ?? state.camera;
      const requestId = state.requestId + 1;

      return {
        ...state,
        camera: viewport,
        committed: viewport,
        status: "loading",
        requestId,
        query: {
          requestId,
          bounds: viewport.bounds,
          zoom: viewport.zoom,
          shopTypes: state.filters.shopTypes,
        },
        lastCommittedLabel: action.label ?? null,
      };
    }

    case "resultsLoaded": {
      if (action.requestId !== state.requestId) {
        return state;
      }

      const stillVisible =
        state.selectedShopId !== null &&
        action.shops.some((shop) => shop.id === state.selectedShopId);

      return {
        ...state,
        results: action.shops,
        truncated: action.truncated,
        status: "idle",
        selectedShopId: stillVisible ? state.selectedShopId : null,
      };
    }

    case "resultsFailed": {
      if (action.requestId !== state.requestId) {
        return state;
      }

      // Old results stay usable; the user is offered Retry.
      return { ...state, status: "error" };
    }

    case "selectShop": {
      if (action.shopId === state.selectedShopId) {
        return state;
      }

      return { ...state, selectedShopId: action.shopId };
    }

    // Visit state and availability are decided over the result set already in
    // hand, so they need no round trip and take effect on the same frame.
    case "setStatusFilter": {
      return { ...state, filters: { ...state.filters, status: action.status } };
    }

    case "setAvailabilityFilter": {
      return {
        ...state,
        filters: { ...state.filters, availability: action.availability },
      };
    }

    case "toggleShopType": {
      return requery(state, toggleShopType(state.filters, action.shopType));
    }

    case "clearFilters": {
      if (state.filters.shopTypes.length === 0) {
        return { ...state, filters: EMPTY_FILTERS };
      }

      return requery(state, EMPTY_FILTERS);
    }

    case "setSheetState": {
      return { ...state, sheetState: action.sheetState };
    }

    default: {
      return state;
    }
  }
}

/**
 * `Search this area` is offered after meaningful camera movement, and never
 * while a committed query is already in flight. Filters no longer wait on it:
 * they apply where they are changed.
 */
export function shouldOfferSearchArea(state: ExploreState): boolean {
  if (state.status === "loading") {
    return false;
  }

  return hasMovedMeaningfully(
    state.committed,
    state.camera,
    DEFAULT_MOVEMENT_THRESHOLD,
  );
}
