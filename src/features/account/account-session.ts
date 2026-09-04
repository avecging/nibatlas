/**
 * The account seam, now answered by a real session.
 *
 * WP2 of Milestone 1.5 built this module as a *shape* with nothing behind it:
 * normal mode was always signed out, and reviewer mode could preview the
 * signed-in structure from a local-storage key so the founder could read it
 * before authentication existed. Milestone 4 WP2 built the session routes, so
 * that preview is gone — with it the `ACCOUNT_PREVIEW_STORAGE_KEY` key, the
 * `reviewer@nibatlas.example` identity, and the `preview` flag every consumer
 * had to carry. A signed-in Nib Atlas screen now means a signed-in reader.
 *
 * Four states, because a session is read over the network and each answer is a
 * different thing to tell the reader:
 *
 * - **loading** — the server has not answered yet. Nothing may claim either way.
 * - **signed-out** — the ordinary state, and a complete one. Anonymous
 *   exploration is the product, not a degraded mode of it.
 * - **signed-in** — an identity from `GET /api/v1/auth/session`.
 * - **unavailable** — the session could not be read. Split by reason, because
 *   "this build has no authentication configured" and "we could not reach it
 *   just now" are different facts and only one of them is worth retrying.
 *
 * No component reads Supabase. This module parses one JSON response from the
 * application's own route and nothing else.
 */

/** The account identity is the session's; email never enters the public schema. */
export interface SignedInSession {
  readonly status: "signed-in";
  readonly userId: string;
  /** How the account identifies itself — the address it authenticated with. */
  readonly identityLabel: string;
  /** Optional, and owned by the private profile row rather than the identity. */
  readonly displayName: string | null;
}

export interface LoadingSession {
  readonly status: "loading";
}

export interface SignedOutSession {
  readonly status: "signed-out";
}

/**
 * Why the session could not be read.
 *
 * `not-configured` is the fixture and prototype builds: no Supabase project is
 * wired to them, the routes answer `auth_unavailable`, and offering a sign-in
 * control would be offering something that cannot work. `unreachable` is a
 * configured build whose session read failed, which is worth trying again.
 */
export type SessionUnavailableReason = "not-configured" | "unreachable";

export interface UnavailableSession {
  readonly status: "unavailable";
  readonly reason: SessionUnavailableReason;
}

export type AccountSession =
  | LoadingSession
  | SignedOutSession
  | SignedInSession
  | UnavailableSession;

export const LOADING: LoadingSession = { status: "loading" };
export const SIGNED_OUT: SignedOutSession = { status: "signed-out" };

/** Display names are a single line, trimmed, and bounded. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

/**
 * Normalises a display name held against the profile.
 *
 * Applied to what the server sends rather than to what a reader types — there
 * is no profile-update route yet — so a name that arrives with newlines, runs
 * of whitespace, or more characters than the interface reserves for it cannot
 * break the identity block. Whitespace-only collapses to `null`, so "cleared"
 * and "never set" stay one state.
 */
export function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const collapsed = value.replace(/\s+/gu, " ").trim();

  if (collapsed.length === 0) {
    return null;
  }

  return collapsed.slice(0, DISPLAY_NAME_MAX_LENGTH);
}

function unavailable(reason: SessionUnavailableReason): UnavailableSession {
  return { status: "unavailable", reason };
}

function errorCode(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const error = (body as { error?: unknown }).error;

  if (typeof error !== "object" || error === null) {
    return null;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" ? code : null;
}

/**
 * Turns one session response into one state.
 *
 * Deliberately unforgiving: a 200 whose body is not one of the two documented
 * shapes is `unreachable`, not signed out. Guessing "signed out" from an
 * unrecognised payload would show a signed-in reader the anonymous product and
 * invite them to sign in again; saying the read failed is both true and
 * recoverable.
 */
export function parseSessionResponse(status: number, body: unknown): AccountSession {
  if (status === 503 && errorCode(body) === "auth_unavailable") {
    return unavailable("not-configured");
  }

  if (status !== 200 || typeof body !== "object" || body === null) {
    return unavailable("unreachable");
  }

  const payload = body as Record<string, unknown>;

  if (payload["status"] === "signed-out") {
    return SIGNED_OUT;
  }

  if (payload["status"] !== "signed-in") {
    return unavailable("unreachable");
  }

  const userId = payload["userId"];
  const identityLabel = payload["identityLabel"];

  if (typeof userId !== "string" || userId.length === 0) {
    return unavailable("unreachable");
  }

  return {
    status: "signed-in",
    userId,
    identityLabel:
      typeof identityLabel === "string" && identityLabel.trim().length > 0
        ? identityLabel.trim().slice(0, 254)
        : "Signed-in account",
    displayName: normalizeDisplayName(payload["displayName"]),
  };
}

/** How the reader is addressed: their chosen name, or the account itself. */
export function accountHeadline(session: AccountSession): string {
  if (session.status === "signed-in") {
    return session.displayName ?? session.identityLabel;
  }

  if (session.status === "loading") {
    return "Checking your account";
  }

  if (session.status === "unavailable") {
    return "Account unavailable";
  }

  return "Not signed in";
}
