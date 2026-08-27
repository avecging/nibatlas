import { describe, expect, it } from "vitest";

import {
  CONTRIBUTE_EMAIL,
  SHOP_CORRECTION_SUBJECT,
  SUGGEST_SHOP_SUBJECT,
  shopCorrectionHref,
  suggestShopHref,
} from "@/src/features/contribute/contribute-links";

describe("suggestShopHref", () => {
  it("addresses the contribution mailbox with the exact subject tag", () => {
    const href = suggestShopHref();

    expect(href).toBe("mailto:hello@nibatlas.com?subject=%5BSuggest%20shop%5D");

    // Asserted decoded as well as encoded: the wire form is percent-encoded, but
    // what has to reach the mailbox is the tag exactly as accepted decision 8
    // writes it.
    const url = new URL(href);

    expect(url.pathname).toBe(CONTRIBUTE_EMAIL);
    expect(url.searchParams.get("subject")).toBe(SUGGEST_SHOP_SUBJECT);
  });

  it("encodes the space as %20 rather than +", () => {
    // `+` is pasted literally into the subject line by several mail clients.
    expect(suggestShopHref()).not.toContain("+");
  });
});

describe("shopCorrectionHref", () => {
  it("carries its own subject tag, and names the shop when there is one", () => {
    expect(new URL(shopCorrectionHref()).searchParams.get("subject")).toBe(
      SHOP_CORRECTION_SUBJECT,
    );
    expect(
      new URL(shopCorrectionHref("Ginza Itoya")).searchParams.get("subject"),
    ).toBe("[Shop correction] Ginza Itoya");
  });
});
