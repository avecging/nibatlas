import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getViewportShops } from "@/src/server/http/shop-read-routes";

const MAX_COMPRESSED_VIEWPORT_BYTES = 250 * 1024;

function denseShop(index: number) {
  const suffix = index.toString(16).padStart(12, "0");

  return {
    id: `00000000-0000-4000-8000-${suffix}`,
    slug: `dense-city-shop-${index}`,
    name: `Dense City Fountain Pen and Stationery Shop ${index}`,
    countryCode: "JP",
    localityName: `Neighbourhood ${index % 40}, Tokyo`,
    position: {
      latitude: 35.65 + (index % 50) / 10_000,
      longitude: 139.7 + Math.floor(index / 50) / 10_000,
    },
    primaryType: index % 2 === 0 ? "fountain_pen_specialist" : "stationery_store",
    specialtyLine: `Published specialty summary ${index} for a representative dense-city result`,
    operationalStatus: index % 17 === 0 ? "unknown" : "open",
    markerState: "unvisited",
    sourceQuality: "sourced",
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("viewport payload budget", () => {
  it("keeps a full 500-shop dense-city response below 250 KB compressed", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          shops: Array.from({ length: 500 }, (_, index) => denseShop(index)),
          truncated: true,
          committedBounds: { west: 139.6, south: 35.58, east: 139.85, north: 35.78 },
          zoom: 13,
        }),
      ),
    );

    const response = await getViewportShops(
      new Request(
        "https://nibatlas.test/api/v1/shops/viewport?west=139.6&south=35.58&east=139.85&north=35.78&zoom=13&limit=500",
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body).shops).toHaveLength(500);
    expect(gzipSync(Buffer.from(body)).byteLength).toBeLessThan(
      MAX_COMPRESSED_VIEWPORT_BYTES,
    );
  });
});
