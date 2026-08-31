import { describe, expect, it } from "vitest";

import { estimateTextEms, fitStampTitle } from "./stamp-title";

/**
 * Fitting a name into an impression.
 *
 * The property that matters is not the exact size chosen — that is a rendering
 * detail — but that a name is never left running past the space it was given.
 * Every case here checks the fitted result against its own budget.
 */
const SIZES = [37, 33, 29, 25, 22] as const;

function widthOf(line: string, fontSize: number): number {
  return estimateTextEms(line) * fontSize;
}

describe("estimateTextEms", () => {
  it("counts full-width scripts as a whole advance each", () => {
    // Four ideographs plus a space: the space is narrow, the ideographs are not.
    expect(estimateTextEms("銀座 伊東屋 本店")).toBeGreaterThan(7);
    expect(estimateTextEms("銀座 伊東屋 本店")).toBeLessThan(8);
  });

  it("counts Latin at roughly half an advance", () => {
    expect(estimateTextEms("Ginza")).toBeLessThan(3);
    expect(estimateTextEms("Ginza")).toBeGreaterThan(2);
  });

  it("gives capitals and narrow letters different advances", () => {
    expect(estimateTextEms("MMMM")).toBeGreaterThan(estimateTextEms("llll"));
  });
});

describe("fitStampTitle", () => {
  it("keeps a short name on one line at the largest size", () => {
    const fitted = fitStampTitle({ title: "Itoya", maxWidth: 340, sizes: SIZES });

    expect(fitted.lines).toEqual(["Itoya"]);
    expect(fitted.fontSize).toBe(37);
  });

  it("wraps a long name rather than shrinking it away", () => {
    const fitted = fitStampTitle({
      title: "NAGASAWA Stationery Center Main Store",
      maxWidth: 340,
      sizes: SIZES,
    });

    expect(fitted.lines.length).toBe(2);

    for (const line of fitted.lines) {
      expect(widthOf(line, fitted.fontSize)).toBeLessThanOrEqual(340);
    }
  });

  it("never returns more lines than it was allowed, for any catalogue name", () => {
    const names = [
      "Aesthetic Bay",
      "Fook Hing Trading Co.",
      "Ginza Itoya Main Store",
      "Ginza Itoya Yokohama Motomachi",
      "NAGASAWA Stationery Center Main Store",
      "NAGASAWA PenStyle DEN",
      "Pen House",
      "SKB",
      "Ty Lee Pen Shop",
      "Juspirit",
      "East District, Tainan",
      "Chūō, Tokyo",
      "Naka, Yokohama",
      "Singapore",
      "Kaohsiung",
      "Taiwan",
      "Japan",
    ];

    for (const title of names) {
      const fitted = fitStampTitle({ title, maxWidth: 340, sizes: SIZES });

      expect(fitted.lines.length).toBeLessThanOrEqual(2);

      for (const line of fitted.lines) {
        expect(widthOf(line, fitted.fontSize)).toBeLessThanOrEqual(340);
      }
    }
  });

  it("breaks a full-width script between characters, which is how it breaks", () => {
    const fitted = fitStampTitle({
      title: "示範台北大安墨水圖書室與試寫空間",
      maxWidth: 340,
      sizes: SIZES,
    });

    expect(fitted.lines.length).toBeGreaterThan(1);
    expect(fitted.lines.join("")).toBe("示範台北大安墨水圖書室與試寫空間");

    for (const line of fitted.lines) {
      expect(widthOf(line, fitted.fontSize)).toBeLessThanOrEqual(340);
    }
  });

  it("breaks a single unbreakable word rather than letting it overrun", () => {
    const fitted = fitStampTitle({
      title: "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch",
      maxWidth: 340,
      sizes: SIZES,
    });

    expect(fitted.lines.join("")).toBe(
      "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch",
    );

    for (const line of fitted.lines) {
      expect(widthOf(line, fitted.fontSize)).toBeLessThanOrEqual(340);
    }
  });

  it("is deterministic, so an impression regenerates identically", () => {
    const once = fitStampTitle({
      title: "Ginza Itoya Yokohama Motomachi",
      maxWidth: 340,
      sizes: SIZES,
    });
    const twice = fitStampTitle({
      title: "Ginza Itoya Yokohama Motomachi",
      maxWidth: 340,
      sizes: SIZES,
    });

    expect(once).toEqual(twice);
  });

  it("still returns something for a name no size can fit in two lines", () => {
    const fitted = fitStampTitle({
      title: "字".repeat(200),
      maxWidth: 340,
      sizes: SIZES,
    });

    expect(fitted.lines.length).toBeGreaterThan(0);
    expect(fitted.fontSize).toBe(22);
  });
});
