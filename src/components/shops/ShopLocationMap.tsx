"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { markerGlyph } from "@/src/components/map/marker-markup";
import { directionsHref } from "@/src/components/shops/directions";
import { useMapPlatform } from "@/src/components/shops/useMapPlatform";
import { ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { createMapStyleProvider } from "@/src/features/map/map-style";
import { canPreviewShopLocation, PREVIEW_ZOOM } from "@/src/features/map/shop-location";
import { noopTelemetry } from "@/src/features/map/telemetry";

import styles from "./ShopLocationMap.module.css";

/**
 * Where the shop is, as a still picture of the map.
 *
 * A preview, not the map screen. It is built on the renderer and the style
 * provider the Map already uses — so a keyed deployment gets the same MapTiler
 * basemap, an unkeyed one gets the same offline paper style, and the licence
 * attribution arrives the way it already does — but every interaction handler is
 * off. `interactive: false` disables drag, scroll zoom, double-tap and keyboard
 * panning in one option, so the preview can never swallow a page scroll on a
 * phone, and nothing about the camera can drift from the coordinate the record
 * actually holds.
 *
 * MapLibre is loaded on demand rather than imported into the shop route: a
 * reader who never opens a shop page should not pay for a renderer, and a shop
 * with no usable coordinate does not load one either.
 *
 * A build with no tile key has no geography to draw at this zoom. The offline
 * field-journal style is a graticule, which orients a world map and says
 * nothing at all about a street corner, so the preview is omitted rather than
 * framed around a blank sheet — the address below already answers the question,
 * and an empty box would read as a broken map rather than an absent one.
 *
 * The map is decoration over the address, never a substitute for it. A record
 * with no mappable coordinate, a renderer that will not start, and a basemap
 * that will not load all leave the address and the directions link untouched
 * below — see `ShopDetailView`, which renders them whatever this returns.
 */
export function ShopLocationMap({ shop }: { readonly shop: ShopDetail }) {
  const platform = useMapPlatform();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  const styleProvider = useMemo(
    () => createMapStyleProvider(process.env.NEXT_PUBLIC_MAPTILER_KEY),
    [],
  );
  const point = canPreviewShopLocation(shop.position, process.env.NEXT_PUBLIC_MAPTILER_KEY)
    ? shop.position
    : null;

  const latitude = point?.latitude;
  const longitude = point?.longitude;
  const zoom = PREVIEW_ZOOM[shop.positionPrecision];

  useEffect(() => {
    const container = containerRef.current;

    if (latitude === undefined || longitude === undefined || !container) {
      return;
    }

    let map: MapLibreMap | null = null;
    let cancelled = false;

    /*
     * The renderer arrives asynchronously, so every step re-checks whether the
     * reader has already navigated away: a map created for a shop that is no
     * longer on screen is torn down rather than left attached.
     */
    void (async () => {
      try {
        const [maplibre, runtime] = await Promise.all([
          import("maplibre-gl"),
          import("@/src/features/map/maplibre-runtime"),
        ]);

        if (cancelled) {
          return;
        }

        runtime.configureMapLibreRuntime();

        map = new maplibre.Map({
          container,
          style: styleProvider.getStyle(),
          center: [longitude, latitude],
          zoom,
          // Every handler off: a preview must not compete with the page scroll.
          interactive: false,
          attributionControl: styleProvider.attribution
            ? { compact: true, customAttribution: styleProvider.attribution }
            : { compact: true },
        });

        // A basemap that will not load must never break the page around it.
        map.on("error", () => {});

        const pin = document.createElement("span");

        pin.className = styles.pin ?? "";
        pin.innerHTML = markerGlyph("unvisited", false);

        new maplibre.Marker({ element: pin })
          .setLngLat([longitude, latitude])
          .addTo(map);

        if (cancelled) {
          map.remove();
          map = null;
        }
      } catch {
        try {
          map?.remove();
        } catch {
          /* A partially initialized instance may not support removal. */
        }

        map = null;
        container.replaceChildren();

        if (!cancelled) {
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;

      try {
        map?.remove();
      } catch {
        /* As above: teardown is best effort. */
      }
    };
  }, [latitude, longitude, zoom, styleProvider]);

  if (!point) {
    // No coordinate this record can stand behind, or no basemap to draw it on:
    // either way the address below speaks for itself.
    return null;
  }

  return (
    <div className={styles.location}>
      <div className={styles.frame} data-testid="shop-location-map">
        {/*
          The picture carries no information the address below does not already
          state in words, so it is not announced twice. MapLibre's attribution
          control stays inside and reachable.
        */}
        <div className={styles.canvas} ref={containerRef} aria-hidden={failed} />
        {failed ? (
          <p className={styles.unavailable}>
            <Icon name="alert" size={16} />
            <span>Map preview unavailable.</span>
          </p>
        ) : null}
      </div>

      <ButtonLink
        href={directionsHref(shop, platform)}
        variant="quiet"
        external
        onClick={() =>
          noopTelemetry.record("directions_opened", { shopSlug: shop.slug })
        }
      >
        <Icon name="directions" size={18} />
        Get directions
      </ButtonLink>
    </div>
  );
}
