import { describe, expect, it } from "vitest";

import {
  defaultPassportMode,
  EMPTY_PASSPORT_VIEW,
  parsePassportView,
  passportViewStorageKey,
  resolvePassportMode,
  serializePassportView,
} from "@/src/features/passport/passport-view-state";

describe("resolvePassportMode", () => {
  it("defaults a normal device to List and a reviewer device to Book", () => {
    expect(resolvePassportMode({ stored: null, reviewer: false })).toBe("list");
    expect(resolvePassportMode({ stored: null, reviewer: true })).toBe("book");
  });

  it("lets an explicit choice outrank the audience default in both directions", () => {
    expect(resolvePassportMode({ stored: "book", reviewer: false })).toBe("book");
    expect(resolvePassportMode({ stored: "list", reviewer: true })).toBe("list");
  });

  it("names the same defaults on its own", () => {
    expect(defaultPassportMode(false)).toBe("list");
    expect(defaultPassportMode(true)).toBe("book");
  });
});

describe("passportViewStorageKey", () => {
  it("keeps the two audiences apart", () => {
    // One key plus a flag would let a reviewer's Book choice become a tester's,
    // and each audience has a different default to fall back to.
    expect(passportViewStorageKey("normal")).not.toBe(
      passportViewStorageKey("reviewer"),
    );
  });
});

describe("parsePassportView", () => {
  it("treats a device with no record as one that has chosen nothing", () => {
    expect(parsePassportView(null)).toEqual(EMPTY_PASSPORT_VIEW);
    expect(parsePassportView("")).toEqual(EMPTY_PASSPORT_VIEW);
  });

  it("reads a complete record", () => {
    const record = parsePassportView(
      JSON.stringify({
        mode: "book",
        coverSeen: true,
        place: { kind: "locality", countryCode: "JP", localitySlug: "ginza-tokyo" },
        listScrollTop: 420,
      }),
    );

    expect(record).toEqual({
      mode: "book",
      coverSeen: true,
      place: { kind: "locality", countryCode: "JP", localitySlug: "ginza-tokyo" },
      listScrollTop: 420,
    });
  });

  it("canonicalises a hand-written place so it still matches the domain", () => {
    const record = parsePassportView(
      JSON.stringify({
        place: { kind: "locality", countryCode: "jp", localitySlug: "Ginza-Tokyo" },
      }),
    );

    expect(record.place).toEqual({
      kind: "locality",
      countryCode: "JP",
      localitySlug: "ginza-tokyo",
    });
  });

  it("discards an unparseable or hostile value rather than throwing", () => {
    for (const raw of [
      "not json",
      "[]",
      "null",
      '"list"',
      "42",
      JSON.stringify({ mode: "sideways" }),
      JSON.stringify({ mode: 7 }),
      JSON.stringify({ place: { kind: "sideways" } }),
      JSON.stringify({ place: { kind: "locality", countryCode: "JP" } }),
      JSON.stringify({ place: { kind: "locality", countryCode: "", localitySlug: "" } }),
      JSON.stringify({ place: "ginza" }),
      JSON.stringify({ listScrollTop: -10 }),
      JSON.stringify({ listScrollTop: "far" }),
      JSON.stringify({ listScrollTop: Number.NaN }),
      JSON.stringify({ coverSeen: "yes" }),
    ]) {
      const record = parsePassportView(raw);

      expect(record.mode === null || record.mode === "list" || record.mode === "book")
        .toBe(true);
      expect(record.listScrollTop).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(record.listScrollTop)).toBe(true);
    }

    // Each of these carries nothing usable, so each resolves to "never chose".
    expect(parsePassportView(JSON.stringify({ mode: "sideways" })).mode).toBeNull();
    expect(parsePassportView(JSON.stringify({ place: "ginza" })).place).toBeNull();
    expect(parsePassportView(JSON.stringify({ coverSeen: "yes" })).coverSeen).toBe(
      false,
    );
    expect(parsePassportView(JSON.stringify({ listScrollTop: -10 })).listScrollTop).toBe(
      0,
    );
  });
});

describe("serializePassportView", () => {
  it("round-trips", () => {
    const record = {
      mode: "list" as const,
      coverSeen: true,
      place: { kind: "seals" as const },
      listScrollTop: 12,
    };

    expect(parsePassportView(serializePassportView(record))).toEqual(record);
  });

  it("never writes a default down as a choice", () => {
    // The reader has been to the book and turned a page, but has never used the
    // toggle. Writing "list" here would make the reviewer default unreachable
    // and would misreport what the reader picked.
    const written = serializePassportView({
      ...EMPTY_PASSPORT_VIEW,
      coverSeen: true,
      place: { kind: "seals" },
    });

    expect(JSON.parse(written).mode).toBeNull();
    expect(parsePassportView(written).mode).toBeNull();
    expect(resolvePassportMode({ stored: parsePassportView(written).mode, reviewer: true }))
      .toBe("book");
  });
});
