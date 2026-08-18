import { describe, expect, it } from "vitest";

import {
  boundsCenter,
  containsPoint,
  distanceMeters,
  hasMovedMeaningfully,
  normalizeLongitude,
} from "@/src/domain/geo";

const tokyo = { bounds: { west: 139.6, south: 35.58, east: 139.85, north: 35.78 }, zoom: 11 };

describe("viewport geometry", () => {
  it("finds the centre of ordinary bounds", () => {
    expect(boundsCenter(tokyo.bounds)).toEqual({ latitude: 35.68, longitude: 139.725 });
  });

  it("finds the centre across the antimeridian", () => {
    const centre = boundsCenter({ west: 170, south: -10, east: -170, north: 10 });

    expect(centre.longitude).toBeCloseTo(180, 5);
  });

  it("normalizes longitudes into range", () => {
    expect(normalizeLongitude(200)).toBeCloseTo(-160, 6);
    expect(normalizeLongitude(-190)).toBeCloseTo(170, 6);
  });

  it("tests containment including antimeridian bounds", () => {
    expect(containsPoint(tokyo.bounds, { latitude: 35.68, longitude: 139.7 })).toBe(true);
    expect(containsPoint(tokyo.bounds, { latitude: 35.68, longitude: 135 })).toBe(false);
    expect(
      containsPoint({ west: 170, south: -10, east: -170, north: 10 }, {
        latitude: 0,
        longitude: 179,
      }),
    ).toBe(true);
    expect(
      containsPoint({ west: 170, south: -10, east: -170, north: 10 }, {
        latitude: 0,
        longitude: 100,
      }),
    ).toBe(false);
  });

  it("measures distance between two points", () => {
    const metres = distanceMeters(
      { latitude: 1.2903, longitude: 103.8519 },
      { latitude: 1.3005, longitude: 103.8559 },
    );

    expect(metres).toBeGreaterThan(1000);
    expect(metres).toBeLessThan(1400);
  });
});

describe("hasMovedMeaningfully", () => {
  it("ignores an unchanged camera", () => {
    expect(hasMovedMeaningfully(tokyo, tokyo)).toBe(false);
  });

  it("ignores a small nudge inside the threshold", () => {
    const nudged = {
      bounds: { west: 139.601, south: 35.581, east: 139.851, north: 35.781 },
      zoom: 11,
    };

    expect(hasMovedMeaningfully(tokyo, nudged)).toBe(false);
  });

  it("detects a whole zoom step", () => {
    expect(hasMovedMeaningfully(tokyo, { ...tokyo, zoom: 12 })).toBe(true);
  });

  it("detects a pan to another city", () => {
    const kyoto = {
      bounds: { west: 135.68, south: 34.94, east: 135.83, north: 35.08 },
      zoom: 11,
    };

    expect(hasMovedMeaningfully(tokyo, kyoto)).toBe(true);
  });
});
