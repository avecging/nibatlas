import { describe, expect, it } from "vitest";

import type { ShopMedia } from "@/src/features/admin/media-contract";
import { logoShape, splitShopMedia } from "@/src/features/shops/shop-media";

function entry(overrides: Partial<ShopMedia> & Pick<ShopMedia, "id">): ShopMedia {
  return {
    kind: "photo",
    width: 1200,
    height: 800,
    altText: "A shop photograph",
    creditText: null,
    ...overrides,
  };
}

describe("splitting a published media list", () => {
  it("keeps the logo out of the photographs, and out of their count", () => {
    const { logo, photos } = splitShopMedia([
      entry({ id: "logo", kind: "logo" }),
      entry({ id: "only-photo" }),
    ]);

    expect(logo?.id).toBe("logo");
    expect(photos.map((photo) => photo.id)).toEqual(["only-photo"]);
  });

  it("preserves server order, so the first published photo is the cover", () => {
    // The public list arrives ordered by sort_order, created_at, id. Nothing
    // re-sorts it, and a logo sitting between two photos does not reorder them.
    const { photos } = splitShopMedia([
      entry({ id: "zebra" }),
      entry({ id: "brand", kind: "logo" }),
      entry({ id: "apple" }),
    ]);

    expect(photos.map((photo) => photo.id)).toEqual(["zebra", "apple"]);
  });

  it("has no logo and no photographs for an empty list", () => {
    expect(splitShopMedia([])).toEqual({ logo: null, photos: [] });
  });
});

describe("choosing a logo slot from its own dimensions", () => {
  it("treats a square canvas as square", () => {
    // Dino-Writes' actual mark is a square canvas.
    expect(logoShape({ width: 512, height: 512 })).toBe("square");
  });

  it("treats a wide wordmark as wide", () => {
    // An Aesthetic Bay style horizontal wordmark.
    expect(logoShape({ width: 1200, height: 400 })).toBe("wide");
  });

  it("keeps a portrait mark in the square slot rather than inventing a third", () => {
    expect(logoShape({ width: 400, height: 1200 })).toBe("square");
  });

  it("does not call a slightly wide mark wide", () => {
    expect(logoShape({ width: 130, height: 100 })).toBe("square");
  });
});
