"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button, ButtonLink } from "@/src/components/ui/Button";
import { accountHeadline } from "@/src/features/account/account-session";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { pendingIntentContext } from "@/src/features/auth/auth-copy";
import {
  DEFAULT_AUTH_RETURN_TO,
  isAllowedReturnTo,
  pendingIntentFromParams,
} from "@/src/features/auth/return-to";
import { SignInPanel } from "@/src/features/auth/SignInPanel";

import styles from "./LoginScreen.module.css";

/**
 * `/login`, the route form of the interruption.
 *
 * `UX.md`'s route map has carried this path since Milestone 1 and nothing has
 * answered it until now. It exists because an interruption cannot only be an
 * overlay: an emailed link that fails, a bookmark, a shared address, or a
 * device that reloaded mid-flow all have to land somewhere that can start the
 * flow again — and a page can be linked to, which an overlay cannot.
 *
 * It is the same `SignInPanel` the overlay uses, so there is one implementation
 * of both flows and one set of failure states. What differs is what a route
 * owes a reader that an overlay does not: a heading at level one, no dismissal
 * (leaving is the Back button or the way out below), and an answer for arriving
 * here already signed in.
 *
 * `returnTo` is read from the query and re-validated here before it is used as
 * a link, then validated again by the server when a flow starts. Nothing on
 * this page follows a path the allowlist in `normalizeReturnTo` rejects.
 */
export function LoginScreen() {
  const { session, refresh } = useAccountSession();
  const params = useSearchParams();
  const requested = params?.get("returnTo");
  const returnTo = isAllowedReturnTo(requested) ? requested : DEFAULT_AUTH_RETURN_TO;
  const intent = params ? pendingIntentFromParams(params) : null;

  if (session.status === "loading") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Sign in to Nib Atlas</h1>
          {/* Not an empty frame and not a guess: the session is being read, and
              that is what it says until the answer arrives. */}
          <p aria-label="Sign-in status" className={styles.body} role="status">
            Checking whether you are already signed in…
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "signed-in") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>You are already signed in</h1>
          <p className={styles.body}>
            This account is <strong>{accountHeadline(session)}</strong>. There is
            nothing to do here.
          </p>
          <ButtonLink href={returnTo} variant="primary">
            Continue
          </ButtonLink>
          <p className={styles.note}>
            Signing out lives in{" "}
            <Link className={styles.link} href="/me#me-account">
              Me
            </Link>
            , with the rest of your account.
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "unavailable") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Signing in is unavailable</h1>
          {session.reason === "not-configured" ? (
            <>
              <p className={styles.body}>
                This build of Nib Atlas has no accounts behind it, so there is
                nothing to sign in to.
              </p>
              <p className={styles.note}>
                Everything else works: the map, saving shops on this device, and
                collecting impressions.
              </p>
            </>
          ) : (
            <>
              <p aria-label="Sign-in status" className={styles.body} role="alert">
                Nib Atlas could not check your account just now. Nothing has
                changed about it.
              </p>
              <Button onClick={refresh} variant="secondary">
                Try again
              </Button>
            </>
          )}
          <ButtonLink href="/" variant="quiet">
            Back to the map
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <SignInPanel
          context={pendingIntentContext(intent)}
          footer={
            <p className={styles.note}>
              Or{" "}
              <Link className={styles.link} href={returnTo}>
                keep exploring without an account
              </Link>
              . Nothing on the map needs one.
            </p>
          }
          headingLevel={1}
          intent={intent}
          returnTo={returnTo}
          titleId="login-title"
        />
      </div>
    </div>
  );
}
