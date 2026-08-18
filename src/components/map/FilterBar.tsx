"use client";

import { Chip } from "@/src/components/ui/Chip";
import {
  activeFilterCount,
  STATUS_FILTERS,
  type ShopFilters,
  type StatusFilter,
} from "@/src/domain/filters";
import { SHOP_TYPE_LABELS } from "@/src/domain/shop-detail";
import { SHOP_TYPES, type ShopType } from "@/src/domain/shops";

import styles from "./FilterBar.module.css";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  unvisited: "Unvisited",
  visited: "Visited",
  saved: "Saved",
};

interface FilterBarProps {
  readonly filters: ShopFilters;
  readonly uncommitted: boolean;
  readonly onStatusChange: (status: StatusFilter) => void;
  readonly onToggleType: (shopType: ShopType) => void;
  readonly onClear: () => void;
}

export function FilterBar({
  filters,
  uncommitted,
  onStatusChange,
  onToggleType,
  onClear,
}: FilterBarProps) {
  const count = activeFilterCount(filters);

  return (
    <section className={styles.bar} aria-label="Result filters">
      <div className={styles.row} role="group" aria-label="Visit status">
        <span className={`${styles.groupLabel} visually-hidden`}>Visit status</span>
        {STATUS_FILTERS.map((status) => (
          <Chip
            key={status}
            pressed={filters.status === status}
            intent={status === "saved" ? "saving" : "default"}
            onToggle={() => onStatusChange(status)}
          >
            {STATUS_LABELS[status]}
          </Chip>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Shop type">
        {SHOP_TYPES.map((shopType) => (
          <Chip
            key={shopType}
            pressed={filters.shopTypes.includes(shopType)}
            onToggle={() => onToggleType(shopType)}
          >
            {SHOP_TYPE_LABELS[shopType]}
          </Chip>
        ))}
      </div>
      <div className={styles.legend}>
        <span>
          {count === 0 ? "No filters active" : `${count} filter${count === 1 ? "" : "s"} active`}
          {uncommitted ? (
            <>
              {" · "}
              <span className={styles.pending}>Search this area to apply</span>
            </>
          ) : null}
        </span>
        <button type="button" className={styles.clear} onClick={onClear} disabled={count === 0}>
          Clear filters
        </button>
      </div>
    </section>
  );
}
