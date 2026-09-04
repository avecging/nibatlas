import {
  DEFAULT_MOVEMENT_THRESHOLD,
  hasMovedMeaningfully,
  type Viewport,
} from "@/src/domain/geo";
import {
  EMPTY_FILTERS,
  filtersEqual,
  toggleShopType,
  type AvailabilityFilter,
  type ShopFilters,
  type StatusFilter,
} from "@/src/domain/filters";
import type { ViewportBounds } from "@/src/domain/geo";
import type { ShopMapSummary, ShopType } from "@/src/domain/shops";

export type SheetState = "peek" | "half" | "full";
export const SHEET_STATES: readonly SheetState[] = ["peek", "half", "full"];

/**
 * `unavailable` is not `error`.
 *
 * An error is a request that failed and can be retried. `unavailable` is a
 * catalogue that cannot be asked at all — a misconfigured mode — so there is
 * nothing to retry and no result set to keep. Issue #25 requires that state to
 * be visible rather than disguised by fixture data.
 */
export type ExploreStatus = "idle" | "loading" | "error" | "unavailable";

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
   * The filters the displayed results are under.
   *
   * Milestone 1 held a draft set that only took effect on the next committed
   * search, with no commit action of its own — a reader pressed `Saved`, nothing
   * moved, and small print asked them to search the area. That read as broken.
   *
   * What replaces it is an explicit transaction rather than no transaction at
   * all. The visit segment is a top-level control and commits on press. Shop
   * type and availability are edited in the drawer as `draftFilters` and commit
   * together on **Apply filters**, so the reader never sees one dimension land
   * while another waits on a query.
   */
  readonly filters: ShopFilters;
  /**
   * The drawer's working copy. It exists only while the drawer is open, is
   * seeded from `filters` when it opens, and is discarded when it closes without
   * applying.
   */
  readonly draftFilters: ShopFilters;
  readonly filtersOpen: boolean;
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
  | { readonly type: "retryQuery" }
  | { readonly type: "catalogueUnavailable" }
  | { readonly type: "selectShop"; readonly shopId: string | null }
  | { readonly type: "setStatusFilter"; readonly status: StatusFilter }
  | { readonly type: "restoreFilters"; readonly filters: ShopFilters }
  | { readonly type: "openFilters" }
  | { readonly type: "closeFilters" }
  | {
      readonly type: "setDraftAvailability";
      readonly availability: AvailabilityFilter;
    }
  | { readonly type: "toggleDraftShopType"; readonly shopType: ShopType }
  | { readonly type: "clearDraftFilters" }
  | { readonly type: "applyFilters"; readonly viewport?: Viewport }
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
    draftFilters: filters,
    filtersOpen: false,
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
 * Commit a filter set, re-running the query when the source has to resolve part
 * of it and, optionally, over a viewport the caller supplies.
 *
 * Applying filters may carry the camera with it, which is how a reader who has
 * panned and then filtered gets one commit rather than two. With no viewport
 * given the bounds are the ones already committed: narrowing the results a
 * reader is looking at must never quietly search somewhere else, and an
 * outstanding `Search this area` survives untouched.
 */
function commitFilters(
  state: ExploreState,
  filters: ShopFilters,
  viewport?: Viewport,
): ExploreState {
  const settled: ExploreState = {
    ...state,
    filters,
    draftFilters: filters,
    filtersOpen: false,
  };

  const requeries =
    viewport !== undefined ||
    filters.shopTypes.length !== state.query.shopTypes.length ||
    filters.shopTypes.some((type) => !state.query.shopTypes.includes(type));

  if (!requeries) {
    return settled;
  }

  const bounds = viewport ?? state.committed;
  const requestId = state.requestId + 1;

  return {
    ...settled,
    ...(viewport === undefined ? {} : { camera: viewport, committed: viewport }),
    status: "loading",
    requestId,
    query: {
      requestId,
      bounds: bounds.bounds,
      zoom: bounds.zoom,
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

    /*
     * Retry re-runs the query the displayed results are under, not the camera.
     *
     * A failed refresh leaves the reader looking at the previous results with the
     * map wherever they last moved it. Committing the camera instead would
     * quietly search somewhere else and call it a retry.
     */
    case "retryQuery": {
      if (state.status !== "error") {
        return state;
      }

      const requestId = state.requestId + 1;

      return {
        ...state,
        status: "loading",
        requestId,
        query: { ...state.query, requestId },
      };
    }

    case "catalogueUnavailable": {
      return { ...state, status: "unavailable", results: [], truncated: false };
    }

    case "selectShop": {
      if (action.shopId === state.selectedShopId) {
        return state;
      }

      return { ...state, selectedShopId: action.shopId };
    }

    /*
     * The visit segment is a top-level control, decided over the result set
     * already in hand. Pressing it *is* its commit: it lands whole, on the same
     * frame, with no round trip and nothing left waiting. The drawer is closed
     * whenever it is reachable, so a segment press can never land while a
     * drafted shop type is still waiting on Apply.
     */
    case "setStatusFilter": {
      const filters = { ...state.filters, status: action.status };

      return { ...state, filters, draftFilters: filters };
    }

    case "restoreFilters": {
      return commitFilters(state, action.filters);
    }

    case "openFilters": {
      return { ...state, filtersOpen: true, draftFilters: state.filters };
    }

    // Closing without applying discards the draft.
    case "closeFilters": {
      return { ...state, filtersOpen: false, draftFilters: state.filters };
    }

    case "setDraftAvailability": {
      return {
        ...state,
        draftFilters: { ...state.draftFilters, availability: action.availability },
      };
    }

    case "toggleDraftShopType": {
      return {
        ...state,
        draftFilters: toggleShopType(state.draftFilters, action.shopType),
      };
    }

    /*
     * The drawer's Clear is for the drawer's own controls. The visit segment is
     * outside it, so clearing shop type and availability must not silently reset
     * a choice the reader made out there — that is what the bar's
     * `Clear filters` is for.
     */
    case "clearDraftFilters": {
      return {
        ...state,
        draftFilters: { ...EMPTY_FILTERS, status: state.draftFilters.status },
      };
    }

    case "applyFilters": {
      return commitFilters(state, state.draftFilters, action.viewport);
    }

    case "clearFilters": {
      return commitFilters(state, EMPTY_FILTERS);
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
 * while a committed query is already in flight.
 *
 * It is about *movement only*. Filters have their own commit — the segment on
 * press, the drawer on Apply — so a filter change never raises this prompt, and
 * an Apply that carries the moved camera settles it in the same action.
 */
export function shouldOfferSearchArea(state: ExploreState): boolean {
  if (state.status === "loading" || state.status === "unavailable") {
    return false;
  }

  return hasMovedMeaningfully(
    state.committed,
    state.camera,
    DEFAULT_MOVEMENT_THRESHOLD,
  );
}

/** Whether the drawer holds changes the reader has not applied yet. */
export function hasUnappliedFilters(state: ExploreState): boolean {
  return !filtersEqual(state.draftFilters, state.filters);
}

/**
 * Whether a draft's match count can be counted exactly from the results already
 * loaded, rather than guessed.
 *
 * Visit state and availability are decided over the loaded set, so they always
 * can be. Shop type is resolved by the source, so a draft that *widens* the
 * committed type selection would be counted against a set that never contained
 * the shops it is asking for — and a truncated result set is a lower bound on
 * any question at all. In both cases the drawer says nothing rather than
 * something wrong.
 */
export function canCountDraftMatches(state: ExploreState): boolean {
  if (state.truncated || state.status === "loading") {
    return false;
  }

  const committed = state.query.shopTypes;

  if (committed.length === 0) {
    return true;
  }

  const draft = state.draftFilters.shopTypes;

  return draft.length > 0 && draft.every((type) => committed.includes(type));
}
