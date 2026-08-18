import { describe, expect, it } from "vitest";

import { clusterBounds, clusterByScreenDistance } from "@/src/domain/clustering";
import type { ShopMapSummary } from "@/src/domain/shops";

function shop(id: string, longitude: number, latitude: number): ShopMapSummary {
  return {
    id,
    slug: `demo-${id}`,
    name: `Demo ${id}`,
    countryCode: "JP",
    localityName: "Demo locality",
    position: { latitude, longitude },
    primaryType: "fountain_pen_specialist",
    operationalStatus: "open",
    markerState: "unvisited",
    sourceQuality: "demo",
  };
}

// One screen pixel per 0.01 degree keeps the arithmetic obvious.
const project = (point: { latitude: number; longitude: number }) => ({
  x: point.longitude * 100,
  y: point.latitude * 100,
});

describe("clusterByScreenDistance", () => {
  it("keeps distant shops as individual markers", () => {
    const clusters = clusterByScreenDistance(
      [shop("a", 0, 0), shop("b", 5, 5)],
      project,
      40,
    );

    expect(clusters).toHaveLength(2);
    expect(clusters.every((cluster) => cluster.shops.length === 1)).toBe(true);
    expect(clusters[0]?.id).toBe("shop-a");
  });

  it("groups shops that would overlap on screen", () => {
    const clusters = clusterByScreenDistance(
      [shop("a", 0, 0), shop("b", 0.1, 0), shop("c", 0.2, 0), shop("d", 9, 9)],
      project,
      40,
    );

    expect(clusters).toHaveLength(2);
    const cluster = clusters.find((candidate) => candidate.shops.length > 1);
    expect(cluster?.shops.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(cluster?.id).toBe("cluster-a");
  });

  it("is deterministic for the same input", () => {
    const shops = [shop("a", 0, 0), shop("b", 0.1, 0), shop("c", 4, 4)];

    expect(clusterByScreenDistance(shops, project, 40)).toEqual(
      clusterByScreenDistance(shops, project, 40),
    );
  });

  it("never hides the selected shop inside a cluster", () => {
    const clusters = clusterByScreenDistance(
      [shop("a", 0, 0), shop("b", 0.1, 0), shop("c", 0.2, 0)],
      project,
      40,
      { pinned: "b" },
    );

    const pinned = clusters.find((cluster) => cluster.id === "shop-b");

    expect(pinned?.shops).toHaveLength(1);
    expect(clusters.flatMap((cluster) => cluster.shops).map((item) => item.id).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("places a cluster at the centroid of its members", () => {
    const clusters = clusterByScreenDistance(
      [shop("a", 0, 0), shop("b", 0.2, 0.2)],
      project,
      40,
    );

    expect(clusters[0]?.position).toEqual({ latitude: 0.1, longitude: 0.1 });
  });

  it("reports bounds covering every member", () => {
    const [cluster] = clusterByScreenDistance(
      [shop("a", 0, 0), shop("b", 0.2, 0.3)],
      project,
      40,
    );

    expect(clusterBounds(cluster!)).toEqual({
      west: 0,
      south: 0,
      east: 0.2,
      north: 0.3,
    });
  });
});
