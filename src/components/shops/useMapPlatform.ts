"use client";

import { useSyncExternalStore } from "react";

import { detectMapPlatform, type MapPlatform } from "@/src/components/shops/directions";

/**
 * The platform's own maps application, read once per document.
 *
 * The platform never changes for a document, so this is a read of the
 * environment rather than state: the server snapshot is the universal fallback,
 * which works everywhere, and hydration upgrades it to the native handoff. That
 * keeps the two renders in agreement instead of correcting one after paint.
 *
 * Shared by the action row and the location preview so a single document cannot
 * disagree with itself about which application Directions opens.
 */
const NO_SUBSCRIPTION = () => () => {};

export function useMapPlatform(): MapPlatform {
  return useSyncExternalStore(
    NO_SUBSCRIPTION,
    () => detectMapPlatform(window.navigator.userAgent),
    () => "other" as const,
  );
}
