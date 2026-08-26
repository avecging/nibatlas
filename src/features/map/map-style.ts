import type { StyleSpecification } from "maplibre-gl";

/**
 * `MapStyleProvider` keeps the tile supplier separable from the renderer, as
 * `ARCHITECTURE.md` requires. Milestone 1 ships an offline "field journal"
 * basemap so automated tests never depend on a paid tile key. Staging and
 * production provide `NEXT_PUBLIC_MAPTILER_KEY` and receive real MapTiler
 * geography. The supplier response remains outside domain state.
 */
export interface MapStyleProvider {
  readonly id: string;
  readonly label: string;
  readonly attribution: string | null;
  readonly isOffline: boolean;
  getStyle(): StyleSpecification | string;
}

const PAPER = "#fbf8f1";
const GRATICULE = "#e5dac7";
const GRATICULE_MAJOR = "rgba(16, 45, 70, 0.18)";

/**
 * A latitude/longitude graticule, built in code so the offline basemap needs no
 * tiles and no key.
 *
 * It is deliberately the only geography the offline style draws: enough
 * orientation to tell where in the world a marker sits, and none of the
 * commercial POI noise `BRAND.md` asks the basemap to keep out of the way.
 */
function graticule(stepDegrees: number): GeoJSON.FeatureCollection {
  const lines: GeoJSON.Feature[] = [];

  for (let longitude = -180; longitude <= 180; longitude += stepDegrees) {
    lines.push({
      type: "Feature",
      properties: { major: longitude % 30 === 0 },
      geometry: {
        type: "LineString",
        coordinates: [
          [longitude, -85],
          [longitude, 0],
          [longitude, 85],
        ],
      },
    });
  }

  for (let latitude = -80; latitude <= 80; latitude += stepDegrees) {
    lines.push({
      type: "Feature",
      properties: { major: latitude % 30 === 0 },
      geometry: {
        type: "LineString",
        coordinates: [
          [-180, latitude],
          [0, latitude],
          [180, latitude],
        ],
      },
    });
  }

  return { type: "FeatureCollection", features: lines };
}

export function createPaperStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Nib Atlas field journal (offline)",
    sources: {
      graticule: { type: "geojson", data: graticule(10) },
      graticuleFine: { type: "geojson", data: graticule(1) },
    },
    layers: [
      {
        id: "paper",
        type: "background",
        paint: { "background-color": PAPER },
      },
      {
        id: "graticule-fine",
        type: "line",
        source: "graticuleFine",
        minzoom: 7,
        paint: {
          "line-color": GRATICULE,
          "line-width": 0.6,
          "line-opacity": 0.7,
        },
      },
      {
        id: "graticule-ten",
        type: "line",
        source: "graticule",
        paint: {
          "line-color": GRATICULE,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 8, 1.4],
        },
      },
      {
        id: "graticule-major",
        type: "line",
        source: "graticule",
        filter: ["==", ["get", "major"], true],
        paint: {
          "line-color": GRATICULE_MAJOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 8, 1.8],
        },
      },
    ],
  };
}

export function createMapStyleProvider(apiKey?: string): MapStyleProvider {
  const key = apiKey?.trim();

  if (key) {
    const styleUrl = new URL(
      "https://api.maptiler.com/maps/dataviz-light/style.json",
    );
    styleUrl.searchParams.set("key", key);

    return {
      id: "maptiler-nib-atlas",
      label: "MapTiler vector basemap",
      // MapTiler's style sources already provide the required attribution.
      // Adding a custom copy would render the legal line twice.
      attribution: null,
      isOffline: false,
      getStyle: () => styleUrl.toString(),
    };
  }

  return {
    id: "nib-atlas-paper",
    label: "Offline field-journal basemap",
    attribution: "Nib Atlas demo basemap \u2014 no tile provider configured",
    isOffline: true,
    getStyle: createPaperStyle,
  };
}
