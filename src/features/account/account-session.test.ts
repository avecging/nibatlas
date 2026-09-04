import { describe, expect, it } from "vitest";

import {
  accountHeadline,
  normalizeDisplayName,
  parseSessionResponse,
  SIGNED_OUT,
} from "@/src/features/account/account-session";

/**
 * One session response, one state, and no state guessed from another.
 *
 * The property that matters most is the pessimistic one: a response this
 * function does not recognise resolves to `unavailable`, never to signed out.
 * Guessing signed out would show a signed-in reader the anonymous product and
 * invite them to sign in again, which is both wrong and irreversible-looking.
 */
describe("parseSessionResponse", () => {
  it("reads the signed-out answer", () => {
    expect(parseSessionResponse(200, { status: "signed-out" })).toEqual(SIGNED_OUT);
  });

  it("reads a signed-in answer, with and without a display name", () => {
    expect(
      parseSessionResponse(200, {
        status: "signed-in",
        userId: "user-1",
        identityLabel: "ada@example.com",
        displayName: null,
      }),
    ).toEqual({
      status: "signed-in",
      userId: "user-1",
      identityLabel: "ada@example.com",
      displayName: null,
    });

    expect(
      parseSessionResponse(200, {
        status: "signed-in",
        userId: "user-1",
        identityLabel: "ada@example.com",
        displayName: "  Ada  Lovelace ",
      }),
    ).toMatchObject({ displayName: "Ada Lovelace" });
  });

  it("names an unconfigured build, so the interface can stop offering sign-in", () => {
    expect(
      parseSessionResponse(503, { ok: false, error: { code: "auth_unavailable" } }),
    ).toEqual({ status: "unavailable", reason: "not-configured" });
  });

  it("treats every other failure as worth retrying", () => {
    for (const response of [
      [503, { ok: false, error: { code: "session_unavailable" } }],
      [500, { ok: false }],
      [200, { status: "who knows" }],
      [200, null],
      [200, { status: "signed-in" }],
      [200, { status: "signed-in", userId: "" }],
      [200, { status: "signed-in", userId: 7 }],
    ] as const) {
      expect(parseSessionResponse(response[0], response[1])).toEqual({
        status: "unavailable",
        reason: "unreachable",
      });
    }
  });

  it("falls back to a neutral identity label rather than an empty line", () => {
    expect(
      parseSessionResponse(200, {
        status: "signed-in",
        userId: "user-1",
        identityLabel: "   ",
      }),
    ).toMatchObject({ identityLabel: "Signed-in account" });
  });
});

describe("normalizeDisplayName", () => {
  it("collapses whitespace, bounds the length, and treats blank as unset", () => {
    expect(normalizeDisplayName("Ada\n Lovelace")).toBe("Ada Lovelace");
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName(null)).toBeNull();
    expect(normalizeDisplayName(42)).toBeNull();
    expect(normalizeDisplayName("x".repeat(80))).toHaveLength(40);
  });
});

describe("accountHeadline", () => {
  it("addresses the reader by their chosen name, or by the account", () => {
    expect(
      accountHeadline({
        status: "signed-in",
        userId: "user-1",
        identityLabel: "ada@example.com",
        displayName: "Ada",
      }),
    ).toBe("Ada");

    expect(
      accountHeadline({
        status: "signed-in",
        userId: "user-1",
        identityLabel: "ada@example.com",
        displayName: null,
      }),
    ).toBe("ada@example.com");
  });

  /** No state renders as an empty heading, including the two unsettled ones. */
  it("says what is happening in the states that are not an account", () => {
    expect(accountHeadline({ status: "loading" })).toBe("Checking your account");
    expect(accountHeadline(SIGNED_OUT)).toBe("Not signed in");
    expect(
      accountHeadline({ status: "unavailable", reason: "unreachable" }),
    ).toBe("Account unavailable");
  });
});
