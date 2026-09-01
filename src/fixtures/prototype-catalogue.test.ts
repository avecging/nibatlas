import { describe, expect, it } from "vitest";

import {
  hasSourcedValueLayer,
  shopEvidenceIssues,
} from "@/src/domain/shop-evidence";
import { STAMP_INKS, STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";
import { COUNTRY_SEAL_STAMP_THRESHOLD } from "@/src/domain/seals";
import { countryLabel } from "@/src/domain/geo";
import { isLanguageTag } from "@/src/domain/language";
import { demoShops } from "@/src/fixtures/demo-shops";
import {
  PROTOTYPE_CATALOGUE_NOTICE,
  prototypeCoverageSets,
  prototypeShopDetails,
  prototypeShopSummaries,
} from "@/src/fixtures/prototype-catalogue";

describe("prototype catalogue", () => {
  it("is a deliberately small sourced subset", () => {
    expect(prototypeShopDetails.length).toBeGreaterThanOrEqual(8);
    expect(prototypeShopDetails.length).toBeLessThanOrEqual(20);
  });

  it("covers the current three-country fixture, including Taiwan beyond Taipei", () => {
    expect(new Set(prototypeShopDetails.map((shop) => shop.countryCode))).toEqual(
      new Set(["SG", "JP", "TW"]),
    );

    const taiwanLocalities = new Set(
      prototypeShopDetails
        .filter((shop) => shop.countryCode === "TW")
        .map((shop) => shop.localityName),
    );

    expect(taiwanLocalities).toContain("East District, Tainan");
    expect(taiwanLocalities).toContain("Kaohsiung");
  });

  it("carries prominent Japanese destinations beyond Tokyo", () => {
    const japanLocalities = new Set(
      prototypeShopDetails
        .filter((shop) => shop.countryCode === "JP")
        .map((shop) => shop.localityName),
    );

    expect(japanLocalities.size).toBeGreaterThan(1);
    expect([...japanLocalities].some((name) => !name.includes("Tokyo"))).toBe(true);
  });

  it("uses real country codes rather than merely alpha-2-shaped values", () => {
    const countryCodes = new Set(
      prototypeShopDetails.map((shop) => shop.countryCode),
    );

    for (const countryCode of countryCodes) {
      const label = countryLabel(countryCode);

      expect(label).not.toBe(countryCode);
      expect(label).not.toMatch(/unknown region/i);
    }
  });

  it("tags every local-script name explicitly rather than inferring from country", () => {
    for (const shop of prototypeShopDetails) {
      if (shop.localName === undefined) {
        expect(shop.localNameLang).toBeUndefined();
      } else {
        expect(shop.localNameLang).toBeDefined();
        expect(isLanguageTag(shop.localNameLang ?? "")).toBe(true);
      }
    }
  });

  it("attributes every record to at least one source", () => {
    for (const shop of prototypeShopDetails) {
      expect(shop.sources.length).toBeGreaterThan(0);

      for (const source of shop.sources) {
        expect(source.label.length).toBeGreaterThan(0);
        expect(source.confirms.length).toBeGreaterThan(0);
        expect(source.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("never claims the catalogue is verified or complete", () => {
    for (const shop of prototypeShopDetails) {
      expect(shop.sourceQuality).not.toBe("verified");
      expect(shop.fixtureNotice).toBe(PROTOTYPE_CATALOGUE_NOTICE);
    }
  });

  it("omits rather than invents unsupported practical detail", () => {
    // A shop whose own site publishes no hours must show none, and must not be
    // given an invented address either.
    const skb = prototypeShopDetails.find((shop) => shop.slug === "skb-kaohsiung");

    expect(skb).toBeDefined();
    expect(skb?.openingHours).toBeUndefined();
    expect(skb?.addressLines).toBeUndefined();
    expect(skb?.positionPrecision).toBe("locality");

    // And nothing anywhere carries a practical or access claim we could not
    // source. WP4 moved appointment, payment, languages and accessibility into
    // the sourced `practical` and `access` blocks; no source in this catalogue
    // publishes any of them, so no record carries either block.
    for (const shop of prototypeShopDetails) {
      expect(shop.practical).toBeUndefined();
      expect(shop.access).toBeUndefined();
    }
  });

  /**
   * WP4's central rule, enforced rather than described.
   *
   * Accepted decision 4 lets Claude Code define the pen-specific schema and
   * forbids it inventing the content. Every service, experience, exclusive,
   * access and practical claim therefore names the source that confirms it, and
   * this asserts the reference resolves against the record's own source list.
   *
   * The catalogue currently carries no such claim — no source in it publishes
   * services, in-store experiences, shop-only items, stations, payment methods
   * or languages — so the check is a guard on what may be added later rather
   * than a verdict on what is here now. `shop-evidence.test.ts` proves it
   * catches a bad reference.
   */
  it("backs every pen-specific claim with one of the record's own sources", () => {
    for (const shop of prototypeShopDetails) {
      expect(shopEvidenceIssues(shop)).toEqual([]);
    }
  });

  it("invents no services, experiences, or exclusives", () => {
    for (const shop of prototypeShopDetails) {
      expect(shop.services).toBeUndefined();
      expect(shop.experiences).toBeUndefined();
      expect(shop.exclusives).toBeUndefined();
      expect(hasSourcedValueLayer(shop)).toBe(false);
    }
  });

  it("labels every coordinate as unsurveyed", () => {
    for (const shop of prototypeShopDetails) {
      expect(["street", "locality"]).toContain(shop.positionPrecision);
    }
  });

  it("gives every stamp exactly one pinned ink from the shared palette", () => {
    for (const shop of prototypeShopDetails) {
      expect(STAMP_INKS).toContain(shop.stamp.ink);
      expect(shop.stamp.paletteVersion).toBe(STAMP_PALETTE_VERSION);
      expect(shop.stamp.tier).toBe("shop");
    }
  });

  it("keeps the summary projection aligned with the detail records", () => {
    expect(prototypeShopSummaries).toHaveLength(prototypeShopDetails.length);

    for (const summary of prototypeShopSummaries) {
      const detail = prototypeShopDetails.find((shop) => shop.id === summary.id);

      expect(detail).toBeDefined();
      expect(summary.specialtyLine).toBe(detail?.specialtyLine ?? null);
      // The public projection never carries user state.
      expect(summary.markerState).toBe("unvisited");
    }
  });

  it("versions every curated coverage set", () => {
    expect(prototypeCoverageSets).toHaveLength(3);

    for (const set of prototypeCoverageSets) {
      expect(set.version).toMatch(/^[a-z]{2}-prototype-\d{4}-\d{2}-\d+$/);
      expect(set.eligibleShopIds.length).toBeGreaterThan(0);
      expect(set.eligibleShopIds.length).toBeLessThanOrEqual(
        prototypeShopDetails.length,
      );
    }
  });

  it("keeps a country whose curated set is smaller than the stamp threshold", () => {
    // The Singapore set is deliberately small so the "complete a curated set
    // smaller than five" seal rule is exercised by the seeded data.
    const singapore = prototypeCoverageSets.find((set) => set.countryCode === "SG");

    expect(singapore?.eligibleShopIds.length).toBeLessThan(
      COUNTRY_SEAL_STAMP_THRESHOLD,
    );
  });
});

describe("shared Codex fixture", () => {
  it("stays explicitly marked as invented demo data", () => {
    expect(demoShops).toHaveLength(3);

    for (const shop of demoShops) {
      expect(shop.sourceQuality).toBe("demo");
      expect(shop.fixtureNotice).toMatch(/not a verified business/i);
    }
  });
});
