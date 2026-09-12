# Nib Atlas Data Model

**Status:** Production-shaped MVP model
**Version:** 1.3
**Last updated:** 12 September 2026

## Modelling principles

- Canonical shop data is separate from user state.
- Visit status is derived from immutable stamp collections, not a mutable `visited` boolean.
- Geographic data uses PostGIS with spatial indexes.
- Structured/filterable attributes are relational; flexible display snapshots may use `jsonb`.
- Publication state and real-world operational state are separate.
- Provenance and last verification are first-class.
- Locality modelling must support country-specific wards, municipalities, districts, city-states, and parent relationships without a Western-city assumption.
- Content language is explicit BCP 47 metadata and is separate from a user's interface locale.
- Country codes use ISO 3166-1 alpha-2; canonical membership is validated at the import boundary, not by a frontend launch allowlist.
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
| `name_local` | `text null` | Local-script or locally used name |
| `name_local_language_tag` | `text null` | Valid BCP 47 tag paired with `name_local`; never inferred from country |
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
| `country_code` | `char(2)` | ISO 3166-1 alpha-2; canonical membership validated on import |
| `admin_area_code` / `admin_area_name` | `text null` | |
| `locality_id` | `uuid null` | FK to `localities` |
| `city_display` | `text null` | Search/display snapshot, not grouping identity |
| `neighbourhood` | `text null` | |
| `timezone` | `text` | IANA zone |
| `location` | `geometry(Point,4326)` | GiST indexed |
| `phone` | `text null` | |
| `website_url` | `text null` | Official site only |
| `opening_hours` | `jsonb` | MVP representation; normalized later if editing proves awkward |
| `appointment_required` | `boolean null` | Unknown remains null; `false` is a sourced factual claim, not a default |
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

`id`, `shop_id`, `alias`, `language_tag`, `alias_type`, timestamps.

Supports local-script names, romanizations, former names, and search synonyms.
`language_tag` is a valid BCP 47 tag for the alias content; it is not inferred
from the shop's country. Unique normalized alias per shop.

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
| `id`, `shop_id` | Stable source identity scoped to one shop |
| `label` | Required public display label; not used as identity |
| `source_type` | Controlled public kind: `official`, `brand_dealer_list`, `community_list`, `founder_visit`; `demo_fixture` is test/staging-only |
| `source_url` | Evidence location |
| `checked_at` | Freshness |
| `reliability` | Controlled rating |
| `evidence_note` | Admin-only concise note |
| `status` | Active/stale/unavailable |

Public detail responses expose only the safe source projection: stable `id`, `label`, controlled `kind`, optional URL, retrieval date, and explicit claim tokens. Admin evidence notes and reliability controls remain private. Sourced service claims refer to the stable source UUID as `confirmedBy`; display-label changes therefore cannot break evidence references.

### `shop_source_claims`

| Column | Notes |
| --- | --- |
| `shop_id`, `source_id` | Composite FK guarantees the source belongs to the same shop |
| `claim_token` | Non-blank public token naming exactly what the source supports |
| `created_at` | Audit timestamp |

Primary key `(source_id, claim_token)`. The canonical registry is admin-only under RLS; `shop_detail` projects the safe tokens as each source's `confirms` list.

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
| `shop_id` | `uuid FK`, required for the MVP Atlas Stamp |
| `name` | `text` |
| `stamp_type` | `atlas`; future `official`, `campaign` |
| `current_design_version` | `integer null`; an active stamp must point to an approved version belonging to the same stamp |
| `availability_start` / `availability_end` | `timestamptz null` |
| `status` | `draft`, `active`, `retired` |
| timestamps | |

Campaign and merchant-issued stamp relationships remain conceptually reserved
but are not migrated into this MVP table before those features exist.

MVP invariant: exactly one active Atlas Stamp per published shop. A partial
unique index enforces the upper bound, while deferred cross-table constraint
triggers enforce the lower bound at transaction commit. This permits an approved
replacement to be activated transactionally, but never permits a published shop
to finish a write with no active stamp. Retiring/redesigning a stamp must not
alter collected historical snapshots.

### `stamp_artwork_versions`

Artwork and its approval belong to an immutable child version rather than to the
mutable stamp record.

| Column | Type / notes |
| --- | --- |
| `id` | `uuid PK` |
| `stamp_id`, `design_version` | Composite unique version identity; both are referenced by collections |
| `artwork_kind` | `generated_template` or `commissioned` |
| `approval_status` | `draft` or `approved`; approved rows cannot be updated or deleted |
| `template_data` | Required object for generated artwork; absent for commissioned artwork |
| editable source / clean SVG / outlined SVG / transparent PNG keys | Provider-neutral object keys, required before commissioned approval |
| matching SHA-256 columns | Lowercase checksums bound to the approved exports |
| `canvas_width`, `canvas_height` | Fixed `1200 × 800` master canvas |
| `ink`, `palette_version` | One of the shared eight inks and the palette version |
| illustrator credit / optional URL / maker-mark confirmation | Required before commissioned approval |
| rights basis / approval timestamp / evidence reference | Required before commissioned approval; the evidence reference remains admin-only |
| `created_at` | Audit timestamp |

Before human-commissioned artwork is approved, each immutable design version
therefore preserves:

- the editable source, clean SVG, outlined SVG and transparent PNG object keys;
- dimensions, checksums, selected ink and palette version for the approved files;
- the illustrator's display credit and optional credit URL;
- confirmation that the maker mark is part of the approved artwork;
- rights/licence metadata appropriate to the commission; and
- the illustrator's written approval timestamp plus an admin-only reference to
  the approval evidence.

Generated-template fixtures use the same version identity and approval boundary,
but store their complete renderer descriptor in `template_data` instead of
pretending that commissioned files, rights or illustrator approval exist.

### `stamp_collections`

Immutable source of truth for visited state and Passport.

| Column | Type / notes |
| --- | --- |
| `id` | `uuid PK` |
| `user_id` | `uuid FK` |
| `stamp_id` | `uuid FK` |
| `shop_id` | `uuid FK` |
| `stamp_design_version` | Composite FK to the exact approved artwork version issued |
| `collected_at` | server `timestamptz` |
| `shop_timezone` | IANA timezone snapshot |
| `verification_method` | `geofence`; future `qr`, `nfc`, `admin` |
| `verification_version` | integer policy version |
| `distance_m` | integer null |
| `reported_accuracy_m` | integer null |
| `anomaly_flags` | `text[]` |
| `shop_name_snapshot` | text |
| `place_snapshot` | `jsonb` containing country/locality display values |
| `stamp_snapshot` | `jsonb` containing design identity/version and the credited illustrator display data for that version |

Unique `(user_id, stamp_id)`. The stamp/shop pair and stamp/design-version pair
are protected by composite foreign keys. `stamp_snapshot` must match the active,
approved artwork kind, ink, palette version and generated template descriptor or
commissioned illustrator credit. Authenticated clients have owner-scoped read
access only; they cannot insert, update or delete. The server-only WP2
transaction/function verifies and issues atomically. Raw latitude/longitude is
never written.

### `verification_attempts`

Privacy-limited diagnostic/abuse table:

- `id`, `user_id`, `shop_id`, server-generated request ID and attempt time;
- coarse accuracy/distance buckets and configured radius;
- allowlisted result and anomaly flags;
- no raw coordinates, ciphertext, browser timestamps or arbitrary JSON.

Nonce hashes/keys and rate buckets live separately in the unexposed
`stamp_private` schema. Neither browser nor service-role direct table reads
can access diagnostics; controlled server functions own these records.

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

## Milestone 5 WP2 implementation

`verification_attempts` is now implemented with private 30-day diagnostics.
Nonces, per-shop policy and throttles live in the unexposed `stamp_private`
schema. Collection diagnostics remain null/empty; issuance snapshots are built
server-side. The service role no longer has direct collection INSERT permission.
See [the verification contract](docs/api/stamp-verification-v1.md) for the
precise schema/policy, clocks, privacy boundary and retention job.

WP3 adds `list_stamp_collections(p_after uuid)` for bounded owner-only history.
It returns saved historical fields plus a nullable current published shop slug
for navigation. Archiving a shop does not remove a collection. No table mutation,
collection-write permission, or historical-snapshot rewrite is introduced.
