import { describe, expect, it } from "vitest";

import {
  formatCheckedOn,
  oldestRetrievedOn,
  provenanceSentence,
  retrievalDates,
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
  });

  it("says plainly 'checked' only when every source shares one date", () => {
    expect(
      provenanceSentence([
        source({ retrievedOn: "2026-08-26" }),
        source({ retrievedOn: "2026-08-26", kind: "community_list" }),
      ]),
    ).toBe(
      "Details from the shop's own website and a community shop list, checked 26 August 2026.",
    );
  });

  it("names the oldest date as the oldest when the sources disagree", () => {
    // "checked 16 March 2026" would state something untrue about the website,
    // which was read in August. The floor on freshness is still what is claimed;
    // it is now labelled as a floor.
    expect(
      provenanceSentence([
        source({ retrievedOn: "2026-08-26" }),
        source({ retrievedOn: "2026-03-16", kind: "founder_visit" }),
      ]),
    ).toBe(
      "Details from the shop's own website and a Nib Atlas visit; oldest source checked 16 March 2026.",
    );
  });

  it("treats repeated dates as one date, not as a disagreement", () => {
    expect(
      retrievalDates([
        source({ retrievedOn: "2026-08-26" }),
        source({ retrievedOn: "2026-08-26", kind: "community_list" }),
        source({ retrievedOn: "2026-03-16", kind: "founder_visit" }),
      ]),
    ).toEqual(["2026-03-16", "2026-08-26"]);

    expect(
      retrievalDates([
        source({ retrievedOn: "2026-08-26" }),
        source({ retrievedOn: " 2026-08-26 ", kind: "community_list" }),
      ]),
    ).toEqual(["2026-08-26"]);
  });

  it("ignores an unreadable date when deciding whether the sources agree", () => {
    // One readable date plus one unreadable one is not a disagreement the reader
    // can act on, so the simple wording stands.
    expect(
      provenanceSentence([
        source({ retrievedOn: "2026-08-26" }),
        source({ retrievedOn: "sometime", kind: "community_list" }),
      ]),
    ).toBe(
      "Details from the shop's own website and a community shop list, checked 26 August 2026.",
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
    // the name, address and district come from a community list. Both sources
    // were read on the same day, so the simple wording applies.
    const shop = findPrototypeShop("ty-lee-pen-shop")!;

    expect(provenanceSentence(shop.sources)).toBe(
      "Details from the shop's own website and a community shop list, checked 26 August 2026.",
    );
  });

  it("qualifies SKB's date, whose founder visit predates its website read", () => {
    const shop = findPrototypeShop("skb-kaohsiung")!;

    expect(provenanceSentence(shop.sources)).toBe(
      "Details from the shop's own website and a Nib Atlas visit; oldest source checked 16 March 2026.",
    );
  });

  it("qualifies Pen House, which rests on three kinds across two dates", () => {
    const shop = findPrototypeShop("pen-house-tainan")!;

    expect(provenanceSentence(shop.sources)).toBe(
      "Details from the shop's own website, a community shop list, and a Nib Atlas visit; oldest source checked 16 March 2026.",
    );
  });

  it("keeps the simple wording for a single-source record", () => {
    const shop = findPrototypeShop("ginza-itoya-main-store")!;

    expect(provenanceSentence(shop.sources)).toBe(
      "Details from the shop's own website, checked 26 August 2026.",
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

      // And the date clause names what it means. A bare "checked" is only
      // allowed where every source really was read on that day.
      const dates = retrievalDates(shop.sources);

      if (dates.length > 1) {
        expect(sentence, `${shop.slug} claims one date across ${dates.length}`).toContain(
          "oldest source checked",
        );
      } else if (dates.length === 1) {
        expect(sentence, shop.slug).toContain("checked");
        expect(sentence, shop.slug).not.toContain("oldest source");
      }
    }
  });
});
