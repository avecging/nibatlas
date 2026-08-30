"use client";

import { Icon } from "@/src/components/ui/Icon";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { useCollection } from "@/src/features/collection/collection-store";
import { noopTelemetry } from "@/src/features/map/telemetry";

import styles from "./ShopSaveButton.module.css";

/**
 * Save, as a bookmark beside the shop's name.
 *
 * The founder's staging review of WP4: as a full-width Atlas Navy button it
 * competed with Collect Stamp, which is the action the page is actually built
 * around. Saving is a quiet, reversible bookmark — so it is drawn as one, next
 * to the name it applies to.
 *
 * The bookmark metaphor is `UX.md`'s and stays: never a heart. State is carried
 * three ways, so colour is never doing the work alone — the glyph fills,
 * `aria-pressed` flips, and the accessible name changes between *Save shop* and
 * *Remove saved shop*. The visible tooltip follows the same wording.
 *
 * Behaviour and telemetry are unchanged from the button it replaces.
 */
export function ShopSaveButton({ shop }: { readonly shop: ShopDetail }) {
  const collection = useCollection();
  const saved = collection.isSaved(shop.id);
  const label = saved ? "Remove saved shop" : "Save shop";

  return (
    <button
      type="button"
      className={styles.save}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      onClick={() => {
        const next = collection.toggleSaved(shop.id);
        noopTelemetry.record("shop_saved", {
          shopSlug: shop.slug,
          outcome: next ? "saved" : "unsaved",
        });
      }}
    >
      <Icon name={saved ? "bookmark-filled" : "bookmark"} size={22} />
    </button>
  );
}
