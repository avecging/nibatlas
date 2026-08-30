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
  unvisited: "Unvisited",
  saved: "Saved",
  visited: "Visited",
};

/**
 * Never `Open now`.
 *
 * These filter the operational status a record carries. Nib Atlas does not model
 * opening hours and does not infer current availability from partial ones, so
 * every label says "recorded" and the drawer repeats it in full underneath.
 */
const AVAILABILITY_LABELS: Record<AvailabilityFilter, string> = {
  any: "Any recorded status",
  open: "Recorded as open",
  not_closed: "Hide recorded closures",
};

interface MapFiltersProps {
  /** What the displayed results are under. */
  readonly filters: ShopFilters;
  /** The drawer's working copy, discarded unless applied. */
  readonly draftFilters: ShopFilters;
  readonly open: boolean;
  readonly hasUnapplied: boolean;
  /** Exact number of draft matches, or `null` when it cannot be counted. */
  readonly draftMatchCount: number | null;
  /** Whether applying will also commit the camera the reader has moved to. */
  readonly appliesCamera: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onStatusChange: (status: StatusFilter) => void;
  readonly onDraftAvailabilityChange: (availability: AvailabilityFilter) => void;
  readonly onToggleDraftType: (shopType: ShopType) => void;
  readonly onClearDraft: () => void;
  readonly onApply: () => void;
  readonly onClear: () => void;
}

/**
 * Visit segment in the open, everything else behind one labelled button.
 *
 * The segment is a top-level control and commits on press: it is decided over
 * the results already in hand, so it lands whole and at once.
 *
 * The drawer is a transaction. Shop type and availability are edited as a draft
 * and commit together on **Apply filters**, which also closes the drawer;
 * closing or cancelling discards the draft. That is what stops a reader seeing
 * availability land while a shop type is still waiting on a query. The segment
 * sits behind the drawer's scrim while it is open, so the two can never
 * interleave.
 */
export function MapFilters({
  filters,
  draftFilters,
  open,
  hasUnapplied,
  draftMatchCount,
  appliesCamera,
  onOpen,
  onClose,
  onStatusChange,
  onDraftAvailabilityChange,
  onToggleDraftType,
  onClearDraft,
  onApply,
  onClear,
}: MapFiltersProps) {
  const drawerId = useId();
  const titleId = `${drawerId}-title`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(open);

  // The badge counts what is applied, not what is being drafted: it describes
  // the results on screen.
  const drawerCount = drawerFilterCount(filters);
  const totalCount = activeFilterCount(filters);
  const draftCount = drawerFilterCount(draftFilters);

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
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

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
          onClick={() => (open ? onClose() : onOpen())}
        >
          <Icon name="filter" size={16} />
          Filters
          {drawerCount > 0 ? (
            <span className={styles.count} data-testid="filter-count">
              {drawerCount}
              <span className="visually-hidden"> filters applied</span>
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
            onClick={onClose}
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
                aria-label="Close filters without applying"
                onClick={onClose}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <FilterGroup label="Shop type">
              <div className={styles.chips}>
                {SHOP_TYPES.map((shopType) => (
                  <Chip
                    key={shopType}
                    pressed={draftFilters.shopTypes.includes(shopType)}
                    onToggle={() => onToggleDraftType(shopType)}
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
                    pressed={draftFilters.availability === availability}
                    onToggle={() => onDraftAvailabilityChange(availability)}
                  >
                    {AVAILABILITY_LABELS[availability]}
                  </Chip>
                ))}
              </div>
              <p className={styles.note}>
                This is the operational status recorded for a shop, not live
                opening hours. Nib Atlas does not know whether a shop is open
                right now.
              </p>
            </FilterGroup>

            <div className={styles.drawerFoot}>
              <p className={styles.liveCount} aria-live="polite">
                {draftMatchCount === null
                  ? "Apply to see what matches."
                  : `${draftMatchCount} shop${draftMatchCount === 1 ? "" : "s"} match`}
              </p>
              <div className={styles.drawerActions}>
                <button
                  type="button"
                  className={styles.clearDraft}
                  disabled={draftCount === 0 && draftFilters.status === "all"}
                  onClick={onClearDraft}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className={styles.apply}
                  data-unapplied={hasUnapplied}
                  onClick={onApply}
                >
                  {appliesCamera ? "Apply and search this area" : "Apply filters"}
                </button>
              </div>
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
