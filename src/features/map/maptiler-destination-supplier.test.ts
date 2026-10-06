import { describe, expect, it, vi } from "vitest";
import {
  createMapTilerDestinationSupplier,
  projectMapTilerPlace,
} from "@/src/features/map/maptiler-destination-supplier";

describe("MapTiler place search", () => {
  it("projects a neighborhood into a map frame without treating it as a shop", () => {
    expect(projectMapTilerPlace({
      id: "neighbourhood.ginza",
      text: "Ginza",
      place_name: "Ginza, Tokyo, Japan",
      place_type: ["neighbourhood"],
      bbox: [139.75, 35.66, 139.78, 35.68],
    })).toEqual({
      id: "neighbourhood.ginza",
      name: "Ginza",
      context: "Ginza, Tokyo, Japan",
      viewport: {
        bounds: { west: 139.75, south: 35.66, east: 139.78, north: 35.68 },
        zoom: 11,
      },
    });
  });

  it("rejects malformed provider coordinates", () => {
    expect(projectMapTilerPlace({
      id: "bad", text: "Bad", place_type: ["place"], bbox: [0, 0, 999, 1],
    })).toBeNull();
  });

  it("requests geographic results and omits invalid features", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      features: [
        { id: "place.bugis", text: "Bugis", place_name: "Bugis, Singapore",
          place_type: ["neighbourhood"], center: [103.85, 1.30] },
        { id: "bad", text: "Bad", place_type: ["place"] },
      ],
    }), { status: 200 }));
    const signal = new AbortController().signal;
    const results = await createMapTilerDestinationSupplier("test-key", fetcher)
      .suggest("Bugis", signal);
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("Bugis");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(new URL(String(url)).searchParams.get("types")).toContain("neighbourhood");
    expect(init?.signal).toBe(signal);
  });

  it("fails on provider errors rather than inventing places", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 403 }));
    await expect(createMapTilerDestinationSupplier("test-key", fetcher)
      .suggest("Ginza")).rejects.toThrow("Place search unavailable");
  });
});
