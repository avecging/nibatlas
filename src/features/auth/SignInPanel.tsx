"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import {
  requestMagicLink,
  startGoogleSignIn,
  type SignInStart,
} from "@/src/features/auth/auth-client";
import { SIGN_IN_SENDER, signInErrorMessage } from "@/src/features/auth/auth-copy";
import { leaveForProvider } from "@/src/features/auth/navigate";

import styles from "./SignInPanel.module.css";

/**
 * The sign-in interruption itself.
 *
 * `UX.md` — *Authentication and interruption* — makes this an interruption
 * rather than the beginning of the product, and that decides everything about
 * the panel. It is short: two ways in, one line on what an account is for, and
 * no tour. It never claims the reader needs an account to explore, because
 * they do not. It states what it is interrupting, so pressing the way in is a
 * continuation of what they were already doing rather than a new errand. And
 * the way out is a control, not a browser gesture.
 *
 * Both flows leave the page — Google immediately, the magic link when the
 * reader opens it — so the return path travels with the request and is
 * validated by the server, not held in memory here. The panel is the same
 * component in the overlay and on `/login`; only the heading level and the
 * dismissal differ, because a route has nothing to dismiss.
 */
export interface SignInPanelProps {
  /** Owned by the surface: the dialog labels itself with this heading. */
  readonly titleId: string;
  readonly returnTo: string;
  readonly intent: SignInStart["intent"];
  /**
   * What the reader was doing, in their terms — "Save Ginza Itoya", say.
   * Omitted when sign-in was chosen for its own sake, as it is from Me.
   */
  readonly context?: string | null;
  readonly headingLevel?: 1 | 2;
  /** The dismissal, when the surface has one. Rendered inside the panel. */
  readonly footer?: React.ReactNode;
}

type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "sent"; readonly email: string }
  /** The provider navigation has been asked for and the page is leaving. */
  | { readonly kind: "leaving" };

export function SignInPanel({
  titleId,
  returnTo,
  intent,
  context = null,
  headingLevel = 2,
  footer,
}: SignInPanelProps) {
  const { refresh } = useAccountSession();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();
  const hintId = useId();
  const errorId = useId();
  const sentRef = useRef<HTMLParagraphElement>(null);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  // Memoised because both submit handlers depend on it: a fresh object every
  // render would rebuild them every render.
  const start = useMemo<SignInStart>(() => ({ returnTo, intent }), [intent, returnTo]);
  const busy = phase.kind === "sending" || phase.kind === "leaving";

  /*
   * A magic link is often opened somewhere else — the mail application on the
   * same phone, a different tab, a laptop. The tab that asked for it has no way
   * to be told, so it asks again when the reader comes back to it: returning to
   * a tab that still says "check your email" after signing in elsewhere is the
   * one moment this interface would otherwise be wrong about the reader.
   */
  useEffect(() => {
    if (phase.kind !== "sent") {
      return;
    }

    function recheck() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);

    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [phase.kind, refresh]);

  // The confirmation replaces the form, so focus is moved to it: a keyboard or
  // screen-reader user would otherwise be left on a submit button that is no
  // longer in the document.
  useEffect(() => {
    if (phase.kind === "sent") {
      sentRef.current?.focus();
    }
  }, [phase.kind]);

  const onGoogle = useCallback(async () => {
    setError(null);
    setPhase({ kind: "leaving" });

    const outcome = await startGoogleSignIn(start);

    if (!outcome.ok) {
      setPhase({ kind: "idle" });
      setError(signInErrorMessage(outcome.code));

      return;
    }

    // A top-level navigation, deliberately: the provider exchange cannot happen
    // inside a fetch, and the route returns the URL rather than a redirect so
    // that the browser — not `fetch` — is the thing that leaves.
    leaveForProvider(outcome.redirectTo);
  }, [start]);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const address = email.trim();

      if (address.length === 0) {
        setError("Enter the email address you want the link sent to.");

        return;
      }

      setError(null);
      setPhase({ kind: "sending" });

      const outcome = await requestMagicLink(address, start);

      if (!outcome.ok) {
        setPhase({ kind: "idle" });
        setError(signInErrorMessage(outcome.code));

        return;
      }

      setPhase({ kind: "sent", email: address });
    },
    [email, start],
  );

  if (phase.kind === "sent") {
    return (
      <div className={styles.panel}>
        <Heading className={styles.title} id={titleId}>
          Check your email
        </Heading>
        {/*
          A live region and the focus target, because it is the outcome of the
          form that was here a moment ago. The address is repeated back so a
          typo is visible without reopening anything.
        */}
        <p
          aria-label="Sign-in link"
          className={styles.sent}
          ref={sentRef}
          role="status"
          tabIndex={-1}
        >
          A sign-in link is on its way to <strong>{phase.email}</strong>. Open it to
          finish signing in — it works once, and only for a short time.
        </p>
        <p className={styles.note}>
          The message comes from {SIGN_IN_SENDER}. If it is not there in a minute,
          check the folder your mail application files promotions or spam in.
        </p>
        <p className={styles.note}>
          You can keep exploring in the meantime. Nothing you have saved on this
          device is lost by signing in.
        </p>
        <Button
          fullWidth
          onClick={() => {
            setPhase({ kind: "idle" });
            setError(null);
          }}
          variant="quiet"
        >
          Use a different address
        </Button>
        {footer}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <Heading className={styles.title} id={titleId}>
        Sign in to Nib Atlas
      </Heading>

      {/*
        The interruption says what it interrupted, then what an account is for.
        Neither line is an argument for having one: exploring, saving and
        collecting all work on this device without an account, and a panel that
        implied otherwise would be the onboarding wall this is not.
      */}
      {context ? <p className={styles.context}>{context}</p> : null}
      <p className={styles.lede}>
        An account keeps your saved shops and collected impressions with you on
        every device you use. Signing in for the first time creates it.
      </p>

      {/*
        The error is named, like the row results in Me and for the same reason:
        a page can carry several live regions — the router's own announcer among
        them — and two unnamed ones are indistinguishable to anyone navigating
        by region.
      */}
      {error ? (
        <p
          aria-label="Sign-in error"
          className={styles.error}
          id={errorId}
          role="alert"
        >
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </p>
      ) : null}

      <Button disabled={busy} fullWidth onClick={onGoogle} variant="secondary">
        {phase.kind === "leaving" ? "Opening Google…" : "Continue with Google"}
      </Button>

      {/*
        A separator with a word in it, and the word is not a heading: it labels
        the choice between two routes to the same place. `aria-hidden` on the
        rules keeps the decoration out of the accessibility tree while the text
        itself is read.
      */}
      <p className={styles.divider}>
        <span aria-hidden="true" className={styles.rule} />
        or
        <span aria-hidden="true" className={styles.rule} />
      </p>

      <form className={styles.form} noValidate onSubmit={onSubmit}>
        <label className={styles.label} htmlFor={emailId}>
          Email address
        </label>
        <p className={styles.hint} id={hintId}>
          We send a link that signs you in. There is no password to choose or
          remember.
        </p>
        <input
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          autoComplete="email"
          className={styles.input}
          disabled={busy}
          id={emailId}
          inputMode="email"
          name="email"
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          type="email"
          value={email}
        />
        <Button disabled={busy} fullWidth type="submit">
          <Icon name="mail" size={18} />
          {phase.kind === "sending" ? "Sending the link…" : "Email me a sign-in link"}
        </Button>
      </form>

      <p className={styles.note}>
        Nib Atlas stores your address to sign you in and nothing else.{" "}
        <Link className={styles.link} href="/privacy">
          What we store
        </Link>
        .
      </p>

      {footer}
    </div>
  );
}
