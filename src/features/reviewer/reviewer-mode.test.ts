import { describe, expect, it } from "vitest";

import {
  hrefWithoutReviewerParam,
  parseReviewerParam,
  resolveReviewerMode,
  reviewerParamFromSearch,
  serializeReviewerChoice,
} from "@/src/features/reviewer/reviewer-mode";

describe("reviewer mode parameter", () => {
  it("reads the enabling forms", () => {
    for (const value of ["1", "true", "on", "YES", " 1 "]) {
      expect(parseReviewerParam(value)).toBe(true);
    }
  });

  it("reads the disabling forms", () => {
    for (const value of ["0", "false", "off", "NO", " 0 "]) {
      expect(parseReviewerParam(value)).toBe(false);
    }
  });

  it("treats an absent or unrecognised value as no decision", () => {
    // `null` has to stay distinct from `false`: a missing parameter falls
    // through to the remembered choice, while `?review=0` overrides it.
    expect(parseReviewerParam(null)).toBeNull();
    expect(parseReviewerParam(undefined)).toBeNull();
    expect(parseReviewerParam("")).toBeNull();
    expect(parseReviewerParam("maybe")).toBeNull();
  });

  it("pulls the parameter out of a search string", () => {
    expect(reviewerParamFromSearch("?review=1")).toBe(true);
    expect(reviewerParamFromSearch("review=0")).toBe(false);
    expect(reviewerParamFromSearch("?destination=ginza&review=1")).toBe(true);
    expect(reviewerParamFromSearch("?destination=ginza")).toBeNull();
    expect(reviewerParamFromSearch("")).toBeNull();
  });
});

describe("reviewer mode resolution", () => {
  it("defaults to off on a device that has never chosen", () => {
    expect(resolveReviewerMode({ param: null, stored: null })).toBe(false);
  });

  it("uses the remembered choice when no parameter is present", () => {
    expect(resolveReviewerMode({ param: null, stored: true })).toBe(true);
    expect(resolveReviewerMode({ param: null, stored: false })).toBe(false);
  });

  it("lets an explicit parameter override the remembered choice in both directions", () => {
    expect(resolveReviewerMode({ param: true, stored: false })).toBe(true);
    expect(resolveReviewerMode({ param: false, stored: true })).toBe(false);
  });

  it("round-trips a persisted choice", () => {
    for (const enabled of [true, false]) {
      expect(parseReviewerParam(serializeReviewerChoice(enabled))).toBe(enabled);
    }
  });
});

describe("stripping the parameter from a URL", () => {
  it("removes review and keeps every other parameter and the hash", () => {
    expect(
      hrefWithoutReviewerParam("https://beta.example/?destination=ginza&review=1#top"),
    ).toBe("https://beta.example/?destination=ginza#top");
  });

  it("drops the question mark when review was the only parameter", () => {
    expect(hrefWithoutReviewerParam("https://beta.example/me?review=1")).toBe(
      "https://beta.example/me",
    );
  });

  it("removes every occurrence so none can win on reload", () => {
    expect(hrefWithoutReviewerParam("https://beta.example/me?review=0&review=1")).toBe(
      "https://beta.example/me",
    );
  });

  it("reports nothing to do when the parameter is absent", () => {
    // The caller skips a pointless history write on this.
    expect(hrefWithoutReviewerParam("https://beta.example/me?destination=kobe")).toBeNull();
    expect(hrefWithoutReviewerParam("https://beta.example/me")).toBeNull();
    expect(hrefWithoutReviewerParam("not a url")).toBeNull();
  });
});
