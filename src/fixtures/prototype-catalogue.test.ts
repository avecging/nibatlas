import { describe, expect, it } from "vitest";

import { STAMP_INKS, STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";
import { COUNTRY_SEAL_STAMP_THRESHOLD } from "@/src/domain/seals";
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

  it("covers the three launch countries, including Taiwan beyond Taipei", () => {
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

    // And nothing anywhere carries an appointment or accessibility claim we
    // could not source.
    for (const shop of prototypeShopDetails) {
      expect(shop.appointmentRequired).toBeUndefined();
      expect(shop.accessibilityNotes).toBeUndefined();
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
