import type { ReactNode } from "react";
import { vi } from "vitest";

import { AccountSessionProvider } from "@/src/features/account/AccountSessionProvider";
import { SignInProvider } from "@/src/features/auth/SignInProvider";
import { ReviewerModeProvider } from "@/src/features/reviewer/ReviewerModeProvider";

/**
 * A session for a component test, arranged where a browser would find one.
 *
 * The provider reads the session over `fetch` from a first-party route, so a
 * component test arranges the route's answer rather than the provider's state.
 * That keeps the parsing, the failure classification and the effect ordering
 * inside the test instead of being mocked past — the same reason the reviewer
 * helper seeds `localStorage` rather than stubbing its provider.
 */
export const SESSION_USER_ID = "3f8a1c62-5d4b-4a7e-9b21-0c6f5d8e4a11";
export const SESSION_IDENTITY = "ada@nibatlas.example";

export type SessionFixture =
  | { readonly kind: "signed-out" }
  | {
      readonly kind: "signed-in";
      readonly displayName?: string | null;
      readonly identityLabel?: string;
    }
  | { readonly kind: "not-configured" }
  | { readonly kind: "unreachable" }
  /** The route never answers, which is what "loading" is made of. */
  | { readonly kind: "pending" };

export interface AuthFetchFixture {
  readonly session?: SessionFixture;
  readonly magicLink?: { readonly status: number; readonly code?: string };
  readonly google?: {
    readonly status: number;
    readonly code?: string;
    readonly redirectTo?: string;
  };
  readonly signOut?: { readonly status: number };
  readonly savedShops?: { readonly status?: number; readonly body: unknown };
  readonly pendingSave?: { readonly status?: number; readonly body?: unknown };
  readonly pendingSaves?: readonly {
    readonly status?: number;
    readonly body?: unknown;
  }[];
  readonly savedMutation?: { readonly status?: number; readonly body: unknown };
}

export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly body: Record<string, unknown> | null;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sessionResponse(fixture: SessionFixture): Promise<Response> {
  if (fixture.kind === "pending") {
    return new Promise<Response>(() => {
      // Never settles: the provider stays in its loading state.
    });
  }

  if (fixture.kind === "signed-out") {
    return Promise.resolve(jsonResponse(200, { status: "signed-out" }));
  }

  if (fixture.kind === "signed-in") {
    return Promise.resolve(
      jsonResponse(200, {
        status: "signed-in",
        userId: SESSION_USER_ID,
        identityLabel: fixture.identityLabel ?? SESSION_IDENTITY,
        displayName: fixture.displayName ?? null,
      }),
    );
  }

  return Promise.resolve(
    jsonResponse(503, {
      ok: false,
      error: {
        code:
          fixture.kind === "not-configured" ? "auth_unavailable" : "session_unavailable",
      },
    }),
  );
}

/**
 * Installs a `fetch` that answers only the auth routes.
 *
 * Anything else throws rather than resolving to something plausible: a
 * component reaching for a route this fixture has not been told about is a
 * defect, and a silent empty response would hide it.
 */
export function installAuthFetch(fixture: AuthFetchFixture = {}) {
  const requests: RecordedRequest[] = [];
  let pendingSaveIndex = 0;
  const session = fixture.session ?? { kind: "signed-out" };

  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const raw = typeof init?.body === "string" ? init.body : null;

    requests.push({
      url,
      method: init?.method ?? "GET",
      body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null,
    });

    if (url.includes("/api/v1/auth/session")) {
      return sessionResponse(session);
    }

    if (url.includes("/api/v1/auth/magic-link")) {
      const outcome = fixture.magicLink ?? { status: 202 };

      return outcome.status < 400
        ? jsonResponse(outcome.status, { ok: true })
        : jsonResponse(outcome.status, {
            ok: false,
            error: { code: outcome.code ?? "magic_link_unavailable" },
          });
    }

    if (url.includes("/api/v1/auth/google")) {
      const outcome = fixture.google ?? {
        status: 200,
        redirectTo: "https://project.supabase.co/auth/v1/authorize?provider=google",
      };

      return outcome.status < 400
        ? jsonResponse(outcome.status, {
            ok: true,
            ...(outcome.redirectTo === undefined
              ? {}
              : { redirectTo: outcome.redirectTo }),
          })
        : jsonResponse(outcome.status, {
            ok: false,
            error: { code: outcome.code ?? "google_unavailable" },
          });
    }

    if (url.includes("/api/v1/auth/sign-out")) {
      const outcome = fixture.signOut ?? { status: 204 };

      return outcome.status === 204
        ? new Response(null, { status: 204 })
        : jsonResponse(outcome.status, {
            ok: false,
            error: { code: "sign_out_failed" },
          });
    }

    if (url.endsWith("/api/v1/saved-shops")) {
      const outcome = fixture.savedShops ?? {
        status: 200,
        body: { savedShopIds: [], shops: [] },
      };

      return jsonResponse(outcome.status ?? 200, outcome.body);
    }

    if (url.endsWith("/api/v1/saved-shops/pending")) {
      const sequenced = fixture.pendingSaves?.[
        Math.min(pendingSaveIndex, Math.max(0, fixture.pendingSaves.length - 1))
      ];
      const outcome = sequenced ?? fixture.pendingSave ?? { status: 204 };

      pendingSaveIndex += 1;

      return outcome.status === 204
        ? new Response(null, { status: 204 })
        : jsonResponse(outcome.status ?? 200, outcome.body);
    }

    if (url.includes("/api/v1/saved-shops/")) {
      if (!fixture.savedMutation) {
        throw new Error(`Unexpected saved-shop mutation in a test: ${url}`);
      }

      return jsonResponse(
        fixture.savedMutation.status ?? 200,
        fixture.savedMutation.body,
      );
    }

    throw new Error(`Unexpected fetch in a test: ${url}`);
  });

  vi.stubGlobal("fetch", mock);

  return { requests, mock };
}

/** The provider stack an account-aware component needs, in layout's order. */
export function WithAccount({ children }: { readonly children: ReactNode }) {
  return (
    <ReviewerModeProvider>
      <AccountSessionProvider>
        <SignInProvider>{children}</SignInProvider>
      </AccountSessionProvider>
    </ReviewerModeProvider>
  );
}
