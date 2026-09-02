import { describe, expect, it, vi } from "vitest";

import {
  createHttpShopReadClient,
  ShopReadAbortedError,
  ShopReadHttpError,
} from "@/src/api/v1/shop-read-client";
import { ShopReadContractError } from "@/src/api/v1/shop-read";

const MAP_SHOP = {
  id: "00000000-0000-4000-8000-000000000301",
  slug: "m3-demo-shop",
  name: "M3 Demo Shop",
  countryCode: "SG",
  localityName: "Singapore",
  position: { latitude: 1.29, longitude: 103.85 },
  primaryType: "fountain_pen_specialist",
  specialtyLine: null,
  operationalStatus: "unknown",
  markerState: "unvisited",
  sourceQuality: "demo",
};

const SOURCE_ID = "00000000-0000-4000-8000-000000000501";

const DETAIL = {
  ...MAP_SHOP,
  timezone: "Asia/Singapore",
  positionPrecision: "locality",
  shopTypes: ["fountain_pen_specialist"],
  specialties: [],
  services: [{ label: "Nib tuning", confirmedBy: SOURCE_ID }],
  brands: [],
  links: [],
  sources: [{
    id: SOURCE_ID,
    label: "Demo fixture",
    kind: "demo_fixture",
    retrievedOn: "2026-09-02",
    confirms: ["Service: Nib tuning"],
  }],
};

function jsonFetch(payload: unknown, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return Response.json(payload, { status });
  });
}

function clientWith(fetchMock: ReturnType<typeof jsonFetch>) {
  return createHttpShopReadClient({
    baseUrl: "https://nibatlas.test",
    fetch: fetchMock as unknown as typeof fetch,
  });
}

describe("HTTP shop read client", () => {
  it("encodes every public viewport field and never sends prototype user state", async () => {
    const fetchMock = jsonFetch({
      shops: [MAP_SHOP],
      truncated: false,
      committedBounds: { west: 103.7, south: 1.2, east: 104, north: 1.5 },
    });
    const client = clientWith(fetchMock);

    await client.fetchViewport({
      bounds: { west: 103.7, south: 1.2, east: 104, north: 1.5 },
      zoom: 12,
      operationalStatuses: ["open", "unknown"],
      statuses: ["saved"],
      shopTypes: ["fountain_pen_specialist", "nib_repair_services"],
      limit: 75,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/api/v1/shops/viewport");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      west: "103.7000000",
      south: "1.2000000",
      east: "104.0000000",
      north: "1.5000000",
      zoom: "12",
      operationalStatus: "open,unknown",
      shopType: "fountain_pen_specialist,nib_repair_services",
      limit: "75",
    });
    expect(parsed.searchParams.has("statuses")).toBe(false);
    expect(init).toMatchObject({ method: "GET" });
  });

  it("encodes sub-microdegree bounds without exponential notation", async () => {
    const bounds = { west: -0.0000001, south: -0.0000002, east: 0.0000001, north: 0.0000002 };
    const fetchMock = jsonFetch({ shops: [], truncated: false, committedBounds: bounds });
    const client = clientWith(fetchMock);

    await client.fetchViewport({ bounds, zoom: 24 });

    const parsed = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(Object.fromEntries(parsed.searchParams)).toMatchObject({
      west: "-0.0000001",
      south: "-0.0000002",
      east: "0.0000001",
      north: "0.0000002",
    });
    expect(parsed.search).not.toMatch(/e[+-]?\d/i);
  });

  it("preserves multilingual canonical search text and its limit", async () => {
    const fetchMock = jsonFetch({ query: "第二期 東京", shops: [] });
    const client = clientWith(fetchMock);

    await client.searchCanonicalShops({ query: "第二期 東京", limit: 12 });

    const parsed = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(parsed.pathname).toBe("/api/v1/shops/search");
    expect(parsed.searchParams.get("q")).toBe("第二期 東京");
    expect(parsed.searchParams.get("limit")).toBe("12");
  });

  it("encodes the detail slug as one path segment and maps a 404 to null", async () => {
    const fetchMock = jsonFetch({ ok: false, error: { code: "shop_not_found" } }, 404);
    const client = clientWith(fetchMock);

    await expect(client.fetchShopDetail("shop / slug")).resolves.toBeNull();
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://nibatlas.test/api/v1/shops/shop%20%2F%20slug",
    );
  });

  it("does not turn an unevidenced 404 into an absent shop", async () => {
    const fetchMock = jsonFetch({ message: "proxy route missing" }, 404);
    const client = clientWith(fetchMock);

    await expect(client.fetchShopDetail("existing-shop")).rejects.toMatchObject({
      name: "ShopReadHttpError",
      status: 404,
      code: undefined,
    });
  });

  it("keeps Nearby coordinates in POST JSON and out of the URL", async () => {
    const fetchMock = jsonFetch({ shops: [], radiusMeters: 2500 });
    const client = clientWith(fetchMock);

    await client.fetchNearbyShops({
      latitude: 1.29027,
      longitude: 103.851959,
      radiusMeters: 2500,
      limit: 25,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://nibatlas.test/api/v1/shops/nearby");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      latitude: 1.29027,
      longitude: 103.851959,
      radiusMeters: 2500,
      limit: 25,
    });
  });

  it("passes the caller's exact AbortSignal and classifies cancellation separately", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }));
    const client = createHttpShopReadClient({
      fetch: fetchMock as unknown as typeof fetch,
    });
    const pending = client.fetchViewport(
      { bounds: { west: 103, south: 1, east: 104, north: 2 }, zoom: 10 },
      controller.signal,
    );

    expect((fetchMock.mock.calls[0]![1] as RequestInit).signal).toBe(controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(ShopReadAbortedError);
  });

  it("does not start a request when the caller signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = jsonFetch({});
    const client = clientWith(fetchMock);

    await expect(client.searchCanonicalShops(
      { query: "Itoya" },
      controller.signal,
    )).rejects.toBeInstanceOf(ShopReadAbortedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies HTTP and network failures without falling back to fixtures", async () => {
    const unavailable = clientWith(jsonFetch({
      ok: false,
      error: { code: "read_service_unavailable" },
    }, 503));
    await expect(unavailable.fetchViewport({
      bounds: { west: 103, south: 1, east: 104, north: 2 },
      zoom: 10,
    })).rejects.toMatchObject({
      name: "ShopReadHttpError",
      kind: "http",
      status: 503,
      code: "read_service_unavailable",
    });

    const networkCause = new TypeError("network down");
    const fetchMock = vi.fn(async () => {
      throw networkCause;
    });
    const offline = createHttpShopReadClient({
      fetch: fetchMock as unknown as typeof fetch,
    });
    const request = offline.searchCanonicalShops({ query: "Itoya" });
    await expect(request).rejects.toEqual(
      expect.objectContaining<Partial<ShopReadHttpError>>({ kind: "network", status: null }),
    );
    await expect(request).rejects.toHaveProperty(
      "cause",
      networkCause,
    );
  });

  it("runs successful payloads through v1 decoding, stripping unknown keys", async () => {
    const fetchMock = jsonFetch({ ...DETAIL, adminEvidenceNote: "must not pass" });
    const client = clientWith(fetchMock);

    const detail = await client.fetchShopDetail("m3-demo-shop");

    expect(detail?.sources[0]?.id).toBe(SOURCE_ID);
    expect(detail).not.toHaveProperty("adminEvidenceNote");
  });

  it("fails closed when a known response field is malformed", async () => {
    const malformed = { ...MAP_SHOP } as Record<string, unknown>;
    delete malformed["specialtyLine"];
    const fetchMock = jsonFetch({
      shops: [malformed],
      truncated: false,
      committedBounds: { west: 103, south: 1, east: 104, north: 2 },
    });
    const client = clientWith(fetchMock);

    await expect(client.fetchViewport({
      bounds: { west: 103, south: 1, east: 104, north: 2 },
      zoom: 10,
    })).rejects.toBeInstanceOf(ShopReadContractError);
  });
});
