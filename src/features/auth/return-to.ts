/**
 * Where authentication comes back to, and what it was interrupting.
 *
 * The validation itself is not reimplemented here. `returnTo` is an
 * open-redirect surface and the pending intent is a server-side continuation,
 * so both are defined once — in `src/server/auth/continuation.ts`, where WP2
 * built them — and the interruption imports those exact functions. They are
 * pure string and object validators with no Supabase client, no secret and no
 * cookie behind them; sharing them is what keeps the browser's idea of an
 * allowed return path from drifting away from the server's.
 *
 * Nothing here is a security boundary. Every value the interruption sends is
 * re-validated by the route that receives it; this module exists so the
 * interface offers the reader the same paths the server will accept.
 */

import {
  DEFAULT_AUTH_RETURN_TO,
  normalizeReturnTo,
  parsePendingIntent,
  type PendingAuthIntent,
} from "@/src/server/auth/continuation";

export { DEFAULT_AUTH_RETURN_TO, normalizeReturnTo, parsePendingIntent };
export type { PendingAuthIntent };

export interface ReturnToLocation {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

/**
 * The place the reader is standing, as a return path.
 *
 * Path, query and fragment together, because the query is what already carries
 * map and Passport context: `?shop=` restores a selected shop and its camera,
 * and the fragment addresses a section of Me. `normalizeReturnTo` drops the
 * callback's own `auth` and `authError` parameters, so signing in from a page
 * that is showing a previous result cannot carry that result around again.
 */
export function captureReturnTo(location: ReturnToLocation): string {
  return normalizeReturnTo(`${location.pathname}${location.search}${location.hash}`);
}

/** The current document's location, or the default when there is no document. */
export function currentReturnTo(): string {
  if (typeof window === "undefined") {
    return DEFAULT_AUTH_RETURN_TO;
  }

  return captureReturnTo(window.location);
}

/**
 * Whether a value may be used as a client-side destination.
 *
 * `normalizeReturnTo` answers by substitution: it returns the value unchanged
 * when it is allowed and the fallback when it is not. A caller that is about to
 * navigate needs the yes-or-no form, so it is stated once here rather than
 * inferred at each call site.
 */
export function isAllowedReturnTo(value: unknown): value is string {
  // A sentinel no allowed path can equal, so the comparison cannot be satisfied
  // by the fallback itself — an empty string would be, and is not a path.
  return typeof value === "string" && normalizeReturnTo(value, "\u0000") === value;
}

/** Reads a pending intent out of a route's query, in the shape the API takes. */
export function pendingIntentFromParams(
  params: Pick<URLSearchParams, "get">,
): PendingAuthIntent | null {
  const type = params.get("intent");

  if (type === "save-shop") {
    return parsePendingIntent({ type, shopId: params.get("shopId") });
  }

  if (type === "collect-shop") {
    return parsePendingIntent({ type, shopSlug: params.get("shopSlug") });
  }

  return null;
}
