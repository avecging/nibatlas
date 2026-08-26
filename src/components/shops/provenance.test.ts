import { describe, expect, it } from "vitest";

import {
  formatCheckedOn,
  primarySource,
  provenanceSentence,
} from "@/src/components/shops/provenance";
import type { ShopSourceRef } from "@/src/domain/shop-detail";
import { prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";

function source(overrides: Partial<ShopSourceRef> = {}): ShopSourceRef {
  return {
    label: "Example",
    retrievedOn: "2026-08-26",
    kind: "official",
    confirms: ["address"],
    ...overrides,
  };
}

describe("provenance sentence", () => {
  it("names the shop's own website and the date it was read", () => {
    expect(provenanceSentence([source()])).toBe(
      "Details from the shop's own website, checked 26 August 2026.",
    );
  });

  it("prefers the shop's own website over a weaker source", () => {
    const chosen = primarySource([
      source({ kind: "community_list", retrievedOn: "2026-08-26" }),
      source({ kind: "official", retrievedOn: "2026-01-02" }),
    ]);

    expect(chosen?.kind).toBe("official");
  });

  it("prefers the most recently read source among equals", () => {
    const chosen = primarySource([
      source({ kind: "official", retrievedOn: "2026-01-02", label: "old" }),
      source({ kind: "official", retrievedOn: "2026-08-26", label: "new" }),
    ]);

    expect(chosen?.label).toBe("new");
  });

  it("says nothing at all when there is no source", () => {
    // A vague claim of provenance would be worse than none, so the line is
    // omitted rather than softened.
    expect(provenanceSentence([])).toBeNull();
  });

  it("drops the date rather than printing an unparseable one", () => {
    expect(provenanceSentence([source({ retrievedOn: "sometime" })])).toBe(
      "Details from the shop's own website.",
    );
    expect(formatCheckedOn("2026-13-45")).toBeNull();
  });

  it("produces a line for every shop in the catalogue", () => {
    for (const shop of prototypeShopDetails) {
      const sentence = provenanceSentence(shop.sources);

      expect(sentence, shop.slug).not.toBeNull();
      // One sentence, no per-field breakdown and no retrieval-date dump.
      expect(sentence).not.toMatch(/confirms/i);
      expect(sentence?.split(". ").length).toBe(1);
    }
  });
});
