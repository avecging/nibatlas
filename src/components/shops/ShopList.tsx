"use client";

import { useEffect, useRef } from "react";

import { ShopCard } from "@/src/components/shops/ShopCard";
import { Icon } from "@/src/components/ui/Icon";
import type { ShopMapSummary } from "@/src/domain/shops";

import styles from "./ShopList.module.css";

interface ShopListProps {
  readonly shops: readonly ShopMapSummary[];
  readonly selectedShopId: string | null;
  readonly savedShopIds: ReadonlySet<string>;
  readonly truncated: boolean;
  readonly onSelect: (shopId: string) => void;
  readonly onToggleSaved: (shopId: string) => void;
  readonly onOpenDetail?: (shop: ShopMapSummary) => void;
  readonly emptyMessage?: string;
}

export function ShopList({
  shops,
  selectedShopId,
  savedShopIds,
  truncated,
  onSelect,
  onToggleSaved,
  onOpenDetail,
  emptyMessage = "No shops match this area and these filters. Move the map or clear a filter, then search again.",
}: ShopListProps) {
  const listRef = useRef<HTMLOListElement | null>(null);

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
      <ol className={styles.list} ref={listRef} aria-label="Shops in the searched area">
        {shops.map((shop) => (
          <ShopCard
            key={shop.id}
            shop={shop}
            selected={shop.id === selectedShopId}
            specialtyLine={shop.specialtyLine}
            saved={savedShopIds.has(shop.id)}
            onSelect={onSelect}
            onToggleSaved={onToggleSaved}
            {...(onOpenDetail ? { onOpenDetail } : {})}
          />
        ))}
      </ol>
    </>
  );
}
