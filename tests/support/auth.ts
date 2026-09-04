import type { Page, Route } from "@playwright/test";

/**
 * Standing in for a session, in a build that has none.
 *
 * The fixture build these journeys run against has no Supabase configuration,
 * so `GET /api/v1/auth/session` answers `auth_unavailable` — which is itself one
 * of the states under test, and the default here. Every other state is arranged
 * by intercepting the application's own route.
 *
 * That is the right seam for a frontend journey. WP2 owns whether the route
 * returns the right thing for a given cookie and proves it in
 * `src/server/auth/http.test.ts`; what these tests are about is what the
 * interface does with each answer — including the two answers a real Supabase
 * project is needed to produce. Nothing here mocks Supabase, invents a token or
 * writes an auth cookie: the fixture is one HTTP response on a first-party
 * route, exactly as the browser would receive it.
 */
export const SESSION_ROUTE = "**/api/v1/auth/session";
export const MAGIC_LINK_ROUTE = "**/api/v1/auth/magic-link";
export const GOOGLE_ROUTE = "**/api/v1/auth/google";
export const SIGN_OUT_ROUTE = "**/api/v1/auth/sign-out";

/** A stable identity for the signed-in journeys and their screenshots. */
export const SESSION_USER_ID = "3f8a1c62-5d4b-4a7e-9b21-0c6f5d8e4a11";
export const SESSION_IDENTITY = "ada@nibatlas.example";

export type SessionStub =
  | { readonly kind: "signed-out" }
  | {
      readonly kind: "signed-in";
      readonly displayName?: string | null;
      readonly identityLabel?: string;
    }
  /** The build has no authentication behind it: the routes say so. */
  | { readonly kind: "not-configured" }
  /** Configured, but the session could not be read just now. */
  | { readonly kind: "unreachable" };

const NO_STORE = { "cache-control": "private, no-store" };

function sessionResponse(stub: SessionStub) {
  if (stub.kind === "signed-out") {
    return { status: 200, body: { status: "signed-out" } };
  }

  if (stub.kind === "signed-in") {
    return {
      status: 200,
      body: {
        status: "signed-in",
        userId: SESSION_USER_ID,
        identityLabel: stub.identityLabel ?? SESSION_IDENTITY,
        displayName: stub.displayName ?? null,
      },
    };
  }

  return {
    status: 503,
    body: {
      ok: false,
      error: {
        code: stub.kind === "not-configured" ? "auth_unavailable" : "session_unavailable",
      },
    },
  };
}

function fulfil(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: NO_STORE,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function stubSession(page: Page, stub: SessionStub) {
  const { status, body } = sessionResponse(stub);

  await page.route(SESSION_ROUTE, (route) => fulfil(route, status, body));
}

/**
 * Swaps the session answer mid-journey.
 *
 * Playwright applies the most recently registered handler first, so re-routing
 * is how a journey moves from signed out to signed in the way a callback does:
 * the same page asks again and gets the other answer.
 */
export const changeSession = stubSession;

export type StartOutcome =
  | { readonly kind: "accepted" }
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "error"; readonly status: number; readonly code: string };

/** Every request body posted to a start route, in order, for assertions. */
export interface RecordedStarts {
  readonly bodies: Record<string, unknown>[];
}

async function stubStart(
  page: Page,
  pattern: string,
  outcome: StartOutcome,
): Promise<RecordedStarts> {
  const bodies: Record<string, unknown>[] = [];

  await page.route(pattern, (route) => {
    const raw = route.request().postData();

    if (raw) {
      try {
        bodies.push(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        bodies.push({ unparsed: raw });
      }
    }

    if (outcome.kind === "error") {
      return fulfil(route, outcome.status, {
        ok: false,
        error: { code: outcome.code },
      });
    }

    if (outcome.kind === "redirect") {
      return fulfil(route, 200, { ok: true, redirectTo: outcome.to });
    }

    return fulfil(route, 202, { ok: true });
  });

  return { bodies };
}

export function stubMagicLink(page: Page, outcome: StartOutcome = { kind: "accepted" }) {
  return stubStart(page, MAGIC_LINK_ROUTE, outcome);
}

export function stubGoogle(page: Page, outcome: StartOutcome) {
  return stubStart(page, GOOGLE_ROUTE, outcome);
}

export async function stubSignOut(
  page: Page,
  outcome: { readonly ok: boolean } = { ok: true },
) {
  await page.route(SIGN_OUT_ROUTE, (route) =>
    outcome.ok
      ? route.fulfill({ status: 204, headers: NO_STORE, body: "" })
      : fulfil(route, 502, { ok: false, error: { code: "sign_out_failed" } }),
  );
}
