import { describe, expect, it } from "vitest";

import {
  canTurn,
  firstPosition,
  lastPosition,
  normalizePosition,
  rotationAt,
  settleDuration,
  shouldCompleteTurn,
  showsBackFace,
  targetPosition,
  turnLayers,
  visiblePages,
  type BookGeometry,
} from "@/src/features/passport/book-controller";

const spread: BookGeometry = { mode: "spread", pageCount: 8 };
const single: BookGeometry = { mode: "single", pageCount: 8 };

describe("spread geometry", () => {
  it("opens on the first spread and ends on the last complete one", () => {
    expect(firstPosition("spread")).toBe(1);
    expect(lastPosition(spread)).toBe(7);
  });

  it("pairs a left and a right page at every position", () => {
    expect(visiblePages(spread, 1)).toEqual({ left: 0, right: 1 });
    expect(visiblePages(spread, 3)).toEqual({ left: 2, right: 3 });
    expect(visiblePages(spread, 7)).toEqual({ left: 6, right: 7 });
  });

  it("snaps any page index onto the spread that contains it", () => {
    expect(normalizePosition(spread, 0)).toBe(1);
    expect(normalizePosition(spread, 4)).toBe(5);
    expect(normalizePosition(spread, 5)).toBe(5);
    expect(normalizePosition(spread, 99)).toBe(7);
    expect(normalizePosition(spread, -4)).toBe(1);
  });

  it("refuses to turn past either end", () => {
    expect(canTurn(spread, 1, -1)).toBe(false);
    expect(canTurn(spread, 1, 1)).toBe(true);
    expect(canTurn(spread, 7, 1)).toBe(false);
    expect(canTurn(spread, 7, -1)).toBe(true);
    expect(turnLayers(spread, 1, -1)).toBeNull();
    expect(turnLayers(spread, 7, 1)).toBeNull();
  });
});

describe("forward turn", () => {
  const layers = turnLayers(spread, 3, 1);

  it("takes the right leaf and hinges it on the spine", () => {
    expect(layers?.leafSide).toBe("right");
    expect(layers?.rotationFrom).toBe(0);
    expect(layers?.rotationTo).toBe(-180);
  });

  it("carries the current right page on its front and the next page on its back", () => {
    expect(layers?.leafFront).toBe(3);
    expect(layers?.leafBack).toBe(4);
  });

  it("leaves the old left page in place and reveals the page after next", () => {
    expect(layers?.staticLeft).toBe(2);
    expect(layers?.staticRight).toBe(5);
  });

  it("lands the moved leaf on the left stack", () => {
    const next = targetPosition(spread, 3, 1);

    expect(next).toBe(5);
    // The leaf's own back face (page 4) is now the left page: the leaf really
    // moved from the right stack to the left one.
    expect(visiblePages(spread, next)).toEqual({ left: 4, right: 5 });
    expect(visiblePages(spread, next).left).toBe(layers?.leafBack);
  });
});

describe("reverse turn", () => {
  const layers = turnLayers(spread, 5, -1);

  it("takes the left leaf and hinges it on the same spine from the other side", () => {
    expect(layers?.leafSide).toBe("left");
    expect(layers?.rotationFrom).toBe(0);
    expect(layers?.rotationTo).toBe(180);
  });

  it("carries the current left page on its front", () => {
    expect(layers?.leafFront).toBe(4);
    expect(layers?.leafBack).toBe(3);
  });

  it("returns the leaf to the right stack", () => {
    const next = targetPosition(spread, 5, -1);

    expect(next).toBe(3);
    expect(visiblePages(spread, next)).toEqual({ left: 2, right: 3 });
    expect(visiblePages(spread, next).right).toBe(layers?.leafBack);
  });

  it("is the inverse path of the forward turn, not a mirrored one", () => {
    const forward = turnLayers(spread, 3, 1);
    const back = turnLayers(spread, 5, -1);

    // Forward moves page 3 to the left; reverse from the resulting spread moves
    // page 4 back to the right and restores page 3 as the right page.
    expect(forward?.leafFront).toBe(3);
    expect(back?.leafBack).toBe(3);
    // Opposite hinge sides, opposite rotation signs: not one animation negated.
    expect(forward?.leafSide).not.toBe(back?.leafSide);
    expect(Math.sign(forward?.rotationTo ?? 0)).not.toBe(
      Math.sign(back?.rotationTo ?? 0),
    );
  });
});

describe("round trips", () => {
  it("returns to the same spread after forward then reverse", () => {
    let position = 1;

    position = targetPosition(spread, position, 1);
    position = targetPosition(spread, position, 1);
    expect(position).toBe(5);

    position = targetPosition(spread, position, -1);
    position = targetPosition(spread, position, -1);
    expect(position).toBe(1);
  });

  it("cannot be walked past either end however many times it is asked", () => {
    let position = 1;

    for (let index = 0; index < 20; index += 1) {
      if (canTurn(spread, position, 1)) {
        position = targetPosition(spread, position, 1);
      }
    }

    expect(position).toBe(lastPosition(spread));

    for (let index = 0; index < 20; index += 1) {
      if (canTurn(spread, position, -1)) {
        position = targetPosition(spread, position, -1);
      }
    }

    expect(position).toBe(firstPosition("spread"));
  });
});

describe("single-page mode", () => {
  it("moves one page at a time", () => {
    expect(firstPosition("single")).toBe(0);
    expect(lastPosition(single)).toBe(7);
    expect(targetPosition(single, 3, 1)).toBe(4);
    expect(targetPosition(single, 3, -1)).toBe(2);
  });

  it("shows one page with no left leaf", () => {
    expect(visiblePages(single, 3)).toEqual({ left: null, right: 3 });
  });

  it("keeps origin, direction, and content order coherent forward", () => {
    const layers = turnLayers(single, 3, 1);

    expect(layers?.leafSide).toBe("right");
    expect(layers?.leafFront).toBe(3);
    expect(layers?.leafBack).toBe(4);
    expect(layers?.staticRight).toBe(4);
    expect(layers?.rotationTo).toBe(-180);
  });

  it("brings the previous page back along the same arc in reverse", () => {
    const layers = turnLayers(single, 3, -1);

    expect(layers?.leafFront).toBe(2);
    expect(layers?.leafBack).toBe(3);
    expect(layers?.staticRight).toBe(3);
    // Reverse animates the same arc from its far end rather than a new one.
    expect(layers?.rotationFrom).toBe(-180);
    expect(layers?.rotationTo).toBe(0);
  });
});

describe("progress", () => {
  it("interpolates rotation and clamps outside the range", () => {
    const layers = turnLayers(spread, 3, 1);

    expect(layers).not.toBeNull();
    expect(rotationAt(layers!, 0)).toBe(0);
    expect(rotationAt(layers!, 0.5)).toBe(-90);
    expect(rotationAt(layers!, 1)).toBe(-180);
    expect(rotationAt(layers!, 4)).toBe(-180);
    expect(rotationAt(layers!, -2)).toBe(0);
  });

  it("swaps to the back face only after the sheet is edge-on", () => {
    expect(showsBackFace(0.49)).toBe(false);
    expect(showsBackFace(0.5)).toBe(true);
  });

  it("completes a slow drag only past the midpoint", () => {
    expect(shouldCompleteTurn(0.4, 0.2)).toBe(false);
    expect(shouldCompleteTurn(0.6, 0.2)).toBe(true);
  });

  it("completes a fast flick on less distance", () => {
    expect(shouldCompleteTurn(0.2, 3)).toBe(true);
    expect(shouldCompleteTurn(0.05, 3)).toBe(false);
  });

  it("settles proportionally and stays under the cap", () => {
    expect(settleDuration(0.9, true)).toBeLessThan(settleDuration(0.2, true));
    expect(settleDuration(0, true)).toBeLessThanOrEqual(450);
    expect(settleDuration(1, false)).toBeLessThanOrEqual(450);
    expect(settleDuration(0.99, true)).toBeGreaterThanOrEqual(120);
  });
});
