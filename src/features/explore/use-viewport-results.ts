"use client";

import { useEffect, type Dispatch } from "react";

import type { CommittedQuery, ExploreAction } from "@/src/features/explore/explore-state";
import {
  AbortedError,
  PROTOTYPE_RESULT_CAP,
  type ShopSource,
} from "@/src/features/explore/shop-source";
import { noopTelemetry } from "@/src/features/map/telemetry";

/**
 * The one place the map reads catalogue data.
 *
 * The screen is handed a `ShopSource` and never fetches itself, which is what
 * lets fixture and API modes run the same interaction model. Four behaviours
 * live here, and each one is a stated Milestone 3 requirement:
 *
 * - **No request storm.** The committed query is the only dependency. Panning,
 *   zooming, adopting the renderer's own camera, and any filter the loaded set
 *   can answer never change it, so a continuous drag issues no requests at all.
 *   The guard is structural rather than a debounce, so there is no window in
 *   which a fast gesture can still slip a request through.
 * - **Cancellation.** A commit landing while an earlier one is in flight aborts
 *   it through the effect's own cleanup, and cancellation is classified as
 *   control flow: no error is raised for a request nobody is waiting for.
 * - **Stale rejection.** Each dispatch carries the `requestId` it was issued
 *   for, and the reducer discards one that is no longer current — so a slow
 *   response cannot overwrite fresher results, and the results already on
 *   screen stay usable throughout.
 * - **An unusable catalogue.** A `null` source is a mode that cannot be asked,
 *   reported as `unavailable` rather than as an empty area or a failed request.
 */
export function useViewportResults(
  shopSource: ShopSource | null,
  query: CommittedQuery,
  dispatch: Dispatch<ExploreAction>,
): void {
  useEffect(() => {
    if (shopSource === null) {
      dispatch({ type: "catalogueUnavailable" });
      return;
    }

    const controller = new AbortController();

    void shopSource
      .fetchViewport(
        {
          bounds: query.bounds,
          zoom: query.zoom,
          shopTypes: query.shopTypes,
          // The client's page size in either mode. It is well inside the read
          // API's own `1..500`, so a dense viewport comes back truncated and
          // says so rather than arriving as a payload nobody can read.
          limit: PROTOTYPE_RESULT_CAP,
        },
        controller.signal,
      )
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        dispatch({
          type: "resultsLoaded",
          requestId: query.requestId,
          shops: response.shops,
          truncated: response.truncated,
        });
        noopTelemetry.record("map_view_committed", {
          zoom: Math.round(query.zoom),
          resultCount: response.shops.length,
          truncated: response.truncated,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof AbortedError || controller.signal.aborted) {
          return;
        }

        dispatch({ type: "resultsFailed", requestId: query.requestId });
      });

    return () => controller.abort();
  }, [dispatch, query, shopSource]);
}
