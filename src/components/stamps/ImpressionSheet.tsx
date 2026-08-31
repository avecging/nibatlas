"use client";

import type { ReactNode, RefObject } from "react";

import { Icon } from "@/src/components/ui/Icon";

import styles from "./ImpressionSheet.module.css";

/**
 * The sheet an impression is shown on, wherever it is shown.
 *
 * Three overlays in the Passport — a shop stamp, a locality seal, a country seal
 * — and the collection ceremony a shop page opens are all the same act: an
 * impression, enlarged, on paper, with the facts that impression records and
 * whatever action it licenses. WP5's brief was that they had to share surface
 * treatment, header and dismissal placement, spacing rhythm, responsive
 * behaviour, and focus, keyboard and screen-reader behaviour.
 *
 * So they share this. The caller owns the body — its own facts and its own
 * actions, which is exactly the part that must *not* be shared, because a shop
 * stamp reports a collection date and leads to its shop while a derived seal
 * reports an earned date and leads nowhere.
 *
 * Focus containment, Escape and focus restoration are the caller's
 * `useDialogFocus`, whose ref lands on the dialog element here.
 */
export function ImpressionSheet({
  children,
  tier,
  onClose,
  closeLabel,
  dialogRef,
  labelledBy,
  testId,
  dialogProps,
}: {
  readonly children: ReactNode;
  /** The kind of artefact: `Shop stamp`, `Locality seal`, `Country seal`. */
  readonly tier: string;
  readonly onClose: () => void;
  readonly closeLabel: string;
  readonly dialogRef: RefObject<HTMLDivElement | null>;
  readonly labelledBy: string;
  readonly testId?: string | undefined;
  /** Data attributes the caller needs on the dialog itself. */
  readonly dialogProps?: Record<string, string> | undefined;
}) {
  return (
    <div className={styles.scrim} data-testid={testId}>
      {/*
        A click on the scrim closes, like every other dismissible surface in the
        product. It is never the accessible route out: the close control and
        Escape both work, and this is hidden from assistive technology.
      */}
      <button
        className={styles.scrimButton}
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        {...dialogProps}
      >
        <div className={styles.header}>
          <p className={styles.tier}>{tier}</p>
          <button
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
