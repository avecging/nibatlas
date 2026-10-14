"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { directionsHref } from "@/src/components/shops/directions";
import { useMapPlatform } from "@/src/components/shops/useMapPlatform";
import { ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { createMapStyleProvider } from "@/src/features/map/map-style";
import { isMappablePoint, PREVIEW_ZOOM } from "@/src/features/map/shop-location";
import { noopTelemetry } from "@/src/features/map/telemetry";

import styles from "./ShopLocationMap.module.css";

/** Start fetching the renderer before the frame is on screen, not after. */
const PREFETCH_MARGIN = "400px";

/**
 * Where the shop is, as a still picture of the map.
 *
 * A preview, not the map screen. It is built on the renderer and the style
 * provider the Map already uses — so a keyed deployment gets the same MapTiler
 * basemap, an unkeyed one would get the same offline paper style, and the
 * licence attribution arrives the way it already does — but every interaction
 * handler is off. `interactive: false` disables drag, scroll zoom, double-tap
 * and keyboard panning in one option, so the preview can never swallow a page
 * scroll on a phone, and nothing about the camera can drift from the coordinate
 * the record actually holds.
 *
 * The renderer and its stylesheet are fetched only when the frame comes near
 * the viewport. It sits well below the fold on a phone, and MapLibre is 140 KB
 * compressed: a reader who never scrolls that far should not pay for it.
 *
 * The preview draws wherever the record has a coordinate, and does not ask
 * whether a tile key is configured. Hiding the whole section when the key is
 * missing made the one failure worth noticing — a key that did not reach the
 * bundle — completely invisible, which is precisely when someone is looking for
 * it. A deployment without a key falls back to the offline field-journal style,
 * which is a graticule and so nearly bare at street zoom; that is a visible,
 * diagnosable state rather than a silent absence, and it only happens in
 * development, since staging and production both supply the key.
 *
 * Rendering unconditionally also means the ordinary gates exercise this: the
 * axe scan, the interaction journeys and the visual breakpoints all run without
 * a key, and would have skipped the preview entirely otherwise.
 *
 * The map is decoration over the address, never a substitute for it. A record
 * with no mappable coordinate, a renderer that will not start, and a basemap
 * that will not load all leave the address and the directions link untouched.
 */
export function ShopLocationMap({ shop }: { readonly shop: ShopDetail }) {
  const platform = useMapPlatform();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  /*
   * Where there is no observer to ask — the server, and jsdom — the renderer is
   * simply wanted. Nothing rendered depends on this, so the server and the
   * client can disagree about it without a hydration mismatch.
   */
  const [wanted, setWanted] = useState(() => typeof IntersectionObserver === "undefined");

  const styleProvider = useMemo(
    () => createMapStyleProvider(process.env.NEXT_PUBLIC_MAPTILER_KEY),
    [],
  );
  const point = isMappablePoint(shop.position) ? shop.position : null;

  const latitude = point?.latitude;
  const longitude = point?.longitude;
  const zoom = PREVIEW_ZOOM[shop.positionPrecision];

  useEffect(() => {
    const frame = frameRef.current;

    if (wanted || !frame) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setWanted(true);
        }
      },
      { rootMargin: PREFETCH_MARGIN },
    );

    observer.observe(frame);

    return () => observer.disconnect();
  }, [wanted]);

  useEffect(() => {
    const container = containerRef.current;

    if (!wanted || latitude === undefined || longitude === undefined || !container) {
      return;
    }

    let map: MapLibreMap | null = null;
    let cancelled = false;

    /*
     * The renderer arrives asynchronously, so the reader may have navigated
     * away before it does. There is no await between creating the map and the
     * check below, so an instance can never be created and then orphaned.
     */
    void (async () => {
      try {
        const { createShopMapPreview } = await import(
          "@/src/components/shops/shop-map-preview"
        );

        if (cancelled) {
          return;
        }

        map = createShopMapPreview({
          container,
          center: [longitude, latitude],
          zoom,
          styleProvider,
          pinClassName: styles.pin ?? "",
        });

        if (cancelled) {
          map.remove();
          map = null;
          return;
        }

        // A later attempt may succeed where an earlier one did not.
        setFailed(false);
      } catch {
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
        /* Teardown is best effort; a partial instance may not support it. */
      }
    };
  }, [wanted, latitude, longitude, zoom, styleProvider]);

  if (!point) {
    // No coordinate this record can stand behind: the address speaks for itself.
    return null;
  }

  return (
    <div className={styles.location}>
      <div className={styles.frame} ref={frameRef} data-testid="shop-location-map">
        {/*
          The picture carries no information the address below does not already
          state in words, so it is not announced twice. MapLibre's attribution
          control stays inside it and reachable.
        */}
        <div className={styles.canvas} ref={containerRef} />
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
