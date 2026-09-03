# API v1 public shop reads

**Status:** Milestone 2 application contract  
**Version:** 1  
**Last updated:** 3 September 2026

The browser and Milestone 3 frontend adapter read catalogue data through these
same-origin Next.js endpoints. They do not call PostgREST directly. The server
adapter uses the browser-safe Supabase publishable key against fixed,
security-definer RPC names; it never uses the service role for public reads.

All error responses are non-cacheable and use:

```json
{ "ok": false, "error": { "code": "stable_machine_code" } }
```

PostgREST messages and database identifiers are never relayed.

## `GET /api/v1/shops/viewport`

Required query parameters: `west`, `south`, `east`, `north`, `zoom`.

Optional:

- `operationalStatus`: comma-separated `open`, `temporarily_closed`,
  `permanently_closed`, `unknown`;
- `shopType`: comma-separated approved shop-type codes;
- `limit`: `1..500`, default `500`.

The response is the shared `ShopMapSummary` projection plus `truncated` and
`committedBounds`. The database-only `zoom` echo is intentionally removed.
User-owned Saved/Visited state is not accepted here; public results always begin
as `unvisited` and Milestone 3 merges user state separately.

Cache: `s-maxage=300`, with stale-while-revalidate.

## `GET /api/v1/shops/search`

Required `q` is trimmed and limited to 1–120 characters. Optional `limit` is
`1..50`, default `20`. Results are canonical shops, not destination-geocoder
results, and may identify the matched alias.

Cache: `s-maxage=300`, with stale-while-revalidate.

## `GET /api/v1/shops/[slug]`

Returns the published database-backed detail or `404`. Unknown, draft, and
malformed slugs do not reveal publication state.

This wire projection is deliberately one adapter step before frontend
`ShopDetail`: Milestone 3 adds the deterministic frontend-owned stamp design and
maps any remaining presentation-only fields. It must not bypass the evidence
rules below.

Cache: `s-maxage=3600`, with stale-while-revalidate.

### Evidence contract

- Every public source has stable `id`, public `label`, controlled `kind`,
  optional public URL, `retrievedOn`, and explicit `confirms` tokens.
- `confirmedBy` is always a source UUID, never display prose.
- A sourced service is public only when its join row has `source_id`.
- The internal `appointment_required` and `accessibility_notes` columns are not
  part of v1 while they have no per-field source UUID. Populating either cannot
  make an otherwise valid public detail unavailable or publish an unsourced
  practical claim.
- The source UUID must belong to the same shop, enforced by composite foreign
  keys.
- Canonical claim rows and admin evidence notes remain inaccessible to anonymous
  and ordinary authenticated roles.
- `demo_fixture` is a staging/test-only source kind paired with
  `sourceQuality: "demo"`; production imports must reject it.

Milestone 3 must update the frontend evidence reference from label to source ID.
It must also handle the staging-only `demo_fixture` kind explicitly: extend the
fixture-facing frontend type or reject it outside staging/test, never cast it
silently into one of the four real provenance kinds. It may retain `confirms`
for reviewer validation or derive equivalent checks from the same source/claim
projection, but it may not treat one source as supporting claims absent from that
source's token list.

## `POST /api/v1/shops/nearby`

The JSON body requires numeric `latitude` and `longitude`. Optional numeric
`radiusMeters` is an integer from `1..100000` (default 10000), and `limit` is
an integer from `1..100` (default 50). Unknown body fields and non-JSON requests
are rejected.

The response is always `private, no-store`. Caller coordinates are sent only to
the statement-local RPC in a request body, never placed in a URL, returned,
persisted, or placed in public cache metadata. Keeping coordinates out of the URL
prevents normal edge request logging from recording them. Returned `position`
values are shop coordinates. Each candidate also carries `positionPrecision`,
`primaryType`, and `operationalStatus`: the frontend shows a distance only when
both endpoints have street precision, and never recommends a permanently closed
shop.

## Runtime validation

The application boundary decodes each RPC response into a versioned allowlisted
shape. Unknown keys are dropped; missing/invalid required fields fail closed as
`502 invalid_upstream_contract`. For viewport reads, failing the complete
response rather than dropping malformed rows is deliberate: catalogue contract
violations stay loud and observable instead of silently removing markers. SQL
projections exclude known unrepresentable states, such as published shops with no
assigned type. This prevents a later database/provider change from silently
becoming a browser API change.

