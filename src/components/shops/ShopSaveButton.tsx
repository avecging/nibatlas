"use client";

import { Icon } from "@/src/components/ui/Icon";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { noopTelemetry } from "@/src/features/map/telemetry";
import { useSavedShops } from "@/src/features/saved/SavedShopsProvider";

import styles from "./ShopSaveButton.module.css";

/**
 * Save, as a bookmark beside the shop's name.
 *
 * Saving is a quiet, reversible bookmark — so it is drawn beside the name it
 * applies to. A new save from an anonymous session opens the sign-in
 * interruption; an authenticated save is applied optimistically and reconciled
 * against the private saved-shop service.
 */
export function ShopSaveButton({ shop }: { readonly shop: ShopDetail }) {
  const savedShops = useSavedShops();
  const saved = savedShops.isSaved(shop.id);
  const pending = savedShops.pendingShopIds.has(shop.id);
  const label = pending
    ? saved
      ? "Saving shop"
      : "Removing saved shop"
    : saved
      ? "Remove saved shop"
      : "Save shop";

  return (
    <button
      type="button"
      className={styles.save}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      disabled={pending || savedShops.status === "loading"}
      onClick={() => {
        const wasSaved = saved;
        savedShops.toggleSaved(shop.id, shop.name);
        noopTelemetry.record("shop_saved", {
          shopSlug: shop.slug,
          outcome: wasSaved ? "unsave-requested" : "save-requested",
        });
      }}
    >
      <Icon name={saved ? "bookmark-filled" : "bookmark"} size={22} />
    </button>
  );
}
