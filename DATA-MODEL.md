# Nib Atlas Data Model

**Status:** Implemented MVP schema with explicitly marked planned entities
**Version:** 1.4
**Last updated:** 15 September 2026

## Implementation status

This is a domain summary, not an exact SQL column/grant reference. The ordered
[migrations](supabase/migrations/README.md) establish the implemented schema;
feature API contracts establish what callers can access. A migrated table does
not imply a complete UI, public endpoint or hosted runtime acceptance.

| Entities | Repository status |
| --- | --- |
| `profiles`, `saved_shops` | Implemented account tables with owner-scoped access |
| `localities`, `shops`, `shop_aliases`, `shop_links`, `shop_images`, attributes/join tables, `shop_sources`, `shop_source_claims` | Implemented catalogue tables; public access uses bounded safe projections. `shop_images` existence does not mean photo attachment/delivery is complete |
| `stamps`, `stamp_artwork_versions`, `stamp_collections` | Implemented versioned artwork and immutable collection foundations; commissioned upload/approval delivery remains incomplete |
| `verification_attempts`, `stamp_private` policy/nonces/rate buckets | Implemented internal verification records, not direct public APIs |
| `admin_audit_log`, `shop_working_copies`, `media_uploads` | Implemented restricted internal records, accessed through controlled operations |
| `import_batches` | Planned for M6 WP4; no migration/table yet |
| `contributions` | Planned database moderation model; current forms use Worker → Apps Script → Google Sheets |
| Campaign entities and `stamps.campaign_id` | Future only; not migrated |

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
| `alt_text` | Optional; delivery derives truthful shop-name fallback |
| `credit_text`, `source_url`, `rights_basis` | Optional existing metadata preserved; not MVP publication gates (#73) |
| `width`, `height`, `content_type` | Validation metadata |
| `sort_order`, `moderation_status` | Publication control |
| `upload_id`, `kind` | Unique validated receipt attachment; photo or logo. Attachment identity immutable; publication status may change |
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

### `import_batches` — planned, not migrated

`id`, source filename/key, content hash, contract version, imported by/at, dry-run flag, row counts, error report key, status.

Enables repeatable and auditable countrywide data operations.

### `admin_audit_log`

`id`, actor, action, entity type/id, before summary, after summary, request ID,
created timestamp. Implemented internal append-only audit: controlled server
operations write; admins use a bounded read RPC. Editors have no direct table
append/read access. See the M6 implementation sections below.

## Contributions

The database model below is planned, not migrated. Suggestion/correction forms
already exist and write to Google Sheets through the Worker and Apps Script; see
`docs/runbooks/contribution-intake.md`. Database-backed review/apply tooling is
deferred to Phase 2.

### `contributions` — planned, not migrated

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

Current public catalogue HTTP responses and Supabase fetches use `no-store`;
see `docs/adr/0012-shop-administration.md`. New requests read current catalogue
state; already-open results refresh through explicit reload/search. Per-request
memoization remains. Cross-request caching by bounds/zoom/filter is a future
optimization requiring reliable invalidation. Continue to fetch/merge private
saved and visited state separately.

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

Staging phone testing adds `test_venue` as a record type, separate from the four
public pen-shop filter types. Database constraints require its records to remain
`source_quality=demo`; no invented pen attributes are required. The fixture is
outside migrations/default seed and needs an explicit staging environment guard.
`position_precision=street` means approximate sourced venue/address precision,
not surveyed entrance, unit or floor precision.

## Milestone 6 WP1 implementation

`admin_audit_log` now records profile role changes with allowlisted before/after
role summaries, actor/target UUIDs, actor kind, request UUID and timestamp. No raw
request data. Direct table access is denied; only admins can use the bounded
read RPC. Update/delete/truncate are blocked. The service role loses broad profile
mutation privileges; database-owner `assign_profile_role` performs audited setup.
Audit starts at migration time. Canonical catalogue-change events and their
transactional hooks follow with each later admin write package.

## Milestone 6 WP2 implementation

`shop_working_copies` stores bounded private edit documents, revision UUIDs and
canonical base fingerprints. No direct client/service-role grants; role-checked
RPCs own access. Unpublished shops may have null country/timezone/location;
published geography remains non-null by constraint. Publication validates the
full catalogue and existing approved-active-stamp prerequisite. Catalogue writes
append status/fingerprint audit summaries without recording source notes or raw
field values. See `docs/adr/0012-shop-administration.md` for transitions, locking,
field semantics and the intentionally separate artwork/import integration points.

## M6 WP3 first-slice media transport

`media_uploads` records a private upload UUID, environment, existing shop and
optional commissioned draft artwork-version FK, purpose, immutable object key,
SHA-256, expected size/MIME, optional photo/logo source/rights/credit/alt metadata, expiry
and server-validated dimensions. Its pending/validated states describe transport,
not approval. Artwork rights/credit are copied from the existing version and
rechecked at finalization. No approval evidence is copied. Direct API-role table
access is revoked; the isolated Worker RPC enforces the live editor/admin role
and uploader identity. Initiation/finalization append existing audit fingerprints;
validated rows are immutable. Existing artwork, images and collections are not
rewritten or attached by this foundation. See `docs/api/admin-media-v1.md`.

### WP3 JPEG photo identity

For JPEG shop photos, original `sha256`, `byte_size` and `content_type` remain
input identity. Nullable `output_sha256`, `output_byte_size`, `output_width`,
`output_height`, `output_content_type` describe a processed PNG. `storage_key`
is initially null and reserved exactly once against the output hash before R2
write, through the live-role, uploader/environment-isolated `prepare` operation.
Input identity and reserved output are immutable; completed receipts retain the
existing immutability trigger. PNG rows/keys remain unchanged. No source JPEG is
stored. Preparation adds an audit fingerprint; retrying identical preparation
or completed finalization adds no duplicate event. See the media API contract.

### WP3 photo/logo attachment and delivery (#73)

The additive 20260919000100 migration makes photo/logo receipt metadata nullable,
drops the obsolete approved-image paperwork check, and adds immutable receipt
attachments to `shop_images`. Existing values are not rewritten. Logos use PNG
and never enter stamp validation or JPEG conversion. The service-only
`shop_media_operation` locks live roles and shop state, checks environment and
validated uploader ownership on attach, and audits attachment/publication/hiding.
Only admin may publish/hide. Public list/file lookup requires a published shop
and approved attachment in the current environment; raw bucket access stays private.
Existing non-receipt image rows are preserved but not exposed by this new delivery
route. Stamp schema/origin/credit/approval changes remain the next #73 slice; do
not fabricate old commissioned fields to make uploads pass.
