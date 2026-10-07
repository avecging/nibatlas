import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Viewport } from "@/src/domain/geo";
import { useAutoViewportSearch } from "@/src/features/explore/use-auto-viewport-search";

const tokyo: Viewport = {
  bounds: { west: 139.6, south: 35.58, east: 139.85, north: 35.78 },
  zoom: 11,
};
const kyoto: Viewport = {
  bounds: { west: 135.6, south: 34.9, east: 135.9, north: 35.1 },
  zoom: 12,
};

afterEach(() => vi.useRealTimers());

describe("automatic viewport refresh", () => {
  it("waits 400 ms after the final settled movement and commits only the latest bounds", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result } = renderHook(() => useAutoViewportSearch(dispatch));

    act(() => {
      result.current.schedule(tokyo);
      vi.advanceTimersByTime(300);
      result.current.schedule(kyoto);
      vi.advanceTimersByTime(399);
    });
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "commitSearch", viewport: kyoto });
  });

  it("reframes a pending refresh after a resize or marker-reveal pan", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result } = renderHook(() => useAutoViewportSearch(dispatch));
    act(() => {
      result.current.schedule(tokyo);
      vi.advanceTimersByTime(200);
      expect(result.current.rescheduleIfPending(kyoto)).toBe(true);
      vi.advanceTimersByTime(399);
    });
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledWith({ type: "commitSearch", viewport: kyoto });
    expect(result.current.rescheduleIfPending(tokyo)).toBe(false);
  });

  it("cancels a pending refresh when another gesture begins or the map unmounts", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result, unmount } = renderHook(() => useAutoViewportSearch(dispatch));
    act(() => {
      result.current.schedule(tokyo);
      result.current.cancel();
      vi.advanceTimersByTime(500);
    });
    expect(dispatch).not.toHaveBeenCalled();
    act(() => result.current.schedule(kyoto));
    unmount();
    act(() => vi.advanceTimersByTime(500));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
