import { describe, expect, it } from "vitest";

import {
  captureReturnTo,
  DEFAULT_AUTH_RETURN_TO,
  isAllowedReturnTo,
  pendingIntentFromParams,
} from "@/src/features/auth/return-to";
import { EXPLORE_CONTEXT_STORAGE_KEY } from "@/src/features/explore/explore-context";

const SHOP_ID = "9f1b6c3a-2d4e-4f8a-9c1b-5e7d2a3f4b60";

/**
 * The interruption's use of WP2's validators.
 *
 * These tests are not a second copy of the allowlist — `continuation.test.ts`
 * owns that. They cover what this module adds: capturing a location as a return
 * path, answering yes or no rather than by substitution, and reading an intent
 * out of a route's query.
 */
describe("captureReturnTo", () => {
  it("keeps the query and fragment, because that is the context", () => {
    expect(
      captureReturnTo({
        pathname: "/",
        search: "?shop=ginza-itoya-main-store",
        hash: "",
      }),
    ).toBe("/?shop=ginza-itoya-main-store");

    expect(captureReturnTo({ pathname: "/me", search: "", hash: "#me-account" })).toBe(
      "/me#me-account",
    );
  });

  /*
   * A reader who signs in from a page that is showing a previous callback's
   * result must not carry that result into the next return path, or the banner
   * announces a sign-in that did not just happen.
   */
  it("drops the callback's own parameters", () => {
    expect(
      captureReturnTo({
        pathname: "/shops/ty-lee-pen-shop",
        search: "?auth=success&from=map&authError=expired_link",
        hash: "",
      }),
    ).toBe("/shops/ty-lee-pen-shop?from=map");
  });

  it("falls back for a path outside the application", () => {
    expect(captureReturnTo({ pathname: "/admin", search: "", hash: "" })).toBe(
      DEFAULT_AUTH_RETURN_TO,
    );
  });
});

describe("currentReturnTo", () => {
  it("carries committed map filters and viewport into an auth return", async () => {
    const { currentReturnTo } = await import("@/src/features/auth/return-to");
    window.history.replaceState({}, "", "/shops/ty-lee-pen-shop?from=map");
    window.sessionStorage.setItem(
      EXPLORE_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        viewport: { bounds: { west: 120, south: 24, east: 122, north: 26 }, zoom: 9 },
        label: "Taipei",
        filters: { status: "saved", shopTypes: ["stationery_store"], availability: "open" },
      }),
    );

    const result = new URL(currentReturnTo(), "https://test.invalid");
    expect(result.pathname).toBe("/shops/ty-lee-pen-shop");
    expect(result.searchParams.get("from")).toBe("map");
    expect(result.searchParams.get("mapContext")).toContain('"status":"saved"');

    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
  });
});

describe("isAllowedReturnTo", () => {
  it("accepts application paths and refuses everything else", () => {
    expect(isAllowedReturnTo("/me#me-account")).toBe(true);
    expect(isAllowedReturnTo("/shops/ty-lee-pen-shop?from=map")).toBe(true);

    expect(isAllowedReturnTo("https://elsewhere.example/")).toBe(false);
    expect(isAllowedReturnTo("//elsewhere.example/")).toBe(false);
    expect(isAllowedReturnTo("/admin")).toBe(false);
    expect(isAllowedReturnTo("")).toBe(false);
    expect(isAllowedReturnTo(null)).toBe(false);
    // Allowed path, but not in the form the server would keep.
    expect(isAllowedReturnTo("/me?auth=success")).toBe(false);
  });
});

describe("pendingIntentFromParams", () => {
  it("reads a save intent, and refuses one that is not a shop id", () => {
    expect(
      pendingIntentFromParams(
        new URLSearchParams({ intent: "save-shop", shopId: SHOP_ID }),
      ),
    ).toEqual({ type: "save-shop", shopId: SHOP_ID });

    expect(
      pendingIntentFromParams(
        new URLSearchParams({ intent: "save-shop", shopId: "not-a-uuid" }),
      ),
    ).toBeNull();
  });

  it("reads a collect intent by shop slug", () => {
    expect(
      pendingIntentFromParams(
        new URLSearchParams({ intent: "collect-shop", shopSlug: "ty-lee-pen-shop" }),
      ),
    ).toEqual({ type: "collect-shop", shopSlug: "ty-lee-pen-shop" });
  });

  it("has no intent when the query does not carry one", () => {
    expect(pendingIntentFromParams(new URLSearchParams())).toBeNull();
    expect(
      pendingIntentFromParams(new URLSearchParams({ intent: "delete-everything" })),
    ).toBeNull();
  });
});
