/**
 * What the reader is told when authentication does not go to plan.
 *
 * Kept as data, in one file, for three reasons. Every failure the routes can
 * report has copy — so no state can reach a reader as a bare code or an empty
 * region. The wording says what happened and what to do next, in the reader's
 * terms, with no status numbers and no provider names they did not choose. And
 * a token, a magic-link parameter or a provider message is never among the
 * inputs: only the closed set of codes the client already reduced them to.
 */

import type { SignInErrorCode } from "@/src/features/auth/auth-client";
import type {
  AuthErrorCode,
  PendingAuthIntent,
} from "@/src/server/auth/continuation";

/** Failures of the two routes that start a sign-in. */
export const SIGN_IN_ERROR_COPY: Readonly<Record<SignInErrorCode, string>> = {
  invalid_email: "That does not look like an email address. Check it and try again.",
  rate_limited:
    "Too many sign-in links have been asked for. Wait a few minutes, then try again.",
  unavailable: "Sign-in is not responding just now. Try again in a moment.",
  not_configured: "Signing in is not available in this build.",
  rejected: "That sign-in request could not be sent. Reload the page and try again.",
  network: "Nib Atlas could not reach the network. Check your connection and try again.",
};

/**
 * Failures reported by the callback, as `?authError=` on the return path.
 *
 * The reader arrives back where they started and has to be told why they are
 * still signed out — including, for an expired link, that asking for another
 * one is the fix rather than a repeat of the same mistake.
 */
export const CALLBACK_ERROR_COPY: Readonly<Record<AuthErrorCode, string>> = {
  expired_link:
    "That sign-in link has expired. Ask for a new one and open it within the hour.",
  provider_denied: "Google sign-in was not completed, so you are still signed out.",
  invalid_callback:
    "That sign-in link could not be used. It may have been opened twice — ask for a new one.",
  service_unavailable:
    "Sign-in could not be completed just now. Nothing has changed about your account.",
};

export function signInErrorMessage(code: SignInErrorCode): string {
  return SIGN_IN_ERROR_COPY[code];
}

export function callbackErrorMessage(code: AuthErrorCode): string {
  return CALLBACK_ERROR_COPY[code];
}

/** The `?authError=` values the callback can send, for parsing a return path. */
export function parseCallbackError(value: unknown): AuthErrorCode | null {
  return typeof value === "string" && value in CALLBACK_ERROR_COPY
    ? (value as AuthErrorCode)
    : null;
}

/**
 * What the reader was doing, when the interruption knows only the intent.
 *
 * A caller with the shop in hand passes its own line — "Save Ginza Itoya" — but
 * `/login` reaches the panel from a URL, where the intent carries an identifier
 * and nothing to name. Both lines say what returning will do and stop there.
 * Neither claims the action has been completed: the server holds the pending
 * intent, and finishing it is WP5's work.
 */
export function pendingIntentContext(intent: PendingAuthIntent | null): string | null {
  if (!intent) {
    return null;
  }

  if (intent.type === "save-shop") {
    return "You were saving a shop. Signing in brings you straight back to it.";
  }

  return "You were collecting an Atlas Stamp. Signing in brings you back to the shop; your location is asked for there, when you press Collect, and never during sign-in.";
}
