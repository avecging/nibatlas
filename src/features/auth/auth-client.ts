/**
 * The browser's only route to a session.
 *
 * Every call here goes to a first-party route built in WP2. No component
 * imports a Supabase client, holds a key, or reads an auth cookie: the session
 * is whatever `GET /api/v1/auth/session` says it is, and the two sign-in
 * flows are started by posting to routes that keep the provider exchange, the
 * `returnTo` validation and the pending intent on the server.
 *
 * Responses are translated into a small closed set of outcomes rather than
 * being passed through, so the interface never has to interpret an HTTP status
 * and can never render a server error string it has not written copy for.
 */

import {
  parseSessionResponse,
  type AccountSession,
} from "@/src/features/account/account-session";
import type { PendingAuthIntent } from "@/src/features/auth/return-to";

/**
 * What went wrong, in the terms the interface needs.
 *
 * `rejected` covers the two refusals a correct interface should never provoke —
 * a malformed body or a cross-origin post. It is kept distinct from `network`
 * so a defect here shows up as itself in evidence rather than hiding inside a
 * connectivity message.
 */
export type SignInErrorCode =
  | "invalid_email"
  | "rate_limited"
  | "unavailable"
  | "not_configured"
  | "rejected"
  | "network";

export interface SignInStart {
  readonly returnTo: string;
  readonly intent: PendingAuthIntent | null;
}

export type MagicLinkOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: SignInErrorCode };

export type GoogleOutcome =
  | { readonly ok: true; readonly redirectTo: string }
  | { readonly ok: false; readonly code: SignInErrorCode };

export type SignOutOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: SignInErrorCode };

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/**
 * Same-origin, never cached, and never reading a cross-origin response.
 *
 * `credentials: "same-origin"` is the default, and stated because the session
 * cookie is the whole point of the call. `redirect: "manual"` matters on the
 * Google route: the interface performs the provider navigation itself at the
 * top level, so `fetch` must not be allowed to follow a redirect chain it
 * would then fail on as a subresource.
 */
function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "manual",
    body: JSON.stringify(body),
  });
}

async function errorCodeOf(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();

    if (typeof body !== "object" || body === null) {
      return null;
    }

    const error = (body as { error?: unknown }).error;

    return typeof error === "object" && error !== null
      ? ((error as { code?: unknown }).code as string | undefined) ?? null
      : null;
  } catch {
    return null;
  }
}

async function classify(response: Response): Promise<SignInErrorCode> {
  if (response.status === 429) {
    return "rate_limited";
  }

  const code = await errorCodeOf(response);

  if (code === "invalid_email") {
    return "invalid_email";
  }

  if (code === "auth_unavailable") {
    return "not_configured";
  }

  if (response.status === 400 || response.status === 403) {
    return "rejected";
  }

  return "unavailable";
}

/** Reads the session. Failures are states, not exceptions. */
export async function fetchAccountSession(
  signal?: AbortSignal,
): Promise<AccountSession> {
  let response: Response;

  try {
    response = await fetch("/api/v1/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { status: "unavailable", reason: "unreachable" };
  }

  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return parseSessionResponse(response.status, body);
}

/**
 * Asks for a magic link.
 *
 * The response is the same whether or not an account already existed, and this
 * function keeps it that way: there is exactly one success outcome, so no copy
 * downstream can turn the route's deliberate ambiguity into an account probe.
 */
export async function requestMagicLink(
  email: string,
  start: SignInStart,
): Promise<MagicLinkOutcome> {
  try {
    const response = await post("/api/v1/auth/magic-link", {
      email,
      returnTo: start.returnTo,
      intent: start.intent,
    });

    return response.ok ? { ok: true } : { ok: false, code: await classify(response) };
  } catch {
    return { ok: false, code: "network" };
  }
}

/**
 * Starts Google sign-in and returns the provider URL to navigate to.
 *
 * The route has already checked that the URL is the configured Supabase
 * authorize endpoint. The absolute-URL check here is the browser's own guard
 * against handing `location` something it should not follow, not a second
 * opinion on the provider.
 */
export async function startGoogleSignIn(start: SignInStart): Promise<GoogleOutcome> {
  try {
    const response = await post("/api/v1/auth/google", {
      returnTo: start.returnTo,
      intent: start.intent,
    });

    if (!response.ok) {
      return { ok: false, code: await classify(response) };
    }

    const body: unknown = await response.json();
    const redirectTo =
      typeof body === "object" && body !== null
        ? (body as { redirectTo?: unknown }).redirectTo
        : null;

    if (typeof redirectTo !== "string" || !/^https?:\/\//u.test(redirectTo)) {
      return { ok: false, code: "unavailable" };
    }

    return { ok: true, redirectTo };
  } catch {
    return { ok: false, code: "network" };
  }
}

export async function endSession(): Promise<SignOutOutcome> {
  try {
    const response = await fetch("/api/v1/auth/sign-out", {
      method: "POST",
      headers: JSON_HEADERS,
      credentials: "same-origin",
      cache: "no-store",
    });

    return response.ok ? { ok: true } : { ok: false, code: await classify(response) };
  } catch {
    return { ok: false, code: "network" };
  }
}
