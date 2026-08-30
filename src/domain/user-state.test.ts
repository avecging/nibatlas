import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS, type ShopFilters } from "@/src/domain/filters";
import { decorateResults, markerStateFor } from "@/src/domain/user-state";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";

const publicProjection = prototypeShopSummaries.map((shop) => ({
  ...shop,
  markerState: "unvisited" as const,
}));

const first = publicProjection[0]!;
const second = publicProjection[1]!;

const userState = {
  savedShopIds: new Set([second.id]),
  visitedShopIds: new Set([first.id]),
};

function filters(overrides: Partial<ShopFilters> = {}): ShopFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe("user shop state", () => {
  it("prefers visited over saved", () => {
    expect(
      markerStateFor(first.id, {
        savedShopIds: new Set([first.id]),
        visitedShopIds: new Set([first.id]),
      }),
    ).toBe("visited");
  });

  it("merges saved and visited identifiers into the public projection", () => {
    const decorated = decorateResults(publicProjection, userState, filters());

    expect(decorated.find((shop) => shop.id === first.id)?.markerState).toBe("visited");
    expect(decorated.find((shop) => shop.id === second.id)?.markerState).toBe("saved");
  });

  it("applies the status filter after merging", () => {
    const saved = decorateResults(publicProjection, userState, filters({ status: "saved" }));

    expect(saved).toHaveLength(1);
    expect(saved[0]?.id).toBe(second.id);
  });

  /*
   * The Saved segment reads the reader's own saved set, not the collapsed
   * marker state. A shop stays saved once it has been visited, even though its
   * marker shows the visited silhouette.
   */
  it("keeps a visited shop in the Saved segment when it is also saved", () => {
    const both = {
      savedShopIds: new Set([first.id]),
      visitedShopIds: new Set([first.id]),
    };

    const saved = decorateResults(publicProjection, both, filters({ status: "saved" }));

    expect(saved.map((shop) => shop.id)).toEqual([first.id]);
    expect(saved[0]?.markerState).toBe("visited");
  });

  it("filters on recorded availability", () => {
    const open = decorateResults(
      publicProjection,
      userState,
      filters({ availability: "open" }),
    );

    expect(open.length).toBeGreaterThan(0);
    expect(open.every((shop) => shop.operationalStatus === "open")).toBe(true);
  });
});
