import { describe, expect, it } from "vitest";

import {
  inkForStampKey,
  STAMP_INK_HEX,
  STAMP_INK_LABELS,
  STAMP_INKS,
  STAMP_PALETTE_VERSION,
} from "@/src/domain/stamp-palette";

describe("stamp palette", () => {
  it("holds exactly eight shared global inks", () => {
    expect(STAMP_INKS).toHaveLength(8);
    expect(new Set(STAMP_INKS).size).toBe(8);
  });

  it("gives every ink a value and a name", () => {
    for (const ink of STAMP_INKS) {
      expect(STAMP_INK_HEX[ink]).toMatch(/^#[0-9a-f]{6}$/);
      expect(STAMP_INK_LABELS[ink].length).toBeGreaterThan(0);
    }
  });

  it("pins a palette version so an impression regenerates identically", () => {
    expect(STAMP_PALETTE_VERSION).toBeGreaterThan(0);
  });

  it("is deterministic for the same key", () => {
    expect(inkForStampKey("stamp-pen-house-tainan")).toBe(
      inkForStampKey("stamp-pen-house-tainan"),
    );
  });

  it("never lets a country, locality, or tier own a colour", () => {
    // Keys that share a country produce different inks, and keys from different
    // countries collide freely: there is no mapping to decode.
    const byCountry = new Map<string, Set<string>>();

    for (const country of ["jp", "sg", "tw"]) {
      const inks = new Set<string>();

      for (let index = 0; index < 40; index += 1) {
        inks.add(inkForStampKey(`stamp-${country}-shop-${index}`));
      }

      byCountry.set(country, inks);
    }

    for (const inks of byCountry.values()) {
      // Every country reaches most of the palette, so no country owns a colour.
      expect(inks.size).toBeGreaterThanOrEqual(6);
    }
  });

  it("spreads keys across the whole palette", () => {
    const counts = new Map<string, number>();

    for (let index = 0; index < 800; index += 1) {
      const ink = inkForStampKey(`stamp-${index}`);
      counts.set(ink, (counts.get(ink) ?? 0) + 1);
    }

    expect(counts.size).toBe(8);

    for (const count of counts.values()) {
      // A blind hash, not a perfect cycle: every ink still gets real use.
      expect(count).toBeGreaterThan(40);
    }
  });
});
