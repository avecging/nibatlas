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

### Approved international-content contract change

`ShopMapSummary` and `ShopDetail` now carry
`localNameLang?: LanguageTag` alongside `localName`. When a local name is
present, fixture/import validation requires a valid BCP 47 language tag. The
viewport and shop-detail APIs must preserve the pair so cards, search, shop
identity, Passport snapshots, and stamp artwork can apply the correct language,
line breaking, and text direction. The API must not infer this tag from
`countryCode`.

Country codes accept the ISO 3166-1 alpha-2 wire shape without a frontend
country allowlist; canonical ISO membership is validated during import. Country
display labels come from `Intl.DisplayNames`. Shop timezones remain explicit
IANA zones per record and are not inferred from country.

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

Both live on `ShopDetail` only. `ShopMapSummary` remains the shared
Codex-owned projection; its approved additions are `specialtyLine` and
`localNameLang`. Coordinate precision and provenance still belong only to
`ShopDetail`; exposing either on markers or cards would require another
explicit contract change.

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
`docs/milestone-1-5-product-refinement.md` asks for. WP4 did not otherwise change `ShopMapSummary`, so this is a frontend projection change under accepted decision 4
("Claude Code may define the optional schema and the sourcing rules"), not a
change to the Codex-owned marker/card contract.

New optional fields, all on `ShopDetail` only:

| Field | Shape | Why |
| --- | --- | --- |
| `services` | `readonly ShopService[]` | A service with `accessMode` (`walk_in`, `booking`, `send_in`, `enquire`) and a sourced `duration`. Separates a repair bench from a shelf |
| `experiences` | `readonly ShopExperience[]` | Test bench, ink wall, clinics, and whether they need booking |
| `exclusives` | `readonly ShopExclusive[]` | Shop-only inks and editions — the field a general listing cannot have |
| `access` | `ShopAccessNote` | Nearest station, walking guidance as the source words it, floor/building note, accessibility note — **each field sourced separately** |
| `practical` | `ShopPracticalInfo` | Payment methods, languages spoken, appointment requirement — **each field sourced separately** |

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

### Every pen-specific claim names a source that confirms *it*

Each entry carries `confirmedBy: string`, holding the `label` of one of the
record's own `sources` entries. This reuses the evidence registry that already
exists — `ShopSourceRef` is unchanged, `confirms` is still the field-level
evidence list it always was, and reviewer mode still renders the whole list with
its retrieval dates.

`shopEvidenceIssues` in `src/domain/shop-evidence.ts` checks **two** things per
claim, and `prototype-catalogue.test.ts` asserts the result is empty for every
record:

1. `confirmedBy` resolves to a source actually attached to the record
   (`failure: "unknown-source"`), and
2. **that source's own `confirms` list covers this specific claim**
   (`failure: "claim-not-confirmed"`).

The second check exists because the first alone is not honesty. TY Lee's official
source confirms only `Local-script name`; label-existence alone would have let a
nib-grinding service cite it and publish.

A pen-specific claim's `confirms` entry therefore has a canonical form, produced
by the token helpers in the same module — `serviceEvidenceToken`,
`experienceEvidenceToken`, `exclusiveEvidenceToken`, `ACCESS_EVIDENCE_TOKENS`,
`PRACTICAL_EVIDENCE_TOKENS`. Data and validator derive the token from the same
helper, so support is a lookup rather than a substring guess, and the tokens stay
readable English (`Service: Custom grind`, `Nearest station`) because reviewer
mode prints them verbatim. Comparison normalises case and whitespace and nothing
looser: a source confirming `Languages of the website` never counts as confirming
`Languages spoken`, and `Custom grind` never covers `Custom grind, wet`.

The Milestone 1 fields keep their existing prose entries (`Name`, `Address`,
`Opening hours`); they are not validated by this function, which checks only the
pen-specific claims.

#### Access and practical facts are sourced per field

`access` and `practical` do **not** carry one block-level `confirmedBy`. Each
populated field is its own `SourcedText`, `SourcedList` or `SourcedFlag`, with its
own `confirmedBy`:

```ts
access: {
  nearestStation: { value: "…", confirmedBy: "…" },
  floorNote: { value: "…", confirmedBy: "…" },
}
```

A block-level reference would let one source that publishes a station implicitly
vouch for a payment method and a spoken language it says nothing about. Per-field
values make that unsayable rather than merely detectable, and they let one block
rest on two sources — a station from an official page, payment methods from a
dealer listing. An absent field is not checked; a present one is, including
`appointmentRequired: { value: false }`, which is a claim about the shop rather
than an absence.

#### Milestone 3 mapping

Milestone 3 should be able to satisfy the same shape from
`GET /api/v1/shops/[slug]`. **Project `confirmedBy` from a stable source id, not
from a display label** — that is the founder's recorded preference, and a label is
display prose that can be reworded. The mapping:

| Frontend | Database |
| --- | --- |
| `services[]`, `experiences[]`, `exclusives[]` | `shop_services` / `shop_specialties`-style join rows, one per claim |
| a claim's `confirmedBy` | that join row's `source_id` → `shop_sources.id` |
| an `access`/`practical` field's `confirmedBy` | the same, per attribute row |
| the evidence token in `confirms` | derived server-side from the attribute row; the API need not send a token list at all if every claim already carries a resolved `source_id` |

`ShopSourceRef` gains an `id` at that point and `confirmedBy` becomes that id.
Nothing in this PR asks for a schema change: the label reference is the smallest
change compatible with the registry as it stands, and it fails loudly rather than
silently if a label is reworded, because the catalogue test resolves every
reference.

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

Its specimen source's `confirms` list is built from the same token helpers the
validator compares, so the record satisfies the evidence rule the way a real
sourced record will have to rather than bypassing it.
