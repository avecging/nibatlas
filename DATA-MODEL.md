# Nib Atlas Data Model

**Status:** Production-shaped MVP model
**Version:** 1.0
**Last updated:** 11 August 2026

## Modelling principles

- Canonical shop data is separate from user state.
- Visit status is derived from immutable stamp collections, not a mutable `visited` boolean.
- Geographic data uses PostGIS with spatial indexes.
- Structured/filterable attributes are relational; flexible display snapshots may use `jsonb`.
- Publication state and real-world operational state are separate.
- Provenance and last verification are first-class.
- Locality modelling must support Japanese wards, Taiwanese municipalities/districts, and Singapore.
- Raw user collection coordinates are never persisted.
- Future merchant/campaign work must not distort the MVP schema.

## Conventions

- Primary keys: UUID (`gen_random_uuid()`).
- Timestamps: `timestamptz`, server-generated UTC.
- Countries: ISO 3166-1 alpha-2.
- Display dates: converted using the shop timezone snapshot.
- Slugs: human-readable, unique, and treated as mutable routing aliases rather than identity.
- Soft deletion: archive canonical content; do not delete records referenced by collections.
- Every migration is versioned in `supabase/migrations` and tested from an empty database.

## Core entities

### `profiles`

Extends `auth.users` without creating public social profiles.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid PK` | FK to `auth.users.id`, cascade delete only after account-deletion workflow |
| `display_name` | `text null` | Private by default |
| `home_country_code` | `char(2) null` | Optional personalization |
| `preferred_locale` | `text not null default 'en'` | UI locale |
| `distance_unit` | `text not null default 'metric'` | Constrained enum/check |
| `role` | `text not null default 'user'` | `user`, `editor`, `admin`; server-controlled |
| `created_at` / `updated_at` | `timestamptz` | Audit fields |

RLS: users read/update their own non-role fields. Only server/admin path changes role.

### `localities`

Normalized geographic grouping for Passport and search.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid PK` | |
| `country_code` | `char(2)` | Indexed |
| `admin_area_code` / `admin_area_name` | `text null` | Optional normalized parent area |
| `name` | `text` | Default English/romanized display |
| `name_local` | `text null` | Local script |
| `locality_type` | `text` | `city`, `ward`, `district`, `municipality`, `region`, `other` |
| `parent_locality_id` | `uuid null` | Self-FK |
| `slug` | `text` | Unique within country/parent |
| `centroid` | `geometry(Point,4326) null` | Search/map positioning |

### `shops`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid PK` | Canonical identity |
| `slug` | `text unique` | Public route |
| `name` | `text` | Canonical display name |
| `short_description` | `text` | Factual visit-oriented summary |
| `address_line_1` / `address_line_2` | `text` | |
| `postal_code` | `text null` | String, never numeric |
| `country_code` | `char(2)` | Launch allowlist at application layer |
| `admin_area_code` / `admin_area_name` | `text null` | |
| `locality_id` | `uuid null` | FK to `localities` |
| `city_display` | `text null` | Search/display snapshot, not grouping identity |
| `neighbourhood` | `text null` | |
| `timezone` | `text` | IANA zone |
| `location` | `geometry(Point,4326)` | GiST indexed |
| `phone` | `text null` | |
| `website_url` | `text null` | Official site only |
| `opening_hours` | `jsonb` | MVP representation; normalized later if editing proves awkward |
| `appointment_required` | `boolean default false` | |
| `accessibility_notes` | `text null` | Factual, not inferred |
| `operational_status` | `text` | `open`, `temporarily_closed`, `permanently_closed`, `unknown` |
| `publication_status` | `text` | `draft`, `published`, `archived` |
| `source_quality` | `text` | `verified`, `sourced`, `community_unverified`, `demo` |
| `last_verified_at` | `timestamptz null` | |
| `published_at` | `timestamptz null` | |
| `created_at` / `updated_at` | `timestamptz` | |

Indexes:

- unique B-tree on `slug`;
- GiST on `location`;
- B-tree on `(publication_status, operational_status)`;
- B-tree on `(country_code, locality_id)`;
- trigram indexes for normalized `name` after `pg_trgm` is enabled;
- optional GIN search document after multilingual search testing.

Public reads expose only published projections. Admin-only provenance must not leak through the public shop endpoint.

### `shop_aliases`

`id`, `shop_id`, `alias`, `locale`, `alias_type`, timestamps.

Supports local-script names, romanizations, former names, and search synonyms. Unique normalized alias per shop.

### `shop_links`

`id`, `shop_id`, `link_type`, `url`, `label`, `is_official`, `sort_order`, timestamps.

Types include website, Instagram, Facebook, X, Line, directions, contact. URLs are validated and sanitized.

### `shop_images`

| Column | Notes |
| --- | --- |
| `id`, `shop_id`, `storage_key` | Store provider-neutral object key, not permanent CDN URL |
| `alt_text` | Required before publication |
| `credit_text`, `source_url`, `rights_basis` | Rights/provenance required |
| `width`, `height`, `content_type` | Validation metadata |
| `sort_order`, `moderation_status` | Publication control |
| timestamps | |

### Shop attributes

Use controlled vocabularies and join tables:

- `shop_types` / `shop_shop_types`;
- `services` / `shop_services`;
- `specialties` / `shop_specialties`;
- `brands` / `shop_brands`.

MVP shop types:

- `fountain_pen_specialist`
- `stationery_store`
- `vintage_used`
- `nib_repair_services`

Join tables may carry `note`, `confidence`, `source_id`, and `last_verified_at`. Brands are supporting visit information, not the start of a product catalogue.

### `shop_sources`

| Column | Notes |
| --- | --- |
| `id`, `shop_id` | |
| `source_type` | Official website/social, directory, direct verification, etc. |
| `source_url` | Evidence location |
| `checked_at` | Freshness |
| `reliability` | Controlled rating |
| `evidence_note` | Admin-only concise note |
| `status` | Active/stale/unavailable |

### `saved_shops`

| Column | Type |
| --- | --- |
| `user_id` | `uuid FK` |
| `shop_id` | `uuid FK` |
| `created_at` | `timestamptz` |

Composite primary key `(user_id, shop_id)`. RLS permits users to read/insert/delete only their own rows.

### `stamps`

| Column | Type / notes |
| --- | --- |
| `id` | `uuid PK` |
| `shop_id` | `uuid null FK` |
| `campaign_id` | `uuid null`, relationship reserved but table deferred |
| `name` | `text` |
| `stamp_type` | `atlas`; future `official`, `campaign` |
| `artwork_key` | Provider-neutral object key or template descriptor |
| `template_data` | `jsonb` for approved local motif/labels |
| `design_version` | `integer` |
| `availability_start` / `availability_end` | `timestamptz null` |
| `status` | `draft`, `active`, `retired` |
| timestamps | |

MVP invariant: exactly one active Atlas Stamp per published shop, enforced with a partial unique index. Retiring/redesigning a stamp must not alter collected historical snapshots.

### `stamp_collections`

Immutable source of truth for visited state and Passport.

| Column | Type / notes |
| --- | --- |
| `id` | `uuid PK` |
| `user_id` | `uuid FK` |
| `stamp_id` | `uuid FK` |
| `shop_id` | `uuid FK` |
| `collected_at` | server `timestamptz` |
| `shop_timezone` | IANA timezone snapshot |
| `verification_method` | `geofence`; future `qr`, `nfc`, `admin` |
| `verification_version` | integer policy version |
| `distance_m` | integer null |
| `reported_accuracy_m` | integer null |
| `anomaly_flags` | `text[]` |
| `shop_name_snapshot` | text |
| `place_snapshot` | `jsonb` containing country/locality display values |
| `stamp_snapshot` | `jsonb` containing design identity/version |

Unique `(user_id, stamp_id)`. Client cannot insert directly; a server-controlled transaction/function verifies and issues atomically. Raw latitude/longitude is never written.

### `verification_attempts`

Privacy-limited diagnostic/abuse table:

- `id`, `user_id`, `shop_id`, requested/server timestamps;
- reported accuracy, computed distance, configured radius;
- result and failure reason;
- nonce/request hash and rate-limit bucket;
- no raw coordinates.

Default retention: 30 days, automatically purged. Extend only after an explicit privacy decision.

### `import_batches`

`id`, source filename/key, content hash, contract version, imported by/at, dry-run flag, row counts, error report key, status.

Enables repeatable and auditable countrywide data operations.

### `admin_audit_log`

`id`, actor, action, entity type/id, before summary, after summary, request ID, created timestamp. Append-only to editors.

## Contributions

Schema is defined for compatibility, but migration/UI can be deferred until Phase 2.

### `contributions`

- `id`
- `submitter_id null`
- `shop_id null`
- `contribution_type`
- `proposed_data jsonb`
- `evidence_urls jsonb`
- `state`: `submitted`, `in_review`, `approved`, `rejected`, `withdrawn`
- reviewer, reviewed timestamp, decision note
- created/updated timestamps

Approved contributions become canonical only through a reviewed admin operation and audit log. `proposed_data` never directly replaces a shop row.

## Future campaigns

Do not migrate/build until later phase, but preserve conceptual relationships:

- `campaigns`
- `campaign_shops`
- `campaign_completion_rules`
- `campaign_completions`
- campaign stamps through `stamps.campaign_id`

Do not add reward balances, points, or generalized gamification tables.

## Geographic querying requirements

### Viewport endpoint/RPC

Contract inputs:

- west, south, east, north;
- zoom;
- status filters;
- shop-type filters;
- optional authenticated user context;
- cursor/limit where individual results are returned.

Query strategy:

1. Validate coordinate ranges and maximum bounds.
2. Create `ST_MakeEnvelope(west, south, east, north, 4326)`.
3. Use `ST_Intersects(location, envelope)` against the GiST index.
4. If bounds cross the antimeridian, query two envelopes and union them.
5. Filter publication/operational state and shop types in the same query.
6. Return marker/card projection only; fetch shop detail separately.
7. Cap individual results and report `truncated: true`.
8. At launch scale, allow MapLibre client clustering of a bounded GeoJSON set.
9. At global/tens-of-thousands scale, add server-side zoom-dependent clustering or vector tiles without changing the frontend domain contract.

Cache public viewport results by rounded bounds + zoom + filter hash. Fetch/merge user-specific saved and visited IDs separately so public data remains cacheable.

### Near Me and collection verification

- Use `ST_DWithin(shop.location::geography, user_point::geography, radius_m)`.
- Compute exact `ST_Distance` server-side for diagnostic output.
- User coordinates exist only in request/transaction memory.
- Default geofence: 150 m; shop override requires admin reason.
- Require reported accuracy ≤100 m and fresh position timestamp.

### Search

- Search canonical names plus aliases.
- Normalize Latin case/diacritics without destroying CJK text.
- Begin with `pg_trgm` and exact/prefix weighting.
- Evaluate PGroonga only after real Japanese/Traditional Chinese query failures are measured.
- Keep geocoder destination results separate from canonical shop search results.

## Security/RLS matrix

| Entity | Anonymous | Authenticated user | Editor/admin |
| --- | --- | --- | --- |
| Published shop projection | Read | Read | Read/write through admin path |
| Draft/admin provenance | None | None | Authorized read/write |
| Own profile | None | Read/update allowed fields | Role management server-only |
| Saved shops | None | Own rows only | Support read only when justified |
| Stamp collections | None | Own rows read; no direct insert/update/delete | Admin/support through audited path |
| Contributions | Future limited insert | Own future submissions | Review/apply |
| Audit log | None | None | Restricted read; server append |

All exposed tables have RLS explicitly enabled in migrations. Service-role credentials never reach the browser.

## Test data and provenance

- Fixtures use reserved deterministic UUIDs and `source_quality='demo'`.
- Fixtures never share the production import pipeline without explicit environment guard.
- Real seed/import rows require source URL/type and checked date.
- Synthetic performance data is generated only in test environments and is visibly marked.
