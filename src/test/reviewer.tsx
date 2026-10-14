import type { ReactNode } from "react";

import {
  REVIEWER_STORAGE_KEY,
  serializeReviewerChoice,
} from "@/src/features/reviewer/reviewer-mode";
import { ReviewerModeProvider } from "@/src/features/reviewer/ReviewerModeProvider";

/**
 * Puts a component test in a known reviewer state.
 *
 * The provider resolves from local storage on mount, so seeding storage before
 * `render` is the same path a real device takes — no mocked context, and the
 * default (`false`) exercises exactly what a normal tester receives.
 */
export function seedReviewerMode(enabled: boolean): void {
  window.localStorage.setItem(REVIEWER_STORAGE_KEY, serializeReviewerChoice(enabled));
}

export function clearReviewerMode(): void {
  window.localStorage.removeItem(REVIEWER_STORAGE_KEY);
}

export function WithReviewerMode({ children }: { readonly children: ReactNode }) {
  return <ReviewerModeProvider>{children}</ReviewerModeProvider>;
}
