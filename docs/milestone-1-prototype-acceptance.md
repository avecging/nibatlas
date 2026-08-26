# Milestone 1 Prototype Acceptance

**Status:** Founder-approved implementation brief  
**Applies to:** Milestone 1 frontend prototype refinement  
**Primary mobile viewport:** 360 × 800 px  
**Desktop review viewport:** 1440 × 900 px  
**Last updated:** 26 August 2026

## Purpose

This brief converts the current product decisions into the acceptance target for the next Milestone 1 frontend pass.

The standalone prototype supplied on 26 August 2026 is the founder's latest interaction and visual reference. Preserve its good decisions and character, but do not copy implementation shortcuts that conflict with the repository specifications. Repository documents remain authoritative.

## Outcome

A first-time user should immediately understand that Nib Atlas helps them find physical fountain-pen shops and preserve verified visits as tactile stamp memories.

The complete prototype journey is:

> Explore Map → select a shop → open shop → simulate collection → see Visited update → open Passport → inspect the new impression

The product should feel quiet, warm, geographic, and collectible without becoming a game, a feed, or a tracking product.

## Primary information architecture

Use exactly three primary destinations:

1. **Map**
2. **Passport**
3. **Me**

Do not restore Discover or Saved as primary navigation.

- Discovery is an activity within Map. Contextual editorial prompts may suggest where to explore, but there is no feed-shaped Discover destination.
- Saved is a global Map mode/filter. It must let a user browse every saved shop across locations, not only saved shops in the current viewport.
- Me is one conventional page containing profile, countries/localities visited, account, settings, privacy, help, export/delete, and sign-out placeholders.
- Recent Impressions is deferred and must not appear. Avoid UI that makes users feel passively tracked or followed.

## Map

### Composition

- Map fills the working canvas around a persistent responsive app shell.
- Search stays near the top safe area.
- Mobile results use stable Peek, Half, and Full sheet states.
- Desktop uses a useful map/list composition rather than stretching the mobile sheet.
- Controls and sheet handles do not collide with browser or PWA safe areas.
- Every control and map target has at least a 44 × 44 px hit area.

### Search and viewport

- Search label: **Search shops or places**.
- Place and shop results are visibly distinguishable.
- Choosing a place moves and commits the viewport.
- Choosing a shop selects its marker and corresponding list/card.
- Manual pan and zoom do not continuously refresh results.
- Meaningful camera movement reveals **Search this area**.
- **Search this area** commits the camera bounds and active filters.
- Existing results stay visible while a prototype-local refresh is pending.

### States and synchronization

- Persisted marker priority is Visited → Saved → Unvisited.
- Selected is temporary and shown with a halo; it is not a persisted fourth status.
- Marker, card, shop detail, Saved mode, and Passport must agree after simulated collection.
- Card selection highlights its marker without discarding the broader viewport.
- Marker selection raises the mobile sheet to at least Peek and scrolls the relevant card into view.
- Dragging the sheet never pans the map.
- Browser Back dismisses transient layers and higher sheet states before leaving Map.

### Saved mode

- Saved belongs to Map and is reachable from an obvious labelled control.
- Entering Saved mode changes the result scope from the current viewport to all saved shops.
- Results remain grouped or searchable by geography where useful.
- Opening a saved shop can return to Map with that shop selected and the camera positioned appropriately.
- Do not add named trips, itinerary building, or a separate Saved primary destination.

## Shop data and detail

Use a deliberately small subset of real shops already researched or known to the project. This is prototype data, not a claim of a complete or continuously verified catalogue.

- Reuse only source-supported names, local-script names, locations, categories, links, and practical details.
- Omit uncertain fields rather than inventing realistic-looking facts.
- Show a quiet prototype/staging data notice at environment or page level, never inside a search field, status control, or shop fact.
- Include Singapore, Japan, and Taiwan where supported by existing research.
- Test long English, Japanese, and Traditional Chinese names.
- Use authorized or rights-cleared imagery only.

The first shop-detail viewport must establish:

- identity and local-script name where available;
- locality and primary shop type;
- why it may be worth visiting;
- practical operational status where reliably sourced;
- Save, Directions/official site, and simulated Collect Stamp actions.

Do not show ratings, price ranking, engagement counts, inventory, or invented freshness claims.

## Simulated collection

- Collection is simulated prototype state; it is not real visit verification.
- The ceremony is restrained: poised stamp → short press/impact → ink settles → date/place appears.
- Target 600–900 ms total.
- One soft haptic cue may be attempted only where supported and user-permitted.
- After collection, the shop becomes Visited exactly once everywhere.
- Reduced motion uses the completed impression with a short opacity transition under 150 ms.
- No confetti, points, rarity reveal, streaks, or loot-style language.

## Passport content

Passport contains shop stamps and derived geographic seals.

### Standard stamp rule

- The shared system has eight approved global ink colours.
- A standard stamp uses exactly one ink.
- Colour is place-sensitive art direction, but no colour belongs to a country, locality, shop tier, rarity, or achievement.
- Stamp palette version is pinned for deterministic regeneration.
- Dual-ink and spectrum/rainbow impressions are future editions and do not appear in Milestone 1.

### Derived geographic seals

- A locality seal derives from the first verified shop stamp acquired in that locality.
- If check-in is later adopted, it must produce the same canonical verified-visit event rather than a second eligibility system.
- A country seal derives after five verified shop stamps in that country, or after completing the eligible curated set when that versioned set contains fewer than five shops.
- Once earned, a locality or country seal is never revoked when the curated set expands.
- Prototype counters must not imply completeness unless their eligible set and version are explicit.

### Passport structure

- Milestone 1 uses one Passport, not a library of books.
- Multiple books / **A library of places I’ve visited** is recorded as a future scaling idea.
- Geography may organize the collection, but country/locality profile summaries also belong in Me.
- Selecting a shop stamp opens its shop and preserves return context.
- Empty states explain how collection works and return the user to Map.
- Recent Impressions is absent.

## Passport presentation and motion

The complete physical model is specified in `docs/passport-interaction-spec.md`. The following are release-blocking outcomes.

### Desktop

- Closed Passport is a thin modern passport viewed at a slight three-quarter angle, centred on a quiet desk-like field with enough surrounding space to read as an object.
- The cover has believable proportions, restrained grain, edge thickness, rounded corners, debossed/foil-like identity treatment, and a visible fore-edge. It must not look like a flat card or a heavy antique bible.
- Opening originates at the spine. The front cover rotates around its bound edge and reveals the first spread; it does not dissolve, mirror, or rotate around its centre.
- Open mode presents a complete two-page spread with a fixed central spine/gutter.
- Page turns preserve which leaf belongs to the left and right stacks. Direction cannot be faked by reversing an unrelated card animation.
- Shadows, curvature, and page thickness respond continuously to progress and settle cleanly without snapping.

### Mobile

- The MVP uses a portrait, single-page reading mode.
- The page occupies the useful width with comfortable margins and stable controls.
- Swipe/drag direction follows reading order; buttons and keyboard equivalents remain available.
- Do not require device auto-rotate, motion permission, landscape orientation lock, or a sideways grip.
- Manual sideways phone reading with an internally rotated 90° book and vertical drag gestures is explicitly post-MVP and documented separately.
- Reduced motion replaces 3D turning with an immediate page change and short cross-fade.

## Me

Me is deliberately conventional and trustworthy.

Show coherent prototype sections for:

- profile identity;
- countries and localities visited;
- account and sign-in state;
- preferences and accessibility;
- privacy policy;
- location/check-in explanation;
- data export and account deletion;
- help/contact;
- sign out.

Privacy copy must clearly distinguish active user actions from passive tracking. Do not imply background location history, surveillance, or automatic visit recording.

## Accessibility and PWA checks

- Semantic HTML, visible labels, visible focus, logical reading order, and focus restoration are required.
- Status never relies on colour alone.
- Map actions have list equivalents.
- Page-turn and stamp animations respect `prefers-reduced-motion`.
- Passport navigation works with touch, mouse, keyboard, and labelled buttons.
- Test at 200% zoom.
- Test mobile Safari and Android Chrome as an installed or add-to-home-screen PWA where possible.
- Do not depend on browser APIs whose permission or support is inconsistent for the core MVP journey.
- Prevent clipped content under notches, home indicators, and browser chrome.

## Acceptance scenarios

The frontend PR is ready for founder review when these journeys work:

1. Open Map without authentication or location permission.
2. Search for a place and a shop, distinguish them, and commit the moved viewport.
3. Pan without a request storm, then use **Search this area**.
4. Select a marker and see the matching selected card.
5. Move the mobile sheet through Peek, Half, and Full without panning the map.
6. Enter global Saved mode and find a saved shop outside the previous viewport.
7. Open a shop and understand why/how to visit from the first viewport.
8. Simulate one shop-stamp collection and see Visited update once everywhere.
9. Open Passport on mobile and navigate the single-page collection.
10. Open Passport on desktop, inspect the closed object, open from the spine, and turn pages in both directions.
11. See locality/country seal logic represented without an unversioned completeness claim.
12. Open Me and find profile geography, privacy, account, and data controls.
13. Complete the core journey with keyboard navigation and reduced motion.

## Evidence required in the frontend PR

Provide screenshots or short recordings for:

- 360 × 800: initial Map, selected + Peek, Half, Full, global Saved mode, shop first viewport, post-collection state, Passport single page, and Me;
- 768 × 1024: Map and Passport;
- 1440 × 900: closed Passport, opening transition, open spread, and reverse page turn;
- reduced-motion collection and Passport transitions;
- real-device mobile PWA check on iOS Safari and Android Chrome, with device/browser versions;
- `pnpm verify`, `pnpm test:e2e`, and `pnpm build:cloudflare` results;
- explicit visual debt and any source fields deliberately omitted.

## Out of scope

- Recent Impressions.
- Discover or Saved primary navigation destinations.
- Manual sideways/rotated phone-reading mode and rotate-phone tutorial.
- Multiple Passport books.
- Real authentication, persistence, saves, location verification, or check-ins.
- Dual-ink and spectrum/rainbow editions.
- Production catalogue completeness.
- Reviews, ratings, feed, social profiles, named trips, achievements, merchant tools, or campaigns.
- Database migrations, API contracts, Cloudflare configuration, CI, or secrets.
