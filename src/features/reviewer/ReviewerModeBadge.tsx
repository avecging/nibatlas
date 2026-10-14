"use client";

import { Badge } from "@/src/components/ui/StatusBadge";
import { useReviewerModeStore } from "@/src/features/reviewer/ReviewerModeProvider";

import styles from "./ReviewerModeBadge.module.css";

/**
 * The marker that reviewer mode is on, and the discreet way out of it.
 *
 * Renders nothing at all in normal mode, so a tester never sees the control
 * that would put them into a mode they were not asked to evaluate.
 */
export function ReviewerModeBadge({ compact = false }: { readonly compact?: boolean }) {
  const { reviewer, setReviewer } = useReviewerModeStore();

  if (!reviewer) {
    return null;
  }

  return (
    <span className={styles.wrap} data-testid="reviewer-mode-badge">
      <Badge tone="prototype">Reviewer mode</Badge>
      <button
        className={styles.exit}
        type="button"
        onClick={() => setReviewer(false)}
        title="Return to the production-like experience on this device"
      >
        {compact ? "Exit" : "Exit reviewer mode"}
      </button>
    </span>
  );
}
