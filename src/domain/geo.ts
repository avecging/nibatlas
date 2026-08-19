export type CountryCode = "SG" | "JP" | "TW";

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface ViewportBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface Viewport {
  readonly bounds: ViewportBounds;
  readonly zoom: number;
}

export function isAntimeridianCrossing(bounds: ViewportBounds): boolean {
  return bounds.west > bounds.east;
}

/**
 * Wraps a longitude into `[-180, 180)`.
 *
 * `180` and `-180` are the same meridian; this function returns `-180` for
 * both so the result is a single canonical value. Never compare wrapped
 * longitudes directly across the antimeridian — use `longitudeDelta` or
 * `containsPoint`, which work in offsets rather than absolute values.
 */
export function normalizeLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

/** Shortest signed east-positive angle from one longitude to another, in `[-180, 180)`. */
export function longitudeDelta(from: number, to: number): number {
  return normalizeLongitude(to - from);
}

/**
 * Width of a viewport in degrees, going east from `west`.
 *
 * Handles both forms MapLibre produces: wrapped bounds where `west > east`
 * because the viewport crosses the antimeridian, and unwrapped bounds where
 * `east` runs past 180 — or past 360 at world zoom.
 */
export function longitudeSpan(bounds: ViewportBounds): number {
  const raw = bounds.east - bounds.west;

  return raw < 0 ? raw + 360 : raw;
}

export function boundsCenter(bounds: ViewportBounds): GeoPoint {
  return {
    latitude: (bounds.south + bounds.north) / 2,
    longitude: normalizeLongitude(bounds.west + longitudeSpan(bounds) / 2),
  };
}

export function containsPoint(bounds: ViewportBounds, point: GeoPoint): boolean {
  if (point.latitude < bounds.south || point.latitude > bounds.north) {
    return false;
  }

  const span = longitudeSpan(bounds);

  // A viewport at world zoom covers every meridian.
  if (span >= 360) {
    return true;
  }

  // Measured as an eastward offset from `west`, so the antimeridian, an
  // unwrapped `east`, and an exact 180 all fall out of the same arithmetic.
  const offset = ((point.longitude - bounds.west) % 360 + 360) % 360;

  return offset <= span;
}

const EARTH_RADIUS_M = 6_371_008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in metres. Used for demo sorting and movement thresholds. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(normalizeLongitude(b.longitude - a.longitude));

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const METERS_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_M;

/**
 * Approximate diagonal span of a viewport in metres.
 *
 * Derived from the degree spans rather than a corner-to-corner great-circle
 * distance, because a corner measurement collapses across the antimeridian and
 * saturates at world zoom, both of which would shrink the movement threshold.
 */
export function boundsSpanMeters(bounds: ViewportBounds): number {
  const midLatitude = (bounds.south + bounds.north) / 2;
  const horizontal =
    Math.min(longitudeSpan(bounds), 360) *
    METERS_PER_DEGREE *
    Math.cos(toRadians(midLatitude));
  const vertical = (bounds.north - bounds.south) * METERS_PER_DEGREE;

  return Math.hypot(horizontal, vertical);
}

export interface MovementThreshold {
  /** Fraction of the committed viewport span the centre may drift before a new search is offered. */
  readonly centerDriftRatio: number;
  /** Absolute zoom-level change that always offers a new search. */
  readonly zoomDelta: number;
}

export const DEFAULT_MOVEMENT_THRESHOLD: MovementThreshold = {
  centerDriftRatio: 0.25,
  zoomDelta: 1,
};

/**
 * `Search this area` must appear only after meaningful movement, never on every
 * frame or every `moveend`. Movement is meaningful when the camera centre has
 * drifted a noticeable fraction of the committed viewport, when the zoom level
 * has changed by a whole step, or when the camera no longer overlaps the
 * committed centre.
 */
export function hasMovedMeaningfully(
  committed: Viewport,
  camera: Viewport,
  threshold: MovementThreshold = DEFAULT_MOVEMENT_THRESHOLD,
): boolean {
  if (Math.abs(camera.zoom - committed.zoom) >= threshold.zoomDelta) {
    return true;
  }

  const committedCenter = boundsCenter(committed.bounds);
  const cameraCenter = boundsCenter(camera.bounds);

  if (!containsPoint(camera.bounds, committedCenter)) {
    return true;
  }

  const drift = distanceMeters(committedCenter, cameraCenter);
  const span = boundsSpanMeters(committed.bounds);

  if (span === 0) {
    return drift > 0;
  }

  return drift / span >= threshold.centerDriftRatio;
}
