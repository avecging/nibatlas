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

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { Button } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { callbackErrorMessage } from "@/src/features/auth/auth-copy";
import { currentReturnTo, type PendingAuthIntent } from "@/src/features/auth/return-to";
import { SignInPanel } from "@/src/features/auth/SignInPanel";

import styles from "./SignInProvider.module.css";

/**
 * The interruption, made available to every surface.
 *
 * Authentication is not a destination in this product, so no screen navigates
 * to it: a surface that reaches a point where an account is genuinely required
 * asks for the interruption, states what it was doing, and hands over the
 * return path. That keeps two things in one place — the overlay's focus and
 * dismissal behaviour, and the announcement of whatever the callback said on
 * the way back — instead of once per caller.
 *
 * Milestone 4 WP3 wires the account controls in Me. Saving stays a device-local
 * bookmark until WP4's endpoints exist, so nothing on the map or a shop page
 * asks for an account yet; when WP5 connects them, `requestSignIn` is what they
 * call, and the pending intent it already carries is what completes the save.
 */
export interface SignInRequest {
  /** Defaults to wherever the reader is standing, query and fragment included. */
  readonly returnTo?: string;
  /** Completed by the server after authentication. WP5 owns the completion. */
  readonly intent?: PendingAuthIntent | null;
  /** One line naming what was interrupted, in the reader's terms. */
  readonly context?: string | null;
}

export interface SignInPromptStore {
  readonly signInOpen: boolean;
  requestSignIn(request?: SignInRequest): void;
  dismissSignIn(): void;
}

const SignInPromptContext = createContext<SignInPromptStore | null>(null);

interface OpenRequest {
  readonly returnTo: string;
  readonly intent: PendingAuthIntent | null;
  readonly context: string | null;
}

export function SignInProvider({ children }: { readonly children: ReactNode }) {
  const { session, authResult, acknowledgeAuthResult } = useAccountSession();
  const [request, setRequest] = useState<OpenRequest | null>(null);

  const dismissSignIn = useCallback(() => setRequest(null), []);
  const requestSignIn = useCallback((next: SignInRequest = {}) => {
    setRequest({
      returnTo: next.returnTo ?? currentReturnTo(),
      intent: next.intent ?? null,
      context: next.context ?? null,
    });
  }, []);

  /*
   * A session that arrives while the interruption is open closes it. That is
   * the magic-link-in-another-tab case: the reader signs in elsewhere, comes
   * back to this tab, the panel re-reads the session, and the overlay must get
   * out of the way rather than keep asking.
   */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       The session is an external system, read over the network, and this is the
       interruption synchronising with it: the same "subscribe to an external
       store" case as the providers above it. There is no render-time derivation
       that works instead — deriving the open state from the session would make
       a dismissed request reappear the moment the reader signed out again. */
    if (session.status === "signed-in") {
      setRequest(null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [session.status]);

  const dialogRef = useDialogFocus<HTMLDivElement>(request !== null, dismissSignIn);

  const value = useMemo<SignInPromptStore>(
    () => ({ signInOpen: request !== null, requestSignIn, dismissSignIn }),
    [dismissSignIn, request, requestSignIn],
  );

  return (
    <SignInPromptContext.Provider value={value}>
      {children}

      {/*
        The callback's result, announced wherever the reader landed. `returnTo`
        can be any allowed page, so this cannot live on one screen — and a
        failure has to carry the way to try again, because the reader is back
        where they started with nothing to show that anything happened.
      */}
      {authResult ? (
        <div className={styles.bannerWrap}>
          <div
            // Named for the same reason as the row results in Me: the banner
            // can land on a page that already has live regions of its own — the
            // map's search status, the router's announcer — and an unnamed one
            // cannot be told from them.
            aria-label="Sign-in result"
            className={styles.banner}
            data-tone={authResult.kind === "signed-in" ? "success" : "error"}
            role={authResult.kind === "signed-in" ? "status" : "alert"}
          >
            <Icon name={authResult.kind === "signed-in" ? "check" : "alert"} size={20} />
            <p className={styles.bannerText}>
              {authResult.kind === "signed-in"
                ? "You are signed in. Everything you had open is where you left it."
                : callbackErrorMessage(authResult.code)}
            </p>
            <div className={styles.bannerActions}>
              {authResult.kind === "failed" ? (
                <Button
                  compact
                  onClick={() => {
                    acknowledgeAuthResult();
                    requestSignIn();
                  }}
                  variant="secondary"
                >
                  Try again
                </Button>
              ) : null}
              <button
                aria-label="Dismiss this message"
                className={styles.bannerClose}
                onClick={acknowledgeAuthResult}
                type="button"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {request ? (
        <div className={styles.backdrop}>
          <div
            aria-labelledby="sign-in-interruption-title"
            aria-modal="true"
            className={styles.dialog}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <SignInPanel
              context={request.context}
              footer={
                /*
                 * The way out is a control with a name, not a browser gesture.
                 * It says what dismissing does — exploring continues — because
                 * the reader has to be able to tell that this is an
                 * interruption they can decline rather than a gate.
                 */
                <div className={styles.footer}>
                  <Button fullWidth onClick={dismissSignIn} variant="quiet">
                    Not now
                  </Button>
                  <p className={styles.footerNote}>
                    Exploring the map, saving shops on this device and collecting
                    impressions all work without an account.
                  </p>
                </div>
              }
              intent={request.intent}
              returnTo={request.returnTo}
              titleId="sign-in-interruption-title"
            />
          </div>
        </div>
      ) : null}
    </SignInPromptContext.Provider>
  );
}

export function useSignInPrompt(): SignInPromptStore {
  const store = useContext(SignInPromptContext);

  if (!store) {
    throw new Error("useSignInPrompt must be used inside SignInProvider");
  }

  return store;
}
