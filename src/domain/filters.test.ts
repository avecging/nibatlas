import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  EMPTY_FILTERS,
  filtersEqual,
  matchesFilters,
  selectShopsInViewport,
  toggleShopType,
} from "@/src/domain/filters";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";

const singaporeBounds = { west: 103.6, south: 1.21, east: 104.03, north: 1.47 };

describe("filters", () => {
  it("counts active filters", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(
      activeFilterCount({ status: "saved", shopTypes: ["vintage_used", "stationery_store"] }),
    ).toBe(3);
  });

  it("compares filters regardless of type order", () => {
    expect(
      filtersEqual(
        { status: "all", shopTypes: ["stationery_store", "vintage_used"] },
        { status: "all", shopTypes: ["vintage_used", "stationery_store"] },
      ),
    ).toBe(true);
    expect(
      filtersEqual(EMPTY_FILTERS, { status: "visited", shopTypes: [] }),
    ).toBe(false);
  });

  it("toggles a shop type on and off in a stable order", () => {
    const once = toggleShopType(EMPTY_FILTERS, "vintage_used");
    const twice = toggleShopType(once, "fountain_pen_specialist");

    expect(twice.shopTypes).toEqual(["fountain_pen_specialist", "vintage_used"]);
    expect(toggleShopType(twice, "vintage_used").shopTypes).toEqual([
      "fountain_pen_specialist",
    ]);
  });

  it("matches on status and shop type together", () => {
    const shop = prototypeShopSummaries[0];
    expect(shop).toBeDefined();

    expect(matchesFilters(shop!, EMPTY_FILTERS)).toBe(true);
    expect(matchesFilters(shop!, { status: "visited", shopTypes: [] })).toBe(false);
    expect(matchesFilters(shop!, { status: "all", shopTypes: ["vintage_used"] })).toBe(
      false,
    );
  });

  it("selects only shops inside the viewport", () => {
    const selected = selectShopsInViewport(
      prototypeShopSummaries,
      singaporeBounds,
      EMPTY_FILTERS,
    );

    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((shop) => shop.countryCode === "SG")).toBe(true);
  });
});
