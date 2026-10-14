import { describe, expect, it, vi } from "vitest";

import { createCatalogueAdapters } from "@/src/features/catalogue/catalogue-adapters";
import { resolveCatalogueMode } from "@/src/features/catalogue/catalogue-mode";

const japanBounds = { west: 128, south: 30, east: 146, north: 46 };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("catalogue adapters", () => {
  it("gives fixture mode a working source, the simulated flow, and the prototype join", async () => {
    const adapters = createCatalogueAdapters(resolveCatalogueMode("fixture"));

    expect(adapters.simulatedCollection).toBe(true);
    expect(adapters.prototypeCatalogueJoin).toBe(true);

    const response = await adapters.shopSource?.fetchViewport({
      bounds: japanBounds,
      zoom: 6,
    });

    expect(response?.shops.length).toBeGreaterThan(0);
  });

  /*
   * Mode separation, the two invariants issue #25 states outright: a simulated
   * impression must not be offered beside real catalogue records, and device-local
   * prototype state must not be joined to the public catalogue.
   */
  it("withholds the simulated flow and the prototype join in api mode", () => {
    const adapters = createCatalogueAdapters(resolveCatalogueMode("api"), {
      fetch: vi.fn(),
    });

    expect(adapters.simulatedCollection).toBe(false);
    expect(adapters.prototypeCatalogueJoin).toBe(false);
    expect(adapters.shopSource).not.toBeNull();
  });

  it("reads the viewport through the same-origin v1 route in api mode", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ shops: [], truncated: false, committedBounds: japanBounds }),
    );
    const adapters = createCatalogueAdapters(resolveCatalogueMode("api"), {
      fetch: fetchMock as unknown as typeof fetch,
    });

    await adapters.shopSource?.fetchViewport({ bounds: japanBounds, zoom: 6 });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain("/api/v1/shops/viewport");
    expect(url).toContain("zoom=6");
  });

  it("leaves a misconfigured mode with no source at all", () => {
    const adapters = createCatalogueAdapters(resolveCatalogueMode("nonsense"));

    expect(adapters.shopSource).toBeNull();
    expect(adapters.simulatedCollection).toBe(false);
    expect(adapters.prototypeCatalogueJoin).toBe(false);
  });
});
