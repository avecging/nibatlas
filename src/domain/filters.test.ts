import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  drawerFilterCount,
  EMPTY_FILTERS,
  filtersEqual,
  matchesAvailability,
  matchesFilters,
  matchesStatus,
  selectShopsInViewport,
  STATUS_FILTERS,
  toggleShopType,
  type ShopFilters,
} from "@/src/domain/filters";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";

const singaporeBounds = { west: 103.6, south: 1.21, east: 104.03, north: 1.47 };

function filters(overrides: Partial<ShopFilters> = {}): ShopFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe("filters", () => {
  it("offers a three-way visit segment and no Unvisited position", () => {
    expect([...STATUS_FILTERS]).toEqual(["all", "saved", "visited"]);
  });

  it("counts active filters, and counts only the drawer's for the badge", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(drawerFilterCount(EMPTY_FILTERS)).toBe(0);

    const set = filters({
      status: "saved",
      shopTypes: ["vintage_used", "stationery_store"],
      availability: "open",
    });

    expect(activeFilterCount(set)).toBe(4);
    // The visit segment is always on screen, so the badge never counts it.
    expect(drawerFilterCount(set)).toBe(3);
  });

  it("compares filters regardless of type order", () => {
    expect(
      filtersEqual(
        filters({ shopTypes: ["stationery_store", "vintage_used"] }),
        filters({ shopTypes: ["vintage_used", "stationery_store"] }),
      ),
    ).toBe(true);
    expect(filtersEqual(EMPTY_FILTERS, filters({ status: "visited" }))).toBe(false);
    expect(filtersEqual(EMPTY_FILTERS, filters({ availability: "open" }))).toBe(false);
  });

  it("toggles a shop type on and off in a stable order", () => {
    const once = toggleShopType(EMPTY_FILTERS, "vintage_used");
    const twice = toggleShopType(once, "fountain_pen_specialist");

    expect(twice.shopTypes).toEqual(["fountain_pen_specialist", "vintage_used"]);
    expect(toggleShopType(twice, "vintage_used").shopTypes).toEqual([
      "fountain_pen_specialist",
    ]);
  });

  /*
   * Saved and visited are two states a reader owns, not two points on one axis:
   * a shop that is both must answer to both segments.
   */
  it("reads saved and visited as independent states", () => {
    const both = { saved: true, visited: true };

    expect(matchesStatus(both, "saved")).toBe(true);
    expect(matchesStatus(both, "visited")).toBe(true);
    expect(matchesStatus({ saved: false, visited: false }, "all")).toBe(true);
    expect(matchesStatus({ saved: false, visited: false }, "saved")).toBe(false);
  });

  it("filters availability on recorded operational status only", () => {
    expect(matchesAvailability("open", "open")).toBe(true);
    expect(matchesAvailability("unknown", "open")).toBe(false);

    expect(matchesAvailability("unknown", "not_closed")).toBe(true);
    expect(matchesAvailability("temporarily_closed", "not_closed")).toBe(false);
    expect(matchesAvailability("permanently_closed", "not_closed")).toBe(false);

    expect(matchesAvailability("permanently_closed", "any")).toBe(true);
  });

  it("matches on status, shop type and availability together", () => {
    const shop = prototypeShopSummaries[0];
    expect(shop).toBeDefined();

    expect(matchesFilters(shop!, EMPTY_FILTERS)).toBe(true);
    expect(matchesFilters(shop!, filters({ status: "visited" }))).toBe(false);
    expect(matchesFilters(shop!, filters({ shopTypes: ["vintage_used"] }))).toBe(false);
    expect(
      matchesFilters({ ...shop!, operationalStatus: "unknown" }, filters({ availability: "open" })),
    ).toBe(false);
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
