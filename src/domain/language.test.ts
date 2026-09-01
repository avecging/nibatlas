import { describe, expect, it } from "vitest";

import {
  isLanguageTag,
  languageDirection,
  languageTag,
} from "@/src/domain/language";

describe("isLanguageTag", () => {
  it.each(["en", "ja", "ko", "ms", "ta", "zh-Hans", "zh-Hant", "ar"])(
    "accepts the BCP 47 tag %s",
    (tag) => {
      expect(isLanguageTag(tag)).toBe(true);
    },
  );

  it.each(["", "not_a_language", "zh--Hant"])("rejects %j", (tag) => {
    expect(isLanguageTag(tag)).toBe(false);
  });
});


describe("languageTag", () => {
  it("returns a validated tag", () => {
    expect(languageTag("zh-Hant")).toBe("zh-Hant");
  });

  it("rejects invalid fixture or import data", () => {
    expect(() => languageTag("not_a_language")).toThrow(RangeError);
  });
});

describe("languageDirection", () => {
  it.each(["ar", "fa", "he", "ur", "az-Arab"])(
    "recognises the RTL script used by %s",
    (tag) => {
      expect(languageDirection(tag)).toBe("rtl");
    },
  );

  it.each(["en", "ja", "ko", "ms", "ta", "zh-Hans", "zh-Hant"])(
    "keeps %s left-to-right",
    (tag) => {
      expect(languageDirection(tag)).toBe("ltr");
    },
  );

  it("fails safely for an invalid tag", () => {
    expect(languageDirection("not_a_language")).toBe("ltr");
  });
});
