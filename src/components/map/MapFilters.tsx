"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Chip } from "@/src/components/ui/Chip";
import { Icon } from "@/src/components/ui/Icon";
import {
  activeFilterCount,
  AVAILABILITY_FILTERS,
  drawerFilterCount,
  STATUS_FILTERS,
  type AvailabilityFilter,
  type ShopFilters,
  type StatusFilter,
} from "@/src/domain/filters";
import { SHOP_TYPE_LABELS } from "@/src/domain/shop-detail";
import { SHOP_TYPES, type ShopType } from "@/src/domain/shops";

import styles from "./MapFilters.module.css";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  saved: "Saved",
  visited: "Visited",
};

const AVAILABILITY_LABELS: Record<AvailabilityFilter, string> = {
  any: "Any status",
  open: "Confirmed open",
  not_closed: "Hide closed",
};

interface MapFiltersProps {
  readonly filters: ShopFilters;
  readonly open: boolean;
  /** Results currently matching, so the drawer can show that a change landed. */
  readonly resultCount: number;
  readonly onOpenChange: (open: boolean) => void;
  readonly onStatusChange: (status: StatusFilter) => void;
  readonly onAvailabilityChange: (availability: AvailabilityFilter) => void;
  readonly onToggleType: (shopType: ShopType) => void;
  readonly onClear: () => void;
}

/**
 * Visit segment in the open, everything else behind one labelled button.
 *
 * The segment is three-way — All, Saved, Visited — because visited and saved are
 * two things a reader owns rather than three points on one axis. Shop type and
 * availability live in the drawer, and the button carries the count of what is
 * set there, so a reader who has collapsed it can still see that something is
 * narrowing their results.
 *
 * Every control here applies on press. Nothing waits for `Search this area`.
 */
export function MapFilters({
  filters,
  open,
  resultCount,
  onOpenChange,
  onStatusChange,
  onAvailabilityChange,
  onToggleType,
  onClear,
}: MapFiltersProps) {
  const drawerId = useId();
  const titleId = `${drawerId}-title`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(open);

  const drawerCount = drawerFilterCount(filters);
  const totalCount = activeFilterCount(filters);

  useEffect(() => {
    if (open === wasOpen.current) {
      return;
    }

    wasOpen.current = open;

    if (open) {
      drawerRef.current?.focus();
    } else {
      // Closing returns the reader to the control they opened, not to the top of
      // the document.
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  return (
    <section className={styles.bar} aria-label="Result filters" data-filters-open={open}>
      <div className={styles.controls}>
        <div className={styles.segment} role="group" aria-label="Visit status">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className={styles.segmentButton}
              aria-pressed={filters.status === status}
              onClick={() => onStatusChange(status)}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={drawerId}
          data-active={drawerCount > 0}
          onClick={() => onOpenChange(!open)}
        >
          <Icon name="filter" size={16} />
          Filters
          {drawerCount > 0 ? (
            <span className={styles.count} data-testid="filter-count">
              {drawerCount}
              <span className="visually-hidden"> filters set</span>
            </span>
          ) : null}
        </button>
        {totalCount > 0 ? (
          <button type="button" className={styles.clear} onClick={onClear}>
            Clear filters
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          <div
            className={styles.scrim}
            data-testid="filter-scrim"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            id={drawerId}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <div className={styles.drawerHead}>
              <h2 className={styles.drawerTitle} id={titleId}>
                Filters
              </h2>
              <button
                type="button"
                className={styles.close}
                aria-label="Close filters"
                onClick={() => onOpenChange(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <FilterGroup label="Shop type">
              <div className={styles.chips}>
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
            </FilterGroup>

            <FilterGroup label="Availability">
              <div className={styles.chips}>
                {AVAILABILITY_FILTERS.map((availability) => (
                  <Chip
                    key={availability}
                    pressed={filters.availability === availability}
                    onToggle={() => onAvailabilityChange(availability)}
                  >
                    {AVAILABILITY_LABELS[availability]}
                  </Chip>
                ))}
              </div>
              <p className={styles.note}>
                Availability is the operational status a shop has been recorded
                with. It is not live opening hours.
              </p>
            </FilterGroup>

            <div className={styles.drawerFoot}>
              <p className={styles.liveCount} aria-live="polite">
                {resultCount} shop{resultCount === 1 ? "" : "s"} match
              </p>
              <button
                type="button"
                className={styles.done}
                onClick={() => onOpenChange(false)}
              >
                Done
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function FilterGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      <p className={styles.groupLabel}>{label}</p>
      {children}
    </div>
  );
}
