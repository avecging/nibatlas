# Frontend fixture contract

Milestone 1 must build against the types in `src/domain` and the explicitly
labelled data in `src/fixtures`.

Rules:

- `ShopMapSummary` is the shared marker/card projection.
- Persisted map status is `unvisited`, `saved`, or `visited`; selection is
  transient UI state.
- Every invented record must use `sourceQuality: "demo"` and carry a visible
  fixture notice.
- Fixtures may be replaced behind an adapter in Milestone 3; UI components must
  not depend on provider response shapes.
- Contract changes require Codex coordination and a documented PR note.

## Milestone 1 additions

Milestone 1 added these modules:

- `src/domain/shop-detail.ts` — `ShopDetail` extends `ShopMapSummary` for the
  shop page. Milestone 3 should be able to satisfy it from
  `GET /api/v1/shops/[slug]`.
- `src/domain/passport.ts` — `StampCollection` and the Passport groupings that
  Milestone 5 will populate from `stamp_collections`.
- `src/domain/stamp-palette.ts` — the eight shared global inks, the pinned
  palette version, and the blind key-to-ink function.
- `src/domain/seals.ts` — derived locality and country seals, versioned coverage
  sets, and the never-revoked rule.
- `src/domain/filters.ts`, `src/domain/user-state.ts`,
  `src/domain/clustering.ts` — viewport filtering, the separate merge of
  saved/visited identifiers into the cacheable public projection, and
  client-side marker clustering.
- `src/features/passport/book-controller.ts` and `passport-pages.ts` — the
  Passport's logical page list and the page-turn geometry, both pure.
- `src/fixtures/prototype-catalogue.ts`, `prototype-passport.ts`,
  `prototype-destinations.ts` — the sourced real-shop prototype data.

### Approved contract change

`UX.md` asks the shop card for one specialty or service line, and
`ShopMapSummary` now carries `specialtyLine: string | null`. The viewport fixture
populates it from the shop's own summary line and cards read it directly from the
public projection.

## Milestone 1 refinement notes

### `ShopDetail` fields are optional

The Milestone 1 catalogue holds real shops, and the acceptance brief requires
omitting a field no source supports rather than inventing a plausible value. Every
descriptive and practical field on `ShopDetail` is therefore optional, and the
detail view renders only what is present — it never emits a placeholder standing
in for a missing fact. `timezone`, `shopTypes`, `positionPrecision`, `sources`,
and `stamp` stay required.

Two frontend-owned additions carry the honesty:

- `sources: readonly ShopSourceRef[]` — where each record's facts came from, when
  the source was read, and which fields it confirms.
- `positionPrecision: "street" | "locality"` — how precise the mapped coordinate
  is. No Milestone 1 coordinate is surveyed.

Both live on `ShopDetail` only. **`ShopMapSummary` is unchanged**: it is the
shared Codex-owned projection, and adding to it is a contract change rather than
a frontend decision. If markers or cards should ever state coordinate precision
or provenance, that needs an explicit contract change and belongs in Milestone 2
or 3, not here.

### `PassportOverview.recent` was removed

Recent Impressions is deferred by
`docs/milestone-1-prototype-acceptance.md`, which asks for it to be absent
because a running list of where someone has just been reads as tracking. The
projection field it would need was removed so no surface can reintroduce it
quietly. `PassportCountry` and `PassportLocality` still order their own
collections newest first.

### `demo-shops.ts` is no longer the base of the catalogue

`src/fixtures/demo-shops.ts` remains the shared Codex-owned fixture and is
untouched, with its own test. Milestone 1's catalogue no longer extends it,
because its three records are invented and the acceptance brief requires a subset
of real shops. If Codex wants the shared example to be the same records the
frontend renders, that is a coordination point, not a silent change.

## Milestone 1.5 WP4 — the shop value layer

`ShopDetail` gains the optional pen-specific fields root cause D in
`docs/milestone-1-5-product-refinement.md` asks for. **`ShopMapSummary` is
unchanged**, so this is a frontend projection change under accepted decision 4
("Claude Code may define the optional schema and the sourcing rules"), not a
change to the Codex-owned marker/card contract.

New optional fields, all on `ShopDetail` only:

| Field | Shape | Why |
| --- | --- | --- |
| `services` | `readonly ShopService[]` | A service with `accessMode` (`walk_in`, `booking`, `send_in`, `enquire`) and a sourced `duration`. Separates a repair bench from a shelf |
| `experiences` | `readonly ShopExperience[]` | Test bench, ink wall, clinics, and whether they need booking |
| `exclusives` | `readonly ShopExclusive[]` | Shop-only inks and editions — the field a general listing cannot have |
| `access` | `ShopAccessNote` | Nearest station, walking guidance as the source words it, floor/building note, accessibility note |
| `practical` | `ShopPracticalInfo` | Payment methods, languages spoken, appointment requirement |

Two Milestone 1 fields were folded into those blocks rather than left beside
them, so that a practical claim cannot exist without the evidence reference the
block carries:

- `appointmentRequired: boolean` → `practical.appointmentRequired`
- `accessibilityNotes: string` → `access.accessibilityNote`

`services` also changes shape, from `readonly string[]` to
`readonly ShopService[]`. A bare label cannot say whether a nib grind is a
walk-in or a three-day send-in, which is the distinction the section exists to
make. **Nothing populated any of the three fields in their old form**, so no data
was migrated and no other surface read them.

### Every pen-specific claim names its source

Each new entry carries `confirmedBy: string`, holding the `label` of one of the
record's own `sources` entries. This reuses the evidence registry that already
exists — the source list, its `retrievedOn` dates and its `confirms` breakdown
are unchanged, and reviewer mode still renders them in full.

`shopEvidenceIssues` in `src/domain/shop-evidence.ts` returns every claim whose
reference does not resolve, and `prototype-catalogue.test.ts` asserts the result
is empty for every record. A claim therefore cannot reach a shop page without the
source that backs it travelling with it.

Milestone 3 should be able to satisfy the same shape from
`GET /api/v1/shops/[slug]`. The natural mapping is the join-table `note`,
`confidence`, `source_id` columns `DATA-MODEL.md` already reserves on
`shop_services` and its siblings, with `confirmedBy` projected from `source_id`.
Nothing here asks for a schema change; if Codex would rather project a source id
than a label, that is a coordination point and a one-line change in this module.

### `nearbyPenShops` is derived, not stored

`src/domain/nearby-shops.ts` derives the "Nearby pen shops" section from the same
catalogue the map reads. It is not a new data structure and nothing persists it.
A distance is offered **only** where both records carry
`positionPrecision: "street"`; a locality-centroid coordinate gets the locality
name instead, because a measured figure from a city centroid would claim
precision the record does not have. Walking time is not offered at all — that
needs a routing source this repository does not have.

### `src/fixtures/shop-value-specimen.ts`

One invented record, `sourceQuality: "demo"`, carrying its own fixture notice and
rendered only on `/styleguide` (internal, `noindex`). It exists because no source
in the prototype catalogue publishes a service, an experience, a shop-only item,
a station, a payment method or a language, so the populated design would otherwise
be unreviewable. It is not imported by `prototype-catalogue.ts` and never reaches
a shop page, the map, search, or the Passport.
