import { Suspense } from "react";

import { ExploreScreen } from "@/src/features/explore/ExploreScreen";

export default function MapPage() {
  return (
    <Suspense fallback={<p style={{ padding: "1rem" }}>Loading the map…</p>}>
      <ExploreScreen />
    </Suspense>
  );
}
