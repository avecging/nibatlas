# Package C checkpoint 1 — import preview (work in progress)

Coordination boundary: based on main `2721a52`, with no open PR at inspection.
Claude's next map/list checkpoint may proceed independently. This branch adds
import-only UI/routes/modules and migration `20260920001000_c1_import_preview.sql`.
The existing editor changes only by adding an admin-only link beside Add a shop.
No public shop-summary, manual normalization, publication, media, dependency or
workflow contracts change. Accepted shop-page decisions remain intact.

This checkpoint is read-only. Actual private import, vocabulary creation,
selected publication, durable batches/audit/retention and retry/resume execution
are later checkpoints; Package C is not complete.

## Shipped boundary

`/admin/shops/import` is linked beside Add a shop for admins. Its session-keyed
workspace holds uploads, mappings and results in memory only; sign-out/account
change unmounts it. `GET /api/v1/admin/import` loads canonical choices;
`POST` previews `{version:"nibatlas-shops-v1",batchId,rows}`. Both require verified
cookie identity and current **admin** role. POST additionally requires same
origin, JSON, no query/extra keys, ≤25 rows and ≤256 KiB. All responses are
private/no-store. The single request-scoped ordinary Supabase client handles
identity, role and RPC calls; no elevated credential is introduced.

The separate `admin_import_preview(context|validate, rows)` RPC independently
checks current admin role, accepts ≤25 rows/2 MiB, and is STABLE/read-only.
Context supplies explicit-ID private copies/revisions and at most 10 candidates
plus an overflow flag, considering canonical and private names/slugs. Similar
names use a conservative trigram threshold (0.5) within the supplied country;
missing country searches all countries. Slug matches ignore country. Candidate
matching is advisory, not exhaustive entity resolution, and never authorizes an
update. Exact repeated IDs/slugs and equal names with compatible or unknown
countries are also flagged across the entire file, including request boundaries.

Server-side preparation starts from the current private document or explicit
new-draft defaults and invokes the unchanged `normalizeShopCreate` /
`normalizeShopDocument`. Untouched existing values and relationship metadata
are retained exactly after normalization. Proposed update slugs are immutable.
SQL validation calls the existing `validate_shop_document` and
`shop_publication_errors`, checks private revision and canonical base conflicts,
archival and duplicate/reserved slugs. Merged documents are subdivided below
900,000 compact JSON bytes to stay below the SQL payload limit even when source
rows are tiny and private copies are large. Failure never falls back to a local
"valid" result. A completed preview is an observation, not a future write token.

## Files, mapping and correction

Downloadable v1 templates use the same flat fields for CSV and JSON. JSON wraps
`{version,rows}`; CSV version is identified by template filename and current
mapping schema. Arbitrary CSV headings are mapped explicitly, with ignored
columns visible. UTF-8/BOM, quoted commas, multiline text and doubled CSV quotes
are supported. Files are bounded to 2 MiB, 500 rows, 64 columns and 4,000 characters
per cell; ambiguous headers, mismatched cell counts, malformed quoting, nested
JSON values, wrong JSON version and oversized input fail with correction guidance.

`row_id` is optional but recommended (unique 1–100 letters/numbers/`_.:-`);
otherwise source line/array position identifies the row. Keep it through source
corrections. Proposed creation UUIDs derive from session batch UUID + row identity;
retries within the loaded batch remain stable. A newly selected file starts a new
preview batch. This is not a persisted resume mechanism.

Grouped values resolve countries using the existing country selector and
localities/types/brands/specialties against current canonical IDs. Exact unique
labels/IDs may match automatically; ambiguous labels require explicit selection.
Locality mappings include country scope; omitted country on an update can select
from all existing localities, with the merged country enforced by shared/SQL
validation. Selections apply once to every matching value and can be reused when
reselecting a corrected file in the same signed-in workspace. Nothing creates
vocabulary. Brands/specialties use `|`-separated cells and add/reuse relationships;
shop_type sets the primary type while retaining other type rows and legacy notes.

Blank/omitted/null cells preserve existing values. `clear_fields` contains
`|`-separated supported field names, deliberately clears scalars or the whole
selected relationship group, and appears as EXPLICIT CLEAR with before/after.
Name, slug and required status/precision cannot be cleared. Supplied value plus
clear is rejected. Sources/aliases/experiences/services/opening hours, legacy
classification/review dates, media, artwork and attestations are not import
inputs in v1; their existing values survive. Arbitrary image URLs are never
fetched. No stamp/default creation, publication, visit or audit write occurs.

The founder can filter/search/paginate results (25 on screen), see actionable
field errors and source row IDs, inspect duplicates and proposed changes, and
download a CSV correction report. Each cell is quoted/escaped and formula-like
leading content is neutralized, including leading whitespace/control characters.
The report contains private admin data: download is explicit, never automatic.
Correct the source file and rerun; any mapping/file change invalidates old results.

## Next checkpoint and launch obligations

Actual selected private import must add durable batch/row/operation identities,
bounded execution, transaction-bound revision and canonical-fingerprint checks,
audit/retention, safe retry/resume and honest partial outcomes. It must re-read,
revalidate and merge patches, never pass partial rows to replacement writes, and
reuse the existing atomic generated-default initializer only for new shops.
Names/candidates never select overwrite targets. Selected publication remains a
separate deliberate review/position attestation against fresh saved revisions.
No durable mutation API, publication UI or resumable executor is implemented here.

Package C remains incomplete. Package A acceptance, M5 geography/field testing,
M7/M8 production/account/backup/monitoring obligations and #68/#70/#71/#72 remain.
No merge or deployment is authorized by this checkpoint. Staging remains shared
with Claude's public UI work.
