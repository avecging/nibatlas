import { describe, expect, it, vi } from "vitest";

import { ShopReadHttpError } from "@/src/api/v1/shop-read-client";
import {
  createFixtureShopSource,
  createHttpShopSource,
  AbortedError,
} from "@/src/features/explore/shop-source";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";

const japanBounds = { west: 128, south: 30, east: 146, north: 46 };

describe("fixture shop source", () => {
  it("returns only shops inside the requested bounds", async () => {
    const source = createFixtureShopSource();
    const response = await source.fetchViewport({ bounds: japanBounds, zoom: 6 });

    expect(response.shops.length).toBeGreaterThan(0);
    expect(response.shops.every((shop) => shop.countryCode === "JP")).toBe(true);
  });

  it("never leaks user state through the public projection", async () => {
    const source = createFixtureShopSource();
    const response = await source.fetchViewport({ bounds: japanBounds, zoom: 6 });

    expect(response.shops.every((shop) => shop.markerState === "unvisited")).toBe(true);
  });

  it("carries the approved specialty line in the viewport projection", async () => {
    const source = createFixtureShopSource();
    const response = await source.fetchViewport({ bounds: japanBounds, zoom: 6 });

    expect(response.shops.every((shop) => "specialtyLine" in shop)).toBe(true);
    expect(response.shops.some((shop) => shop.specialtyLine !== null)).toBe(true);
  });

  it("filters by shop type", async () => {
    const source = createFixtureShopSource();
    const response = await source.fetchViewport({
      bounds: japanBounds,
      zoom: 6,
      shopTypes: ["stationery_store"],
    });

    expect(response.shops.length).toBeGreaterThan(0);
    expect(
      response.shops.every((shop) => shop.primaryType === "stationery_store"),
    ).toBe(true);
  });

  it("filters by the shared operational-status request field", async () => {
    const source = createFixtureShopSource();
    const response = await source.fetchViewport({
      bounds: japanBounds,
      zoom: 6,
      operationalStatuses: ["open"],
    });

    expect(response.shops.length).toBeGreaterThan(0);
    expect(response.shops.every((shop) => shop.operationalStatus === "open")).toBe(true);
  });

  it("caps results and reports truncation", async () => {
    const source = createFixtureShopSource({ resultCap: 3 });
    const response = await source.fetchViewport({
      bounds: { west: -180, south: -85, east: 180, north: 85 },
      zoom: 2,
    });

    expect(response.shops).toHaveLength(3);
    expect(response.truncated).toBe(true);
  });

  it("does not truncate when everything fits", async () => {
    const source = createFixtureShopSource({
      resultCap: prototypeShopSummaries.length,
    });
    const response = await source.fetchViewport({
      bounds: { west: -180, south: -85, east: 180, north: 85 },
      zoom: 2,
    });

    expect(response.truncated).toBe(false);
  });

  it("aborts an in-flight request", async () => {
    const source = createFixtureShopSource({ latencyMs: 50 });
    const controller = new AbortController();
    const pending = source.fetchViewport({ bounds: japanBounds, zoom: 6 }, controller.signal);

    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(AbortedError);
  });
});

describe("HTTP shop source", () => {
  it("implements the shared seam through the v1 decoder", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      shops: [],
      truncated: false,
      committedBounds: japanBounds,
    }));
    const source = createHttpShopSource({
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(source.fetchViewport({ bounds: japanBounds, zoom: 6 })).resolves.toEqual({
      shops: [],
      truncated: false,
      committedBounds: japanBounds,
    });
  });

  it("surfaces API failure and never disguises it with fixture results", async () => {
    const fetchMock = vi.fn(async () => Response.json(
      { ok: false, error: { code: "read_service_unavailable" } },
      { status: 503 },
    ));
    const source = createHttpShopSource({
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(source.fetchViewport({ bounds: japanBounds, zoom: 6 })).rejects.toBeInstanceOf(
      ShopReadHttpError,
    );
  });
});
