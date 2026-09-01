import { describe, expect, it } from "vitest";

import { isLanguageTag } from "@/src/domain/language";

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
