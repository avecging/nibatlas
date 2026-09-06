import type { CookieOptions } from "@supabase/ssr";

export const AUTH_FLOW_COOKIE = "nib-atlas.auth-flow.v1";
export const PENDING_INTENT_COOKIE = "nib-atlas.pending-intent.v1";
export const DEFAULT_AUTH_RETURN_TO = "/me#me-account";

const FLOW_MAX_AGE_SECONDS = 60 * 60;
const PENDING_MAX_AGE_SECONDS = 10 * 60;
const MAX_RETURN_TO_LENGTH = 2_048;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHOP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export type PendingAuthIntent =
  | { readonly type: "save-shop"; readonly shopId: string }
  | { readonly type: "collect-shop"; readonly shopSlug: string };

export interface AuthContinuation {
  readonly returnTo: string;
  readonly intent: PendingAuthIntent | null;
  readonly issuedAt: number;
}

export interface AuthCookieStore {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: CookieOptions): void;
  delete(name: string): void;
}

function allowedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/me" ||
    pathname === "/saved" ||
    pathname === "/account" ||
    pathname === "/passport" ||
    pathname.startsWith("/passport/") ||
    pathname.startsWith("/shops/")
  );
}

/** Same-origin, application-route-only redirect validation. */
export function normalizeReturnTo(
  value: unknown,
  fallback = DEFAULT_AUTH_RETURN_TO,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_RETURN_TO_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://nibatlas.invalid");

    if (url.origin !== "https://nibatlas.invalid" || !allowedPath(url.pathname)) {
      return fallback;
    }

    // These names describe callback results and cannot be supplied by a caller.
    url.searchParams.delete("auth");
    url.searchParams.delete("authError");

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function parsePendingIntent(value: unknown): PendingAuthIntent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;

  if (
    input["type"] === "save-shop" &&
    typeof input["shopId"] === "string" &&
    UUID.test(input["shopId"]) &&
    Object.keys(input).every((key) => key === "type" || key === "shopId")
  ) {
    return { type: "save-shop", shopId: input["shopId"] };
  }

  if (
    input["type"] === "collect-shop" &&
    typeof input["shopSlug"] === "string" &&
    input["shopSlug"].length <= 120 &&
    SHOP_SLUG.test(input["shopSlug"]) &&
    Object.keys(input).every((key) => key === "type" || key === "shopSlug")
  ) {
    return { type: "collect-shop", shopSlug: input["shopSlug"] };
  }

  return null;
}

function encode(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");
}

function decode(value: string): unknown {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function writeAuthContinuation(
  store: AuthCookieStore,
  input: { readonly returnTo?: unknown; readonly intent?: unknown },
  now = Date.now(),
) {
  const continuation: AuthContinuation = {
    returnTo: normalizeReturnTo(input.returnTo),
    intent: parsePendingIntent(input.intent),
    issuedAt: now,
  };

  store.set(AUTH_FLOW_COOKIE, encode(continuation), cookieOptions(FLOW_MAX_AGE_SECONDS));

  return continuation;
}

export function readAuthContinuation(
  store: AuthCookieStore,
  now = Date.now(),
): AuthContinuation | null {
  const value = store.get(AUTH_FLOW_COOKIE)?.value;

  if (!value || value.length > 4_096) {
    return null;
  }

  try {
    const parsed = decode(value);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const issuedAt = record["issuedAt"];

    if (
      typeof issuedAt !== "number" ||
      !Number.isSafeInteger(issuedAt) ||
      issuedAt > now + 60_000 ||
      issuedAt < now - FLOW_MAX_AGE_SECONDS * 1_000
    ) {
      return null;
    }

    const returnTo = normalizeReturnTo(record["returnTo"]);

    if (returnTo !== record["returnTo"]) {
      return null;
    }

    const rawIntent = record["intent"];
    const intent = rawIntent === null ? null : parsePendingIntent(rawIntent);

    if (rawIntent !== null && intent === null) {
      return null;
    }

    return { returnTo, intent, issuedAt };
  } catch {
    return null;
  }
}

/**
 * Reads the short-lived action promoted by a successful callback.
 *
 * Reading does not consume it: the action owner clears the cookie only after
 * the idempotent operation succeeds, so a transient response cannot lose the
 * reader's Save.
 */
export function readPendingIntent(
  store: AuthCookieStore,
  now = Date.now(),
): PendingAuthIntent | null {
  const value = store.get(PENDING_INTENT_COOKIE)?.value;

  if (!value || value.length > 4_096) {
    return null;
  }

  try {
    const parsed = decode(value);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const issuedAt = record["issuedAt"];

    if (
      typeof issuedAt !== "number" ||
      !Number.isSafeInteger(issuedAt) ||
      issuedAt > now + 60_000 ||
      issuedAt < now - PENDING_MAX_AGE_SECONDS * 1_000
    ) {
      return null;
    }

    return parsePendingIntent(record["intent"]);
  } catch {
    return null;
  }
}

/** Clears only the promoted action, leaving no unrelated auth state behind. */
export function clearPendingIntent(store: AuthCookieStore): void {
  store.delete(PENDING_INTENT_COOKIE);
}

export function finishAuthContinuation(store: AuthCookieStore, now = Date.now()) {
  const continuation = readAuthContinuation(store, now);
  store.delete(AUTH_FLOW_COOKIE);

  if (continuation?.intent) {
    store.set(
      PENDING_INTENT_COOKIE,
      encode({ intent: continuation.intent, issuedAt: now }),
      cookieOptions(PENDING_MAX_AGE_SECONDS),
    );
  } else {
    store.delete(PENDING_INTENT_COOKIE);
  }

  return continuation;
}

export function clearAuthContinuation(store: AuthCookieStore) {
  store.delete(AUTH_FLOW_COOKIE);
  store.delete(PENDING_INTENT_COOKIE);
}

export function appendAuthResult(
  returnTo: string,
  result: { readonly auth?: "success"; readonly authError?: AuthErrorCode },
) {
  const url = new URL(normalizeReturnTo(returnTo), "https://nibatlas.invalid");

  if (result.auth) {
    url.searchParams.set("auth", result.auth);
  }

  if (result.authError) {
    url.searchParams.set("authError", result.authError);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export type AuthErrorCode =
  | "expired_link"
  | "provider_denied"
  | "invalid_callback"
  | "service_unavailable";
