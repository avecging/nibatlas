"use client";

import { useEffect, useRef } from "react";

import { useMediaQuery } from "@/src/components/hooks/useMediaQuery";
import { ShopCard } from "@/src/components/shops/ShopCard";
import { Icon } from "@/src/components/ui/Icon";
import type { ShopMapSummary } from "@/src/domain/shops";

import styles from "./ShopList.module.css";

interface ShopListProps {
  readonly shops: readonly ShopMapSummary[];
  readonly selectedShopId: string | null;
  readonly highlightedShopId?: string | null;
  readonly savedShopIds: ReadonlySet<string>;
  readonly visitedShopIds?: ReadonlySet<string>;
  readonly truncated: boolean;
  readonly onHighlight?: (shopId: string | null) => void;
  readonly onToggleSaved: (shopId: string) => void;
  readonly onOpenDetail?: (shop: ShopMapSummary) => void;
  readonly emptyMessage?: string;
  readonly listLabel?: string;
  readonly detailFrom?: "map" | "saved" | "passport";
}

const NO_IDS: ReadonlySet<string> = new Set<string>();
const NO_HIGHLIGHT = () => {};

export function ShopList({
  shops,
  selectedShopId,
  highlightedShopId = null,
  savedShopIds,
  visitedShopIds = NO_IDS,
  truncated,
  onHighlight,
  onToggleSaved,
  onOpenDetail,
  emptyMessage = "No shops match this area and these filters. Move the map or clear a filter, then search again.",
  listLabel = "Shops in the searched area",
  detailFrom = "map",
}: ShopListProps) {
  const listRef = useRef<HTMLOListElement | null>(null);
  /**
   * Hover synchronisation is for a real pointer only. A touch tap raises
   * `mouseenter` too, and on a phone that would leave a card highlighted with no
   * way to move off it.
   */
  const hoverHighlights = useMediaQuery("(hover: hover) and (pointer: fine)");

  useEffect(() => {
    if (!selectedShopId || !listRef.current) {
      return;
    }

    const card = listRef.current.querySelector(`[data-shop-id="${selectedShopId}"]`);

    card?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [selectedShopId]);

  if (shops.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {truncated ? (
        <p className={styles.notice}>
          <Icon name="alert" size={18} />
          <span>
            Showing the first {shops.length} shops in this area. Zoom in and search
            again to see the rest.
          </span>
        </p>
      ) : null}
      <ol className={styles.list} ref={listRef} aria-label={listLabel}>
        {shops.map((shop) => (
          <ShopCard
            key={shop.id}
            shop={shop}
            selected={shop.id === selectedShopId}
            highlighted={shop.id === highlightedShopId}
            specialtyLine={shop.specialtyLine}
            saved={savedShopIds.has(shop.id)}
            visited={visitedShopIds.has(shop.id) || shop.markerState === "visited"}
            hoverHighlights={hoverHighlights}
            detailFrom={detailFrom}
            onHighlight={onHighlight ?? NO_HIGHLIGHT}
            onToggleSaved={onToggleSaved}
            {...(onOpenDetail ? { onOpenDetail } : {})}
          />
        ))}
      </ol>
    </>
  );
}
