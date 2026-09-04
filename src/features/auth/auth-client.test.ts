import { afterEach, describe, expect, it, vi } from "vitest";

import {
  endSession,
  fetchAccountSession,
  requestMagicLink,
  startGoogleSignIn,
} from "@/src/features/auth/auth-client";
import { installAuthFetch } from "@/src/test/auth";

const START = { returnTo: "/me#me-account", intent: null } as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The only route the browser has to a session, and what it does with each
 * answer.
 *
 * Two properties are asserted rather than assumed. Every failure resolves to a
 * code the interface has copy for — nothing throws out of these functions, so
 * no surface has to guard a call — and the magic-link route has exactly one
 * success outcome, because the route deliberately answers the same way whether
 * or not the address already had an account.
 */
describe("fetchAccountSession", () => {
  it("asks the first-party route, uncached, with the session cookie", async () => {
    const { requests } = installAuthFetch({ session: { kind: "signed-out" } });

    await expect(fetchAccountSession()).resolves.toEqual({ status: "signed-out" });
    expect(requests[0]?.url).toBe("/api/v1/auth/session");
  });

  it("reports an unreachable route as a state, not an exception", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    await expect(fetchAccountSession()).resolves.toEqual({
      status: "unavailable",
      reason: "unreachable",
    });
  });
});

describe("requestMagicLink", () => {
  it("posts the address with the return path and intent", async () => {
    const { requests } = installAuthFetch();
    const intent = { type: "collect-shop", shopSlug: "ty-lee-pen-shop" } as const;

    await expect(
      requestMagicLink("ada@example.com", { returnTo: "/shops/ty-lee-pen-shop", intent }),
    ).resolves.toEqual({ ok: true });

    expect(requests.at(-1)).toMatchObject({
      url: "/api/v1/auth/magic-link",
      method: "POST",
      body: {
        email: "ada@example.com",
        returnTo: "/shops/ty-lee-pen-shop",
        intent,
      },
    });
  });

  it("translates each refusal into a code the interface has copy for", async () => {
    for (const [fixture, code] of [
      [{ status: 400, code: "invalid_email" }, "invalid_email"],
      [{ status: 429, code: "magic_link_unavailable" }, "rate_limited"],
      [{ status: 502, code: "magic_link_unavailable" }, "unavailable"],
      [{ status: 503, code: "auth_unavailable" }, "not_configured"],
      [{ status: 403, code: "untrusted_origin" }, "rejected"],
    ] as const) {
      installAuthFetch({ magicLink: fixture });

      await expect(requestMagicLink("ada@example.com", START)).resolves.toEqual({
        ok: false,
        code,
      });
    }
  });

  it("reports a network failure without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    await expect(requestMagicLink("ada@example.com", START)).resolves.toEqual({
      ok: false,
      code: "network",
    });
  });
});

describe("startGoogleSignIn", () => {
  it("returns the provider URL for the browser to navigate to", async () => {
    installAuthFetch({
      google: {
        status: 200,
        redirectTo: "https://project.supabase.co/auth/v1/authorize?provider=google",
      },
    });

    await expect(startGoogleSignIn(START)).resolves.toEqual({
      ok: true,
      redirectTo: "https://project.supabase.co/auth/v1/authorize?provider=google",
    });
  });

  /*
   * The route has already checked the URL against the configured Supabase
   * origin. This is the browser's own guard: anything that is not an absolute
   * http(s) URL is not handed to `location`, so a malformed answer cannot become
   * a navigation to a scheme of someone else's choosing.
   */
  it("refuses an answer that is not an absolute http URL", async () => {
    for (const redirectTo of ["javascript:alert(1)", "/relative", ""]) {
      installAuthFetch({ google: { status: 200, redirectTo } });

      await expect(startGoogleSignIn(START)).resolves.toEqual({
        ok: false,
        code: "unavailable",
      });
    }

    installAuthFetch({ google: { status: 200 } });
    await expect(startGoogleSignIn(START)).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
  });

  it("translates a provider failure", async () => {
    installAuthFetch({ google: { status: 502, code: "google_unavailable" } });

    await expect(startGoogleSignIn(START)).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});

describe("endSession", () => {
  it("posts to the sign-out route and reports success", async () => {
    const { requests } = installAuthFetch();

    await expect(endSession()).resolves.toEqual({ ok: true });
    expect(requests.at(-1)).toMatchObject({
      url: "/api/v1/auth/sign-out",
      method: "POST",
    });
  });

  it("reports a failed sign-out rather than assuming it worked", async () => {
    installAuthFetch({ signOut: { status: 502 } });

    await expect(endSession()).resolves.toEqual({ ok: false, code: "unavailable" });
  });
});
