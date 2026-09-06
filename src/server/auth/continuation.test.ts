import { describe, expect, it, vi } from "vitest";

import {
  AUTH_FLOW_COOKIE,
  DEFAULT_AUTH_RETURN_TO,
  PENDING_INTENT_COOKIE,
  appendAuthResult,
  clearPendingIntent,
  finishAuthContinuation,
  normalizeReturnTo,
  parsePendingIntent,
  readAuthContinuation,
  readPendingIntent,
  writeAuthContinuation,
  type AuthCookieStore,
} from "@/src/server/auth/continuation";

function memoryCookies() {
  const values = new Map<string, string>();
  const set = vi.fn<AuthCookieStore["set"]>((name, value) => {
    values.set(name, value);
  });
  const remove = vi.fn<AuthCookieStore["delete"]>((name) => {
    values.delete(name);
  });
  const store: AuthCookieStore = {
    get: (name) => {
      const value = values.get(name);
      return value === undefined ? undefined : { value };
    },
    set,
    delete: remove,
  };

  return { values, set, remove, store };
}

describe("normalizeReturnTo", () => {
  it("preserves an approved in-app destination, query and fragment", () => {
    expect(
      normalizeReturnTo(
        "/shops/ito-ya?west=139.1&shopType=stationery#practical",
      ),
    ).toBe("/shops/ito-ya?west=139.1&shopType=stationery#practical");
  });

  it.each([
    "https://attacker.example/shops/a",
    "//attacker.example/shops/a",
    "/\\attacker.example/shops/a",
    "/api/v1/auth/session",
    "/auth/callback",
    "shops/no-leading-slash",
  ])("rejects an unsafe destination: %s", (value) => {
    expect(normalizeReturnTo(value)).toBe(DEFAULT_AUTH_RETURN_TO);
  });

  it("removes callback result keys supplied by the caller", () => {
    expect(normalizeReturnTo("/saved?auth=fake&authError=fake&q=ink")).toBe(
      "/saved?q=ink",
    );
  });
});

describe("pending auth intents", () => {
  it("accepts only the two bounded, canonical intent shapes", () => {
    expect(
      parsePendingIntent({
        type: "save-shop",
        shopId: "00000000-0000-4000-8000-000000000301",
      }),
    ).toEqual({
      type: "save-shop",
      shopId: "00000000-0000-4000-8000-000000000301",
    });
    expect(
      parsePendingIntent({ type: "collect-shop", shopSlug: "ito-ya-ginza" }),
    ).toEqual({ type: "collect-shop", shopSlug: "ito-ya-ginza" });
    expect(
      parsePendingIntent({
        type: "save-shop",
        shopId: "not-a-uuid",
        extra: true,
      }),
    ).toBeNull();
  });

  it("round-trips a fresh continuation and rejects it after expiry", () => {
    const { store } = memoryCookies();
    const issuedAt = Date.UTC(2026, 8, 4, 8);

    writeAuthContinuation(
      store,
      {
        returnTo: "/shops/ito-ya",
        intent: {
          type: "save-shop",
          shopId: "00000000-0000-4000-8000-000000000301",
        },
      },
      issuedAt,
    );

    expect(readAuthContinuation(store, issuedAt + 1_000)).toMatchObject({
      returnTo: "/shops/ito-ya",
      intent: { type: "save-shop" },
    });
    expect(readAuthContinuation(store, issuedAt + 3_601_000)).toBeNull();
  });

  it("promotes a successful intent once and clears the flow cookie", () => {
    const { store, values, remove, set } = memoryCookies();

    writeAuthContinuation(
      store,
      {
        returnTo: "/saved",
        intent: { type: "collect-shop", shopSlug: "ito-ya" },
      },
      100_000,
    );
    const result = finishAuthContinuation(store, 101_000);

    expect(result?.intent).toEqual({
      type: "collect-shop",
      shopSlug: "ito-ya",
    });
    expect(values.has(AUTH_FLOW_COOKIE)).toBe(false);
    expect(values.has(PENDING_INTENT_COOKIE)).toBe(true);
    expect(remove).toHaveBeenCalledWith(AUTH_FLOW_COOKIE);
    expect(set).toHaveBeenCalledWith(
      PENDING_INTENT_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 600 }),
    );
    expect(readPendingIntent(store, 101_001)).toEqual({
      type: "collect-shop",
      shopSlug: "ito-ya",
    });
    expect(readPendingIntent(store, 701_001)).toBeNull();

    clearPendingIntent(store);
    expect(values.has(PENDING_INTENT_COOKIE)).toBe(false);
  });
});

describe("appendAuthResult", () => {
  it("places the result before a fragment without losing existing state", () => {
    expect(appendAuthResult("/me?tab=data#me-account", { auth: "success" })).toBe(
      "/me?tab=data&auth=success#me-account",
    );
  });
});
