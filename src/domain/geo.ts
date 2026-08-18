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

export function isAntimeridianCrossing(bounds: ViewportBounds): boolean {
  return bounds.west > bounds.east;
}
