import type { Metadata } from "next";
import { Suspense } from "react";

import { ExploreScreen } from "@/src/features/explore/ExploreScreen";

export const metadata: Metadata = {
  title: "Saved shops",
  description: "Every shop you have saved, across all locations, on the map.",
};

/**
 * Saved is a mode Map owns, not a primary destination.
 *
 * It gets its own route so the browser Back button leaves Saved before leaving
 * Map, and so a saved shop is linkable — but the screen, the map, and the
 * navigation are Map's.
 */
export default function SavedModePage() {
  return (
    <Suspense fallback={<p style={{ padding: "1rem" }}>Loading saved shops…</p>}>
      <ExploreScreen mode="saved" />
    </Suspense>
  );
}
