# Frontend fixture contract

Milestone 1 must build against the types in `src/domain` and the explicitly labelled data in `src/fixtures`.

Rules:

- `ShopMapSummary` is the shared marker/card projection.
- Persisted map status is `unvisited`, `saved`, or `visited`; selection is transient UI state.
- Every invented record must use `sourceQuality: "demo"` and carry a visible fixture notice.
- Fixtures may be replaced behind an adapter in Milestone 3; UI components must not depend on provider response shapes.
- Contract changes require Codex coordination and a documented PR note.

## Milestone 1 additions (frontend-owned, additive only)

`src/domain/shops.ts` and `src/fixtures/demo-shops.ts` are unchanged. Milestone 1
added these modules beside them without altering the existing shapes:

- `src/domain/shop-detail.ts` — `ShopDetail` extends `ShopMapSummary` for the
  shop page. Milestone 3 should be able to satisfy it from
  `GET /api/v1/shops/[slug]`.
- `src/domain/passport.ts` — `StampCollection` and the Passport groupings that
  Milestone 5 will populate from `stamp_collections`.
- `src/domain/filters.ts`, `src/domain/user-state.ts`,
  `src/domain/clustering.ts` — viewport filtering, the separate merge of
  saved/visited identifiers into the cacheable public projection, and
  client-side marker clustering.
- `src/fixtures/demo-catalogue.ts`, `demo-passport.ts`, `demo-destinations.ts` —
  demo data built on the shared types, reusing the three canonical records.

### Requested contract change

`UX.md` asks the shop card for one specialty or service line, and
`ShopMapSummary` has no field for it. Milestone 1 looks it up from the demo
catalogue in `src/features/explore/card-enrichment.ts`. Adding a nullable
`specialtyLine` to the Milestone 2 viewport projection would remove that
workaround. Requested, not applied.
