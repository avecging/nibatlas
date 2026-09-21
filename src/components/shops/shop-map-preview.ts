import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapLibreMap, Marker } from "maplibre-gl";

import { markerGlyph } from "@/src/components/map/marker-markup";
import type { MapStyleProvider } from "@/src/features/map/map-style";
import { configureMapLibreRuntime } from "@/src/features/map/maplibre-runtime";

/**
 * The renderer half of the location preview, behind a dynamic import.
 *
 * MapLibre's stylesheet is imported here rather than in the component so it
 * travels in the same lazily-fetched chunk as the renderer. Imported from the
 * component it would be a render-blocking stylesheet on every shop page — 83 KB
 * of it — including the builds with no tile key, where the preview never draws
 * anything at all.
 */
export interface ShopMapPreviewOptions {
  readonly container: HTMLElement;
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly styleProvider: MapStyleProvider;
  /** The class carrying the catalogue's marker colour and 44 px box. */
  readonly pinClassName: string;
}

export function createShopMapPreview({
  container,
  center,
  zoom,
  styleProvider,
  pinClassName,
}: ShopMapPreviewOptions): MapLibreMap {
  configureMapLibreRuntime();

  const map = new MapLibreMap({
    container,
    style: styleProvider.getStyle(),
    center: [center[0], center[1]],
    zoom,
    // Every handler off: a preview must not compete with the page scroll.
    interactive: false,
    attributionControl: styleProvider.attribution
      ? { compact: true, customAttribution: styleProvider.attribution }
      : { compact: true },
  });

  /*
   * MapLibre 6 does not throw when WebGL is unavailable.
   *
   * `_setupPainter` reports a `GPUInitializationError` through the error event
   * and returns, leaving a partially initialised instance with no painter. The
   * caller's `try`/`catch` would only notice by accident, when some later call
   * happened to dereference the missing renderer — a guarantee that would
   * disappear the moment that call moved. `MapCanvas` makes the same check
   * deliberately; so does this.
   */
  if (!(map as { painter?: unknown }).painter) {
    try {
      map.remove();
    } catch {
      /* A partial instance may not support removal. */
    }

    throw new Error("MapLibre could not initialise a renderer");
  }

  // A basemap that will not load must never break the page around it.
  map.on("error", () => {});

  const pin = document.createElement("span");

  pin.className = pinClassName;
  pin.innerHTML = markerGlyph("unvisited", false);

  new Marker({ element: pin }).setLngLat([center[0], center[1]]).addTo(map);

  return map;
}
