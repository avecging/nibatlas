import { describe, expect, it } from "vitest";

import { decorateResults, markerStateFor } from "@/src/domain/user-state";
import { demoShopSummaries } from "@/src/fixtures/demo-catalogue";

const publicProjection = demoShopSummaries.map((shop) => ({
  ...shop,
  markerState: "unvisited" as const,
}));

const first = publicProjection[0]!;
const second = publicProjection[1]!;

const userState = {
  savedShopIds: new Set([second.id]),
  visitedShopIds: new Set([first.id]),
};

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
    const decorated = decorateResults(publicProjection, userState, "all");

    expect(decorated.find((shop) => shop.id === first.id)?.markerState).toBe("visited");
    expect(decorated.find((shop) => shop.id === second.id)?.markerState).toBe("saved");
  });

  it("applies the committed status filter after merging", () => {
    const saved = decorateResults(publicProjection, userState, "saved");

    expect(saved).toHaveLength(1);
    expect(saved[0]?.id).toBe(second.id);
  });
});
