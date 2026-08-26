import { describe, expect, it } from "vitest";

import { shopMetaDescription } from "@/src/components/shops/shop-metadata";
import { findPrototypeShop, prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";

describe("shop meta description", () => {
  it("prefers the record's own sourced description", () => {
    const shop = findPrototypeShop("ginza-itoya-main-store")!;

    expect(shopMetaDescription(shop)).toBe(shop.shortDescription);
  });

  it("never promises a field the record omits", () => {
    // The defect this replaces: a fixed fallback advertised "Address, hours, and
    // what you can do there" on every page, including records that have none.
    //
    // Records carrying their own `shortDescription` are exempt from the keyword
    // checks: that copy is sourced prose about the shop, and SKB's legitimately
    // uses the word "address" to say a shop address is *not* published. The
    // generated fallback is what must not over-promise.
    for (const shop of prototypeShopDetails.filter((shop) => !shop.shortDescription)) {
      const description = shopMetaDescription(shop);
      const hasAddress = (shop.addressLines?.length ?? 0) > 0;
      const hasHours = (shop.openingHours?.length ?? 0) > 0;
      const hasBrands = (shop.brands?.length ?? 0) > 0;

      if (!hasAddress) {
        expect(description.toLowerCase(), shop.slug).not.toContain("address");
      }

      if (!hasHours) {
        expect(description.toLowerCase(), shop.slug).not.toContain("hour");
      }

      if (!hasBrands) {
        expect(description.toLowerCase(), shop.slug).not.toContain("brand");
      }

      // Nothing in the catalogue carries structured services yet, so no preview
      // may offer them.
      expect(description.toLowerCase(), shop.slug).not.toContain("service");
    }
  });

  it("says nothing about facts for a record that carries none", () => {
    // NAGASAWA PenStyle DEN has no address, no hours and no brand list.
    const shop = findPrototypeShop("nagasawa-penstyle-den")!;
    const description = shopMetaDescription(shop);

    expect(description).toContain("NAGASAWA PenStyle DEN");
    expect(description).toContain("Kobe");
    expect(description.toLowerCase()).not.toContain("address");
    expect(description.toLowerCase()).not.toContain("hour");
  });

  it("names the facts a well-sourced record does carry", () => {
    const shop = findPrototypeShop("fook-hing-trading")!;
    const description = shopMetaDescription(shop);

    expect(description.toLowerCase()).toContain("address");
    expect(description.toLowerCase()).toContain("opening hours");
    expect(description.toLowerCase()).toContain("brands carried");
  });

  it("stays a usable length and free of implementation vocabulary", () => {
    for (const shop of prototypeShopDetails) {
      const description = shopMetaDescription(shop);

      expect(description.length, shop.slug).toBeGreaterThan(20);
      expect(description.length, shop.slug).toBeLessThan(300);
      expect(description, shop.slug).not.toMatch(
        /prototype|fixture|milestone|simulat/i,
      );
    }
  });
});

describe("the catalogue records About's shopfront caveat", () => {
  it("keeps SKB honest about having no confirmed shopfront", () => {
    // About says "a few are makers or suppliers whose own sources do not confirm
    // a public shopfront, and those pages say so". This is that page.
    const shop = findPrototypeShop("skb-kaohsiung")!;

    expect(shop.addressLines).toBeUndefined();
    expect(shop.shortDescription).toMatch(/does not confirm a retail shopfront/i);
  });
});
