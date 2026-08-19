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
