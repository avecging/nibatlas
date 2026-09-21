import type { GeoPoint } from "@/src/domain/geo";
import type { PositionPrecision } from "@/src/domain/shop-detail";

/**
 * Whether a record's coordinate can honestly be drawn.
 *
 * A preview that centres on a coordinate is a claim about where a shop is, so
 * the claim is checked before it is made. Null Island is rejected along with the
 * out-of-range and non-finite cases: `0, 0` is where a record lands when it has
 * no position at all, and drawing a pin in the Gulf of Guinea would be inventing
 * a location rather than omitting one.
 */
export function isMappablePoint(point: GeoPoint | undefined): point is GeoPoint {
  if (!point) {
    return false;
  }

  const { latitude, longitude } = point;

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

/**
 * How closely the preview frames the pin.
 *
 * No coordinate in the catalogue is surveyed. A point placed from a sourced
 * street address can be framed like a street; one that only knows its locality
 * is drawn at a zoom that reads as a district, so the picture says roughly what
 * `positionPrecision` says and the page's own "approximate area only" caution is
 * not contradicted by a map that looks certain.
 */
export const PREVIEW_ZOOM: Record<PositionPrecision, number> = {
  street: 15,
  locality: 11,
};

