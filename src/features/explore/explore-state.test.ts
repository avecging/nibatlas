import { describe, expect, it } from "vitest";

import type { Viewport } from "@/src/domain/geo";
import {
  canCountDraftMatches,
  createExploreState,
  exploreReducer,
  hasUnappliedFilters,
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
   * exactly what Milestone 1 built — waiting for the next committed search, with
   * no commit action of their own — which is indistinguishable from broken.
   *
   * The replacement is an explicit transaction. The visit segment is a top-level
   * control and commits on press; the drawer drafts and commits on Apply.
   */
  it("commits a visit filter on press, with no round trip", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const filtered = exploreReducer(initial, { type: "setStatusFilter", status: "saved" });

    expect(filtered.filters.status).toBe("saved");
    expect(filtered.draftFilters.status).toBe("saved");
    expect(filtered.requestId).toBe(initial.requestId);
    expect(filtered.status).toBe("idle");
    expect(hasUnappliedFilters(filtered)).toBe(false);
    expect(shouldOfferSearchArea(filtered)).toBe(false);
  });

  it("keeps drawer edits in draft until they are applied", () => {
    const opened = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
      type: "openFilters",
    });
    const drafted = exploreReducer(
      exploreReducer(opened, { type: "setDraftAvailability", availability: "open" }),
      { type: "toggleDraftShopType", shopType: "vintage_used" },
    );

    // Nothing has moved: not the results, not the query, not the filter set.
    expect(drafted.filters).toEqual(opened.filters);
    expect(drafted.query).toBe(opened.query);
    expect(hasUnappliedFilters(drafted)).toBe(true);

    const applied = exploreReducer(drafted, { type: "applyFilters" });

    expect(applied.filters.availability).toBe("open");
    expect(applied.filters.shopTypes).toEqual(["vintage_used"]);
    expect(applied.filtersOpen).toBe(false);
    expect(hasUnappliedFilters(applied)).toBe(false);
  });

  /*
   * One commit action, not two. Availability must never land while a shop type
   * is still waiting on the source.
   */
  it("commits every dimension together, in one request", () => {
    const opened = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
      type: "openFilters",
    });
    const drafted = exploreReducer(
      exploreReducer(opened, { type: "setDraftAvailability", availability: "open" }),
      { type: "toggleDraftShopType", shopType: "vintage_used" },
    );
    const applied = exploreReducer(drafted, { type: "applyFilters" });

    expect(applied.requestId).toBe(opened.requestId + 1);
    expect(applied.query.shopTypes).toEqual(["vintage_used"]);
    expect(applied.query.bounds).toEqual(tokyo.bounds);
    expect(applied.status).toBe("loading");
  });

  it("closing the drawer discards an unapplied draft", () => {
    const opened = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
      type: "openFilters",
    });
    const drafted = exploreReducer(opened, {
      type: "toggleDraftShopType",
      shopType: "vintage_used",
    });
    const closed = exploreReducer(drafted, { type: "closeFilters" });

    expect(closed.filtersOpen).toBe(false);
    expect(closed.draftFilters).toEqual(closed.filters);
    expect(closed.requestId).toBe(opened.requestId);
  });

  it("applies no request when the draft changes nothing the source resolves", () => {
    const opened = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
      type: "openFilters",
    });
    const drafted = exploreReducer(opened, {
      type: "setDraftAvailability",
      availability: "not_closed",
    });
    const applied = exploreReducer(drafted, { type: "applyFilters" });

    expect(applied.filters.availability).toBe("not_closed");
    expect(applied.query).toBe(opened.query);
    expect(applied.status).toBe("idle");
  });

  it("clears the draft controls, which then need applying like any other draft", () => {
    const opened = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
      type: "openFilters",
    });
    const drafted = exploreReducer(
      exploreReducer(opened, { type: "setDraftAvailability", availability: "open" }),
      { type: "toggleDraftShopType", shopType: "vintage_used" },
    );
    const applied = exploreReducer(drafted, { type: "applyFilters" });

    const reopened = exploreReducer(applied, { type: "openFilters" });
    const cleared = exploreReducer(reopened, { type: "clearDraftFilters" });

    expect(cleared.draftFilters.shopTypes).toEqual([]);
    expect(cleared.draftFilters.availability).toBe("any");
    // Still a draft: the results are untouched until it is applied.
    expect(cleared.filters.shopTypes).toEqual(["vintage_used"]);

    const settled = exploreReducer(cleared, { type: "applyFilters" });

    expect(settled.filters.shopTypes).toEqual([]);
    expect(settled.query.shopTypes).toEqual([]);
  });

  /*
   * The drawer's Clear is for the drawer's own controls. The visit segment lives
   * outside it, and clearing shop type must not silently reset a choice made out
   * there — the bar's `Clear filters` is what clears everything.
   */
  it("leaves the visit segment alone when the drawer's controls are cleared", () => {
    const withStatus = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
      type: "setStatusFilter",
      status: "saved",
    });
    const drafted = exploreReducer(
      exploreReducer(withStatus, { type: "openFilters" }),
      { type: "toggleDraftShopType", shopType: "vintage_used" },
    );
    const cleared = exploreReducer(drafted, { type: "clearDraftFilters" });

    expect(cleared.draftFilters.status).toBe("saved");
    expect(cleared.draftFilters.shopTypes).toEqual([]);

    const applied = exploreReducer(cleared, { type: "applyFilters" });

    expect(applied.filters.status).toBe("saved");
    expect(applied.filters.shopTypes).toEqual([]);
  });

  /*
   * A reader who pans and then filters gets one commit, not two: applying may
   * carry the moved camera with it, which settles the outstanding offer.
   */
  it("can commit the moved camera together with the filters", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const moved = exploreReducer(initial, { type: "cameraMoved", camera: kyoto });

    expect(shouldOfferSearchArea(moved)).toBe(true);

    const drafted = exploreReducer(
      exploreReducer(moved, { type: "openFilters" }),
      { type: "toggleDraftShopType", shopType: "vintage_used" },
    );
    const applied = exploreReducer(drafted, {
      type: "applyFilters",
      viewport: kyoto,
    });

    expect(applied.committed).toEqual(kyoto);
    expect(applied.query.bounds).toEqual(kyoto.bounds);
    expect(applied.query.shopTypes).toEqual(["vintage_used"]);

    const settled = exploreReducer(applied, {
      type: "resultsLoaded",
      requestId: applied.requestId,
      shops: [shop],
      truncated: false,
    });

    expect(shouldOfferSearchArea(settled)).toBe(false);
  });

  /** Camera-only movement still goes through `Search this area`. */
  it("leaves Search this area to camera movement alone", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const moved = exploreReducer(initial, { type: "cameraMoved", camera: kyoto });
    const drafted = exploreReducer(
      exploreReducer(moved, { type: "openFilters" }),
      { type: "setDraftAvailability", availability: "open" },
    );
    // Applying without a viewport narrows what is on screen and nothing else.
    const applied = exploreReducer(drafted, { type: "applyFilters" });

    expect(applied.committed).toEqual(initial.committed);
    expect(shouldOfferSearchArea(applied)).toBe(true);
  });

  it("clears every applied filter in one action from outside the drawer", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const withStatus = exploreReducer(initial, {
      type: "setStatusFilter",
      status: "visited",
    });
    const withType = exploreReducer(
      exploreReducer(exploreReducer(withStatus, { type: "openFilters" }), {
        type: "toggleDraftShopType",
        shopType: "vintage_used",
      }),
      { type: "applyFilters" },
    );

    const cleared = exploreReducer(withType, { type: "clearFilters" });

    expect(cleared.filters).toEqual({ status: "all", shopTypes: [], availability: "any" });
    expect(cleared.draftFilters).toEqual(cleared.filters);
    expect(cleared.query.shopTypes).toEqual([]);
    expect(cleared.requestId).toBe(withType.requestId + 1);
  });

  /*
   * The drawer promises a count only when the loaded set can answer the draft's
   * question exactly.
   */
  describe("the draft match count", () => {
    it("counts against the loaded set when no shop type is committed", () => {
      const opened = exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
        type: "openFilters",
      });

      expect(canCountDraftMatches(opened)).toBe(true);
      expect(
        canCountDraftMatches(
          exploreReducer(opened, { type: "toggleDraftShopType", shopType: "vintage_used" }),
        ),
      ).toBe(true);
    });

    it("declines to count a draft that widens the committed shop types", () => {
      const narrowed = exploreReducer(
        exploreReducer(exploreReducer(loaded(createExploreState({ viewport: tokyo })), {
          type: "openFilters",
        }), { type: "toggleDraftShopType", shopType: "vintage_used" }),
        { type: "applyFilters" },
      );
      const settled = loaded(narrowed);
      const reopened = exploreReducer(settled, { type: "openFilters" });

      // Narrowing further is still countable.
      expect(canCountDraftMatches(reopened)).toBe(true);

      // Removing the only committed type asks about shops never loaded.
      expect(
        canCountDraftMatches(
          exploreReducer(reopened, {
            type: "toggleDraftShopType",
            shopType: "vintage_used",
          }),
        ),
      ).toBe(false);

      // So does adding one alongside it.
      expect(
        canCountDraftMatches(
          exploreReducer(reopened, {
            type: "toggleDraftShopType",
            shopType: "stationery_store",
          }),
        ),
      ).toBe(false);
    });

    it("declines to count against a truncated result set", () => {
      const state = createExploreState({ viewport: tokyo });
      const truncated = exploreReducer(state, {
        type: "resultsLoaded",
        requestId: state.requestId,
        shops: [shop],
        truncated: true,
      });

      expect(canCountDraftMatches(exploreReducer(truncated, { type: "openFilters" }))).toBe(
        false,
      );
    });
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

  it("ignores a failure reported for a request that is no longer current", () => {
    const withResults = loaded(createExploreState({ viewport: tokyo }));
    const stale = exploreReducer(withResults, {
      type: "resultsFailed",
      requestId: withResults.requestId - 1,
    });

    expect(stale.status).toBe("idle");
  });

  /*
   * The request storm guard. The committed query is the effect's only dependency,
   * so a continuous drag must leave it untouched — identical, not merely equal.
   */
  it("leaves the committed query identical through a long drag", () => {
    const initial = loaded(createExploreState({ viewport: tokyo }));
    const dragged = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06].reduce(
      (state, delta) =>
        exploreReducer(state, {
          type: "cameraMoved",
          camera: {
            bounds: {
              west: tokyo.bounds.west + delta,
              south: tokyo.bounds.south + delta,
              east: tokyo.bounds.east + delta,
              north: tokyo.bounds.north + delta,
            },
            zoom: tokyo.zoom,
          },
        }),
      initial,
    );

    expect(dragged.query).toBe(initial.query);
    expect(dragged.requestId).toBe(initial.requestId);
  });

  /*
   * Restoring a filter set the screen was handed, rather than one the reader
   * just chose. Today that is the set a return path carried back through
   * authentication, and it has to behave like any other filter commit: the
   * results shown are the results the filters describe.
   */
  describe("restoring committed filters", () => {
    it("commits them, and does not search anywhere else", () => {
      const initial = loaded(createExploreState({ viewport: tokyo }));
      const restored = exploreReducer(initial, {
        type: "restoreFilters",
        filters: {
          status: "saved",
          availability: "not_closed",
          shopTypes: ["vintage_used"],
        },
      });

      expect(restored.filters).toEqual({
        status: "saved",
        availability: "not_closed",
        shopTypes: ["vintage_used"],
      });
      // The drawer opens on the restored set rather than on an empty one.
      expect(hasUnappliedFilters(restored)).toBe(false);
      expect(restored.committed).toEqual(initial.committed);
      expect(restored.query.bounds).toEqual(tokyo.bounds);
    });

    /* A shop-type filter is resolved by the source, so restoring one re-runs
       the query — exactly as choosing it would. */
    it("re-queries when the source has to resolve the set", () => {
      const initial = loaded(createExploreState({ viewport: tokyo }));
      const restored = exploreReducer(initial, {
        type: "restoreFilters",
        filters: {
          status: "all",
          availability: "any",
          shopTypes: ["nib_repair_services"],
        },
      });

      expect(restored.status).toBe("loading");
      expect(restored.query.requestId).toBe(initial.query.requestId + 1);
      expect(restored.query.shopTypes).toEqual(["nib_repair_services"]);
    });

    /* And does not, when it does not: a status the reader owns is applied to
       the results already loaded. */
    it("keeps the loaded results when the set needs no query", () => {
      const initial = loaded(createExploreState({ viewport: tokyo }));
      const restored = exploreReducer(initial, {
        type: "restoreFilters",
        filters: { status: "visited", availability: "any", shopTypes: [] },
      });

      expect(restored.status).toBe(initial.status);
      expect(restored.requestId).toBe(initial.requestId);
      expect(restored.results).toEqual(initial.results);
    });
  });

  describe("retry", () => {
    it("re-runs the query the visible results are under, not the moved camera", () => {
      const withResults = loaded(createExploreState({ viewport: tokyo }));
      const moved = exploreReducer(withResults, { type: "cameraMoved", camera: kyoto });
      const failed = exploreReducer(moved, {
        type: "resultsFailed",
        requestId: moved.requestId,
      });
      const retried = exploreReducer(failed, { type: "retryQuery" });

      expect(retried.status).toBe("loading");
      expect(retried.requestId).toBe(failed.requestId + 1);
      expect(retried.query.bounds).toEqual(tokyo.bounds);
      // The results the reader is looking at stay while the retry is in flight.
      expect(retried.results).toHaveLength(1);
      // The camera they moved to is untouched, and still theirs to commit.
      expect(retried.camera).toEqual(kyoto);
    });

    it("does nothing when there is no failure to retry", () => {
      const withResults = loaded(createExploreState({ viewport: tokyo }));

      expect(exploreReducer(withResults, { type: "retryQuery" })).toBe(withResults);
    });
  });

  describe("an unusable catalogue", () => {
    it("is not an empty result set and offers nothing to retry", () => {
      const unavailable = exploreReducer(
        loaded(createExploreState({ viewport: tokyo })),
        { type: "catalogueUnavailable" },
      );

      expect(unavailable.status).toBe("unavailable");
      expect(unavailable.results).toEqual([]);
      expect(unavailable.truncated).toBe(false);
      expect(shouldOfferSearchArea(unavailable)).toBe(false);
    });

    it("keeps Search this area hidden however far the camera moves", () => {
      const unavailable = exploreReducer(createExploreState({ viewport: tokyo }), {
        type: "catalogueUnavailable",
      });
      const moved = exploreReducer(unavailable, { type: "cameraMoved", camera: kyoto });

      expect(shouldOfferSearchArea(moved)).toBe(false);
    });
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
