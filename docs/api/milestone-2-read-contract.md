# Milestone 2 public read contract

**Status:** Database RPC contract for Milestone 3 integration  
**Version:** 1  
**Last updated:** 2 September 2026

The browser-facing application endpoints will wrap these functions rather than
exposing canonical tables. Each function is a `security definer` with a fixed
search path, validates bounded inputs, reads only `publication_status =
'published'`, and returns camel-case domain JSON rather than Postgres rows.

Anonymous and authenticated roles may execute the functions. Neither role gains
direct access to `shops`, `shop_sources`, publication controls, or evidence
notes. Saved and visited identifiers remain a separate user-state request so the
public viewport result can be cached.

## `viewport_shops`

Inputs:

- `p_west`, `p_south`, `p_east`, `p_north`: WGS84 bounds. `west > east`
  explicitly means an antimeridian crossing.
- `p_zoom`: integer `0..24`, echoed for the application cache key.
- `p_operational_statuses`: optional canonical operational-state filters.
- `p_shop_type_codes`: optional controlled shop-type codes.
- `p_limit`: `1..500`, default `500`.

Returns `shops`, `truncated`, `committedBounds`, and `zoom`. Each shop is the
existing `ShopMapSummary` public shape: user-owned marker state is always
`unvisited` until the client merges saved/visited IDs. Results are deterministic
and capped. A typical dense-city response must remain below 250 KB compressed at
the application endpoint.

The query uses GiST bounding-box and `ST_Intersects` predicates. An
antimeridian-crossing request is split into the two valid envelopes.

## `search_shops`

Inputs: a trimmed 1–120 character query and a `1..50` result limit.

Published canonical names and aliases are ranked exact, prefix, then trigram
similarity. Lowercasing supports Latin case matching without transliterating or
destroying CJK text. The result identifies the matching alias where applicable;
destination/geocoder results remain a separate provider contract.

## `shop_detail`

Input: canonical shop slug.

Returns one published detail projection or `null`. It includes public catalogue
facts, official links, controlled attributes, conservative position precision,
and freshness. It excludes publication state, admin evidence notes, internal
source controls, and drafts. Nullable facts are omitted rather than replaced by
plausible defaults.

## `nearby_shops`

Inputs: WGS84 latitude/longitude, discovery radius `1..100000` metres (default
10 km), and limit `1..100`.

Uses the geography GiST expression index with `ST_DWithin`, then returns exact
server-calculated distance order. Input coordinates exist only in statement
memory and are not written to tables, logs, analytics, or response metadata.

This discovery radius is not the collection geofence. Stamp verification remains
deferred and retains its separately approved 150 m default, accuracy and
freshness controls.

## Performance gate

`supabase/performance/viewport_50k.sql` creates 40,000 global and 10,000
Tokyo-density test shops inside a transaction, warms the query, measures 20
runs, and fails when p95 database execution reaches 250 ms. The transaction is
rolled back and never becomes catalogue data.
