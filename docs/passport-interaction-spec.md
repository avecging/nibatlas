# Passport Interaction Specification

**Status:** Milestone 1 implementation specification  
**Last updated:** 26 August 2026

## Intent

Passport should feel like a modern travel document that contains personal ink impressions. It is tactile and believable, but never a heavy antique book, a novelty 3D demo, or a blocking animation.

The physical metaphor serves comprehension:

- the spine explains where pages originate;
- left and right page stacks explain progress;
- the cover makes entering Passport feel ceremonial;
- direct controls keep the content usable.

The underlying collection remains semantic HTML. Three-dimensional treatments enhance it; they do not become the only way to read or navigate it.

## Physical reference

Use the proportions and restraint of a contemporary passport:

- compact, thin cover;
- softly rounded corners;
- modest page block, approximately 24–40 leaves visually rather than hundreds;
- flexible cover with slightly greater thickness than an inner leaf;
- off-white inner stock;
- restrained cover grain and debossed or foil-like identity;
- no ornate clasps, leather tooling, exaggerated deckled edges, or massive spine.

Visual thickness is representative, not a literal page count. It should remain stable as the collection grows.

## State model

Passport has four presentation states:

1. **Closed** — cover visible; collection content is not yet exposed.
2. **Opening** — front cover rotates around the bound spine.
3. **Open and settled** — current page or spread is readable.
4. **Turning** — one leaf moves from its source stack to the destination stack.

Opening and turning are distinct transitions. The implementation must not reuse a generic card flip with different labels.

Remember position as content, not a page number: pagination changes as the
collection grows. Storage depends on the collection source:

- **Account/API mode:** keep place, collection anchor and list scroll position in
  owner-scoped memory only. Returning from a shop within that mounted account
  restores the position. Reload or owner disposal does not promise restoration;
  sign-out/account changes discard it. Never write account geography, impression
  IDs or scroll position to local storage.
- **Fixture/reviewer mode:** its audience-separated device store may persist the
  simulated collection's reading position across reloads and browser sessions.
- List/Book choice and whether the cover was opened may persist per device in
  either mode; these preferences do not identify visited places.

See `docs/api/collections-v1.md` for the account boundary.

Book mode is one of two peer presentations of the same collection; `UX.md` covers the List mode this specification does not describe.

## Desktop composition

### Closed

At widths of 1024 px and above:

- centre the closed book within the content region, with generous negative space;
- show it at a restrained three-quarter angle: the cover plane is readable, the fore-edge and a hint of the page block are visible;
- keep the spine on the left for left-to-right reading;
- use contemporary passport proportions, roughly 1:1.4 in the closed state;
- let the book occupy roughly 38–52% of the shorter available content dimension;
- use one soft contact shadow and subtle ambient shadow;
- keep the page block thin enough that the object reads as a passport rather than a bible;
- provide a clear **Open Passport** action; clicking/tapping the cover may be an equivalent shortcut.

The cover treatment should include the Nib Atlas mark and title with restrained emboss/foil cues. It must remain legible without relying on texture.

### Opening

- The spine stays fixed in world space.
- The front cover rotates around its bound left edge.
- The cover's right edge travels in an arc; the cover does not scale through zero, mirror, dissolve, or rotate around its centre.
- Reveal the page block progressively as the cover opens.
- Shadow moves from beneath the closed object toward the inside gutter and desk surface.
- Settle into a near-flat two-page spread with slight natural curvature at the gutter.
- Recommended duration: 650–850 ms with an ease-out settle.
- The user may skip/complete the transition with another activation; input must not queue multiple openings.

### Open spread

- Show a complete left and right page together.
- The central spine/gutter remains fixed and visually continuous.
- Both outer page stacks are subtly visible at the fore-edges.
- The spread fits without horizontal page scrolling at the review viewport.
- Content within each page may scroll only if unavoidable; prefer pagination that keeps one spread stable.
- Page controls are visible, labelled, and placed outside important stamp content.
- Keyboard: Left Arrow = previous, Right Arrow = next; Home/End may jump to first/last.
- Focus moves to the new page heading after a button or keyboard turn and is announced politely.

## Mobile composition

Below 1024 px, the MVP uses a portrait single-page reader.

- One logical page fills the useful width with stable outer margins.
- Keep a restrained page edge and gutter cue, but do not squeeze a two-page spread onto portrait screens.
- The header identifies Passport and the current geographic grouping.
- Previous/next buttons remain visible and labelled.
- Horizontal drag/swipe follows reading order and has a distance/velocity threshold.
- A partial drag tracks the pointer; release below threshold returns to the current page.
- Vertical document scrolling wins over page navigation when gesture intent is primarily vertical.
- Do not require landscape, screen-orientation lock, accelerometer access, or auto-rotate.
- Preserve safe-area padding in installed PWA and browser modes.

The deferred manual sideways mode is specified in `docs/future/passport-sideways-reading-mode.md`; it must not complicate the MVP code path.

## Spine-aware page turning

Treat each page turn as movement of one leaf between two stacks.

### Forward turn

For left-to-right reading on desktop:

1. The source leaf is the current right page.
2. Its bound edge stays attached to the central spine.
3. The free right edge follows the user's pointer or the timed animation.
4. The leaf bends through a shallow curve; it does not remain a rigid rectangle throughout.
5. The visible face changes only as the sheet physically crosses edge-on.
6. The leaf settles as the new left page.
7. The right stack loses one leaf and the left stack gains one.

A reverse turn starts from the current left page and follows the inverse physical path. It is not a forward animation played with an arbitrary negative scale.

On mobile, the single-page transition may simplify the visible stack, but origin, direction, content order, and gesture must remain coherent.

### Rendering model

Prefer CSS transforms and small DOM layers over a heavy book library for Milestone 1.

Suggested layers:

- stationary left page;
- stationary right page;
- turning leaf front;
- turning leaf back;
- gutter shadow;
- moving leaf shadow/highlight;
- left and right page-stack edges.

Use a shared normalized progress value from 0 to 1. Derive rotation, curvature approximation, shadows, and visibility from that progress so pointer-driven and timed turns behave consistently.

A practical approximation may use:

- `transform-origin` at the spine;
- `perspective` on the book stage;
- `rotateY` for the main turn;
- one or two nested wrappers for mild bend;
- clipped gradient overlays for self-shadow;
- no canvas/WebGL requirement.

The leaf front and back must not both be legible simultaneously. Use backface visibility and content swapping carefully to prevent mirrored text.

## Interaction rules

- Buttons, keyboard, and direct gestures all call one transition controller.
- Only one transition runs at a time.
- During a drag, prevent text selection on the active leaf only.
- Pointer capture begins after page-turn intent is established.
- Cancelled drag returns smoothly to its source state.
- A fast swipe may complete with less distance; a slow drag requires crossing the midpoint.
- Do not hijack a gesture begun on links, controls, or scrollable stamp content.
- Browser Back exits a stamp detail or Passport overlay before leaving the route.
- The current page is addressable or recoverable so returning from a shop preserves context.

## Motion timing

- Cover open: 650–850 ms.
- Programmatic page turn: 480–700 ms.
- Drag settle: proportional to remaining distance, capped near 450 ms.
- Control feedback: 120–180 ms.
- Avoid elastic overshoot; paper settles with a quiet ease-out.
- Maintain a responsive frame rate on mid-range mobile devices. Reduce shadow layers before reducing input fidelity.

## Reduced motion

When `prefers-reduced-motion: reduce` is active:

- do not use perspective rotation, parallax, or page curl;
- opening changes from cover to content immediately with a cross-fade no longer than 150 ms;
- page navigation changes content immediately with the same short fade;
- preserve focus, page announcements, and all controls;
- never require a gesture to reveal content.

Offer no separate motion toggle in Milestone 1 unless the application already has a central accessibility preference.

## Responsive fallback

If 3D transforms or pointer events are unavailable, show the same semantic pages in a simple paginated reader. The core content, stamp selection, and return-to-map actions must remain complete.

## Performance constraints

- Animate only transforms and opacity where possible.
- Avoid layout reads and writes in the same animation frame.
- Do not rasterize full book spreads at device-native resolution.
- Use responsive stamp art and lazy-load non-current pages.
- Keep at most the current, previous, and next logical spreads mounted unless accessibility testing requires a different strategy.
- Test with CPU throttling and on real mobile Safari/Chrome, not desktop emulation alone.

## Acceptance checks

1. Closed desktop object reads as a thin modern passport.
2. Opening remains attached to the left spine throughout.
3. A forward desktop turn moves the right leaf to the left stack.
4. A reverse desktop turn moves the left leaf to the right stack.
5. Pointer drag and button-triggered turns settle to the same final states.
6. Text is never mirrored or visible through the wrong face.
7. Rapid repeated input does not corrupt page order.
8. Mobile shows one readable portrait page without requiring rotation.
9. Vertical scrolling and horizontal page gestures do not fight.
10. Keyboard and labelled controls complete the same journey.
11. Reduced motion removes spatial animation without removing content.
12. Returning from a stamp's shop restores the prior Passport context, including the exact page when a locality spans more than one.
13. Fixture/reviewer reading position survives reload and a new browser session.
14. Account reading position survives route navigation in owner-scoped memory,
    never enters device storage, and is discarded on owner disposal. Device
    List/Book preference may persist without private geography.
