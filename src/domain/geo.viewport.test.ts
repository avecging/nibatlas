import { describe, expect, it } from "vitest";

import {
  boundsCenter,
  boundsSpanMeters,
  containsPoint,
  distanceMeters,
  hasMovedMeaningfully,
  longitudeDelta,
  longitudeSpan,
  normalizeLongitude,
} from "@/src/domain/geo";

const tokyo = { bounds: { west: 139.6, south: 35.58, east: 139.85, north: 35.78 }, zoom: 11 };

describe("viewport geometry", () => {
  it("finds the centre of ordinary bounds", () => {
    const centre = boundsCenter(tokyo.bounds);

    expect(centre.latitude).toBeCloseTo(35.68, 9);
    expect(centre.longitude).toBeCloseTo(139.725, 9);
  });

  it("finds the centre across the antimeridian", () => {
    const centre = boundsCenter({ west: 170, south: -10, east: -170, north: 10 });

    // 180 and -180 are the same meridian; -180 is the canonical wrapped value.
    expect(centre.longitude).toBeCloseTo(-180, 9);
    expect(centre.latitude).toBeCloseTo(0, 9);
  });

  it("finds the centre of an unwrapped world viewport", () => {
    expect(boundsCenter({ west: -400, south: -60, east: 400, north: 60 }).longitude).toBeCloseTo(
      0,
      9,
    );
  });

  it("normalizes longitudes into a single canonical range", () => {
    expect(normalizeLongitude(200)).toBeCloseTo(-160, 9);
    expect(normalizeLongitude(-190)).toBeCloseTo(170, 9);
    expect(normalizeLongitude(0)).toBe(0);
    // Both forms of the antimeridian collapse onto one value.
    expect(normalizeLongitude(180)).toBe(-180);
    expect(normalizeLongitude(-180)).toBe(-180);
    expect(normalizeLongitude(540)).toBe(-180);
  });

  it("measures the shortest signed delta between longitudes", () => {
    expect(longitudeDelta(179, -179)).toBeCloseTo(2, 9);
    expect(longitudeDelta(-179, 179)).toBeCloseTo(-2, 9);
    expect(longitudeDelta(10, 20)).toBeCloseTo(10, 9);
    expect(longitudeDelta(-170, 170)).toBeCloseTo(-20, 9);
  });

  it("measures viewport width in both wrapped and unwrapped forms", () => {
    expect(longitudeSpan({ west: 96, south: 0, east: 149, north: 1 })).toBeCloseTo(53, 9);
    expect(longitudeSpan({ west: 170, south: 0, east: -170, north: 1 })).toBeCloseTo(20, 9);
    expect(longitudeSpan({ west: 170, south: 0, east: 190, north: 1 })).toBeCloseTo(20, 9);
    expect(longitudeSpan({ west: -400, south: 0, east: 400, north: 1 })).toBeCloseTo(800, 9);
  });

  it("tests containment for ordinary bounds", () => {
    expect(containsPoint(tokyo.bounds, { latitude: 35.68, longitude: 139.7 })).toBe(true);
    expect(containsPoint(tokyo.bounds, { latitude: 35.68, longitude: 135 })).toBe(false);
    expect(containsPoint(tokyo.bounds, { latitude: 10, longitude: 139.7 })).toBe(false);
  });

  it("tests containment across the antimeridian in wrapped form", () => {
    const crossing = { west: 170, south: -10, east: -170, north: 10 };

    expect(containsPoint(crossing, { latitude: 0, longitude: 179 })).toBe(true);
    expect(containsPoint(crossing, { latitude: 0, longitude: -179 })).toBe(true);
    expect(containsPoint(crossing, { latitude: 0, longitude: 180 })).toBe(true);
    expect(containsPoint(crossing, { latitude: 0, longitude: -180 })).toBe(true);
    expect(containsPoint(crossing, { latitude: 0, longitude: 100 })).toBe(false);
    expect(containsPoint(crossing, { latitude: 0, longitude: -100 })).toBe(false);
  });

  it("tests containment across the antimeridian in unwrapped form", () => {
    // MapLibre reports a viewport panned past 180 as west 170, east 190.
    const unwrapped = { west: 170, south: -10, east: 190, north: 10 };

    expect(containsPoint(unwrapped, { latitude: 0, longitude: 179 })).toBe(true);
    expect(containsPoint(unwrapped, { latitude: 0, longitude: -179 })).toBe(true);
    expect(containsPoint(unwrapped, { latitude: 0, longitude: 160 })).toBe(false);
  });

  it("includes an exact 180 in bounds that stop there", () => {
    expect(containsPoint({ west: 170, south: -10, east: 180, north: 10 }, {
      latitude: 0,
      longitude: 180,
    })).toBe(true);
    expect(containsPoint({ west: -180, south: -10, east: -170, north: 10 }, {
      latitude: 0,
      longitude: -180,
    })).toBe(true);
  });

  it("treats a world viewport as containing every meridian", () => {
    const world = { west: -400, south: -80, east: 400, north: 80 };

    for (const longitude of [-179, -90, 0, 90, 179]) {
      expect(containsPoint(world, { latitude: 0, longitude })).toBe(true);
    }
  });

  it("keeps the viewport span finite and non-collapsing near the antimeridian", () => {
    const crossing = boundsSpanMeters({ west: 170, south: -1, east: -170, north: 1 });
    const equivalent = boundsSpanMeters({ west: 10, south: -1, east: 30, north: 1 });

    expect(crossing).toBeCloseTo(equivalent, 0);
    expect(boundsSpanMeters({ west: -400, south: -60, east: 400, north: 60 })).toBeGreaterThan(
      crossing,
    );
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
