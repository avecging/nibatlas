"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  LOADING,
  SIGNED_OUT,
  type AccountSession,
} from "@/src/features/account/account-session";
import {
  endSession,
  fetchAccountSession,
  type SignOutOutcome,
} from "@/src/features/auth/auth-client";
import { parseCallbackError } from "@/src/features/auth/auth-copy";
import type { AuthErrorCode } from "@/src/server/auth/continuation";

/**
 * What the callback told us on the way back in.
 *
 * The callback cannot render anything: it is a route handler that redirects to
 * the reader's own return path with `?auth=success` or `?authError=…`. That
 * path can be any allowed page — a shop, the map, Me — so the result is held
 * here, at the top of the tree, and announced by whichever surface is showing.
 */
export type AuthResult =
  | { readonly kind: "signed-in" }
  | { readonly kind: "failed"; readonly code: AuthErrorCode };

export interface AccountSessionStore {
  readonly session: AccountSession;
  /** The last callback result, until the reader has been told about it. */
  readonly authResult: AuthResult | null;
  /** Re-reads the session. Used after a callback, and while awaiting a link. */
  refresh(): void;
  /** Ends the session on the server. The outcome is the caller's to report. */
  signOut(): Promise<SignOutOutcome>;
  acknowledgeAuthResult(): void;
}

const AccountSessionContext = createContext<AccountSessionStore | null>(null);

/**
 * Reads the callback's result out of the address bar, then takes it out.
 *
 * It has to go: `?auth=success` left in place would re-announce a sign-in on
 * every reload of that page, and would be carried into the next `returnTo` a
 * reader started from there. Everything else about the URL — the `?shop=` that
 * restores the map, the fragment that addresses a section of Me — is left
 * exactly as it was, because that is the context being returned to.
 *
 * `replaceState` rather than a router navigation, for the same reason reviewer
 * mode uses it: nothing is being navigated to. The page simply stops carrying
 * a parameter, and the router's own history bookkeeping is passed through.
 */
function takeAuthResult(): AuthResult | null {
  if (typeof window === "undefined") {
    return null;
  }

  let url: URL;

  try {
    url = new URL(window.location.href);
  } catch {
    return null;
  }

  const success = url.searchParams.get("auth") === "success";
  const failure = parseCallbackError(url.searchParams.get("authError"));

  if (!success && !failure) {
    return null;
  }

  url.searchParams.delete("auth");
  url.searchParams.delete("authError");

  try {
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    // A blocked History API must not swallow the result itself.
  }

  return failure ? { kind: "failed", code: failure } : { kind: "signed-in" };
}

/**
 * Holds the session for the whole application.
 *
 * The first paint is `loading`, on the server and on the client alike: a
 * session lives in an HTTP-only cookie that only the server can read, so the
 * browser cannot know the answer before it asks. Rendering "signed out" while
 * waiting would flash the anonymous account section at a signed-in reader on
 * every navigation, and rendering the signed-in structure optimistically would
 * be a claim about someone we have not identified. Loading is the truth for as
 * long as it lasts.
 */
export function AccountSessionProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSession] = useState<AccountSession>(LOADING);
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  /** Only the newest read may write state; an aborted one must not. */
  const readToken = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const read = useCallback(() => {
    const token = readToken.current + 1;
    readToken.current = token;
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    void fetchAccountSession(controller.signal).then((next) => {
      if (readToken.current === token) {
        setSession(next);
      }
    });
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       The session and the callback result are both external state that can
       only be read after mount: one is an HTTP-only cookie behind a route, the
       other is the address bar. This is the documented "subscribe to an
       external store" case. */
    const result = takeAuthResult();

    if (result) {
      setAuthResult(result);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    read();

    return () => {
      abortRef.current?.abort();
    };
  }, [read]);

  const signOut = useCallback(async () => {
    const outcome = await endSession();

    if (outcome.ok) {
      // Set directly rather than re-read: the server has just told us the
      // session is gone, and a second round trip would leave the signed-in
      // structure on screen while it ran.
      setSession(SIGNED_OUT);
      setAuthResult(null);
    }

    return outcome;
  }, []);

  const acknowledgeAuthResult = useCallback(() => setAuthResult(null), []);

  const value = useMemo<AccountSessionStore>(
    () => ({
      session,
      authResult,
      refresh: read,
      signOut,
      acknowledgeAuthResult,
    }),
    [acknowledgeAuthResult, authResult, read, session, signOut],
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
