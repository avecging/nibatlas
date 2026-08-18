import { describe, expect, it } from "vitest";

import type { Viewport } from "@/src/domain/geo";
import {
  createExploreState,
  exploreReducer,
  hasUncommittedFilters,
  shouldOfferSearchArea,
  type ExploreState,
} from "@/src/features/explore/explore-state";
import type { ShopMapSummary } from "@/src/domain/shops";

const tokyo: Viewport = {
  bounds: { west: 139.6, south: 35.58, east: 139.85, north: 35.78 },
  zoom: 11,
};

const kyoto: Viewport = {
  bounds: { west: 135.68, south: 34.94, east: 135.83, north: 35.08 },
  zoom: 11,
};

const shop: ShopMapSummary = {
  id: "shop-1",
  slug: "demo-shop",
  name: "Demo Shop",
  countryCode: "JP",
  localityName: "Chūō, Tokyo",
  position: { latitude: 35.67, longitude: 139.76 },
  primaryType: "fountain_pen_specialist",
  operationalStatus: "open",
  markerState: "unvisited",
  sourceQuality: "demo",
};

function loaded(state: ExploreState, shops: readonly ShopMapSummary[] = [shop]): ExploreState {
  return exploreReducer(state, {
    type: "resultsLoaded",
    requestId: state.requestId,
    shops,
    truncated: false,
  });
}

describe("explore reducer", () => {
  it("adopts the renderer camera without offering a new search", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const settled = exploreReducer(initial, {
      type: "adoptCamera",
      camera: { ...tokyo, zoom: 11.4 },
    });

    expect(shouldOfferSearchArea(settled)).toBe(false);
  });

  it("does not refetch while the camera moves", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const moved = exploreReducer(initial, { type: "cameraMoved", camera: kyoto });

    expect(moved.requestId).toBe(initial.requestId);
    expect(moved.committed).toEqual(initial.committed);
    expect(shouldOfferSearchArea(moved)).toBe(true);
  });

  it("commits the camera only when the user asks", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const moved = exploreReducer(initial, { type: "cameraMoved", camera: kyoto });
    const committed = exploreReducer(moved, { type: "commitSearch" });

    expect(committed.committed).toEqual(kyoto);
    expect(committed.status).toBe("loading");
    expect(committed.requestId).toBe(initial.requestId + 1);
    expect(shouldOfferSearchArea(committed)).toBe(false);
  });

  it("keeps filter changes uncommitted until the next search", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const filtered = exploreReducer(initial, { type: "setStatusFilter", status: "saved" });

    expect(hasUncommittedFilters(filtered)).toBe(true);
    expect(filtered.committedFilters.status).toBe("all");
    expect(shouldOfferSearchArea(filtered)).toBe(true);

    const committed = exploreReducer(filtered, { type: "commitSearch" });
    expect(committed.committedFilters.status).toBe("saved");
  });

  it("ignores stale responses", () => {
    const initial = createExploreState({ viewport: tokyo });
    const stale = exploreReducer(initial, {
      type: "resultsLoaded",
      requestId: initial.requestId - 1,
      shops: [shop],
      truncated: false,
    });

    expect(stale.results).toEqual([]);
  });

  it("keeps old results usable after a failure", () => {
    const withResults = loaded(createExploreState({ viewport: tokyo }));
    const failed = exploreReducer(withResults, {
      type: "resultsFailed",
      requestId: withResults.requestId,
    });

    expect(failed.status).toBe("error");
    expect(failed.results).toHaveLength(1);
  });

  it("clears a selection that leaves the result set", () => {
    const selected = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
      type: "selectShop",
      shopId: shop.id,
    });
    const requeried = exploreReducer(selected, { type: "commitSearch" });
    const refreshed = exploreReducer(requeried, {
      type: "resultsLoaded",
      requestId: requeried.requestId,
      shops: [],
      truncated: false,
    });

    expect(refreshed.selectedShopId).toBeNull();
  });

  it("keeps a selection that survives the new result set", () => {
    const selected = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
      type: "selectShop",
      shopId: shop.id,
    });
    const requeried = exploreReducer(selected, { type: "commitSearch" });
    const refreshed = exploreReducer(requeried, {
      type: "resultsLoaded",
      requestId: requeried.requestId,
      shops: [shop],
      truncated: false,
    });

    expect(refreshed.selectedShopId).toBe(shop.id);
  });

  it("moves the sheet between its three states", () => {
    const state = createExploreState({ viewport: tokyo });

    expect(state.sheetState).toBe("peek");
    expect(
      exploreReducer(state, { type: "setSheetState", sheetState: "full" }).sheetState,
    ).toBe("full");
  });
});
