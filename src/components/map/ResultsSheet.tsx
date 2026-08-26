"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import type { SheetState } from "@/src/features/explore/explore-state";

import styles from "./ResultsSheet.module.css";

const ORDER: readonly SheetState[] = ["peek", "half", "full"];

const STATE_LABEL: Record<SheetState, string> = {
  peek: "Peek",
  half: "Half",
  full: "Full",
};

/** Fractions of the available height each state occupies. Kept in sync with the
 *  `data-state` heights in the stylesheet so a drag lands where a tap does. */
const STATE_FRACTION: Record<SheetState, number> = {
  peek: 0.23,
  half: 0.56,
  full: 0.92,
};

function nearestState(fraction: number): SheetState {
  let best: SheetState = "peek";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const state of ORDER) {
    const distance = Math.abs(STATE_FRACTION[state] - fraction);

    if (distance < bestDistance) {
      best = state;
      bestDistance = distance;
    }
  }

  return best;
}

interface ResultsSheetProps {
  readonly state: SheetState;
  readonly onStateChange: (state: SheetState) => void;
  readonly summary: ReactNode;
  readonly children: ReactNode;
}

/**
 * Mobile results sheet with three stable states.
 *
 * The gesture is confined to the handle and the handle sets
 * `touch-action: none`, so a sheet drag can never reach the map underneath and
 * be mistaken for a pan. During a drag the height tracks the pointer; on release
 * it settles to the nearest of Peek, Half, and Full. A plain tap cycles upward
 * and Arrow Up / Arrow Down step, so nothing here needs a gesture.
 */
export function ResultsSheet({
  state,
  onStateChange,
  summary,
  children,
}: ResultsSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ readonly startY: number; readonly startHeight: number } | null>(
    null,
  );
  const suppressClickRef = useRef(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const step = useCallback(
    (direction: 1 | -1) => {
      const index = ORDER.indexOf(state);
      const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, index + direction))];

      if (next && next !== state) {
        onStateChange(next);
      }
    },
    [onStateChange, state],
  );

  const available = () => {
    const parent = sheetRef.current?.parentElement;

    return parent?.clientHeight ?? 0;
  };

  return (
    <section
      ref={sheetRef}
      className={`${styles.sheet} ${dragHeight === null ? "" : styles.dragging}`}
      style={dragHeight === null ? undefined : { height: `${dragHeight}px` }}
      data-state={state}
      data-testid="results-sheet"
      aria-label="Results"
    >
      <div className={styles.handleArea}>
        <button
          type="button"
          className={styles.handle}
          aria-label={`Results sheet, ${STATE_LABEL[state]}. Tap to expand, or use the up and down arrow keys.`}
          onClick={() => {
            // A tap cycles. A completed drag has already chosen a state, and
            // the click that follows its pointerup must not step again.
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }

            step(state === "full" ? -1 : 1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              step(1);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              step(-1);
            }
          }}
          onPointerDown={(event) => {
            const height = sheetRef.current?.clientHeight ?? 0;
            suppressClickRef.current = false;
            dragRef.current = { startY: event.clientY, startHeight: height };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            const max = available();

            if (!drag || max === 0) {
              return;
            }

            const next = drag.startHeight + (drag.startY - event.clientY);
            setDragHeight(Math.min(max * STATE_FRACTION.full, Math.max(64, next)));
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            const max = available();
            event.currentTarget.releasePointerCapture(event.pointerId);

            if (!drag) {
              return;
            }

            const travelled = Math.abs(drag.startY - event.clientY);

            if (travelled < 6 || max === 0) {
              // Treated as a tap: let the click handler cycle instead.
              dragRef.current = null;
              setDragHeight(null);
              return;
            }

            const settled = nearestState((dragHeight ?? drag.startHeight) / max);
            suppressClickRef.current = true;
            dragRef.current = null;
            setDragHeight(null);

            if (settled !== state) {
              onStateChange(settled);
            }
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            suppressClickRef.current = false;
            setDragHeight(null);
          }}
        >
          <span className={styles.handleBar} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.summary}>{summary}</div>
      <div className={styles.scroll}>{children}</div>
    </section>
  );
}
