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
    specialtyLine: null,
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

    expect(clusters[0]?.position.latitude).toBeCloseTo(0.1, 9);
    expect(clusters[0]?.position.longitude).toBeCloseTo(0.1, 9);
  });

  it("reports bounds covering every member", () => {
    const [cluster] = clusterByScreenDistance(
      [shop("a", 0, 0), shop("b", 0.2, 0.3)],
      project,
      40,
    );

    const bounds = clusterBounds(cluster!);

    expect(bounds.west).toBeCloseTo(0, 9);
    expect(bounds.east).toBeCloseTo(0.2, 9);
    expect(bounds.south).toBeCloseTo(0, 9);
    expect(bounds.north).toBeCloseTo(0.3, 9);
  });
});

describe("clustering across the antimeridian", () => {
  // Projecting relative to a viewport centred on 180 keeps neighbouring shops
  // adjacent on screen, which is what MapLibre's transform does.
  const projectNear180 = (point: { latitude: number; longitude: number }) => ({
    x: (((point.longitude - 180 + 540) % 360) - 180) * 100,
    y: point.latitude * 100,
  });

  const straddling = [shop("west", 179.9, 0), shop("east", -179.9, 0.1)];

  it("groups shops that straddle 180", () => {
    const clusters = clusterByScreenDistance(straddling, projectNear180, 40);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.shops).toHaveLength(2);
  });

  it("places the cluster beside its members, not on the far side of the world", () => {
    const [cluster] = clusterByScreenDistance(straddling, projectNear180, 40);
    const longitude = cluster!.position.longitude;

    // Either wrapped form of the antimeridian is correct; 0 would not be.
    expect(Math.min(Math.abs(longitude - 180), Math.abs(longitude + 180))).toBeLessThan(0.1);
  });

  it("reports a narrow span rather than a near-global one", () => {
    const [cluster] = clusterByScreenDistance(straddling, projectNear180, 40);
    const bounds = clusterBounds(cluster!);

    expect(bounds.east - bounds.west).toBeCloseTo(0.2, 6);
    expect(bounds.south).toBeCloseTo(0, 9);
    expect(bounds.north).toBeCloseTo(0.1, 9);
  });

  it("keeps a single member unchanged", () => {
    const [cluster] = clusterByScreenDistance([shop("only", -179.9, 5)], projectNear180, 40);
    const bounds = clusterBounds(cluster!);

    expect(bounds.west).toBeCloseTo(-179.9, 9);
    expect(bounds.east).toBeCloseTo(-179.9, 9);
  });
});
