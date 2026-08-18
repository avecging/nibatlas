"use client";

import { useRef, useState, type ReactNode } from "react";

import type { SheetState } from "@/src/features/explore/explore-state";

import styles from "./ResultsSheet.module.css";

const ORDER: readonly SheetState[] = ["peek", "half", "full"];

const STATE_LABEL: Record<SheetState, string> = {
  peek: "Peek",
  half: "Half",
  full: "Full",
};

interface ResultsSheetProps {
  readonly state: SheetState;
  readonly onStateChange: (state: SheetState) => void;
  readonly summary: ReactNode;
  readonly children: ReactNode;
}

/**
 * Mobile results sheet with three stable states. Drag is confined to the handle
 * so a sheet gesture can never be mistaken for a map pan.
 */
export function ResultsSheet({
  state,
  onStateChange,
  summary,
  children,
}: ResultsSheetProps) {
  const dragStartY = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  function step(direction: 1 | -1) {
    const index = ORDER.indexOf(state);
    const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, index + direction))];

    if (next && next !== state) {
      onStateChange(next);
    }
  }

  return (
    <section
      className={`${styles.sheet} ${dragging ? styles.dragging : ""}`}
      data-state={state}
      data-testid="results-sheet"
      aria-label="Results"
    >
      <div className={styles.handleArea}>
        <button
          type="button"
          className={styles.handle}
          aria-label={`Results sheet, ${STATE_LABEL[state]}. Use arrow keys to resize.`}
          onClick={() => step(state === "full" ? -1 : 1)}
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
            dragStartY.current = event.clientY;
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = dragStartY.current;
            dragStartY.current = null;
            setDragging(false);
            event.currentTarget.releasePointerCapture(event.pointerId);

            if (start === null) {
              return;
            }

            const delta = start - event.clientY;

            if (delta > 32) {
              step(1);
            } else if (delta < -32) {
              step(-1);
            }
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
