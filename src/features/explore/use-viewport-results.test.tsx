import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ViewportShopResponse } from "@/src/domain/shops";
import type { CommittedQuery } from "@/src/features/explore/explore-state";
import { AbortedError, type ShopSource } from "@/src/features/explore/shop-source";
import { useViewportResults } from "@/src/features/explore/use-viewport-results";

const bounds = { west: 139.6, south: 35.58, east: 139.85, north: 35.78 };

function queryAt(requestId: number): CommittedQuery {
  return { requestId, bounds, zoom: 11, shopTypes: [] };
}

const EMPTY_RESPONSE: ViewportShopResponse = {
  shops: [],
  truncated: false,
  committedBounds: bounds,
};

/** A source whose in-flight requests are resolved by the test, one at a time. */
function deferredSource() {
  const calls: {
    readonly signal: AbortSignal | undefined;
    readonly resolve: (response: ViewportShopResponse) => void;
    readonly reject: (cause: unknown) => void;
  }[] = [];

  const source: ShopSource = {
    fetchViewport(_request, signal) {
      return new Promise<ViewportShopResponse>((resolve, reject) => {
        calls.push({ signal, resolve, reject });
      });
    },
  };

  return { source, calls };
}

describe("useViewportResults", () => {
  it("reports an unusable catalogue instead of fetching", () => {
    const dispatch = vi.fn();

    renderHook(() => useViewportResults(null, queryAt(1), dispatch));

    expect(dispatch).toHaveBeenCalledWith({ type: "catalogueUnavailable" });
  });

  it("issues exactly one request per committed query", async () => {
    const dispatch = vi.fn();
    const fetchViewport = vi.fn<ShopSource["fetchViewport"]>(
      async () => EMPTY_RESPONSE,
    );
    const source: ShopSource = { fetchViewport };
    const query = queryAt(1);

    const { rerender } = renderHook(
      (props: { query: CommittedQuery }) =>
        useViewportResults(source, props.query, dispatch),
      { initialProps: { query } },
    );

    // The same committed query, re-rendered: nothing new is asked of the source.
    for (let index = 0; index < 5; index += 1) {
      await act(async () => {
        rerender({ query });
      });
    }

    expect(fetchViewport).toHaveBeenCalledTimes(1);
    expect(fetchViewport.mock.calls[0]?.[0]).toMatchObject({ bounds, zoom: 11 });
  });

  it("cancels the request in flight when a newer query is committed", async () => {
    const dispatch = vi.fn();
    const { source, calls } = deferredSource();

    const { rerender } = renderHook(
      (props: { query: CommittedQuery }) =>
        useViewportResults(source, props.query, dispatch),
      { initialProps: { query: queryAt(1) } },
    );

    await act(async () => {
      rerender({ query: queryAt(2) });
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal?.aborted).toBe(true);
    expect(calls[1]?.signal?.aborted).toBe(false);
  });

  /*
   * A cancelled request is not an outage. Nothing is dispatched for it, so the
   * results already on screen stay exactly as they are and no Retry is offered
   * for a request nobody is waiting for.
   */
  it("dispatches nothing for a cancelled request, whichever way it settles", async () => {
    const dispatch = vi.fn();
    const { source, calls } = deferredSource();

    const { rerender } = renderHook(
      (props: { query: CommittedQuery }) =>
        useViewportResults(source, props.query, dispatch),
      { initialProps: { query: queryAt(1) } },
    );

    await act(async () => {
      rerender({ query: queryAt(2) });
    });

    // One source honours the signal by rejecting; another resolves late and
    // unaware. Neither may reach the reducer.
    await act(async () => {
      calls[0]?.reject(new AbortedError());
    });

    expect(dispatch).not.toHaveBeenCalled();

    const late = deferredSource();
    const lateDispatch = vi.fn();
    const lateHook = renderHook(
      (props: { query: CommittedQuery }) =>
        useViewportResults(late.source, props.query, lateDispatch),
      { initialProps: { query: queryAt(1) } },
    );

    await act(async () => {
      lateHook.rerender({ query: queryAt(2) });
    });
    await act(async () => {
      late.calls[0]?.resolve({ ...EMPTY_RESPONSE, truncated: true });
    });

    expect(lateDispatch).not.toHaveBeenCalled();
  });

  it("stamps each response with the request it was issued for", async () => {
    const dispatch = vi.fn();
    const { source, calls } = deferredSource();

    renderHook(() => useViewportResults(source, queryAt(7), dispatch));

    await act(async () => {
      calls[0]?.resolve({ ...EMPTY_RESPONSE, truncated: true });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "resultsLoaded",
      requestId: 7,
      shops: [],
      truncated: true,
    });
  });

  it("reports a genuine failure against its own request", async () => {
    const dispatch = vi.fn();
    const { source, calls } = deferredSource();

    renderHook(() => useViewportResults(source, queryAt(4), dispatch));

    await act(async () => {
      calls[0]?.reject(new Error("upstream failed"));
    });

    expect(dispatch).toHaveBeenCalledWith({ type: "resultsFailed", requestId: 4 });
  });

  it("aborts the outstanding request when the screen unmounts", async () => {
    const dispatch = vi.fn();
    const { source, calls } = deferredSource();

    const { unmount } = renderHook(() =>
      useViewportResults(source, queryAt(1), dispatch),
    );

    await act(async () => {
      unmount();
    });

    expect(calls[0]?.signal?.aborted).toBe(true);
  });
});
