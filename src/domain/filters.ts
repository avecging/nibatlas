import type { MarkerState, OperationalStatus, ShopMapSummary, ShopType } from "@/src/domain/shops";
import { SHOP_TYPES } from "@/src/domain/shops";
import { containsPoint, type ViewportBounds } from "@/src/domain/geo";

/**
 * Three-way visit segment, per the approved Map experience.
 *
 * `Unvisited` is gone deliberately. Visited and saved are two independent things
 * a reader owns; "not visited" is the absence of one of them, not a third state
 * to filter by, and offering it as a peer made the segment read as one axis with
 * four positions.
 */
export const STATUS_FILTERS = ["all", "saved", "visited"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/**
 * Availability is about the shop, not the reader. It filters on the operational
 * status the catalogue can actually stand behind — never on opening hours, which
 * are not modelled.
 */
export const AVAILABILITY_FILTERS = ["any", "open", "not_closed"] as const;
export type AvailabilityFilter = (typeof AVAILABILITY_FILTERS)[number];

export interface ShopFilters {
  readonly status: StatusFilter;
  readonly shopTypes: readonly ShopType[];
  readonly availability: AvailabilityFilter;
}

export const EMPTY_FILTERS: ShopFilters = {
  status: "all",
  shopTypes: [],
  availability: "any",
};

/** What the reader owns, kept separate so a saved shop stays saved once visited. */
export interface ShopStateFlags {
  readonly saved: boolean;
  readonly visited: boolean;
}

export function flagsFromMarkerState(markerState: MarkerState): ShopStateFlags {
  return {
    saved: markerState === "saved",
    visited: markerState === "visited",
  };
}

export function activeFilterCount(filters: ShopFilters): number {
  return (filters.status === "all" ? 0 : 1) + drawerFilterCount(filters);
}

/**
 * What the filter button's badge counts: the criteria that live behind it. The
 * visit segment is always on screen, so counting it there would label a choice
 * the reader can already see.
 */
export function drawerFilterCount(filters: ShopFilters): number {
  return filters.shopTypes.length + (filters.availability === "any" ? 0 : 1);
}

export function filtersEqual(a: ShopFilters, b: ShopFilters): boolean {
  if (
    a.status !== b.status ||
    a.availability !== b.availability ||
    a.shopTypes.length !== b.shopTypes.length
  ) {
    return false;
  }

  const sortedA = [...a.shopTypes].sort();
  const sortedB = [...b.shopTypes].sort();

  return sortedA.every((type, index) => type === sortedB[index]);
}

export function toggleShopType(filters: ShopFilters, shopType: ShopType): ShopFilters {
  const next = filters.shopTypes.includes(shopType)
    ? filters.shopTypes.filter((type) => type !== shopType)
    : [...filters.shopTypes, shopType];

  return {
    ...filters,
    shopTypes: SHOP_TYPES.filter((type) => next.includes(type)),
  };
}

export function matchesStatus(flags: ShopStateFlags, status: StatusFilter): boolean {
  if (status === "saved") {
    return flags.saved;
  }

  if (status === "visited") {
    return flags.visited;
  }

  return true;
}

export function matchesAvailability(
  operationalStatus: OperationalStatus,
  availability: AvailabilityFilter,
): boolean {
  if (availability === "open") {
    return operationalStatus === "open";
  }

  if (availability === "not_closed") {
    return (
      operationalStatus !== "temporarily_closed" &&
      operationalStatus !== "permanently_closed"
    );
  }

  return true;
}

export function matchesFilters(shop: ShopMapSummary, filters: ShopFilters): boolean {
  if (!matchesStatus(flagsFromMarkerState(shop.markerState), filters.status)) {
    return false;
  }

  if (!matchesAvailability(shop.operationalStatus, filters.availability)) {
    return false;
  }

  return filters.shopTypes.length === 0 || filters.shopTypes.includes(shop.primaryType);
}

export function selectShopsInViewport(
  shops: readonly ShopMapSummary[],
  bounds: ViewportBounds,
  filters: ShopFilters,
): readonly ShopMapSummary[] {
  return shops.filter(
    (shop) => containsPoint(bounds, shop.position) && matchesFilters(shop, filters),
  );
}
