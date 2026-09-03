import type { Viewport } from "@/src/domain/geo";
import type { ShopMapSummary } from "@/src/domain/shops";

/** Zoom a single shop is framed at when the map is sent to it. */
export const SHOP_FOCUS_ZOOM = 16;

const SHOP_FOCUS_PADDING = 0.006;

/**
 * The camera for one shop.
 *
 * One helper rather than a copy in each caller: the explore deep link, the
 * search panel, and the shop locator all have to frame a shop the same way, or
 * the same shop lands at a different zoom depending on how the reader reached
 * it.
 */
export function shopFocusViewport(shop: ShopMapSummary): Viewport {
  return {
    bounds: {
      west: shop.position.longitude - SHOP_FOCUS_PADDING,
      south: shop.position.latitude - SHOP_FOCUS_PADDING,
      east: shop.position.longitude + SHOP_FOCUS_PADDING,
      north: shop.position.latitude + SHOP_FOCUS_PADDING,
    },
    zoom: SHOP_FOCUS_ZOOM,
  };
}
