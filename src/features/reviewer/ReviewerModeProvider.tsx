"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  REVIEWER_STORAGE_KEY,
  parseStoredReviewerChoice,
  resolveReviewerMode,
  reviewerParamFromSearch,
  serializeReviewerChoice,
} from "@/src/features/reviewer/reviewer-mode";

export interface ReviewerModeStore {
  /** Whether reviewer instrumentation should render. */
  readonly reviewer: boolean;
  /**
   * Whether the device's remembered choice has been read yet. False during the
   * server render and the first client paint.
   */
  readonly resolved: boolean;
  /** Persists a new choice on this device. */
  setReviewer(next: boolean): void;
}

const ReviewerModeContext = createContext<ReviewerModeStore | null>(null);

function readStoredChoice(): boolean | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseStoredReviewerChoice(window.localStorage.getItem(REVIEWER_STORAGE_KEY));
  } catch {
    // Storage can be unavailable (private mode, blocked site data). A device
    // that cannot remember a choice is a device that has not made one.
    return null;
  }
}

function writeStoredChoice(enabled: boolean): void {
  try {
    window.localStorage.setItem(REVIEWER_STORAGE_KEY, serializeReviewerChoice(enabled));
  } catch {
    // Best effort. The flag still applies for this page view.
  }
}

/**
 * Resolves reviewer mode on the client only.
 *
 * The server render and the first client paint are always the product. Reviewer
 * material therefore never reaches the server HTML, so a normal tester can
 * never see it flash, and there is no hydration mismatch to reconcile — the two
 * renders agree because both start from "off".
 *
 * The trade is the reverse flash: a reviewer sees production copy for one frame
 * before the instrumentation appears. That is the correct side to pay on.
 *
 * `window.location.search` is read directly rather than through
 * `useSearchParams`, which would force every route that renders the shell into
 * dynamic rendering or a Suspense boundary. The parameter is typed into an
 * address bar, so it always arrives with a document load.
 */
export function ReviewerModeProvider({ children }: { readonly children: ReactNode }) {
  const [reviewer, setReviewerState] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const param = reviewerParamFromSearch(window.location.search);
    const stored = readStoredChoice();
    const next = resolveReviewerMode({ param, stored });

    // An explicit parameter is a decision, so it is remembered even when it
    // matches the default. Otherwise `?review=0` on a fresh device would leave
    // nothing behind and a later `?review=1` link would look like the first
    // choice ever made.
    if (param !== null) {
      writeStoredChoice(param);
    }

    /* eslint-disable react-hooks/set-state-in-effect --
       Local storage and the URL are external systems that can only be read
       after mount; this is the documented "subscribe to an external store"
       case, and reading them during render would reintroduce the mismatch this
       provider exists to avoid. */
    setReviewerState(next);
    setResolved(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setReviewer = useCallback((next: boolean) => {
    writeStoredChoice(next);
    setReviewerState(next);
  }, []);

  const value = useMemo<ReviewerModeStore>(
    () => ({ reviewer, resolved, setReviewer }),
    [resolved, reviewer, setReviewer],
  );

  return (
    <ReviewerModeContext.Provider value={value}>{children}</ReviewerModeContext.Provider>
  );
}

export function useReviewerModeStore(): ReviewerModeStore {
  const store = useContext(ReviewerModeContext);

  if (!store) {
    throw new Error("useReviewerModeStore must be used inside ReviewerModeProvider");
  }

  return store;
}

/**
 * The flag itself.
 *
 * Call this in a client component and branch with `reviewer ? … : null`, so the
 * reviewer-only JSX is never evaluated for a normal tester. Wrapping
 * reviewer-only children from a *server* component would serialise them into
 * the RSC payload of every visitor, which is exactly what this mechanism is
 * meant to prevent.
 */
export function useReviewerMode(): boolean {
  return useReviewerModeStore().reviewer;
}
