import {
  DEFAULT_MOVEMENT_THRESHOLD,
  hasMovedMeaningfully,
  type Viewport,
} from "@/src/domain/geo";
import {
  EMPTY_FILTERS,
  filtersEqual,
  toggleShopType,
  type ShopFilters,
  type StatusFilter,
} from "@/src/domain/filters";
import type { ViewportBounds } from "@/src/domain/geo";
import type { ShopMapSummary, ShopType } from "@/src/domain/shops";

export type SheetState = "peek" | "half" | "full";
export const SHEET_STATES: readonly SheetState[] = ["peek", "half", "full"];

export type ExploreStatus = "idle" | "loading" | "error";

/**
 * The committed query. It changes only when the user commits a search, so
 * adopting a renderer-resolved camera can never trigger a refetch.
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
  readonly committedFilters: ShopFilters;
  readonly draftFilters: ShopFilters;
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
    committedFilters: filters,
    draftFilters: filters,
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
        committedFilters: state.draftFilters,
        status: "loading",
        requestId,
        query: {
          requestId,
          bounds: viewport.bounds,
          zoom: viewport.zoom,
          shopTypes: state.draftFilters.shopTypes,
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

    case "setStatusFilter": {
      return {
        ...state,
        draftFilters: { ...state.draftFilters, status: action.status },
      };
    }

    case "toggleShopType": {
      return {
        ...state,
        draftFilters: toggleShopType(state.draftFilters, action.shopType),
      };
    }

    case "clearFilters": {
      return { ...state, draftFilters: EMPTY_FILTERS };
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
 * `Search this area` is offered after meaningful camera movement or after the
 * user changes a filter that has not been committed yet. It is never offered
 * while a committed query is already in flight.
 */
export function shouldOfferSearchArea(state: ExploreState): boolean {
  if (state.status === "loading") {
    return false;
  }

  if (!filtersEqual(state.draftFilters, state.committedFilters)) {
    return true;
  }

  return hasMovedMeaningfully(
    state.committed,
    state.camera,
    DEFAULT_MOVEMENT_THRESHOLD,
  );
}

export function hasUncommittedFilters(state: ExploreState): boolean {
  return !filtersEqual(state.draftFilters, state.committedFilters);
}
