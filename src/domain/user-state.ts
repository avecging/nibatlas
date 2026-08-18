import type { MarkerState, ShopMapSummary } from "@/src/domain/shops";
import { matchesStatus, type StatusFilter } from "@/src/domain/filters";

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

export function decorateResults<T extends ShopMapSummary>(
  shops: readonly T[],
  userState: UserShopState,
  status: StatusFilter,
): readonly T[] {
  return applyUserShopState(shops, userState).filter((shop) =>
    matchesStatus(shop.markerState, status),
  );
}
