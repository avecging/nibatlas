import type { MarkerState, ShopMapSummary } from "@/src/domain/shops";
import {
  matchesAvailability,
  matchesStatus,
  type ShopFilters,
} from "@/src/domain/filters";

/**
 * Public shop projections are cacheable and therefore carry no user state.
 * Saved and visited identifiers are merged separately, exactly as
 * `DATA-MODEL.md` requires for the production viewport contract.
 */
export interface UserShopState {
  readonly savedShopIds: ReadonlySet<string>;
  readonly visitedShopIds: ReadonlySet<string>;
}

export const EMPTY_USER_SHOP_STATE: UserShopState = {
  savedShopIds: new Set<string>(),
  visitedShopIds: new Set<string>(),
};

export function markerStateFor(shopId: string, userState: UserShopState): MarkerState {
  if (userState.visitedShopIds.has(shopId)) {
    return "visited";
  }

  return userState.savedShopIds.has(shopId) ? "saved" : "unvisited";
}

export function applyUserShopState<T extends ShopMapSummary>(
  shops: readonly T[],
  userState: UserShopState,
): readonly T[] {
  return shops.map((shop) => ({
    ...shop,
    markerState: markerStateFor(shop.id, userState),
  }));
}

/**
 * The result set the reader actually sees.
 *
 * Saved and visited are read from the user's own sets rather than from the
 * collapsed `markerState`, so a shop that is both stays in the Saved segment
 * after it has been visited. The marker keeps its documented priority — visited
 * outranks saved — because that is a presentation rule, not a filter rule.
 */
export function decorateResults<T extends ShopMapSummary>(
  shops: readonly T[],
  userState: UserShopState,
  filters: ShopFilters,
): readonly T[] {
  return applyUserShopState(shops, userState).filter(
    (shop) =>
      matchesStatus(
        {
          saved: userState.savedShopIds.has(shop.id),
          visited: userState.visitedShopIds.has(shop.id),
        },
        filters.status,
      ) && matchesAvailability(shop.operationalStatus, filters.availability),
  );
}
