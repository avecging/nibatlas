# Future Enhancement — Manual Sideways Passport Reading

**Status:** Deferred; post-MVP candidate for late closed beta  
**Last updated:** 26 August 2026

## Concept

On a portrait phone, the user may explicitly choose a sideways reading mode without enabling system auto-rotate. Nib Atlas keeps the web app in its existing portrait viewport and rotates only the Passport presentation by 90 degrees. With the phone held sideways, the book reads like a landscape spread.

Because the interface is internally rotated, the physical gesture mapping changes:

- drag up/down in the portrait coordinate system;
- this feels like a horizontal page turn after the user holds the phone sideways;
- labelled on-screen controls remain available.

This is technically feasible in a PWA with CSS transforms and pointer-coordinate mapping. It does not require device-orientation sensors, motion permission, or a screen-orientation lock.

## Why deferred

The mode adds meaningful interaction and testing complexity:

- transformed viewport sizing and safe-area calculations;
- remapping pointer deltas and velocity;
- accessibility reading order while the visual surface is rotated;
- browser chrome differences in iOS Safari, Android Chrome, and installed PWA modes;
- keyboard, focus-ring, modal, and hit-target positioning;
- coexistence with system auto-rotate;
- discoverability without interrupting users who prefer portrait.

It must not be a dependency of the core Passport experience.

## Proposed entry

Expose a clearly labelled manual action such as **Read sideways** from the Passport view. Do not detect or infer the user's physical orientation.

On first use only, show a short non-blocking cue:

1. phone begins upright;
2. phone rotates 90 degrees;
3. the Passport settles into a spread;
4. one vertical drag indicator demonstrates page movement.

Target duration: about 3 seconds. Include **Skip**, never replay automatically after dismissal, and reduce the cue to a static illustration under reduced motion.

The cue explains an optional control; it does not ask the user to enable system auto-rotate.

## Interaction behavior

- Rotate the book stage, not the entire application shell.
- Keep exit, help, and accessibility controls reachable and logically oriented.
- Translate pointer movement into book-local coordinates before calculating page progress.
- Use vertical screen-space drag as the primary page gesture in portrait coordinates.
- Preserve previous/next buttons as a no-gesture alternative.
- Do not request motion/orientation permission.
- Do not attempt to override OS orientation.
- If the browser or device is physically rotated with auto-rotate enabled, recompute layout and avoid applying a second unintended rotation.

## Beta decision gate

Consider implementation only after the portrait single-page MVP is stable. A late closed-beta test should answer:

- Do users discover the mode without being interrupted?
- Does it make the Passport feel more book-like?
- Do users understand how to hold the phone and turn pages?
- Are accidental exits, scroll conflicts, or double-rotation common?
- Does it remain usable on current iOS Safari, Android Chrome, and installed PWA surfaces?
- Is the experience worth its maintenance and accessibility cost?

Ship beyond beta only if real-device task completion and qualitative feedback are materially better than the portrait reader.
