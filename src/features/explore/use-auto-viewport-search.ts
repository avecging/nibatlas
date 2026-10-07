"use client";

import { useCallback, useEffect, useRef, type Dispatch } from "react";

import type { Viewport } from "@/src/domain/geo";
import type { ExploreAction } from "@/src/features/explore/explore-state";

const SETTLE_DELAY_MS = 400;

/** One trailing refresh per settled gesture; a new gesture cancels the timer. */
export function useAutoViewportSearch(dispatch: Dispatch<ExploreAction>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback((viewport: Viewport) => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      dispatch({ type: "commitSearch", viewport });
    }, SETTLE_DELAY_MS);
  }, [cancel, dispatch]);

  const rescheduleIfPending = useCallback((viewport: Viewport): boolean => {
    if (timer.current === null) return false;
    schedule(viewport);
    return true;
  }, [schedule]);

  useEffect(() => cancel, [cancel]);

  return { schedule, cancel, rescheduleIfPending };
}
