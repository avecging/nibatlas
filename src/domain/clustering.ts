import type { GeoPoint } from "@/src/domain/geo";
import type { ShopMapSummary } from "@/src/domain/shops";

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface MarkerCluster {
  readonly id: string;
  readonly position: GeoPoint;
  readonly shops: readonly ShopMapSummary[];
}

export type Projector = (point: GeoPoint) => ScreenPoint;

/**
 * Screen-space clustering over the bounded result set.
 *
 * Clustering runs on the client so the public viewport payload stays a plain
 * bounded GeoJSON collection. `DATA-MODEL.md` allows exactly this at launch
 * scale and expects server-side clustering only once density demands it, at
 * which point this function is replaced without changing the marker contract.
 *
 * The algorithm is deterministic: shops are visited in input order, and each
 * unassigned shop within `radiusPx` of the current seed joins its cluster.
 */
export function clusterByScreenDistance(
  shops: readonly ShopMapSummary[],
  project: Projector,
  radiusPx: number,
  options: { readonly pinned?: string | null } = {},
): readonly MarkerCluster[] {
  const pinned = options.pinned ?? null;
  const clusters: MarkerCluster[] = [];
  const assigned = new Set<string>();
  const projected = new Map<string, ScreenPoint>();

  for (const shop of shops) {
    projected.set(shop.id, project(shop.position));
  }

  for (const shop of shops) {
    // A selected shop always keeps its own marker so its halo stays visible.
    if (shop.id === pinned) {
      assigned.add(shop.id);
      clusters.push({ id: `shop-${shop.id}`, position: shop.position, shops: [shop] });
    }
  }

  for (const shop of shops) {
    if (assigned.has(shop.id)) {
      continue;
    }

    const seed = projected.get(shop.id);

    if (!seed) {
      continue;
    }

    assigned.add(shop.id);
    const members: ShopMapSummary[] = [shop];

    for (const candidate of shops) {
      if (assigned.has(candidate.id)) {
        continue;
      }

      const point = projected.get(candidate.id);

      if (!point) {
        continue;
      }

      const dx = point.x - seed.x;
      const dy = point.y - seed.y;

      if (Math.sqrt(dx * dx + dy * dy) <= radiusPx) {
        assigned.add(candidate.id);
        members.push(candidate);
      }
    }

    clusters.push({
      id: members.length === 1 ? `shop-${shop.id}` : `cluster-${shop.id}`,
      position: members.length === 1 ? shop.position : centroid(members),
      shops: members,
    });
  }

  return clusters;
}

function centroid(shops: readonly ShopMapSummary[]): GeoPoint {
  const total = shops.reduce(
    (accumulator, shop) => ({
      latitude: accumulator.latitude + shop.position.latitude,
      longitude: accumulator.longitude + shop.position.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / shops.length,
    longitude: total.longitude / shops.length,
  };
}

export function clusterBounds(cluster: MarkerCluster) {
  const latitudes = cluster.shops.map((shop) => shop.position.latitude);
  const longitudes = cluster.shops.map((shop) => shop.position.longitude);

  return {
    west: Math.min(...longitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    north: Math.max(...latitudes),
  };
}
