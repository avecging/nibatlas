import { describe, expect, it } from "vitest";

import {
  canPreviewShopLocation,
  isMappablePoint,
  PREVIEW_ZOOM,
} from "@/src/features/map/shop-location";

describe("whether a coordinate can be drawn", () => {
  it("accepts a real position", () => {
    expect(isMappablePoint({ latitude: 35.6721, longitude: 139.7669 })).toBe(true);
  });

  it("rejects Null Island, which is where a record with no position lands", () => {
    expect(isMappablePoint({ latitude: 0, longitude: 0 })).toBe(false);
    // A genuine coordinate on one axis only is still a real place.
    expect(isMappablePoint({ latitude: 0, longitude: 103.85 })).toBe(true);
  });

  it("rejects a missing, non-finite or out-of-range coordinate", () => {
    expect(isMappablePoint(undefined)).toBe(false);
    expect(isMappablePoint({ latitude: Number.NaN, longitude: 139.7 })).toBe(false);
    expect(isMappablePoint({ latitude: 35.6, longitude: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isMappablePoint({ latitude: 91, longitude: 139.7 })).toBe(false);
    expect(isMappablePoint({ latitude: 35.6, longitude: -180.5 })).toBe(false);
  });
});

describe("how closely the preview frames the pin", () => {
  it("draws a locality-only point as an area rather than an address", () => {
    // The page already cautions that the area is approximate; the picture must
    // not contradict it by looking certain.
    expect(PREVIEW_ZOOM.locality).toBeLessThan(PREVIEW_ZOOM.street);
  });
});

describe("whether this build can draw a preview at all", () => {
  const ginza = { latitude: 35.6721, longitude: 139.7669 };

  it("needs both a coordinate worth drawing and a basemap to draw it on", () => {
    expect(canPreviewShopLocation(ginza, "a-tile-key")).toBe(true);
    // No key: the style provider falls back to the offline graticule, which
    // says nothing about a street corner.
    expect(canPreviewShopLocation(ginza, undefined)).toBe(false);
    expect(canPreviewShopLocation(ginza, "   ")).toBe(false);
    expect(canPreviewShopLocation({ latitude: 0, longitude: 0 }, "a-tile-key")).toBe(false);
  });
});
