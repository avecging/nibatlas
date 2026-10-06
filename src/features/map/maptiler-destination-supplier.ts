import type { DestinationSupplier } from "@/src/features/map/api-destination-geocoder";
import type { DestinationResult } from "@/src/features/map/destination-geocoder";

interface MapTilerFeature {
  id?: unknown;
  text?: unknown;
  place_name?: unknown;
  bbox?: unknown;
  center?: unknown;
  place_type?: unknown;
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    value.every((number) => typeof number === "number" && Number.isFinite(number)) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

/** Keep provider data at this boundary; only validated map frames enter the UI. */
export function projectMapTilerPlace(feature: MapTilerFeature): DestinationResult | null {
  if (typeof feature.id !== "string" || typeof feature.text !== "string" ||
      !feature.text.trim() || !Array.isArray(feature.place_type) ||
      !feature.place_type.some((type) => typeof type === "string")) {
    return null;
  }

  const bbox = feature.bbox;
  const validBounds = Array.isArray(bbox) && bbox.length === 4 &&
    bbox.every((number) => typeof number === "number" && Number.isFinite(number)) &&
    bbox[0] >= -180 && bbox[2] <= 180 && bbox[1] >= -90 && bbox[3] <= 90 &&
    bbox[0] < bbox[2] && bbox[1] < bbox[3];
  const center = isCoordinatePair(feature.center) ? feature.center : null;
  if (!validBounds && !center) return null;

  const bounds = validBounds
    ? { west: bbox[0] as number, south: bbox[1] as number,
        east: bbox[2] as number, north: bbox[3] as number }
    : { west: Math.max(-180, center![0] - 0.02), south: Math.max(-90, center![1] - 0.02),
        east: Math.min(180, center![0] + 0.02), north: Math.min(90, center![1] + 0.02) };
  const context = typeof feature.place_name === "string" && feature.place_name.trim()
    ? feature.place_name
    : feature.text;

  return {
    id: feature.id,
    name: feature.text,
    context,
    viewport: { bounds, zoom: validBounds ? 11 : 12 },
  };
}

export function createMapTilerDestinationSupplier(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): DestinationSupplier {
  return {
    async suggest(query, signal) {
      const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("limit", "5");
      url.searchParams.set("autocomplete", "true");
      url.searchParams.set("types", "country,region,subregion,municipality,municipal_district,locality,neighbourhood,place");
      const response = await fetcher(url.toString(), { signal });
      if (!response.ok) throw new Error("Place search unavailable");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("features" in payload) ||
          !Array.isArray(payload.features)) {
        throw new Error("Invalid place search response");
      }
      return payload.features
        .map((feature: unknown) =>
          feature && typeof feature === "object" ? projectMapTilerPlace(feature) : null)
        .filter((result: DestinationResult | null): result is DestinationResult => result !== null);
    },
  };
}
