/**
 * The account seam.
 *
 * `docs/milestone-1-5-product-refinement.md` gives Me two distinct states, and
 * the signed-in one lists things that do not exist yet: an account identity, a
 * display name, sign out, and Delete account. Authentication itself is
 * Milestone 4, so WP2 cannot make that state real — but it can build the seam
 * the real thing will plug into, and it can make the structure reviewable
 * without lying to a tester about having an account.
 *
 * The rules:
 *
 * - **Normal mode is always signed out.** No parameter, no storage entry and no
 *   control can move a tester's device into the signed-in state, because there
 *   is nothing to sign in to. A tester therefore only ever sees copy that is
 *   true of them.
 * - **Reviewer mode may preview a signed-in account.** The founder and Codex
 *   need to read the signed-in structure — including the Danger group — before
 *   Milestone 4 builds it. That preview lives in a reviewer-namespaced key and
 *   is labelled as a preview wherever it renders.
 *
 * Milestone 4 replaces `resolveAccountSession` with a real session lookup and
 * deletes the preview; every consumer keeps the same shape.
 */

/** A device with no account: the only state normal mode can be in. */
export interface SignedOutSession {
  readonly status: "signed-out";
}

export interface SignedInSession {
  readonly status: "signed-in";
  /**
   * Optional, per the approved structure. An account is identified by its
   * address; the display name is what the reader chose to be called.
   */
  readonly displayName: string | null;
  /** How the account identifies itself — an address in the real thing. */
  readonly identityLabel: string;
  /**
   * True while the signed-in state is reviewer instrumentation rather than a
   * real session. Milestone 4 issues sessions with this false and the flag
   * disappears with the preview.
   */
  readonly preview: boolean;
}

export type AccountSession = SignedOutSession | SignedInSession;

export const SIGNED_OUT: SignedOutSession = { status: "signed-out" };

/**
 * Reviewer-namespaced, and versioned alongside the collection stores.
 *
 * A normal-mode device never reads or writes this key, so a reviewer preview
 * cannot become a tester's state by switching modes.
 */
export const ACCOUNT_PREVIEW_STORAGE_KEY = "nib-atlas.account.reviewer.v1";

/** The identity the preview presents, so screenshots and tests are stable. */
export const PREVIEW_IDENTITY_LABEL = "reviewer@nibatlas.example";

/** Display names are a single line, trimmed, and bounded. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

interface PersistedPreview {
  readonly signedIn: boolean;
  readonly displayName?: string | null;
}

/**
 * Normalises a typed display name.
 *
 * Returns `null` for anything that is only whitespace, so "cleared" and "never
 * set" are one state rather than two that render differently. Newlines and
 * runs of whitespace collapse because this renders on one line.
 */
export function normalizeDisplayName(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const collapsed = value.replace(/\s+/gu, " ").trim();

  if (collapsed.length === 0) {
    return null;
  }

  return collapsed.slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function parseAccountPreview(raw: string | null | undefined): PersistedPreview | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const candidate = parsed as PersistedPreview;

    if (typeof candidate.signedIn !== "boolean") {
      return null;
    }

    return {
      signedIn: candidate.signedIn,
      displayName: normalizeDisplayName(
        typeof candidate.displayName === "string" ? candidate.displayName : null,
      ),
    };
  } catch {
    return null;
  }
}

export function serializeAccountPreview(preview: PersistedPreview): string {
  return JSON.stringify({
    signedIn: preview.signedIn,
    displayName: normalizeDisplayName(preview.displayName ?? null),
  } satisfies PersistedPreview);
}

/**
 * The whole rule in one function.
 *
 * Reviewer mode is checked first and on its own line: a stored preview is
 * ignored outright in normal mode rather than merely unreachable, so a key left
 * behind by an earlier reviewer session cannot sign a tester in.
 */
export function resolveAccountSession({
  reviewer,
  preview,
}: {
  readonly reviewer: boolean;
  readonly preview: PersistedPreview | null;
}): AccountSession {
  if (!reviewer || preview === null || !preview.signedIn) {
    return SIGNED_OUT;
  }

  return {
    status: "signed-in",
    displayName: normalizeDisplayName(preview.displayName ?? null),
    identityLabel: PREVIEW_IDENTITY_LABEL,
    preview: true,
  };
}

/** How the reader is addressed: their chosen name, or the account itself. */
export function accountHeadline(session: AccountSession): string {
  if (session.status === "signed-out") {
    return "Not signed in";
  }

  return session.displayName ?? session.identityLabel;
}
