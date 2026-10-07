"use client";

import { useEffect, useRef, type Dispatch } from "react";

import type { CommittedQuery, ExploreAction } from "@/src/features/explore/explore-state";
import {
  AbortedError,
  type ShopSource,
} from "@/src/features/explore/shop-source";
import { noopTelemetry } from "@/src/features/map/telemetry";
import type { ViewportShopResponse } from "@/src/domain/shops";

const CACHE_MS = 30_000;
const CACHE_SIZE = 8;

/**
 * The one place the map reads catalogue data.
 *
 * The screen is handed a `ShopSource` and never fetches itself, which is what
 * lets fixture and API modes run the same interaction model. Four behaviours
 * live here, and each one is a stated Milestone 3 requirement:
 *
 * - **No request storm.** Only committed queries run here. The screen debounces
 *   settled camera moves and never commits a continuous drag.
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
  const cache = useRef(new Map<string, { response: ViewportShopResponse; expires: number }>());
  const cachedSource = useRef(shopSource);

  useEffect(() => {
    if (cachedSource.current !== shopSource) {
      cache.current.clear();
      cachedSource.current = shopSource;
    }
    if (shopSource === null) {
      dispatch({ type: "catalogueUnavailable" });
      return;
    }

    const key = JSON.stringify([query.bounds, query.zoom, query.shopTypes]);
    const cached = cache.current.get(key);
    if (cached && cached.expires > Date.now()) {
      dispatch({ type: "resultsLoaded", requestId: query.requestId,
        shops: cached.response.shops, truncated: cached.response.truncated });
      return;
    }
    cache.current.delete(key);

    const controller = new AbortController();

    void shopSource
      .fetchViewport(
        {
          bounds: query.bounds,
          zoom: query.zoom,
          shopTypes: query.shopTypes,
          // Use the public endpoint cap. A dense area reports truncation rather
          // than quietly showing only the first 20 shops.
          limit: 500,
        },
        controller.signal,
      )
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        cache.current.set(key, { response, expires: Date.now() + CACHE_MS });
        if (cache.current.size > CACHE_SIZE) cache.current.delete(cache.current.keys().next().value!);
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
