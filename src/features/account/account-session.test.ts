import { describe, expect, it } from "vitest";

import {
  DISPLAY_NAME_MAX_LENGTH,
  PREVIEW_IDENTITY_LABEL,
  accountHeadline,
  normalizeDisplayName,
  parseAccountPreview,
  resolveAccountSession,
  serializeAccountPreview,
} from "@/src/features/account/account-session";

describe("normalizeDisplayName", () => {
  it("treats whitespace-only input as no name at all", () => {
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("\n\t")).toBeNull();
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName(null)).toBeNull();
    expect(normalizeDisplayName(undefined)).toBeNull();
  });

  it("collapses whitespace, because this renders on one line", () => {
    expect(normalizeDisplayName("  Ada   Lovelace \n")).toBe("Ada Lovelace");
  });

  it("bounds the length", () => {
    const name = normalizeDisplayName("x".repeat(200));

    expect(name).toHaveLength(DISPLAY_NAME_MAX_LENGTH);
  });

  it("keeps non-Latin names intact", () => {
    expect(normalizeDisplayName("伊東屋 さん")).toBe("伊東屋 さん");
  });
});

describe("resolveAccountSession", () => {
  /*
   * The property the whole seam exists for. Authentication does not exist yet,
   * so a tester must never be shown copy that says they have an account —
   * whatever is in storage.
   */
  it("is signed out in normal mode even with a stored signed-in preview", () => {
    expect(
      resolveAccountSession({
        reviewer: false,
        preview: { signedIn: true, displayName: "Ada" },
      }),
    ).toEqual({ status: "signed-out" });
  });

  it("is signed out in reviewer mode until the preview is entered", () => {
    expect(resolveAccountSession({ reviewer: true, preview: null }).status).toBe(
      "signed-out",
    );
    expect(
      resolveAccountSession({ reviewer: true, preview: { signedIn: false } }).status,
    ).toBe("signed-out");
  });

  it("resolves the reviewer preview, and says that is what it is", () => {
    const session = resolveAccountSession({
      reviewer: true,
      preview: { signedIn: true, displayName: "  Ada  " },
    });

    expect(session).toEqual({
      status: "signed-in",
      displayName: "Ada",
      identityLabel: PREVIEW_IDENTITY_LABEL,
      preview: true,
    });
  });
});

describe("the persisted preview", () => {
  it("round-trips", () => {
    const raw = serializeAccountPreview({ signedIn: true, displayName: "Ada" });

    expect(parseAccountPreview(raw)).toEqual({ signedIn: true, displayName: "Ada" });
  });

  it("rejects anything that is not a preview record", () => {
    expect(parseAccountPreview(null)).toBeNull();
    expect(parseAccountPreview("")).toBeNull();
    expect(parseAccountPreview("not json")).toBeNull();
    expect(parseAccountPreview("[]")).toBeNull();
    expect(parseAccountPreview('{"signedIn":"yes"}')).toBeNull();
  });

  it("normalises a display name that was stored before the rule tightened", () => {
    expect(parseAccountPreview('{"signedIn":true,"displayName":"  Ada  Lovelace "}')).toEqual(
      { signedIn: true, displayName: "Ada Lovelace" },
    );
  });
});

describe("accountHeadline", () => {
  it("names the reader, or the account when they have not chosen a name", () => {
    expect(accountHeadline({ status: "signed-out" })).toBe("Not signed in");
    expect(
      accountHeadline({
        status: "signed-in",
        displayName: "Ada",
        identityLabel: PREVIEW_IDENTITY_LABEL,
        preview: true,
      }),
    ).toBe("Ada");
    expect(
      accountHeadline({
        status: "signed-in",
        displayName: null,
        identityLabel: PREVIEW_IDENTITY_LABEL,
        preview: true,
      }),
    ).toBe(PREVIEW_IDENTITY_LABEL);
  });
});
