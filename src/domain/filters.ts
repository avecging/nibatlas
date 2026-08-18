import type { MarkerState, ShopMapSummary, ShopType } from "@/src/domain/shops";
import { SHOP_TYPES } from "@/src/domain/shops";
import { containsPoint, type ViewportBounds } from "@/src/domain/geo";

export const STATUS_FILTERS = ["all", "unvisited", "visited", "saved"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface ShopFilters {
  readonly status: StatusFilter;
  readonly shopTypes: readonly ShopType[];
}

export const EMPTY_FILTERS: ShopFilters = {
  status: "all",
  shopTypes: [],
};

export function activeFilterCount(filters: ShopFilters): number {
  return (filters.status === "all" ? 0 : 1) + filters.shopTypes.length;
}

export function filtersEqual(a: ShopFilters, b: ShopFilters): boolean {
  if (a.status !== b.status || a.shopTypes.length !== b.shopTypes.length) {
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

export function matchesStatus(markerState: MarkerState, status: StatusFilter): boolean {
  return status === "all" || status === markerState;
}

export function matchesFilters(shop: ShopMapSummary, filters: ShopFilters): boolean {
  if (!matchesStatus(shop.markerState, filters.status)) {
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
