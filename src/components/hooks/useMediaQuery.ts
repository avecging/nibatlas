"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Mobile-first: the server snapshot is always `false`, so the mobile layout is
 * the rendered baseline and desktop upgrades on hydration.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }

      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);

      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }

    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
