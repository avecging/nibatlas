import { gzipSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getNearby } from "@/app/api/v1/shops/nearby/route";
import { GET as getSearch } from "@/app/api/v1/shops/search/route";
import { GET as getDetail } from "@/app/api/v1/shops/[slug]/route";
import { GET as getViewport } from "@/app/api/v1/shops/viewport/route";

const MAP_SHOP = {
  id: "00000000-0000-4000-8000-000000000301",
  slug: "m2-singapore-demo-fixture",
  name: "M2 Singapore Demo Fixture",
  countryCode: "SG",
  localityName: "Singapore",
  position: { latitude: 1.29027, longitude: 103.851959 },
  primaryType: "fountain_pen_specialist",
  specialtyLine: null,
  operationalStatus: "unknown",
  markerState: "unvisited",
  sourceQuality: "demo",
  fixtureNotice: "Demo data",
};

function accepts(payload: unknown, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return Response.json(payload, { status });
  });
}

function lastBody(mock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = mock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  return JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co/");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/v1/shops/viewport", () => {
  it("validates, translates and returns only the versioned public projection", async () => {
    const fetchMock = accepts({
      shops: [{ ...MAP_SHOP, publicationStatus: "published" }],
      truncated: false,
      committedBounds: { west: 103.7, south: 1.2, east: 104, north: 1.5 },
      zoom: 12,
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getViewport(new Request(
      "https://nibatlas.test/api/v1/shops/viewport?west=103.7&south=1.2&east=104&north=1.5&zoom=12&operationalStatus=open,unknown&shopType=fountain_pen_specialist&limit=50",
    ));
    const payload = await response.json() as { shops: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(payload.shops[0]).not.toHaveProperty("publicationStatus");
    expect(payload).not.toHaveProperty("zoom");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://project.supabase.co/rest/v1/rpc/viewport_shops",
    );
    expect(lastBody(fetchMock)).toMatchObject({
      p_operational_statuses: ["open", "unknown"],
      p_shop_type_codes: ["fountain_pen_specialist"],
      p_limit: 50,
    });
  });

  it("rejects invalid or duplicate bounds before contacting Supabase", async () => {
    const fetchMock = accepts({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await getViewport(new Request(
      "https://nibatlas.test/api/v1/shops/viewport?west=10&west=11&south=2&east=10&north=1&zoom=12",
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_viewport" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the maximum viewport response within the 250 KB compressed budget", async () => {
    const shops = Array.from({ length: 500 }, (_, index) => ({
      ...MAP_SHOP,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      slug: `payload-budget-shop-${index}`,
      name: `Payload Budget Fountain Pen and Stationery Shop ${index}`,
      localityName: `Payload Budget Locality ${index}`,
      specialtyLine: `Nib tuning, stationery, ink, paper, and repair services ${index}`,
      fixtureNotice: `Synthetic contract payload row ${index}; not catalogue data`,
    }));
    vi.stubGlobal("fetch", accepts({
      shops,
      truncated: false,
      committedBounds: { west: -179, south: -80, east: 179, north: 80 },
      zoom: 2,
    }));

    const response = await getViewport(new Request(
      "https://nibatlas.test/api/v1/shops/viewport?west=-179&south=-80&east=179&north=80&zoom=2",
    ));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(gzipSync(body).byteLength).toBeLessThanOrEqual(250 * 1024);
  });
});

describe("GET /api/v1/shops/search", () => {
  it("preserves multilingual query text and uses the public cache", async () => {
    const fetchMock = accepts({
      query: "第二期東京",
      shops: [{
        id: MAP_SHOP.id,
        slug: "m2-tokyo-demo-fixture",
        name: "M2 Tokyo Demo Fixture",
        countryCode: "JP",
        localityName: "Tokyo",
        matchedAlias: "第二期東京デモ店舗",
      }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getSearch(new Request(
      "https://nibatlas.test/api/v1/shops/search?q=%E7%AC%AC%E4%BA%8C%E6%9C%9F%E6%9D%B1%E4%BA%AC&limit=20",
    ));

    expect(response.status).toBe(200);
    expect(lastBody(fetchMock)).toEqual({ p_query: "第二期東京", p_limit: 20 });
    await expect(response.json()).resolves.toMatchObject({ query: "第二期東京" });
  });

  it("refuses an empty query", async () => {
    const fetchMock = accepts({});
    vi.stubGlobal("fetch", fetchMock);
    const response = await getSearch(new Request("https://nibatlas.test/api/v1/shops/search?q=%20"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/shops/[slug]", () => {
  const DETAIL = {
    ...MAP_SHOP,
    shortDescription: "Invented local-only record for database contract tests.",
    timezone: "Asia/Singapore",
    positionPrecision: "locality",
    shopTypes: ["fountain_pen_specialist"],
    specialties: [],
    services: [],
    brands: [],
    links: [],
    sources: [{
      id: "00000000-0000-4000-8000-000000000501",
      label: "Demo fixture",
      kind: "demo_fixture",
      retrievedOn: "2026-09-02",
      confirms: ["Name", "Short description"],
    }],
    evidenceNote: "must not pass",
  };

  it("returns stable source IDs and strips fields outside the public contract", async () => {
    const fetchMock = accepts(DETAIL);
    vi.stubGlobal("fetch", fetchMock);

    const response = await getDetail(
      new Request("https://nibatlas.test/api/v1/shops/m2-singapore-demo-fixture"),
      { params: Promise.resolve({ slug: "m2-singapore-demo-fixture" }) },
    );
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(payload).not.toHaveProperty("evidenceNote");
    expect(payload).toMatchObject({
      primaryType: "fountain_pen_specialist",
      markerState: "unvisited",
      specialtyLine: null,
      sources: [{
        id: "00000000-0000-4000-8000-000000000501",
        label: "Demo fixture",
        confirms: ["Name", "Short description"],
      }],
    });
  });

  it("returns a cache-safe not-found response for drafts and missing slugs", async () => {
    vi.stubGlobal("fetch", accepts(null));
    const response = await getDetail(
      new Request("https://nibatlas.test/api/v1/shops/missing-shop"),
      { params: Promise.resolve({ slug: "missing-shop" }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects an invalid slug without an upstream call", async () => {
    const fetchMock = accepts(null);
    vi.stubGlobal("fetch", fetchMock);
    const response = await getDetail(
      new Request("https://nibatlas.test/api/v1/shops/INVALID"),
      { params: Promise.resolve({ slug: "INVALID" }) },
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/shops/nearby", () => {
  it("never makes a coordinate-bearing request cacheable", async () => {
    const fetchMock = accepts({
      shops: [{
        id: MAP_SHOP.id,
        slug: MAP_SHOP.slug,
        name: MAP_SHOP.name,
        countryCode: "SG",
        localityName: "Singapore",
        position: MAP_SHOP.position,
        distanceMeters: 0,
      }],
      radiusMeters: 1000,
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getNearby(new Request(
      "https://nibatlas.test/api/v1/shops/nearby?latitude=1.29027&longitude=103.851959&radiusMeters=1000&limit=10",
    ));
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(payload).not.toHaveProperty("latitude");
    expect(payload).not.toHaveProperty("longitude");
    expect(lastBody(fetchMock)).toMatchObject({
      p_latitude: 1.29027,
      p_longitude: 103.851959,
    });
  });
});

describe("upstream failures", () => {
  it("fails closed when public Supabase configuration is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await getSearch(new Request("https://nibatlas.test/api/v1/shops/search?q=pen"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: { code: "read_service_unavailable" },
    });
  });

  it("does not relay PostgREST error detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(
      { message: "relation public.secret_table does not exist" },
      { status: 500 },
    )));
    const response = await getSearch(new Request("https://nibatlas.test/api/v1/shops/search?q=pen"));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain("secret_table");
    expect(text).toContain("read_upstream_failed");
  });

  it("fails closed when an RPC response violates the versioned shape", async () => {
    vi.stubGlobal("fetch", accepts({ shops: [{ id: "only-an-id" }], query: "pen" }));
    const response = await getSearch(new Request("https://nibatlas.test/api/v1/shops/search?q=pen"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_upstream_contract" },
    });
  });
});
