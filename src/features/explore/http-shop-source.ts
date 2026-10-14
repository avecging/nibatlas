import {
  createHttpShopReadClient,
  type HttpShopReadClientOptions,
} from "@/src/api/v1/shop-read-client";
import type { ShopSource } from "@/src/features/explore/shop-source";

/** HTTP implementation of the existing explore seam. No fixture fallback. */
export function createHttpShopSource(
  options: HttpShopReadClientOptions = {},
): ShopSource {
  const client = createHttpShopReadClient(options);

  return {
    fetchViewport(request, signal) {
      return client.fetchViewport(request, signal);
    },
  };
}
