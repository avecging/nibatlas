import { describe, expect, it } from "vitest";

import type { Viewport } from "@/src/domain/geo";
import {
  createExploreState,
  exploreReducer,
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
  specialtyLine: "Nib testing bench",
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

  /*
   * Staging reported the filter buttons as "not functioning". They were doing
   * exactly what Milestone 1 built — waiting for the next committed search —
   * which is indistinguishable from broken. A visit or availability filter now
   * takes effect where it is pressed, with no round trip and no new search.
   */
  it("applies a visit filter immediately and without refetching", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const filtered = exploreReducer(initial, { type: "setStatusFilter", status: "saved" });

    expect(filtered.filters.status).toBe("saved");
    expect(filtered.requestId).toBe(initial.requestId);
    expect(filtered.status).toBe("idle");
    expect(shouldOfferSearchArea(filtered)).toBe(false);
  });

  it("applies an availability filter immediately and without refetching", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const filtered = exploreReducer(initial, {
      type: "setAvailabilityFilter",
      availability: "open",
    });

    expect(filtered.filters.availability).toBe("open");
    expect(filtered.query).toBe(initial.query);
  });

  /*
   * Shop type is resolved by the source, so it does need a round trip — but
   * against the bounds already committed. Narrowing the results a reader is
   * looking at must never quietly search somewhere else.
   */
  it("re-queries the committed bounds when a shop type changes", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const moved = exploreReducer(initial, { type: "cameraMoved", camera: kyoto });
    const typed = exploreReducer(moved, {
      type: "toggleShopType",
      shopType: "vintage_used",
    });

    expect(typed.filters.shopTypes).toEqual(["vintage_used"]);
    expect(typed.requestId).toBe(initial.requestId + 1);
    expect(typed.query.bounds).toEqual(tokyo.bounds);
    expect(typed.committed).toEqual(initial.committed);
    expect(typed.status).toBe("loading");

    // The outstanding `Search this area` for the moved camera survives.
    const settled = exploreReducer(typed, {
      type: "resultsLoaded",
      requestId: typed.requestId,
      shops: [shop],
      truncated: false,
    });

    expect(shouldOfferSearchArea(settled)).toBe(true);
  });

  it("clears every filter in one action, re-querying only when the source must", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const set = exploreReducer(
      exploreReducer(initial, { type: "setStatusFilter", status: "visited" }),
      { type: "setAvailabilityFilter", availability: "open" },
    );

    const cleared = exploreReducer(set, { type: "clearFilters" });

    expect(cleared.filters).toEqual({ status: "all", shopTypes: [], availability: "any" });
    expect(cleared.requestId).toBe(set.requestId);

    const typed = exploreReducer(set, { type: "toggleShopType", shopType: "vintage_used" });
    const clearedAfterType = exploreReducer(typed, { type: "clearFilters" });

    expect(clearedAfterType.filters.shopTypes).toEqual([]);
    expect(clearedAfterType.requestId).toBe(typed.requestId + 1);
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

  it("adopts a resize that arrives while nothing is pending", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const resized = exploreReducer(initial, {
      type: "reframeCamera",
      camera: { ...tokyo, zoom: 11.3 },
    });

    expect(resized.committed).toEqual(resized.camera);
    expect(shouldOfferSearchArea(resized)).toBe(false);
    expect(resized.requestId).toBe(initial.requestId);
  });

  it("does not let a resize erase an outstanding Search this area", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const moved = exploreReducer(initial, { type: "cameraMoved", camera: kyoto });

    expect(shouldOfferSearchArea(moved)).toBe(true);

    const resized = exploreReducer(moved, {
      type: "reframeCamera",
      camera: { ...kyoto, zoom: 11.1 },
    });

    expect(shouldOfferSearchArea(resized)).toBe(true);
    expect(resized.committed).toEqual(initial.committed);
    expect(resized.requestId).toBe(initial.requestId);
  });

  it("never refetches on a resize", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const resized = exploreReducer(initial, {
      type: "reframeCamera",
      camera: { ...tokyo, zoom: 11.3 },
    });

    expect(resized.query).toBe(initial.query);
  });

  it("moves the sheet between its three states", () => {
    const state = createExploreState({ viewport: tokyo });

    expect(state.sheetState).toBe("peek");
    expect(
      exploreReducer(state, { type: "setSheetState", sheetState: "full" }).sheetState,
    ).toBe("full");
  });
});
