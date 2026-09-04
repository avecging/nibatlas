import { describe, expect, it } from "vitest";

import {
  PASSPORT_ANCHOR_PARAM,
  mapReturnHref,
  passportHrefWithAnchor,
  passportReturnHref,
} from "@/src/components/shops/ShopBackLink";
import { decodeExploreContext, type ExploreContext } from "@/src/features/explore/explore-context";

/**
 * Where `?from=passport` sends the reader back to.
 *
 * The parameter arrives in a URL, so it is attacker-supplied in the same sense
 * every query parameter is. Two properties matter: a Passport route survives
 * intact, including the page anchor a locality's continuation pages need, and
 * anything else resolves to the Passport root rather than off the application.
 */
describe("passportReturnHref", () => {
  it("returns the Passport root when there is nothing to narrow", () => {
    expect(passportReturnHref(null)).toBe("/passport");
    expect(passportReturnHref(undefined)).toBe("/passport");
    expect(passportReturnHref("")).toBe("/passport");
  });

  it("keeps a Passport route", () => {
    expect(passportReturnHref("/passport")).toBe("/passport");
    expect(passportReturnHref("/passport/jp")).toBe("/passport/jp");
    expect(passportReturnHref("/passport/jp/chuo-tokyo")).toBe(
      "/passport/jp/chuo-tokyo",
    );
  });

  it("keeps the page anchor, and only the page anchor", () => {
    expect(passportReturnHref("/passport/jp/chuo-tokyo?stamp=paged-4")).toBe(
      "/passport/jp/chuo-tokyo?stamp=paged-4",
    );

    // Nothing else from the incoming URL is echoed into the link.
    expect(
      passportReturnHref("/passport/jp?stamp=paged-4&review=1&next=%2Fevil"),
    ).toBe("/passport/jp?stamp=paged-4");
    expect(passportReturnHref("/passport/jp?review=1")).toBe("/passport/jp");
  });

  it("re-encodes the anchor rather than passing it through", () => {
    expect(passportReturnHref("/passport?stamp=a%20b%26c")).toBe(
      `/passport?${PASSPORT_ANCHOR_PARAM}=a%20b%26c`,
    );
  });

  it("refuses anything that would leave the application", () => {
    for (const hostile of [
      "https://example.com",
      "http://example.com/passport",
      "//example.com/passport",
      "//example.com",
      "javascript:alert(1)",
      "/passportfoo",
      "/passport-other/jp",
      "/me",
      "/",
      "/shops/ginza-itoya-main-store",
    ]) {
      expect(passportReturnHref(hostile)).toBe("/passport");
    }
  });

  it("normalises a relative path, which can only land inside the Passport", () => {
    // Nothing this application writes is relative, but resolving it against the
    // site root is the safe reading rather than a rejection.
    expect(passportReturnHref("passport/jp")).toBe("/passport/jp");
    expect(passportReturnHref("me")).toBe("/passport");
  });

  it("refuses a traversal that escapes the Passport", () => {
    // `URL` normalises these before the prefix check sees them.
    expect(passportReturnHref("/passport/../me")).toBe("/passport");
    expect(passportReturnHref("/passport/jp/../../shops/x")).toBe("/passport");
  });

  it("keeps a traversal that stays inside the Passport", () => {
    expect(passportReturnHref("/passport/jp/../tw/daan-taipei")).toBe(
      "/passport/tw/daan-taipei",
    );
  });
});

describe("passportHrefWithAnchor", () => {
  it("appends the anchor when there is one", () => {
    expect(passportHrefWithAnchor("/passport/jp/chuo-tokyo", "paged-4")).toBe(
      "/passport/jp/chuo-tokyo?stamp=paged-4",
    );
  });

  it("leaves the route alone when there is not", () => {
    expect(passportHrefWithAnchor("/passport", null)).toBe("/passport");
    expect(passportHrefWithAnchor("/passport", undefined)).toBe("/passport");
    expect(passportHrefWithAnchor("/passport", "")).toBe("/passport");
  });

  it("encodes an anchor that needs it", () => {
    expect(passportHrefWithAnchor("/passport", "a b&c")).toBe(
      "/passport?stamp=a%20b%26c",
    );
    // And what it writes, `passportReturnHref` reads back unchanged.
    expect(passportReturnHref(passportHrefWithAnchor("/passport", "a b&c"))).toBe(
      "/passport?stamp=a%20b%26c",
    );
  });
});

describe("mapReturnHref", () => {
  const context: ExploreContext = {
    viewport: { bounds: { west: 120, south: 24, east: 122, north: 26 }, zoom: 9 },
    label: "Taipei",
    filters: { status: "saved", shopTypes: ["stationery_store"], availability: "open" },
  };

  it("keeps a validated cross-tab map context with the selected shop", () => {
    const href = mapReturnHref("ty-lee-pen-shop", JSON.stringify(context));
    const url = new URL(href, "https://test.invalid");

    expect(url.searchParams.get("shop")).toBe("ty-lee-pen-shop");
    expect(decodeExploreContext(url.searchParams.get("mapContext"))).toEqual(context);
  });

  it("drops invalid context instead of reflecting it", () => {
    expect(mapReturnHref("ty-lee-pen-shop", "not-json")).toBe(
      "/?shop=ty-lee-pen-shop",
    );
  });
});
