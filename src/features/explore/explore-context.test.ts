import { beforeEach, describe, expect, it } from "vitest";

import {
  decodeExploreContext,
  encodeExploreContext,
  EXPLORE_CONTEXT_PARAM,
  EXPLORE_CONTEXT_STORAGE_KEY,
  type ExploreContext,
  withExploreContext,
} from "@/src/features/explore/explore-context";

const CONTEXT: ExploreContext = {
  viewport: {
    bounds: { west: 120.8, south: 24.8, east: 122, north: 25.4 },
    zoom: 10,
  },
  label: "Taipei",
  filters: {
    status: "saved",
    shopTypes: ["stationery_store", "vintage_used"],
    availability: "not_closed",
  },
};

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("explore return context", () => {
  it("round-trips a committed viewport and every filter", () => {
    expect(decodeExploreContext(encodeExploreContext(CONTEXT))).toEqual(CONTEXT);
  });

  it("refuses malformed, oversized, and out-of-range context", () => {
    expect(decodeExploreContext("not json")).toBeNull();
    expect(decodeExploreContext("x".repeat(1_501))).toBeNull();
    expect(
      decodeExploreContext(
        JSON.stringify({
          ...CONTEXT,
          viewport: { ...CONTEXT.viewport, zoom: 100 },
        }),
      ),
    ).toBeNull();
    expect(
      decodeExploreContext(
        JSON.stringify({
          ...CONTEXT,
          filters: { ...CONTEXT.filters, status: "owner-only" },
        }),
      ),
    ).toBeNull();
  });

  it("canonicalises duplicate and unordered shop types", () => {
    expect(
      decodeExploreContext(
        JSON.stringify({
          ...CONTEXT,
          filters: {
            ...CONTEXT.filters,
            shopTypes: ["vintage_used", "stationery_store", "vintage_used"],
          },
        }),
      )?.filters.shopTypes,
    ).toEqual(["stationery_store", "vintage_used"]);
  });

  it("adds persisted context only to map and shop paths", () => {
    window.sessionStorage.setItem(EXPLORE_CONTEXT_STORAGE_KEY, JSON.stringify(CONTEXT));

    const map = new URL(withExploreContext("/?shop=ty-lee-pen-shop"), "https://test.invalid");
    const shop = new URL(
      withExploreContext("/shops/ty-lee-pen-shop?from=map"),
      "https://test.invalid",
    );

    expect(decodeExploreContext(map.searchParams.get(EXPLORE_CONTEXT_PARAM))).toEqual(
      CONTEXT,
    );
    expect(decodeExploreContext(shop.searchParams.get(EXPLORE_CONTEXT_PARAM))).toEqual(
      CONTEXT,
    );
    expect(withExploreContext("/me#me-account")).toBe("/me#me-account");
  });

  it("reads the viewport-only storage record from earlier builds", () => {
    window.sessionStorage.setItem(
      EXPLORE_CONTEXT_STORAGE_KEY,
      JSON.stringify({ viewport: CONTEXT.viewport, label: null }),
    );

    const url = new URL(withExploreContext("/"), "https://test.invalid");
    expect(decodeExploreContext(url.searchParams.get(EXPLORE_CONTEXT_PARAM))).toEqual({
      viewport: CONTEXT.viewport,
      label: null,
      filters: { status: "all", shopTypes: [], availability: "any" },
    });
  });
});

