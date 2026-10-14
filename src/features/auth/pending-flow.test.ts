import { afterEach, describe, expect, it } from "vitest";

import {
  forgetPendingFlow,
  PENDING_FLOW_STORAGE_KEY,
  readPendingFlow,
  rememberPendingFlow,
} from "@/src/features/auth/pending-flow";

const SHOP_ID = "9f1b6c3a-2d4e-4f8a-9c1b-5e7d2a3f4b60";
const SAVE = { type: "save-shop", shopId: SHOP_ID } as const;

afterEach(() => {
  window.sessionStorage.clear();
});

/**
 * What a retry picks up.
 *
 * The record exists because a failed callback clears the server's continuation
 * and comes back through a full navigation, so nothing in memory survives to
 * tell **Try again** what it was interrupting. It authorises nothing — the
 * server validates the request it re-fills — so what matters here is that it
 * cannot carry anything the server would refuse, and cannot carry it for long.
 */
describe("the remembered flow", () => {
  it("comes back as it was written", () => {
    rememberPendingFlow({ returnTo: "/shops/ty-lee-pen-shop", intent: SAVE });

    expect(readPendingFlow()).toEqual({
      returnTo: "/shops/ty-lee-pen-shop",
      intent: SAVE,
    });
  });

  it("holds a plain sign-in with no intent", () => {
    rememberPendingFlow({ returnTo: "/me#me-account", intent: null });

    expect(readPendingFlow()).toEqual({ returnTo: "/me#me-account", intent: null });
  });

  it("is forgotten on request", () => {
    rememberPendingFlow({ returnTo: "/me#me-account", intent: null });
    forgetPendingFlow();

    expect(readPendingFlow()).toBeNull();
  });

  /* One hour, matching the server's own flow window: a retry must not attach an
     intent from a sign-in the reader has long since forgotten. */
  it("expires after an hour", () => {
    const started = Date.parse("2026-09-04T12:00:00Z");

    rememberPendingFlow({ returnTo: "/shops/ty-lee-pen-shop", intent: SAVE }, started);

    expect(readPendingFlow(started + 59 * 60_000)).not.toBeNull();
    expect(readPendingFlow(started + 61 * 60_000)).toBeNull();
    // A record from the future is not a record.
    expect(readPendingFlow(started - 5 * 60_000)).toBeNull();
  });

  it("refuses anything the server's own validators would rewrite or reject", () => {
    for (const entry of [
      "not json",
      JSON.stringify({ returnTo: "/me", intent: null }),
      JSON.stringify({ returnTo: "https://elsewhere.example/", intent: null, startedAt: Date.now() }),
      JSON.stringify({ returnTo: "/admin", intent: null, startedAt: Date.now() }),
      JSON.stringify({ returnTo: "/me?auth=success", intent: null, startedAt: Date.now() }),
      JSON.stringify({ returnTo: "/me", intent: { type: "save-shop", shopId: "nope" }, startedAt: Date.now() }),
      JSON.stringify({ returnTo: "/me", intent: { type: "delete-everything" }, startedAt: Date.now() }),
      JSON.stringify([1, 2, 3]),
    ]) {
      window.sessionStorage.setItem(PENDING_FLOW_STORAGE_KEY, entry);

      expect(readPendingFlow()).toBeNull();
    }
  });

  it("has nothing to say on a device that has started no flow", () => {
    expect(readPendingFlow()).toBeNull();
  });
});
