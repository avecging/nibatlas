import { describe, expect, it } from "vitest";

import {
  formatCheckedOn,
  oldestRetrievedOn,
  provenanceSentence,
  sourceKindsInOrder,
} from "@/src/components/shops/provenance";
import type { ShopSourceRef } from "@/src/domain/shop-detail";
import { findPrototypeShop, prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";

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
  it("names a single source kind and the date it was read", () => {
    expect(provenanceSentence([source()])).toBe(
      "Details from the shop's own website, checked 26 August 2026.",
    );
  });

  it("names every source kind a mixed record rests on", () => {
    // The defect this replaces: ranking picked "official" and the sentence then
    // claimed official backing for facts a community list supplied.
    expect(
      provenanceSentence([
        source({ kind: "official" }),
        source({ kind: "community_list" }),
      ]),
    ).toBe(
      "Details from the shop's own website and a community shop list, checked 26 August 2026.",
    );

    expect(
      provenanceSentence([
        source({ kind: "community_list" }),
        source({ kind: "founder_visit" }),
        source({ kind: "official" }),
      ]),
    ).toBe(
      "Details from the shop's own website, a community shop list, and a Nib Atlas visit, checked 26 August 2026.",
    );
  });

  it("names each kind once however many sources share it", () => {
    const sentence = provenanceSentence([
      source({ kind: "community_list", label: "one" }),
      source({ kind: "community_list", label: "two" }),
    ]);

    expect(sentence).toBe("Details from a community shop list, checked 26 August 2026.");
  });

  it("orders kinds by strength of backing", () => {
    expect(
      sourceKindsInOrder([
        source({ kind: "founder_visit" }),
        source({ kind: "community_list" }),
        source({ kind: "brand_dealer_list" }),
        source({ kind: "official" }),
      ]),
    ).toEqual(["official", "brand_dealer_list", "community_list", "founder_visit"]);
  });

  it("claims only the oldest check date, because a page is as stale as its stalest fact", () => {
    expect(
      oldestRetrievedOn([
        source({ retrievedOn: "2026-08-26" }),
        source({ retrievedOn: "2026-03-16", kind: "founder_visit" }),
      ]),
    ).toBe("2026-03-16");

    expect(
      provenanceSentence([
        source({ retrievedOn: "2026-08-26" }),
        source({ retrievedOn: "2026-03-16", kind: "founder_visit" }),
      ]),
    ).toBe(
      "Details from the shop's own website and a Nib Atlas visit, checked 16 March 2026.",
    );
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
    expect(formatCheckedOn("2026-02-31")).toBeNull();
  });

  it("credits TY Lee's community list alongside its own website", () => {
    // The record Codex named: tylee.tw confirms only the local-script name, and
    // the name, address and district come from a community list.
    const shop = findPrototypeShop("ty-lee-pen-shop")!;

    expect(provenanceSentence(shop.sources)).toBe(
      "Details from the shop's own website and a community shop list, checked 26 August 2026.",
    );
  });

  it("produces a line for every shop that credits all of its source kinds", () => {
    for (const shop of prototypeShopDetails) {
      const sentence = provenanceSentence(shop.sources);

      expect(sentence, shop.slug).not.toBeNull();

      // Every kind present in the record is represented in the sentence.
      for (const kind of sourceKindsInOrder(shop.sources)) {
        const phrase = {
          official: "the shop's own website",
          brand_dealer_list: "a brand's dealer listing",
          community_list: "a community shop list",
          founder_visit: "a Nib Atlas visit",
        }[kind];

        expect(sentence, `${shop.slug} omits ${kind}`).toContain(phrase);
      }

      // Still one sentence: no per-field breakdown, no retrieval-date dump.
      expect(sentence).not.toMatch(/confirms/i);
      expect(sentence?.split(". ").length).toBe(1);
    }
  });
});
