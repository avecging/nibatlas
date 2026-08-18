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

export function boundsCenter(bounds: ViewportBounds): GeoPoint {
  const latitude = (bounds.south + bounds.north) / 2;
  const longitude = isAntimeridianCrossing(bounds)
    ? normalizeLongitude((bounds.west + bounds.east + 360) / 2)
    : (bounds.west + bounds.east) / 2;

  return { latitude, longitude };
}

export function normalizeLongitude(longitude: number): number {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function containsPoint(bounds: ViewportBounds, point: GeoPoint): boolean {
  if (point.latitude < bounds.south || point.latitude > bounds.north) {
    return false;
  }

  const longitude = normalizeLongitude(point.longitude);

  if (isAntimeridianCrossing(bounds)) {
    return longitude >= bounds.west || longitude <= bounds.east;
  }

  return longitude >= bounds.west && longitude <= bounds.east;
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

/** Approximate diagonal span of a viewport in metres. */
export function boundsSpanMeters(bounds: ViewportBounds): number {
  const southWest = { latitude: bounds.south, longitude: bounds.west };
  const northEast = { latitude: bounds.north, longitude: bounds.east };

  return distanceMeters(southWest, northEast);
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
