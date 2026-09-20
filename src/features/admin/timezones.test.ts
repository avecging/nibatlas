import { describe, expect, it } from "vitest";
import {
  currentOffset,
  isValidTimezone,
  matchTimezones,
  suggestTimezone,
  supportedTimezones,
  timezoneChoices,
  timezoneLabel,
} from "./timezones";

const JANUARY = new Date("2026-01-15T00:00:00Z");
const JULY = new Date("2026-07-15T00:00:00Z");

describe("timezone choices", () => {
  it("covers the platform's whole IANA set, not a handful of sample countries", () => {
    const choices = timezoneChoices(null, JANUARY);
    expect(choices.length).toBe(supportedTimezones().length);
    expect(choices.length).toBeGreaterThan(200);
    for (const id of ["Asia/Singapore", "Asia/Tokyo", "America/Sao_Paulo", "Pacific/Chatham"])
      expect(choices.some((c) => c.id === id)).toBe(true);
  });

  it("shows a readable place and the current offset while persisting the identifier", () => {
    const singapore = timezoneChoices(null, JANUARY).find((c) => c.id === "Asia/Singapore")!;
    expect(singapore.place).toBe("Singapore");
    expect(singapore.region).toBe("Asia");
    expect(timezoneLabel(singapore)).toBe("Singapore, Asia — UTC+08:00");
    const kuala = timezoneChoices(null, JANUARY).find((c) => c.id === "Asia/Kuala_Lumpur")!;
    expect(kuala.place).toBe("Kuala Lumpur");
  });

  it("reports the offset in force now rather than a fixed one", () => {
    expect(currentOffset("Europe/London", JANUARY)).toBe("UTC+00:00");
    expect(currentOffset("Europe/London", JULY)).toBe("UTC+01:00");
    expect(currentOffset("Asia/Singapore", JULY)).toBe("UTC+08:00");
    expect(currentOffset("Not/AZone", JULY)).toBe("");
  });

  it("marks a fixed offset as such and sorts it after every real place", () => {
    // Runtimes differ on whether `UTC` and `Etc/*` are listed at all. Whenever
    // one appears it must be classified as a fixed offset, never as a location,
    // and it must never outrank a real place in the list.
    const choices = timezoneChoices("UTC", JANUARY);
    const fixed = choices.filter((c) => c.fixedOffset);
    expect(fixed.map((c) => c.id)).toContain("UTC");
    expect(fixed.every((c) => c.id === "UTC" || c.id === "GMT" || c.id.startsWith("Etc/"))).toBe(
      true,
    );
    expect(choices.findIndex((c) => c.fixedOffset)).toBeGreaterThan(
      choices.findLastIndex((c) => !c.fixedOffset),
    );
    expect(timezoneChoices(null, JANUARY).every((c) => !c.fixedOffset || c.offset !== "")).toBe(
      true,
    );
  });

  it("keeps an existing valid identifier the runtime does not list", () => {
    const legacy = "Asia/Calcutta";
    const listed = supportedTimezones();
    const choices = timezoneChoices(legacy, JANUARY);
    expect(choices.some((c) => c.id === legacy)).toBe(true);
    // Whether or not the runtime lists the alias, it is never dropped or renamed.
    expect(choices.filter((c) => c.id === legacy)).toHaveLength(1);
    expect(choices.length).toBe(listed.length + (listed.includes(legacy) ? 0 : 1));
  });

  it("never invents a choice for an identifier the runtime rejects", () => {
    expect(timezoneChoices("Mars/Olympus", JANUARY).some((c) => c.id === "Mars/Olympus")).toBe(false);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("Asia/Singapore")).toBe(true);
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("timezone search", () => {
  const choices = timezoneChoices(null, JANUARY);

  it("finds a zone by place, identifier or offset", () => {
    expect(matchTimezones(choices, "singapore")[0]?.id).toBe("Asia/Singapore");
    expect(matchTimezones(choices, "asia/sing")[0]?.id).toBe("Asia/Singapore");
    expect(matchTimezones(choices, "kuala").some((c) => c.id === "Asia/Kuala_Lumpur")).toBe(true);
    expect(matchTimezones(choices, "+09:00").every((c) => c.offset === "UTC+09:00")).toBe(true);
  });

  it("is case-insensitive and ranks a prefix match first", () => {
    const hits = matchTimezones(choices, "TOKYO");
    expect(hits[0]?.id).toBe("Asia/Tokyo");
  });

  it("ranks fixed offsets below places for the same query", () => {
    const hits = matchTimezones(choices, "gmt");
    const firstFixed = hits.findIndex((c) => c.fixedOffset);
    const lastPlace = hits.findLastIndex((c) => !c.fixedOffset);
    if (firstFixed >= 0 && lastPlace >= 0) expect(firstFixed).toBeGreaterThan(lastPlace);
  });

  it("returns nothing rather than a wrong guess", () => {
    expect(matchTimezones(choices, "zzzz-no-such-place")).toEqual([]);
  });
});

describe("country suggestion", () => {
  it("only suggests where a country has a single civil zone", () => {
    expect(suggestTimezone("SG")).toBe("Asia/Singapore");
    expect(suggestTimezone("jp")).toBe("Asia/Tokyo");
    // Several zones: the editor chooses rather than being given a wrong one.
    expect(suggestTimezone("US")).toBe("");
    expect(suggestTimezone("AU")).toBe("");
    expect(suggestTimezone("ID")).toBe("");
    expect(suggestTimezone("NZ")).toBe("");
    expect(suggestTimezone("")).toBe("");
    expect(suggestTimezone(null)).toBe("");
  });
});
