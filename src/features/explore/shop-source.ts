import { containsPoint } from "@/src/domain/geo";
import type {
  ShopMapSummary,
  ViewportShopRequest,
  ViewportShopResponse,
} from "@/src/domain/shops";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";

/**
 * Milestone 1 data seam.
 *
 * `ShopSource` is the only place the explore feature learns about data. In
 * Milestone 3 the fixture implementation is replaced by an HTTP adapter calling
 * `GET /api/v1/shops/viewport` without any component change.
 */
export interface ShopSource {
  fetchViewport(
    request: ViewportShopRequest,
    signal?: AbortSignal,
  ): Promise<ViewportShopResponse>;
}

export const PROTOTYPE_RESULT_CAP = 20;

export class AbortedError extends Error {
  constructor() {
    super("Viewport request aborted");
    this.name = "AbortedError";
  }
}

export interface FixtureShopSourceOptions {
  readonly shops?: readonly ShopMapSummary[];
  readonly latencyMs?: number;
  readonly resultCap?: number;
  /** Deterministic failure hook used by tests and the demo error control. */
  readonly shouldFail?: () => boolean;
}

/**
 * The public projection never carries user state, so every record is returned as
 * `unvisited`. Saved and visited identifiers are merged in the client through
 * `decorateResults`.
 */
function toPublicProjection(shop: ShopMapSummary): ShopMapSummary {
  return { ...shop, markerState: "unvisited" };
}

export function createFixtureShopSource(
  options: FixtureShopSourceOptions = {},
): ShopSource {
  const shops = options.shops ?? prototypeShopSummaries;
  const latencyMs = options.latencyMs ?? 0;
  const resultCap = options.resultCap ?? PROTOTYPE_RESULT_CAP;

  return {
    async fetchViewport(request, signal) {
      if (latencyMs > 0) {
        await delay(latencyMs, signal);
      }

      if (signal?.aborted) {
        throw new AbortedError();
      }

      if (options.shouldFail?.()) {
        throw new Error("Demo viewport request failed");
      }

      const limit = request.limit ?? resultCap;
      const matched = shops
        .filter((shop) => containsPoint(request.bounds, shop.position))
        .filter(
          (shop) =>
            request.shopTypes === undefined ||
            request.shopTypes.length === 0 ||
            request.shopTypes.includes(shop.primaryType),
        )
        .map(toPublicProjection);

      return {
        shops: matched.slice(0, limit),
        truncated: matched.length > limit,
        committedBounds: request.bounds,
      };
    },
  };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortedError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new AbortedError());
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
