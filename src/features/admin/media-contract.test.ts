import { describe, expect, it } from "vitest";
import { decodeShopMedia, mediaCapabilities, mediaPath } from "./media-contract";

const base = {
  id: "73000000-0000-4000-8000-000000000020",
  kind: "photo",
  width: 800,
  height: 600,
  altText: "Photo of a synthetic shop",
  creditText: null,
};
const admin = { ...base, status: "draft", revision: "a".repeat(32) };

describe("shop media decoding", () => {
  it("accepts today's response unchanged", () => {
    expect(decodeShopMedia([base])).toEqual([base]);
    expect(decodeShopMedia([admin], true)[0]).toMatchObject({ status: "draft" });
  });

  it("carries the additive arrangement fields through when the server sends them", () => {
    const [row] = decodeShopMedia([{ ...admin, sortOrder: 2, caption: "Writing counter" }], true);
    expect(row).toMatchObject({ sortOrder: 2, caption: "Writing counter" });
    expect(decodeShopMedia([{ ...admin, caption: null }], true)[0]!.caption).toBeNull();
  });

  it("omits the additive fields entirely when the server does not send them", () => {
    const [row] = decodeShopMedia([admin], true);
    expect("sortOrder" in row!).toBe(false);
    expect("caption" in row!).toBe(false);
  });

  it("still rejects malformed rows, including malformed additive fields", () => {
    expect(() => decodeShopMedia([{ ...admin, sortOrder: 1.5 }], true)).toThrow();
    expect(() => decodeShopMedia([{ ...admin, sortOrder: "2" }], true)).toThrow();
    expect(() => decodeShopMedia([{ ...admin, caption: "x".repeat(301) }], true)).toThrow();
    expect(() => decodeShopMedia([{ ...admin, caption: 7 }], true)).toThrow();
    expect(() => decodeShopMedia([{ ...base, id: "not-a-uuid" }])).toThrow();
    expect(() => decodeShopMedia([{ ...base, altText: "  " }])).toThrow();
    expect(() => decodeShopMedia([admin])).not.toThrow();
    expect(() => decodeShopMedia([base], true)).toThrow();
    expect(() => decodeShopMedia(Array.from({ length: 51 }, () => base))).toThrow();
  });
});

describe("advertised media capabilities", () => {
  it("is empty for today's response, so no unsupported control is offered", () => {
    expect(mediaCapabilities({ entries: [] })).toEqual([]);
    expect(mediaCapabilities(null)).toEqual([]);
    expect(mediaCapabilities([])).toEqual([]);
  });

  it("reads the advertised actions once the server sends them", () => {
    expect(mediaCapabilities({ entries: [], capabilities: ["remove", "arrange"] })).toEqual([
      "remove",
      "arrange",
    ]);
  });

  it("ignores anything that is not a plain action name", () => {
    expect(
      mediaCapabilities({ capabilities: ["remove", 7, "", "Remove", "a b", "x".repeat(33)] }),
    ).toEqual(["remove"]);
    expect(mediaCapabilities({ capabilities: "remove" })).toEqual([]);
    expect(
      mediaCapabilities({ capabilities: Array.from({ length: 21 }, () => "remove") }),
    ).toEqual([]);
  });
});

it("keeps the admin and public media paths distinct", () => {
  expect(mediaPath("abc")).toBe("/api/v1/admin/shops/abc/media");
  expect(mediaPath("abc", false)).toBe("/api/v1/shops/abc/media");
});
