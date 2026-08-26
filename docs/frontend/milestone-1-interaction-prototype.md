# Milestone 1 — frontend interaction prototype

Owner: Claude Code. Scope is exactly the Milestone 1 section of
`IMPLEMENTATION-PLAN.md`, refined by
`docs/milestone-1-prototype-acceptance.md` and
`docs/passport-interaction-spec.md`. Nothing here talks to a database, an API, or
an authentication provider.

## Information architecture

Primary navigation is exactly three destinations: **Map**, **Passport**, **Me**.

- **Discover is not a destination.** Exploring is what Map is for. Contextual
  place prompts appear inside Map's results panel when a search comes back empty,
  and nowhere else.
- **Saved is a mode Map owns.** It has a route so Back leaves Saved before it
  leaves Map, and so a saved shop is linkable, but the screen, the map, and the
  navigation are Map's. Entering it replaces the result *scope*: every saved shop
  everywhere, not the saved shops inside the current viewport.
- **Recent Impressions is absent**, including from the domain projection, so no
  surface can quietly reintroduce it.

## Routes

| Route | Screen | Rendering |
| --- | --- | --- |
| `/` | Map, search, filters, results | Client (map island) |
| `/saved` | Map in global Saved mode | Client |
| `/passport` | The Passport book | Client |
| `/passport/[country]` | The book opened at that country's first locality | Client |
| `/passport/[country]/[locality]` | The book opened at that locality | Client |
| `/shops/[slug]` | Shop detail (statically generated per shop) | Server + action islands |
| `/me` | Profile, geography, account, preferences, privacy, data, help | Client |
| `/privacy` | Plain-language privacy page | Server |
| `/account` | Compatibility redirect into `/me` | Server |
| `/styleguide` | Internal component states, `noindex` | Server |

`/` accepts two deep links: `?shop=<slug>` selects and reveals a shop,
`?destination=<id>` commits a place viewport. `/shops/[slug]` accepts
`?from=map|saved|passport`, which decides only where its single Back control
points; the stable URL stays canonical.

## Interaction contracts

- **Committed bounds versus camera.** `ExploreState` holds `committed` (what the
  displayed results were queried for), `camera` (what the user is looking at),
  and `query` (the parameters of the last committed search). Only a change to
  `query` triggers a fetch, so panning and zooming can never refetch.
- **Search this area.** Offered after meaningful movement — a quarter of the
  committed viewport span, a whole zoom step, or the committed centre leaving the
  camera — or after an uncommitted filter change. Never while a query is in
  flight. The pill tracks the sheet's height so it always sits above it, and
  steps aside at Full where the sheet covers the map.
- **Camera move source.** MapLibre movement is classified as `user` or
  `programmatic`. Programmatic moves (the initial fit, a container resize, a
  destination fly) adopt the new camera silently. A gesture that interrupts a
  programmatic fly counts as user movement.
- **Selection.** One selected shop id is shared by map and list. Selection is not
  navigation; opening detail is a separate action. A selected shop is never
  hidden inside a cluster, and revealing it pans only far enough to bring it
  inside a 72 px inset rather than recentring the map.
- **Search results.** Places and shops are separate lists with separate group
  headings, a different icon, a different edge colour, and a different meta
  prefix. Choosing a place moves and commits the camera; choosing a shop selects
  its marker and card. Selecting a result never reopens the panel over the map.
- **Filters.** Status and shop-type filters are drafted locally and applied only
  when the next search is committed. The bar says so while a change is pending.
- **Results sheet.** Peek, Half, and Full. The drag target is confined to the
  handle, which sets `touch-action: none`, so a sheet gesture can never reach the
  map. During a drag the height tracks the pointer and settles to the nearest
  state; a tap cycles and the arrow keys step. Peek deliberately shows the count
  and the first card only — filters at that height would be clipped mid-row.
- **Failure.** A failed viewport request keeps the previous results usable and
  offers Retry.

## The Passport book

The physical model lives in `src/features/passport/book-controller.ts` as pure
functions, so "which leaf moves, from where, to where" is unit-testable without a
renderer.

- Pages are the two faces of a leaf: leaf `j` carries page `2j` on its front and
  `2j + 1` on its back.
- A desktop spread is named by its **right** page `p` (always odd) and shows
  `p - 1` on the left. Opening lands on `p = 1`.
- A **forward** turn takes the right leaf, hinges it on the spine, rotates its
  front (`p`) away, and settles its back (`p + 1`) as the new left page while
  `p + 2` is revealed underneath. The new spread is `p + 2` — the leaf really
  moved from the right stack to the left one.
- A **reverse** turn is the inverse path, not a forward animation negated: it
  takes the *left* leaf, hinges on the same spine from the other side, and
  settles its back as the new right page.
- Mobile uses the approved portrait single-page reader. Origin, direction,
  content order, and gesture stay coherent; nothing depends on orientation,
  auto-rotate, or motion sensors. The manual sideways mode in
  `docs/future/passport-sideways-reading-mode.md` has no code path here.

One transition controller serves pointer drags, the pager buttons, and the
keyboard, and every entry point refuses while a turn is in flight, so repeated
input cannot interleave two turns. A second activation during the cover swing
completes it rather than queueing another.

Timings: cover 760 ms, programmatic turn 560 ms, drag settle proportional and
capped at 450 ms. Under `prefers-reduced-motion` there is no perspective
rotation, parallax, or curl: content changes immediately with a fade under
150 ms, and every control, announcement, and focus move is unchanged.

### One documented deviation

`docs/passport-interaction-spec.md` asks for the closed book to be centred *and*
for the spine to stay fixed in world space while opening. Those cannot both hold,
because opening a passport grows the object leftwards from its spine. The book
box is therefore always two leaves wide with the spine at its centre, and the
whole object — block, shadow, cover, and pages together — translates half a leaf
as it opens, over the same duration and easing as the cover swing. The spine
never moves relative to any other part of the object, and the cover still rotates
only about its bound edge. The closed state is additionally scaled to about 46%
of the shorter content dimension, inside the specified 38–52% band; the open
spread takes the room it needs to stay readable.

## Stamps and seals

- `src/domain/stamp-palette.ts` holds the eight shared global inks and the pinned
  palette version. Ink is a pure function of the stamp key via a small FNV-1a
  hash: no country, locality, shop type, or collection order feeds into it, so no
  colour can accumulate a meaning. Tier is carried by frame anatomy instead —
  rounded for a shop, cornered for a locality, double-ruled for a country.
- A standard stamp uses exactly one ink. Dual-ink and spectrum editions have no
  code path; the Taiwan Sun-Star Coiro reference informs future work only.
- `src/domain/seals.ts` derives geographic seals from verified shop stamps, never
  from a separate action. A locality seal comes from the first stamp there. A
  country seal comes from five stamps, or from completing a versioned curated set
  smaller than five. Earned seals are persisted with the coverage-set version in
  force at the time and are carried through unchanged, which is how "never
  revoked when the catalogue expands" is implemented: recomputing from
  collections alone would revoke a seal the moment its curated set grew.
- The only `x / y` counts in the interface are against an explicit named
  coverage-set version. Everything else is a plain count.
- The ceremony runs 780 ms: poised, press, settle, then place and date. No
  confetti, points, rarity, streaks, or reward language. One soft haptic cue is
  attempted where the platform supports it and is never required.

## Data seams

| Seam | Milestone 1 implementation | Replaced in |
| --- | --- | --- |
| `ShopSource` | `createFixtureShopSource` over `prototypeShopSummaries` | Milestone 3 (`GET /api/v1/shops/viewport`) |
| `DestinationGeocoder` | `createFixtureGeocoder` | Milestone 3 (MapTiler geocoding) |
| `MapStyleProvider` | Offline graticule style for tests; MapTiler geography when a key is set | Milestone 3 |
| `MapTelemetry` | No-op recorder with the approved event names | Milestone 8 |
| `CollectionStore` | Session-scoped simulated saves, impressions, and seals | Milestones 4 and 5 |

The public projection carries no user state: `createFixtureShopSource` always
returns `markerState: "unvisited"`, and saved/visited identifiers are merged in
the client through `decorateResults`. This mirrors the cacheable-public-payload
rule in `DATA-MODEL.md`.

## Prototype catalogue

`src/fixtures/prototype-catalogue.ts` holds ten real shops across Singapore,
Japan, and Taiwan — including Tainan and Kaohsiung, and Yokohama and Kobe beyond
Tokyo. Every record carries at least one `ShopSourceRef` naming the source, the
date it was read, and the fields it actually confirms, and the shop page renders
that list under **Where this came from**.

The rule is omission, not approximation:

- no opening hours unless the shop's own site or a brand's own dealer directory
  publishes them;
- no address for a shop whose only sourced address is a company office rather
  than a confirmed shopfront;
- no brand list, description, appointment note, or accessibility note that a
  source did not support;
- no photographs anywhere — no image in this set is rights-cleared;
- no `sourceQuality: "verified"` on any record.

Coordinates are the one unavoidable approximation: a map prototype needs a point
and none of these is surveyed. Each record states its `positionPrecision`
(`street` from a sourced address, `locality` where only the locality is known)
and the shop page labels every position as approximate and unsurveyed.

`src/fixtures/prototype-passport.ts` seeds six simulated impressions with fixed
dates, chosen to exercise every seal rule at once: Singapore's curated set of two
is complete (the one case where "complete" is licensed), Japan and Taiwan show
honest progress against their named set versions, and five localities each derive
a locality seal.

`src/fixtures/demo-shops.ts` remains the shared Codex-owned fixture and is
untouched. Milestone 1 no longer builds on it — its three records are invented
and the acceptance brief calls for real shops — but it stays in place with its own
test so the shared contract keeps its example.

## Accessibility

- Every map result has a list equivalent; markers are real focusable buttons with
  text labels.
- Status is carried by shape, icon, and text as well as colour.
- Controls are at least 44 × 44 px; inline prose links are exempt by WCAG.
- Dialogs trap focus, restore it on close, and close on Escape.
- A Passport page turn moves focus to the new page heading and is announced
  politely; arrow keys work from anywhere inside the book.
- `--text-muted` fails AA at 12–14 px on both white and the warm surface, and was
  replaced with `--text-secondary` on the source list, the Me statistics, the
  coverage-set lines, and the location explainer note. Vermilion on the
  Vermilion 100 surface is only 3.66:1 at caption size, so the earned-seal chip
  uses a white surface with a vermilion border and keeps its icon and label.

## Tests

| Command | Covers |
| --- | --- |
| `pnpm test` | Domain logic, clustering, explore reducer, stamp palette, seal derivation, book geometry, Passport page model, fixture source, geocoder, collection store, and component state |
| `pnpm test:e2e` | Journeys, Passport mechanics, accessibility (axe), reduced motion, and the mobile sheet at 360 × 800, 768 × 1024, and 1440 × 900 |
| `VISUAL=1 pnpm test:e2e --project=visual` | Screenshot baselines at the three breakpoints |

Playwright runs against a production build (`pnpm build && pnpm start`) so the
journeys match what CI deploys. Visual baselines are opt-in because rendering
differs between container images; refresh them with
`VISUAL=1 pnpm test:e2e --project=visual --update-snapshots`.

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` is an escape hatch for environments that ship a
Chromium build but not the exact revision this Playwright version downloads. CI
installs browsers normally and leaves it unset.

## Known gaps

- **Near Me is not built.** It needs real location access, which Milestone 1
  excludes. Place search covers the same need in the meantime.
- **No imagery.** No rights-cleared photography exists, so cards use a serif
  monogram and shop pages show no image frame at all rather than an empty one
  that reads as a failure to load.
- **Coordinates are unsurveyed.** Milestone 7 replaces them with verified
  positions; the interface says so in the meantime.
- **The offline basemap draws only a graticule.** It needs no tiles and no key,
  which keeps tests deterministic. Staging and production use MapTiler geography
  when a restricted browser key is supplied at build time. The MapLibre worker is
  served as a same-origin static asset; see `docs/adr/0002-maplibre-worker.md`.
- **Visual baselines are not enforced in CI** until a canonical runner image is
  agreed, and the previous baselines were deleted rather than migrated because
  every screen in the set changed.
- **The Nib Atlas mark still needs small-size artwork.** The founder's drawn mark
  is now in place, but `BRAND.md` asks for simplified artwork below roughly 20 px
  before public launch.
