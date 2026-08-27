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
  ACCOUNT_PREVIEW_STORAGE_KEY,
  SIGNED_OUT,
  normalizeDisplayName,
  parseAccountPreview,
  resolveAccountSession,
  serializeAccountPreview,
  type AccountSession,
} from "@/src/features/account/account-session";
import { useReviewerModeStore } from "@/src/features/reviewer/ReviewerModeProvider";

export interface AccountSessionStore {
  readonly session: AccountSession;
  /**
   * Whether the device's own state has been read yet. False during the server
   * render and the first client paint, exactly as in the collection store: the
   * counts may render from the baseline, but a *claim* about the reader has to
   * wait.
   */
  readonly hydrated: boolean;
  /** Whether the signed-in preview can be entered at all on this device. */
  readonly canPreview: boolean;
  /** Reviewer-only. A no-op in normal mode. */
  previewSignedIn(): void;
  /** Ends the session — the preview today, a real session in Milestone 4. */
  signOut(): void;
  setDisplayName(value: string | null): void;
}

const AccountSessionContext = createContext<AccountSessionStore | null>(null);

function readPreview() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseAccountPreview(window.localStorage.getItem(ACCOUNT_PREVIEW_STORAGE_KEY));
  } catch {
    // Blocked site data. A device that cannot remember a preview has not
    // entered one, which is the safe direction.
    return null;
  }
}

function writePreview(signedIn: boolean, displayName: string | null) {
  try {
    window.localStorage.setItem(
      ACCOUNT_PREVIEW_STORAGE_KEY,
      serializeAccountPreview({ signedIn, displayName }),
    );
  } catch {
    // Best effort: the preview still applies for this page view.
  }
}

/**
 * Resolves the account session on the client only.
 *
 * Same shape and same reasoning as `ReviewerModeProvider`: the server render
 * and the first client paint are signed out, so the signed-in structure never
 * reaches the server HTML of a normal visitor and the two renders agree.
 */
export function AccountSessionProvider({ children }: { readonly children: ReactNode }) {
  const { reviewer, resolved } = useReviewerModeStore();
  const [session, setSession] = useState<AccountSession>(SIGNED_OUT);
  const [hydratedFor, setHydratedFor] = useState<boolean | null>(null);

  useEffect(() => {
    // Reviewer mode resolves after mount. Reading before it settles would
    // resolve the preview against the wrong audience.
    if (!resolved || hydratedFor === reviewer) {
      return;
    }

    /* eslint-disable react-hooks/set-state-in-effect --
       Local storage is an external system that can only be read after mount;
       this is the documented "subscribe to an external store" case. */
    setSession(resolveAccountSession({ reviewer, preview: readPreview() }));
    setHydratedFor(reviewer);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [hydratedFor, resolved, reviewer]);

  const previewSignedIn = useCallback(() => {
    // Guarded here as well as in `resolveAccountSession`, so a stray call from
    // a component cannot sign a tester in even momentarily.
    if (!reviewer) {
      return;
    }

    const displayName = session.status === "signed-in" ? session.displayName : null;

    writePreview(true, displayName);
    setSession(resolveAccountSession({ reviewer, preview: { signedIn: true, displayName } }));
  }, [reviewer, session]);

  const signOut = useCallback(() => {
    // The display name is deliberately kept: signing out of the preview and
    // back in should not silently discard what was typed, and Milestone 4's
    // display name will live on the account rather than the device anyway.
    const displayName = session.status === "signed-in" ? session.displayName : null;

    writePreview(false, displayName);
    setSession(SIGNED_OUT);
  }, [session]);

  const setDisplayName = useCallback(
    (value: string | null) => {
      if (session.status !== "signed-in") {
        return;
      }

      const displayName = normalizeDisplayName(value);

      writePreview(true, displayName);
      setSession({ ...session, displayName });
    },
    [session],
  );

  const value = useMemo<AccountSessionStore>(
    () => ({
      session,
      hydrated: hydratedFor === reviewer,
      canPreview: reviewer,
      previewSignedIn,
      signOut,
      setDisplayName,
    }),
    [hydratedFor, previewSignedIn, reviewer, session, setDisplayName, signOut],
  );

  return (
    <AccountSessionContext.Provider value={value}>{children}</AccountSessionContext.Provider>
  );
}

export function useAccountSession(): AccountSessionStore {
  const store = useContext(AccountSessionContext);

  if (!store) {
    throw new Error("useAccountSession must be used inside AccountSessionProvider");
  }

  return store;
}
