import { describe, expect, it } from "vitest";

import { isAntimeridianCrossing } from "@/src/domain/geo";

describe("isAntimeridianCrossing", () => {
  it("returns false for ordinary bounds", () => {
    expect(
      isAntimeridianCrossing({ west: 103, south: 1, east: 104, north: 2 }),
    ).toBe(false);
  });

  it("returns true when west is numerically east of east", () => {
    expect(
      isAntimeridianCrossing({ west: 170, south: -20, east: -170, north: 20 }),
    ).toBe(true);
  });
});
