"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { FeatureCollection, Point } from "geojson";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type LngLatLike,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { clusterGlyph, markerGlyph } from "@/src/components/map/marker-markup";
import {
  clusterBounds,
  clusterByScreenDistance,
  type MarkerCluster,
} from "@/src/domain/clustering";
import type { Viewport } from "@/src/domain/geo";
import { SHOP_TYPE_LABELS } from "@/src/domain/shop-detail";
import type { ShopMapSummary } from "@/src/domain/shops";
import type { MapStyleProvider } from "@/src/features/map/map-style";
import { configureMapLibreRuntime } from "@/src/features/map/maplibre-runtime";

import styles from "./MapCanvas.module.css";

export interface CameraTarget {
  readonly viewport: Viewport;
  /** A changing token re-runs the camera move even for an identical viewport. */
  readonly token: number;
}

interface MapCanvasProps {
  readonly shops: readonly ShopMapSummary[];
  readonly selectedShopId: string | null;
  readonly initialViewport: Viewport;
  readonly styleProvider: MapStyleProvider;
  readonly cameraTarget: CameraTarget | null;
  readonly onSelectShop: (shopId: string | null) => void;
  /**
   * `user` means a gesture moved the camera and a new search may be offered.
   * `programmatic` means the application or the renderer moved it, so the new
   * camera is adopted without prompting.
   */
  readonly onCameraSettled: (viewport: Viewport, source: CameraMoveSource) => void;
}

export type CameraMoveSource = "user" | "programmatic" | "resize";

const CLUSTER_RADIUS_PX = 46;
const REVEAL_INSET_PX = 72;

/** The adapter still speaks GeoJSON so a tiled source can replace it later. */
export function toFeatureCollection(
  shops: readonly ShopMapSummary[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: shops.map((shop) => ({
      type: "Feature",
      id: shop.id,
      properties: {
        shopId: shop.id,
        name: shop.name,
        localityName: shop.localityName,
        markerState: shop.markerState,
        primaryType: shop.primaryType,
      },
      geometry: {
        type: "Point",
        coordinates: [shop.position.longitude, shop.position.latitude],
      },
    })),
  };
}

function readViewport(map: MapLibreMap): Viewport {
  const bounds = map.getBounds();

  return {
    bounds: {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    },
    zoom: map.getZoom(),
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function markerLabel(shop: ShopMapSummary): string {
  const state =
    shop.markerState === "visited"
      ? "Visited"
      : shop.markerState === "saved"
        ? "Saved"
        : "Not visited";

  return `${shop.name}, ${shop.localityName}. ${SHOP_TYPE_LABELS[shop.primaryType]}. ${state}.`;
}

export function MapCanvas({
  shops,
  selectedShopId,
  initialViewport,
  styleProvider,
  cameraTarget,
  onSelectShop,
  onCameraSettled,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const selectedRef = useRef<string | null>(selectedShopId);
  const shopsRef = useRef<readonly ShopMapSummary[]>(shops);
  const onSelectRef = useRef(onSelectShop);
  const onCameraSettledRef = useRef(onCameraSettled);
  const syncRef = useRef<() => void>(() => {});
  /**
   * Intent of the camera move currently in flight. It is set immediately before
   * the application moves the camera itself and consumed by the next `moveend`,
   * after which it falls back to `user` so an unattributed gesture is never
   * mistaken for an application move.
   */
  const cameraIntent = useRef<CameraMoveSource>("programmatic");

  const [created, setCreated] = useState(false);
  const [failed, setFailed] = useState(false);

  // The GeoJSON projection of the committed result set. Milestone 3 swaps the
  // producer, not this shape.
  const featureCollection = useMemo(() => toFeatureCollection(shops), [shops]);

  // Latest props are mirrored into refs so imperative MapLibre callbacks
  // registered on mount always read current values.
  useEffect(() => {
    selectedRef.current = selectedShopId;
    shopsRef.current = shops;
    onSelectRef.current = onSelectShop;
    onCameraSettledRef.current = onCameraSettled;
  });

  useEffect(() => {
    const container = containerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    let map: MapLibreMap;

    configureMapLibreRuntime();

    try {
      map = new MapLibreMap({
        container,
        style: styleProvider.getStyle(),
        bounds: [
          [initialViewport.bounds.west, initialViewport.bounds.south],
          [initialViewport.bounds.east, initialViewport.bounds.north],
        ],
        attributionControl: styleProvider.attribution
          ? {
              compact: true,
              customAttribution: styleProvider.attribution,
            }
          : { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        maxZoom: 18,
      });
    } catch {
      // MapLibre could not acquire a WebGL context. The list stays authoritative.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }

    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("error", () => {
      // A missing basemap must never break the surrounding experience.
    });

    const reproject = () => syncRef.current();

    map.on("move", reproject);
    map.on("zoom", reproject);
    map.on("resize", reproject);

    // A gesture that interrupts an application move outranks it.
    map.on("movestart", (event) => {
      if ((event as { originalEvent?: unknown }).originalEvent) {
        cameraIntent.current = "user";
      }
    });

    map.on("moveend", () => {
      const source = cameraIntent.current;
      cameraIntent.current = "user";

      onCameraSettledRef.current(readViewport(map), source);
      syncRef.current();
    });

    // A container resize re-frames the same place; it is never user movement.
    map.on("resize", () => {
      cameraIntent.current = "resize";
      onCameraSettledRef.current(readViewport(map), "resize");
    });

    // The renderer resolves the requested bounds against its own aspect ratio,
    // so the resolved camera is reported as soon as the transform exists. This
    // deliberately does not wait for `load`: a basemap that never finishes
    // loading must not strand the rest of the experience.
    requestAnimationFrame(() => {
      if (mapRef.current === map) {
        onCameraSettledRef.current(readViewport(map), "programmatic");
        syncRef.current();
      }
    });

    map.on("click", () => onSelectRef.current(null));

    const markers = markersRef.current;

    setCreated(true);

    return () => {
      for (const marker of markers.values()) {
        marker.remove();
      }
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; data and camera updates run in dedicated effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marker synchronization, including clustering.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !created) {
      return;
    }

    function buildElement(cluster: MarkerCluster, instance: MapLibreMap): HTMLElement {
      const button = document.createElement("button");
      button.type = "button";

      if (cluster.shops.length > 1) {
        button.className = styles.cluster ?? "";
        button.dataset.clusterCount = String(cluster.shops.length);
        button.setAttribute(
          "aria-label",
          `${cluster.shops.length} shops in this area. Zoom in to separate them.`,
        );
        button.innerHTML = `<span class="${styles.markerGlyph}">${clusterGlyph(
          cluster.shops.length,
        )}</span><span class="${styles.clusterCount}" aria-hidden="true">${
          cluster.shops.length
        }</span>`;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          // Expanding a cluster is navigation the user asked for, so the new
          // viewport may offer a fresh search.
          cameraIntent.current = "user";
          const bounds = clusterBounds(cluster);
          instance.fitBounds(
            [
              [bounds.west, bounds.south],
              [bounds.east, bounds.north],
            ],
            {
              padding: 96,
              maxZoom: 17,
              duration: prefersReducedMotion() ? 0 : 400,
            },
          );
        });

        return button;
      }

      const shop = cluster.shops[0] as ShopMapSummary;
      const selected = selectedRef.current === shop.id;

      button.className = [
        styles.marker,
        shop.markerState === "saved" ? styles.markerSaved : null,
        shop.markerState === "visited" ? styles.markerVisited : null,
        selected ? styles.markerSelected : null,
      ]
        .filter(Boolean)
        .join(" ");
      button.dataset.shopId = shop.id;
      button.dataset.markerState = shop.markerState;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.setAttribute("aria-label", markerLabel(shop));
      button.innerHTML = `<span class="${styles.markerGlyph}">${markerGlyph(
        shop.markerState,
        selected,
      )}</span>`;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(shop.id);
      });

      return button;
    }

    const sync = () => {
      const instance = mapRef.current;

      if (!instance) {
        return;
      }

      const clusters = clusterByScreenDistance(
        shopsRef.current,
        (position) => instance.project([position.longitude, position.latitude]),
        CLUSTER_RADIUS_PX,
        { pinned: selectedRef.current },
      );

      const nextKeys = new Set<string>();

      for (const cluster of clusters) {
        const key =
          cluster.shops.length > 1
            ? `${cluster.id}:${cluster.shops.length}`
            : `${cluster.id}:${cluster.shops[0]?.markerState}:${
                selectedRef.current === cluster.shops[0]?.id ? "on" : "off"
              }`;

        nextKeys.add(key);

        const existing = markersRef.current.get(key);
        const lngLat: LngLatLike = [cluster.position.longitude, cluster.position.latitude];

        if (existing) {
          existing.setLngLat(lngLat);
          continue;
        }

        const marker = new Marker({ element: buildElement(cluster, instance), anchor: "center" })
          .setLngLat(lngLat)
          .addTo(instance);

        markersRef.current.set(key, marker);
      }

      for (const [key, marker] of markersRef.current) {
        if (!nextKeys.has(key)) {
          marker.remove();
          markersRef.current.delete(key);
        }
      }
    };

    syncRef.current = sync;
    sync();
  }, [created, featureCollection, selectedShopId]);

  // Reveal the selected shop without resetting the broader viewport.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !created || !selectedShopId) {
      return;
    }

    const shop = shopsRef.current.find((candidate) => candidate.id === selectedShopId);

    if (!shop) {
      return;
    }

    const point = map.project([shop.position.longitude, shop.position.latitude]);
    const canvas = map.getCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    let dx = 0;
    let dy = 0;

    if (point.x < REVEAL_INSET_PX) {
      dx = point.x - REVEAL_INSET_PX;
    } else if (point.x > width - REVEAL_INSET_PX) {
      dx = point.x - (width - REVEAL_INSET_PX);
    }

    if (point.y < REVEAL_INSET_PX) {
      dy = point.y - REVEAL_INSET_PX;
    } else if (point.y > height - REVEAL_INSET_PX) {
      dy = point.y - (height - REVEAL_INSET_PX);
    }

    if (dx !== 0 || dy !== 0) {
      // Revealing a selection is an application move: it must not make the map
      // look as though the user went looking somewhere new.
      cameraIntent.current = "programmatic";
      map.panBy([dx, dy], { duration: prefersReducedMotion() ? 0 : 240 });
    }
  }, [created, selectedShopId]);

  // Destination and shop-search camera moves.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !cameraTarget) {
      return;
    }

    const { bounds } = cameraTarget.viewport;

    cameraIntent.current = "programmatic";

    map.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { duration: prefersReducedMotion() ? 0 : 600, padding: 32, maxZoom: 16 },
    );
  }, [cameraTarget]);

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={styles.canvas}
        data-testid="map-canvas"
        role="region"
        aria-label="Shop map. An equivalent list of the same results is available in the results panel."
      />
      {failed ? (
        <div className={styles.fallback}>
          <div className={styles.fallbackCard}>
            <p className="type-label">Map unavailable</p>
            <p className="type-body-sm">
              The map renderer could not start in this browser. Every result stays
              available in the list.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
