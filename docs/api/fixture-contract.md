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
