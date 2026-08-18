import type { StyleSpecification } from "maplibre-gl";

/**
 * `MapStyleProvider` keeps the tile supplier separable from the renderer, as
 * `ARCHITECTURE.md` requires. Milestone 1 ships an offline "field journal"
 * basemap so the prototype and its tests never depend on a paid tile key; when
 * `NEXT_PUBLIC_MAPTILER_KEY` is present the MapTiler style is used instead.
 *
 * The offline style deliberately declares no sources. MapLibre parses every
 * tiled source in a web worker, and this application currently has no working
 * worker under the Turbopack build — see `docs/adr/0002-maplibre-worker.md`.
 * A source-free background renders identically with or without it.
 */
export interface MapStyleProvider {
  readonly id: string;
  readonly label: string;
  readonly attribution: string;
  readonly isOffline: boolean;
  getStyle(): StyleSpecification | string;
}

const PAPER = "#fbf8f1";

export function createPaperStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Nib Atlas field journal (offline)",
    sources: {},
    layers: [
      {
        id: "paper",
        type: "background",
        paint: { "background-color": PAPER },
      },
    ],
  };
}

export function createMapStyleProvider(apiKey?: string): MapStyleProvider {
  if (apiKey) {
    return {
      id: "maptiler-nib-atlas",
      label: "MapTiler vector basemap",
      attribution: "\u00a9 MapTiler \u00a9 OpenStreetMap contributors",
      isOffline: false,
      getStyle: () =>
        `https://api.maptiler.com/maps/dataviz-light/style.json?key=${apiKey}`,
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
