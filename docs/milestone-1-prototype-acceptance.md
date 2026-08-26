# Milestone 1 Prototype Acceptance — Mobile Map First

**Status:** Founder-directed implementation brief  
**Applies to:** Milestone 1 frontend prototype refinement  
**Primary viewport:** 360 × 800 px  
**Last updated:** 26 August 2026

## Purpose

This brief converts the approved product, brand, UX, and stamp-system decisions into a focused acceptance target for the next Milestone 1 frontend pass.

The attached standalone prototype supplied on 26 August 2026 is a useful interaction study, not a new source of product truth. Where it conflicts with `PRODUCT.md`, `BRAND.md`, `UX.md`, or `IMPLEMENTATION-PLAN.md`, those repository documents and the corrections below win.

## Outcome

At 360 × 800, a first-time user should immediately understand that Nib Atlas is a map for finding physical fountain-pen shops. The screen must feel like a real product, not an annotated prototype or component demonstration.

The complete fixture journey remains:

> Explore map → select shop → open shop → simulate collection → see the visited state → open Passport

## Keep from the 26 August prototype

- Map-first composition with search above the map.
- Calm Paper / Atlas Navy cartographic treatment.
- Distinct marker silhouettes for unvisited, saved, visited, and selected.
- Results sheet layered over the map.
- Editorial serif for shop identity and Passport; sans-serif for controls and metadata.
- Shop detail organised around whether and how to visit.
- Restrained stamp impression treatment and archival Passport mood.
- List view as the immediately usable Passport presentation.
- Reduced-motion support for collection and page/sheet movement.

These are directions to refine, not permission to preserve conflicting navigation, stamp types, fixture claims, or incomplete sheet behaviour.

## Required corrections

| Current prototype behaviour | Required Milestone 1 behaviour |
| --- | --- |
| Three tabs: Map, Passport, Me | Four primary destinations: Map, Discover, Passport, Saved |
| “Me” opens Passport | Remove “Me” from primary navigation; account/preferences belong behind a later avatar menu |
| “Demo” appears inside the search pill | Functional controls contain only customer-facing copy; any staging/demo notice is environment chrome and is absent from production |
| All / Saved / Visited segmented control | Status options are All, Unvisited, Visited, Saved |
| Only two sheet heights are implemented | Provide stable Peek, Half, and Full states |
| Country and city stamps appear in Passport | Milestone 1 displays shop-stamp fixtures only |
| Country/city completion and unversioned totals are shown | Show collected counts only; no `x / y` or implied completeness without a versioned curated coverage set |
| Stamp colours imply geographic or tier meaning | One approved ink per stamp from the shared eight-colour global palette; no country or tier owns a colour |
| Synthetic shops resemble verified real businesses | Fixtures must be unmistakably demo data and must not present invented business details as verified fact |
| Search is a visual placeholder only | Destination and shop-name results are visually distinguishable in the mocked flow |
| Filter changes update immediately | Active filters update the displayed map/list only when the viewport query is committed |
| Prototype title/helper language leaks into the product surface | No implementation notes, helper commentary, acceptance text, or “prototype” status appears in customer-facing UI |

## 360 × 800 composition

### App shell

- Map fills the working canvas above the persistent bottom navigation.
- Bottom navigation contains Map, Discover, Passport, and Saved, in that order.
- Every navigation target is at least 44 × 44 px and has both icon and visible label.
- No account, location, or sign-in prompt appears on initial load.
- Search remains near the top safe area and does not obscure essential map controls.

### Search

- Default label: **Search shops or places**.
- Mock results are grouped or labelled as:
  - **Places** for destinations/localities;
  - **Shops** for canonical shop results.
- Choosing a place moves the camera and commits that viewport.
- Choosing a shop selects its marker and raises the results sheet.
- The search surface does not contain “Demo,” “Prototype,” implementation state, or explanatory prose.

### Map and viewport

- Manual pan and zoom never trigger continuous result fetching.
- Meaningful movement reveals **Search this area**.
- **Search this area** commits current camera bounds and active filters.
- Old results remain visible while the mock refresh is loading.
- Marker priority remains Visited → Saved → Unvisited; Selected is a temporary halo.
- Every marker result has an equivalent list/card item.

### Results sheet

Three stable states are required:

| State | 360 × 800 intent |
| --- | --- |
| Peek | Result count plus selected/first shop summary while most of the map stays visible |
| Half | Browsable cards with enough map context to understand location |
| Full | Scrollable results and filter access; map remains behind |

- Marker selection raises the sheet to at least Peek and scrolls to the corresponding card.
- Card selection highlights the corresponding marker without resetting the broader viewport.
- Dragging the sheet must not pan the map.
- Browser Back closes Full → Half/Peek → transient layers before leaving the map route.
- The locate control must not collide with the sheet handle or navigation.

### Shop card

Required hierarchy:

1. Shop name.
2. Local-script name where available.
3. Locality/neighbourhood and primary shop type.
4. One useful specialty/service line.
5. Reliable operational cue.
6. Saved/Visited state using text/icon as well as colour.

Do not show ratings, price, inventory, ranking, engagement cues, or implementation notes.

### Shop detail

The first mobile viewport must establish:

- shop identity and local-script name;
- locality and primary type;
- why it may be worth visiting;
- operational state where reliable;
- Save, Directions/official site, and simulated Collect Stamp actions.

Further down, show practical information, services/specialties, appointment/accessibility notes where fixture data supports them, official links, and data freshness. Do not invent factual details for real shops.

### Simulated collection

- Collection remains explicitly simulated in Milestone 1 test logic, not described as a real verification claim in customer UI.
- Use one shop stamp only.
- After collection, the same shop becomes Visited on marker, card, detail, and Passport exactly once.
- The ceremony should be brief and restrained.
- Reduced motion shows an immediate impression with an opacity transition under 150 ms.
- No country stamp, city stamp, completion unlock, rarity, points, confetti, or reward language.

### Passport

- Default mobile presentation is a usable list/collection view.
- An experimental book view may remain only if it does not replace or obstruct the accessible list.
- Show total collected shops, countries represented, localities represented, recent impressions, and shop stamps.
- Geography is organisational hierarchy, not a source of collectible country/city stamps.
- Selecting a stamp opens its shop while preserving return context.
- Empty states explain how to collect a shop stamp and link back to the Map.
- Do not show unversioned denominators, locked silhouettes, or artificial completion.

### Discover and Saved

Milestone 1 needs coherent fixture screens, even when deliberately light:

- Discover uses rule-based/editorial prompts and must not become a feed.
- Saved shows bookmarked fixture shops and returns to the map with a shop selected.
- Neither screen should contain prototype commentary or future-feature explanations.
- No named trips, itineraries, social features, ratings, merchant tools, or user profile feed.

## Fixture policy

- Synthetic data uses reserved fixture IDs and an environment-level **Demo / Not production data** treatment.
- Do not place the demo label inside search, filters, shop status, or another functional control.
- Do not use invented business details that could be mistaken for facts about a real shop.
- Long English, Japanese, and Traditional Chinese names remain in the fixture set for layout testing.
- Launch geography fixtures cover Singapore, Japan, and Taiwan without implying catalogue completeness.

## Accessibility and interaction checks

- All controls and interactive map targets have at least 44 × 44 px hit areas.
- Visible focus, semantic names, keyboard operation, and focus restoration are required.
- Status never relies on colour alone.
- Bottom-sheet semantics expose the current state and controls to screen readers.
- Test at 200% zoom.
- Verify long English, Japanese, and Traditional Chinese names without clipping or forced CJK letter spacing.
- Respect `prefers-reduced-motion` for sheet, marker, Passport, and ceremony motion.

## Acceptance scenarios

The next pass is ready for founder review when all of these work at 360 × 800:

1. Open the map without authentication or location permission.
2. Search for a destination, distinguish it from a shop result, and commit the moved viewport.
3. Pan the map without a request storm; use **Search this area** to refresh.
4. Select a marker and see the same shop selected in the results sheet.
5. Move the sheet through Peek, Half, and Full without panning the map.
6. Open the selected shop and understand why/how to visit from the first viewport.
7. Simulate one shop-stamp collection and see Visited update once everywhere.
8. Open Passport and find that shop stamp without encountering country/city stamps or completion denominators.
9. Reach Discover and Saved from the four-item primary navigation.
10. Complete the journey with keyboard navigation and reduced motion enabled.

## Evidence required in the frontend PR

- Screenshots at 360 × 800 for:
  - initial Map;
  - selected marker + Peek;
  - Half and Full sheet;
  - shop first viewport;
  - post-collection visited state;
  - Passport list;
  - Discover;
  - Saved.
- One 768 × 1024 and one 1440 × 900 integration screenshot.
- Updated Playwright coverage for the ten acceptance scenarios above.
- Axe smoke result and reduced-motion result.
- Explicit list of any remaining visual debt.

## Out of scope

- Real auth or saves.
- Real PostGIS/API integration.
- Real location verification.
- Country/city collectible stamps.
- Merchant claims or custom merchant stamps.
- Reviews, ratings, achievements, campaigns, named trips, or social profiles.
- Final production data, imagery, or logo commissioning.
