# Milestone 1 — frontend interaction prototype

Owner: Claude Code. Scope is exactly the Milestone 1 section of
`IMPLEMENTATION-PLAN.md`. Nothing here talks to a database, an API, or an
authentication provider.

## Routes

| Route | Screen | Rendering |
| --- | --- | --- |
| `/` | Map, destination search, filters, results | Client (map island) |
| `/discover` | Rule-based discovery modules | Client |
| `/saved` | Saved shops grouped by country | Client |
| `/passport` | Passport overview | Client |
| `/passport/[country]` | Country collection | Client |
| `/passport/[country]/[locality]` | Locality impressions | Client |
| `/shops/[slug]` | Shop detail (statically generated per demo shop) | Server + action island |
| `/styleguide` | Internal component states, `noindex` | Server |

`/` also accepts two deep links used by Saved and Discover:
`?shop=<slug>` selects and reveals a shop, `?destination=<id>` commits a
destination viewport.

## Interaction contracts

- **Committed bounds versus camera.** `ExploreState` holds `committed` (what the
  displayed results were queried for), `camera` (what the user is looking at),
  and `query` (the parameters of the last committed search). Only a change to
  `query` triggers a fetch, so panning and zooming can never refetch.
- **Search this area.** Offered after meaningful movement — a quarter of the
  committed viewport span, a whole zoom step, or the committed centre leaving the
  camera — or after an uncommitted filter change. Never while a query is in
  flight.
- **Camera move source.** MapLibre movement is classified as `user` or
  `programmatic`. Programmatic moves (the initial fit, a container resize, a
  destination fly) adopt the new camera silently. A gesture that interrupts a
  programmatic fly counts as user movement.
- **Selection.** One selected shop id is shared by map and list. Selection is not
  navigation; opening detail is a separate action. A selected shop is never
  hidden inside a cluster, and revealing it pans only far enough to bring it
  inside a 72 px inset rather than recentring the map.
- **Filters.** Status and shop-type filters are drafted locally and applied only
  when the next search is committed. The bar says so while a change is pending.
- **Failure.** A failed viewport request keeps the previous results usable and
  offers Retry.

## Data seams

| Seam | Milestone 1 implementation | Replaced in |
| --- | --- | --- |
| `ShopSource` | `createFixtureShopSource` over `demoShopSummaries` | Milestone 3 (`GET /api/v1/shops/viewport`) |
| `DestinationGeocoder` | `createFixtureGeocoder` | Milestone 3 (MapTiler geocoding) |
| `MapStyleProvider` | Offline paper style, or MapTiler when a key is set | Milestone 3 |
| `MapTelemetry` | No-op recorder with the approved event names | Milestone 8 |
| `CollectionStore` | Session-scoped simulated saves and impressions | Milestones 4 and 5 |

The public projection carries no user state: `createFixtureShopSource` always
returns `markerState: "unvisited"`, and saved/visited identifiers are merged in
the client through `decorateResults`. This mirrors the cacheable-public-payload
rule in `DATA-MODEL.md`.

## Fixtures

- `src/fixtures/demo-shops.ts` is the shared Codex-owned fixture and is
  unchanged. Its three records are reused verbatim for their `ShopMapSummary`
  fields.
- `src/fixtures/demo-catalogue.ts` extends that set to 30 demo shops across
  Singapore, Japan, and Taiwan, including Changhua, Tainan, Kaohsiung, Kanazawa,
  Sapporo, Hiroshima, and Sendai. Every record uses `sourceQuality: "demo"`,
  carries the fixture notice, and is named "Demo …" so it can never read as a
  real business.
- `src/fixtures/demo-passport.ts` seeds five simulated impressions with fixed
  dates so Passport screenshots stay stable.
- `src/fixtures/demo-destinations.ts` provides mocked geocoder destinations.

## Accessibility

- Every map result has a list equivalent; markers are real focusable buttons with
  text labels.
- Status is carried by shape, icon, and text as well as colour.
- Controls are at least 44 × 44 px; inline prose links are exempt by WCAG.
- The results sheet is operable by pointer, keyboard (arrow keys on the handle),
  and screen reader, and its drag target is confined to the handle so a sheet
  gesture cannot pan the map.
- Dialogs trap focus, restore it on close, and close on Escape.
- The stamp ceremony runs 780 ms normally and resolves instantly with a short
  opacity transition under `prefers-reduced-motion`.
- `--text-muted` failed AA at 12 px on the warm surface and was replaced with
  `--text-secondary` on the card image placeholder.

## Tests

| Command | Covers |
| --- | --- |
| `pnpm test` | Domain logic, clustering, explore reducer, fixture source, geocoder, collection store, and component state for the list, filter bar, sheet, and ceremony |
| `pnpm test:e2e` | Journeys, accessibility (axe), reduced motion, and the mobile sheet at 360 × 800, 768 × 1024, and 1440 × 900 |
| `VISUAL=1 pnpm test:e2e --project=visual` | Screenshot baselines for seven screens at the three breakpoints |

Visual baselines live in
`tests/visual/breakpoints.spec.ts-snapshots/` and double as the responsive
screenshot evidence for this milestone. They are opt-in because rendering differs
between container images; refresh them with
`VISUAL=1 pnpm test:e2e --project=visual --update-snapshots`.

Playwright runs against a production build (`pnpm build && pnpm start`) so the
journeys match what CI deploys.

## Known gaps

- **Near Me is not built.** It needs real location access, which Milestone 1
  excludes. Destination search covers the same need in the meantime.
- **No imagery.** No rights-cleared photography exists, so cards and shop pages
  show a labelled placeholder instead of inventing one.
- **The shop card specialty line is enriched from the demo catalogue**
  (`src/features/explore/card-enrichment.ts`) because `ShopMapSummary` has no
  such field. A `specialtyLine` on the Milestone 2 viewport projection would let
  that module be deleted.
- **MapLibre's worker does not start under the Turbopack build**, so no tiled
  source can be parsed. Milestone 1 works around it; Milestone 3 cannot. See
  `docs/adr/0002-maplibre-worker.md`.
- **Visual baselines are not enforced in CI** until a canonical runner image is
  agreed.
- **The Nib Atlas mark is a placeholder.** `BRAND.md` requires a commissioned SVG
  master before public launch.
