"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeLongitude, type GeoPoint, type Viewport } from "@/src/domain/geo";
import { foregroundPosition } from "@/src/features/collection/foreground-position";

/** Round before any map state, URL, provider request or return-context storage. */
export function nearbyViewport(point: GeoPoint): Viewport | null {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)
    || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) return null;
  const latitude = Math.round(Math.max(-84.9, Math.min(84.9, point.latitude)) * 100) / 100;
  const longitude = Math.round(normalizeLongitude(point.longitude) * 100) / 100;
  const longitudePadding = 0.025 / Math.max(0.1, Math.cos(latitude * Math.PI / 180));
  return {
    bounds: {
      west: longitude - longitudePadding, east: longitude + longitudePadding,
      south: latitude - 0.025, north: latitude + 0.025,
    },
    zoom: 13,
  };
}

export function useNearMe(onLocated: (viewport: Viewport) => void) {
  const [status, setStatus] = useState<"idle" | "explaining" | "locating" | "error">("idle");
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => () => { active.current?.abort(); }, []);

  const locate = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStatus("locating");
    const result = await foregroundPosition(controller.signal);
    if (active.current !== controller || controller.signal.aborted) return;
    active.current = null;
    const viewport = result.ok ? nearbyViewport(result.position) : null;
    if (viewport) {
      setStatus("idle");
      onLocated(viewport);
    } else {
      setStatus("error");
      setMessage(!result.ok && result.code === "permission_denied"
        ? "Location access is off. Allow it in your browser settings, or search for a place."
        : "We couldn’t find your location. Try again, or search for a place.");
    }
  }, [onLocated]);

  return { status, message, explain: () => setStatus("explaining"), locate, cancel };
}
