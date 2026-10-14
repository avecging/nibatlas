import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_FLOW_COOKIE,
  PENDING_INTENT_COOKIE,
  type AuthCookieStore,
} from "@/src/server/auth/continuation";
import {
  deleteAccount,
  finishMagicLink,
  finishOAuthCallback,
  readSession,
  signOut,
  startGoogle,
  startMagicLink,
  updateDisplayName,
  type AuthGateway,
  type AuthRouteDependencies,
} from "@/src/server/auth/http";

function memoryCookies() {
  const values = new Map<string, string>();
  const store: AuthCookieStore = {
    get: (name) => {
      const value = values.get(name);
      return value === undefined ? undefined : { value };
    },
    set: (name, value) => {
      values.set(name, value);
    },
    delete: (name) => {
      values.delete(name);
    },
  };

  return { store, values };
}

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signInWithOtp: vi.fn(async () => ({ error: null })),
    signInWithOAuth: vi.fn(async () => ({
      data: {
        url: "https://project.supabase.co/auth/v1/authorize?provider=google",
      },
      error: null,
    })),
    exchangeCodeForSession: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    getDeletionSession: vi.fn(async () => ({ data: null, error: null })),
    deleteUser: vi.fn(async () => ({ error: null })),
    getClaims: vi.fn(async () => ({ data: null, error: null })),
    getProfile: vi.fn(async () => ({ data: null, error: null })),
    updateProfile: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  };
}

function dependencies(auth = gateway()): AuthRouteDependencies & {
  readonly values: Map<string, string>;
} {
  const { store, values } = memoryCookies();

  return {
    auth,
    cookies: store,
    supabaseOrigin: "https://project.supabase.co",
    now: () => 100_000,
    values,
  };
}

function post(path: string, body: unknown, origin = "https://nibatlas.test") {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

function removeAccount(
  body: unknown = { confirmation: "delete-account" },
  origin = "https://nibatlas.test",
) {
  return new Request(`${origin}/api/v1/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("magic-link initiation", () => {
  it("sends a magic link without revealing whether the account existed", async () => {
    const auth = gateway();
    const deps = dependencies(auth);
    const response = await startMagicLink(
      post("/api/v1/auth/magic-link", {
        email: "gin@example.com",
        returnTo: "/shops/ito-ya?west=139",
        intent: {
          type: "save-shop",
          shopId: "00000000-0000-4000-8000-000000000301",
        },
      }),
      deps,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "gin@example.com",
      options: {
        emailRedirectTo: "https://nibatlas.test",
        shouldCreateUser: true,
      },
    });
    expect(deps.values.has(AUTH_FLOW_COOKIE)).toBe(true);
  });

  it("refuses malformed email and cross-origin posts before calling Supabase", async () => {
    const auth = gateway();
    const deps = dependencies(auth);
    const invalidEmail = await startMagicLink(
      post("/api/v1/auth/magic-link", { email: "not-email" }),
      deps,
    );
    const crossOrigin = new Request(
      "https://nibatlas.test/api/v1/auth/magic-link",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
        },
        body: JSON.stringify({ email: "gin@example.com" }),
      },
    );

    expect(invalidEmail.status).toBe(400);
    expect((await startMagicLink(crossOrigin, deps)).status).toBe(403);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("stops reading an undeclared oversized body before calling Supabase", async () => {
    const auth = gateway();
    const request = new Request(
      "https://nibatlas.test/api/v1/auth/magic-link",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://nibatlas.test",
        },
        body: JSON.stringify({ email: `${"a".repeat(4_096)}@example.com` }),
      },
    );

    expect(request.headers.get("Content-Length")).toBeNull();
    expect((await startMagicLink(request, dependencies(auth))).status).toBe(400);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
});

describe("Google initiation", () => {
  it("starts only Google PKCE and returns a URL for top-level navigation", async () => {
    const auth = gateway();
    const deps = dependencies(auth);
    const response = await startGoogle(
      post("/api/v1/auth/google", { returnTo: "/saved" }),
      deps,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      redirectTo:
        "https://project.supabase.co/auth/v1/authorize?provider=google",
    });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://nibatlas.test/auth/callback",
        skipBrowserRedirect: true,
      },
    });
  });

  it("does not redirect to a malformed provider response", async () => {
    const deps = dependencies(
      gateway({
        signInWithOAuth: vi.fn(async () => ({
          data: { url: "javascript:alert(1)" },
          error: null,
        })),
      }),
    );

    expect(
      (await startGoogle(post("/api/v1/auth/google", {}), deps)).status,
    ).toBe(502);
  });

  it("rejects an undeclared oversized body before starting OAuth", async () => {
    const auth = gateway();
    const request = new Request("https://nibatlas.test/api/v1/auth/google", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://nibatlas.test",
      },
      body: JSON.stringify({ returnTo: `/saved?${"x".repeat(4_096)}` }),
    });

    expect(request.headers.get("Content-Length")).toBeNull();
    expect((await startGoogle(request, dependencies(auth))).status).toBe(400);
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });
});

describe("authentication callbacks", () => {
  it("exchanges an OAuth code, strips it and preserves the chosen destination", async () => {
    const auth = gateway();
    const deps = dependencies(auth);

    await startGoogle(
      post("/api/v1/auth/google", {
        returnTo: "/shops/ito-ya?west=139#practical",
        intent: { type: "collect-shop", shopSlug: "ito-ya" },
      }),
      deps,
    );
    const response = await finishOAuthCallback(
      new Request("https://nibatlas.test/auth/callback?code=secret-code"),
      deps,
    );
    const location = response.headers.get("Location") ?? "";

    expect(response.status).toBe(303);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("secret-code");
    expect(location).toBe(
      "https://nibatlas.test/shops/ito-ya?west=139&auth=success#practical",
    );
    expect(location).not.toContain("secret-code");
    expect(deps.values.has(AUTH_FLOW_COOKIE)).toBe(false);
    expect(deps.values.has(PENDING_INTENT_COOKIE)).toBe(true);
  });

  it("maps provider denial without relaying provider detail", async () => {
    const deps = dependencies();
    const response = await finishOAuthCallback(
      new Request(
        "https://nibatlas.test/auth/callback?error=access_denied&error_description=private+provider+detail",
      ),
      deps,
    );
    const location = response.headers.get("Location") ?? "";

    expect(location).toContain("authError=provider_denied");
    expect(location).not.toContain("private");
  });

  it("verifies magic-link token hashes and reports expiry with a stable code", async () => {
    const auth = gateway({
      verifyOtp: vi.fn(async () => ({
        error: { code: "otp_expired", status: 403 },
      })),
    });
    const response = await finishMagicLink(
      new Request(
        "https://nibatlas.test/auth/confirm?token_hash=secret-hash&type=email",
      ),
      dependencies(auth),
    );
    const location = response.headers.get("Location") ?? "";

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "secret-hash",
      type: "email",
    });
    expect(location).toContain("authError=expired_link");
    expect(location).not.toContain("secret-hash");
  });

  it("rejects unknown magic-link types before verification", async () => {
    const auth = gateway();
    const response = await finishMagicLink(
      new Request(
        "https://nibatlas.test/auth/confirm?token_hash=secret&type=recovery",
      ),
      dependencies(auth),
    );

    expect(response.headers.get("Location")).toContain(
      "authError=invalid_callback",
    );
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});

describe("display name update", () => {
  const userId = "00000000-0000-4000-8000-000000000101";

  it("normalizes and persists the authenticated account's own display name", async () => {
    const updateProfile = vi.fn(async (_userId: string, displayName: string | null) => ({
      data: { display_name: displayName },
      error: null,
    }));
    const auth = gateway({
      getClaims: vi.fn(async () => ({
        data: { claims: { sub: userId } },
        error: null,
      })),
      updateProfile,
    });
    const response = await updateDisplayName(
      post("/api/v1/account/profile", { displayName: "  Ada\nLovelace  " }),
      dependencies(auth),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      displayName: "Ada Lovelace",
    });
    expect(updateProfile).toHaveBeenCalledWith(userId, "Ada Lovelace");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("accepts an empty value as clearing the optional name", async () => {
    const updateProfile = vi.fn(async () => ({
      data: { display_name: null },
      error: null,
    }));
    const response = await updateDisplayName(
      post("/api/v1/account/profile", { displayName: "   " }),
      dependencies(
        gateway({
          getClaims: vi.fn(async () => ({
            data: { claims: { sub: userId } },
            error: null,
          })),
          updateProfile,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith(userId, null);
  });

  it("rejects invalid, unauthenticated, and cross-origin writes before persistence", async () => {
    const updateProfile = vi.fn(async () => ({
      data: { display_name: "should not save" },
      error: null,
    }));
    const signedOut = gateway({ updateProfile });
    const tooLong = gateway({
      getClaims: vi.fn(async () => ({
        data: { claims: { sub: userId } },
        error: null,
      })),
      updateProfile,
    });

    expect(
      (
        await updateDisplayName(
          post("/api/v1/account/profile", { displayName: "x".repeat(41) }),
          dependencies(tooLong),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await updateDisplayName(
          post("/api/v1/account/profile", { displayName: "Ada" }),
          dependencies(signedOut),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await updateDisplayName(
          new Request("https://nibatlas.test/api/v1/account/profile", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Origin: "https://attacker.example",
            },
            body: JSON.stringify({ displayName: "Ada" }),
          }),
          dependencies(tooLong),
        )
      ).status,
    ).toBe(403);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe("session and logout", () => {
  it("returns only verified identity and private profile presentation data", async () => {
    const auth = gateway({
      getClaims: vi.fn(async () => ({
        data: {
          claims: {
            sub: "00000000-0000-4000-8000-000000000101",
            email: "gin@example.com",
            access_token: "must-not-leak",
          },
        },
        error: null,
      })),
      getProfile: vi.fn(async () => ({
        data: { display_name: "Gin" },
        error: null,
      })),
    });
    const response = await readSession(
      new Request("https://nibatlas.test/api/v1/auth/session"),
      dependencies(auth),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(body).toEqual({
      status: "signed-in",
      userId: "00000000-0000-4000-8000-000000000101",
      identityLabel: "gin@example.com",
      displayName: "Gin",
    });
    expect(JSON.stringify(body)).not.toContain("must-not-leak");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("ends only the current device session and clears pending auth state", async () => {
    const auth = gateway();
    const deps = dependencies(auth);
    deps.cookies.set(PENDING_INTENT_COOKIE, "pending", {});
    const response = await signOut(
      post("/api/v1/auth/sign-out", {}),
      deps,
    );

    expect(response.status).toBe(204);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(deps.values.has(PENDING_INTENT_COOKIE)).toBe(false);
  });
});

describe("account deletion", () => {
  const userId = "00000000-0000-4000-8000-000000000101";

  it("validates the live user, revokes every session, then deletes that identity", async () => {
    const getUser = vi.fn(async () => ({
      data: { user: { id: userId } },
      error: null,
    }));
    const signOut = vi.fn(async () => ({ error: null }));
    const deleteUser = vi.fn(async () => ({ error: null }));
    const getDeletionSession = vi.fn(async () => ({
      data: { userId },
      error: null,
    }));
    const response = await deleteAccount(
      removeAccount(),
      dependencies(gateway({ getUser, getDeletionSession, signOut, deleteUser })),
    );

    expect(response.status).toBe(204);
    expect(getUser).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(deleteUser).toHaveBeenCalledWith(userId);
    expect(getUser.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0]!,
    );
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(
      deleteUser.mock.invocationCallOrder[0]!,
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("does not reach the privileged deletion boundary for a revoked session", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const deleteUser = vi.fn(async () => ({ error: null }));
    const response = await deleteAccount(
      removeAccount(),
      dependencies(
        gateway({
          getUser: vi.fn(async () => ({
            data: { user: { id: userId } },
            error: null,
          })),
          getDeletionSession: vi.fn(async () => ({
            data: null,
            error: { code: "28000", status: 400 },
          })),
          signOut,
          deleteUser,
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(signOut).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("reports session-check infrastructure failures without claiming sign-out", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const deleteUser = vi.fn(async () => ({ error: null }));
    const response = await deleteAccount(
      removeAccount(),
      dependencies(
        gateway({
          getUser: vi.fn(async () => ({
            data: { user: { id: userId } },
            error: null,
          })),
          getDeletionSession: vi.fn(async () => ({
            data: null,
            error: { code: "PGRST002", status: 503 },
          })),
          signOut,
          deleteUser,
        }),
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "session_unavailable" },
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("requires the explicit confirmation body and same-origin request", async () => {
    const getUser = vi.fn(async () => ({
      data: { user: { id: userId } },
      error: null,
    }));
    const auth = gateway({ getUser });

    expect(
      (await deleteAccount(removeAccount({}), dependencies(auth))).status,
    ).toBe(400);
    expect(
      (
        await deleteAccount(
          new Request("https://nibatlas.test/api/v1/account", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Origin: "https://attacker.example",
            },
            body: JSON.stringify({ confirmation: "delete-account" }),
          }),
          dependencies(auth),
        )
      ).status,
    ).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("never deletes the identity when global session revocation fails", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const response = await deleteAccount(
      removeAccount(),
      dependencies(
        gateway({
          getUser: vi.fn(async () => ({
            data: { user: { id: userId } },
            error: null,
          })),
          getDeletionSession: vi.fn(async () => ({
            data: { userId },
            error: null,
          })),
          signOut: vi.fn(async () => ({
            error: { code: "service_unavailable", status: 503 },
          })),
          deleteUser,
        }),
      ),
    );

    expect(response.status).toBe(503);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("requires a fresh sign-in when identity deletion fails after revocation", async () => {
    const response = await deleteAccount(
      removeAccount(),
      dependencies(
        gateway({
          getUser: vi.fn(async () => ({
            data: { user: { id: userId } },
            error: null,
          })),
          getDeletionSession: vi.fn(async () => ({
            data: { userId },
            error: null,
          })),
          signOut: vi.fn(async () => ({ error: null })),
          deleteUser: vi.fn(async () => ({
            error: { code: "service_unavailable", status: 503 },
          })),
        }),
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "account_deletion_requires_sign_in" },
    });
  });
});
