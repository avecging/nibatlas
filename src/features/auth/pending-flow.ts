/**
 * The flow a retry has to pick up again.
 *
 * A failed callback returns the reader to their own page with `?authError=`,
 * and the server has already cleared its continuation cookie by then — an
 * unusable flow state is not something to keep. That leaves the interface with
 * a problem the first version of the banner got wrong: **Try again** started a
 * fresh flow with no intent, so a Save that had been deferred through an
 * expired link could never complete, and a Collect had nothing to return to.
 * Nothing in memory can help, because the callback is a full navigation.
 *
 * So the flow the reader started is written down when it starts, in this tab's
 * own `sessionStorage`, and read back when a retry needs it.
 *
 * Three things keep that honest:
 *
 * - **It authorises nothing.** It is used only to re-fill a request that the
 *   server then validates from scratch, exactly as it validates the first one.
 *   A hand-edited entry can at most name a different allowed page or a
 *   well-formed intent — which is what a reader could type into `/login`
 *   anyway — and anything else is rejected on read by the same functions the
 *   server uses.
 * - **It expires.** One hour, matching the server's own flow window, so a
 *   retry cannot attach an intent from a session the reader has forgotten.
 * - **It is forgotten the moment a sign-in completes**, because from then on
 *   the pending intent lives in the server's cookie, which is the copy that
 *   completes the action.
 */

import {
  normalizeReturnTo,
  parsePendingIntent,
  type PendingAuthIntent,
} from "@/src/features/auth/return-to";

export const PENDING_FLOW_STORAGE_KEY = "nib-atlas.auth-flow.retry.v1";

const MAX_AGE_MS = 60 * 60 * 1_000;
const MAX_ENTRY_LENGTH = 2_048;

export interface RememberedFlow {
  readonly returnTo: string;
  readonly intent: PendingAuthIntent | null;
}

export function rememberPendingFlow(flow: RememberedFlow, now = Date.now()): void {
  try {
    window.sessionStorage.setItem(
      PENDING_FLOW_STORAGE_KEY,
      JSON.stringify({
        returnTo: normalizeReturnTo(flow.returnTo),
        intent: flow.intent,
        startedAt: now,
      }),
    );
  } catch {
    // Blocked site data. A retry then behaves as it did before this existed:
    // it starts a plain sign-in, which is a lesser outcome, not a broken one.
  }
}

export function readPendingFlow(now = Date.now()): RememberedFlow | null {
  let raw: string | null = null;

  try {
    raw = window.sessionStorage.getItem(PENDING_FLOW_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw || raw.length > MAX_ENTRY_LENGTH) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const startedAt = record["startedAt"];

    if (
      typeof startedAt !== "number" ||
      !Number.isSafeInteger(startedAt) ||
      startedAt > now + 60_000 ||
      startedAt < now - MAX_AGE_MS
    ) {
      return null;
    }

    const returnTo = normalizeReturnTo(record["returnTo"]);

    // Rejected rather than substituted: a record whose return path the
    // allowlist would rewrite is not the flow the reader started.
    if (returnTo !== record["returnTo"]) {
      return null;
    }

    const rawIntent = record["intent"];
    const intent = rawIntent === null ? null : parsePendingIntent(rawIntent);

    if (rawIntent !== null && intent === null) {
      return null;
    }

    return { returnTo, intent };
  } catch {
    return null;
  }
}

export function forgetPendingFlow(): void {
  try {
    window.sessionStorage.removeItem(PENDING_FLOW_STORAGE_KEY);
  } catch {
    // Nothing to do: an entry that cannot be removed also could not be read.
  }
}
