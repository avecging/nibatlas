/**
 * Passport page-turn geometry and the single transition controller.
 *
 * Everything about "which leaf moves, from where, to where" lives here as pure
 * functions so it can be tested without a renderer, and so pointer drags, button
 * presses, and keyboard input all go through exactly one path.
 *
 * ## The physical model
 *
 * Pages are the two faces of a leaf. Leaf `j` carries page `2j` on its front and
 * page `2j + 1` on its back.
 *
 * A desktop spread is identified by the index of its **right** page, `p`, which
 * is always odd: spread `p` shows page `p - 1` on the left and page `p` on the
 * right. Opening the cover lands on `p = 1`, so the first spread is pages 0 and 1.
 *
 * A forward turn takes the right leaf. Its bound edge stays on the spine, its
 * free right edge sweeps left, its front (`p`) rotates away and its back
 * (`p + 1`) comes to rest as the new left page. Meanwhile page `p + 2` is
 * revealed underneath on the right. The new spread is `p + 2`: left `p + 1`,
 * right `p + 2` — the leaf really did move from the right stack to the left one.
 *
 * A reverse turn is the inverse path, not a forward animation played backwards
 * with a negated scale. It takes the *left* leaf, hinges it on the spine from
 * the other side, and its front (`p - 1`) rotates away to reveal `p - 3`
 * underneath while its back (`p - 2`) settles as the new right page.
 */
export type BookMode = "spread" | "single";
export type TurnDirection = 1 | -1;

export interface BookGeometry {
  readonly mode: BookMode;
  readonly pageCount: number;
}

/** Which physical face sits where while a turn is in flight. */
export interface TurnLayers {
  /** Page resting on the left half, or `null` for none (inside front cover). */
  readonly staticLeft: number | null;
  /** Page resting on the right half, or `null` for none. */
  readonly staticRight: number | null;
  /** Half of the book the moving leaf starts on, and therefore its hinge side. */
  readonly leafSide: "left" | "right";
  /** Face visible when the turn begins. */
  readonly leafFront: number;
  /** Face that comes to rest when the turn completes. */
  readonly leafBack: number | null;
  readonly rotationFrom: number;
  readonly rotationTo: number;
}

export function firstPosition(mode: BookMode): number {
  return mode === "spread" ? 1 : 0;
}

export function lastPosition({ mode, pageCount }: BookGeometry): number {
  if (mode === "single") {
    return Math.max(0, pageCount - 1);
  }

  // Positions are the odd page indices. With an even page count the final spread
  // is (pageCount - 2, pageCount - 1).
  return pageCount <= 1 ? 1 : pageCount - (pageCount % 2 === 0 ? 1 : 2);
}

export function positionStep(mode: BookMode): number {
  return mode === "spread" ? 2 : 1;
}

/** Snaps an arbitrary page index onto a legal position for the current mode. */
export function normalizePosition(geometry: BookGeometry, position: number): number {
  const first = firstPosition(geometry.mode);
  const last = lastPosition(geometry);

  if (geometry.mode === "single") {
    return Math.min(last, Math.max(first, position));
  }

  // A page index maps to the spread that contains it: even pages sit on the
  // right, odd pages on the left of the following spread.
  const asRight = position % 2 === 1 ? position : position + 1;

  return Math.min(last, Math.max(first, asRight));
}

/** Pages visible in the settled state at `position`. */
export function visiblePages(
  geometry: BookGeometry,
  position: number,
): { readonly left: number | null; readonly right: number | null } {
  if (geometry.mode === "single") {
    return { left: null, right: position };
  }

  return {
    left: position - 1 >= 0 ? position - 1 : null,
    right: position < geometry.pageCount ? position : null,
  };
}

export function canTurn(
  geometry: BookGeometry,
  position: number,
  direction: TurnDirection,
): boolean {
  const target = position + direction * positionStep(geometry.mode);

  return (
    target >= firstPosition(geometry.mode) && target <= lastPosition(geometry)
  );
}

export function targetPosition(
  geometry: BookGeometry,
  position: number,
  direction: TurnDirection,
): number {
  return position + direction * positionStep(geometry.mode);
}

/**
 * The layer plan for a turn. `null` when the turn is not possible, which is how
 * the controller refuses input at the first and last page without a special case
 * at every call site.
 */
export function turnLayers(
  geometry: BookGeometry,
  position: number,
  direction: TurnDirection,
): TurnLayers | null {
  if (!canTurn(geometry, position, direction)) {
    return null;
  }

  if (geometry.mode === "single") {
    if (direction === 1) {
      // The current page lifts on its spine edge and turns away to the left,
      // uncovering the next page, which is also this leaf's own back face.
      return {
        staticLeft: null,
        staticRight: position + 1,
        leafSide: "right",
        leafFront: position,
        leafBack: position + 1,
        rotationFrom: 0,
        rotationTo: -180,
      };
    }

    // The previous page swings back in from the left along the same arc.
    return {
      staticLeft: null,
      staticRight: position,
      leafSide: "right",
      leafFront: position - 1,
      leafBack: position,
      rotationFrom: -180,
      rotationTo: 0,
    };
  }

  if (direction === 1) {
    return {
      // The outgoing left page is still there until the moving leaf lands on it.
      staticLeft: position - 1 >= 0 ? position - 1 : null,
      // Revealed progressively as the leaf lifts away.
      staticRight: position + 2 < geometry.pageCount ? position + 2 : null,
      leafSide: "right",
      leafFront: position,
      leafBack: position + 1 < geometry.pageCount ? position + 1 : null,
      rotationFrom: 0,
      rotationTo: -180,
    };
  }

  return {
    // Revealed as the left leaf lifts back towards the right.
    staticLeft: position - 3 >= 0 ? position - 3 : null,
    // The outgoing right page stays until the moving leaf covers it.
    staticRight: position,
    leafSide: "left",
    leafFront: position - 1,
    leafBack: position - 2 >= 0 ? position - 2 : null,
    rotationFrom: 0,
    rotationTo: 180,
  };
}

/**
 * Rotation for a normalized progress value.
 *
 * One shared 0-to-1 progress drives rotation, curvature, and shadow, so a
 * pointer drag at 40% looks exactly like a timed turn passing 40%.
 */
export function rotationAt(layers: TurnLayers, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));

  return layers.rotationFrom + (layers.rotationTo - layers.rotationFrom) * clamped;
}

/** Past the halfway point the leaf is edge-on and the back face takes over. */
export function showsBackFace(progress: number): boolean {
  return progress >= 0.5;
}

/**
 * Whether a release should complete the turn.
 *
 * A quick flick completes on less distance; a slow drag has to cross the
 * midpoint. Velocity is in progress units per second.
 */
export function shouldCompleteTurn(progress: number, velocity: number): boolean {
  if (velocity > 1.1) {
    return progress > 0.12;
  }

  return progress > 0.5;
}

/** Drag settle time, proportional to distance left and capped near 450 ms. */
export function settleDuration(progress: number, complete: boolean): number {
  const remaining = complete ? 1 - progress : progress;

  return Math.round(Math.min(450, Math.max(120, remaining * 520)));
}
