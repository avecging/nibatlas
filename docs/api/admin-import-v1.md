# Package C — preview and selected private import

C1 shipped in merged PR #85 (`38f2ca7`); main inspected for this checkpoint is
`bf878ad` after #86. Main CI 35554754848 and C1 merge CI 35538087141 passed.
The initial main-branch-only deployment check found 35517859183 at `2721a52`.
The final cross-branch check corrected that snapshot: C1 deployment 35533530776
at `9068e77` succeeded. Later run 35539553710 at `60748bc` applied migrations
and uploaded the Worker, then failed its shop-map smoke test. A failed final
workflow status does not mean the older Worker remained deployed. Direct runtime
release inspection timed out, so current served release is unverified. No C2
deployment was performed. No open concurrent PR existed at start. This checkpoint reserves additive migration `20260921000100`; it touches
only import UI/routes/contracts, not public map/editor contracts. Map refresh is
post-MVP #87. Remote Supabase schema/data were not accessible in this session;
schema claims below derive from repository migrations and isolated tests.

Package C is not complete. Selected saved-batch review/position confirmation and
publication remain the next separate checkpoint. This task does not authorize
merge, deployment or real catalogue imports.

## Shipped boundary

`/admin/shops/import` is linked beside Add a shop for admins. Its session-keyed
workspace holds raw uploads, mappings and preview results in memory; sign-out/account
change unmounts it. Only explicitly reviewed mapped rows enter the private ledger. `GET /api/v1/admin/import` loads canonical choices;
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
corrections. Proposed creation UUIDs derive from batch UUID + row identity. Corrections within
an opened batch retain those identities. Use **Start a separate new batch** only
for a distinct import; changing a file does not reset the current batch identity.

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
fetched. Preview itself creates no stamp/default, publication, visit or audit writes.

The founder can filter/search/paginate results (25 on screen), see actionable
field errors and source row IDs, inspect duplicates and proposed changes, and
download a CSV correction report. Each cell is quoted/escaped and formula-like
leading content is neutralized, including leading whitespace/control characters.
The report contains private admin data: download is explicit, never automatic.
Correct the source file and rerun; any mapping/file change invalidates old results.

## Selected private import and durable recovery

`/api/v1/admin/import/batches` uses the same request-scoped ordinary client,
current **admin** authorization, same-origin mutations, bounded JSON body and
private/no-store responses. GET lists the owner's latest 50 unexpired batches;
`?batch=<UUID>` reopens the current operation revision for each row (max 500).
POST accepts exactly one operation, giving each row its own transaction:

- `review`: version, batchId, operationId, previousOperation (or null), mapped row
  and reviewKey. Re-read current options/record, normalize a complete merged
  document and validate again. Reject stale/blocked/duplicate proposals. The SQL
  transaction checks the reviewed SHA-256 binding and current draft/canonical
  state under the shop lock, then persists the private operation. No shop changes.
- `execute`: version, batchId and operationId only. Read that single protected
  operation, reparse its saved mapped input and prepare/validate again. SQL locks
  current admin authority, batch, operation and shop; compares the document,
  expected revision and canonical document/publication state against the stored
  review binding atomically with the save. Check current duplicate candidates
  again. A mismatch is a durable conflict requiring fresh review.

A preview reviewKey is a content/revision binding, never bearer authorization.
SQL checks authorization again for replayed successes. All ledger tables have
RLS enabled and no direct API grants or policies; security-definer functions use
an empty search path and enforce both current admin and batch ownership. Another
admin cannot read/execute another owner's batch. No service key is introduced.
Each environment's existing isolated Supabase project owns its own ledger;
no client-selected environment or cross-project route exists.

The UI selects only valid new or exact-ID update rows. Invalid and duplicate rows
remain unresolved; no-change rows are skipped by selection. **Review selected
rows** persists the selected plans and shows new/update counts and explicit clears.
**Import selected as drafts** runs exactly the confirmed operation IDs sequentially,
with per-row progress, partial outcomes and links to successful private drafts.
Cancellation before this action changes no shop. Publication warnings do not
block an otherwise valid draft. Existing canonical/public records remain intact.

New rows call the existing atomic `admin_shop_write(create)` generated-default
initializer and then save the full normalized document inside the same operation
transaction. Any failure rolls both back. Updates call only private-copy save;
no default initializer runs for existing shops. Blank/omitted fields, stable URLs,
legacy provenance, relationships and existing media/artwork/history remain under
the established merge and save contracts. No vocabulary/image/publication/visit
side effects are added. Imports serialize duplicate checking against other import
executions using a transaction advisory lock; the normal shop locks serialize
manual edits/publication and protect revision checks. No whole-batch transaction.

Persisted UUID operation identities and `(batch,row,operation_revision)` uniqueness
make repeated requests return the existing result. Completed operations cannot be
revised. Corrected unresolved rows use a new UUID and incrementing revision,
require the latest previousOperation ID and fresh preview/review; the superseded
operation becomes skipped and drops its payload. A failed/interrupted request can
be reopened after reload: confirmed successful outcomes are never executed twice.
An unknown transport outcome stops the UI and directs the admin to reopen/recover.

## Access, audit and retention

Only mapped row inputs and the review's before/after projection are persisted;
raw source files and full private documents are not retained in the ledger or logs.
The execution hash binds the complete merged document without storing it. Current
row payloads are available to their creator while that account remains admin, for
30 days from batch creation. Expired batches immediately deny read/execute/review.
Operation IDs, target IDs, revision hashes and outcomes remain as private minimal
idempotency tombstones; reusing an expired batch never starts a new import.

`import_audit_events` records actor, batch, operation/revision, status, review hash
and time atomically; successful events link to the catalogue save's request ID.
No raw cells/documents/names enter audit. Update/delete/truncate is denied. Existing
catalogue and generated-artwork audit still applies. Batch UI does not expose the
operator audit tables. Account lifecycle/long-term accountability retention remains
M8, alongside existing admin audit.

After separately authorized deployment, the database operator must schedule daily
`select public.purge_import_payloads()` in each environment and monitor it. It is
operator-only and clears at most 500 expired payloads per invocation; repeat until
caught up for larger backlogs. This task does not install a remote schedule. Logical
expiry is enforced regardless of cleanup availability. Payload cleanup never runs
in an import row transaction or removes tombstones/audit/catalogue data.

## Next checkpoint and launch obligations

Next: select already saved rows for a fresh, deliberate batch review, position
confirmation and publication bound to saved/current revisions, with recoverable
partial results. Do not treat a draft import, generated default or old preview as
approval to publish. No selected-publication API/UI exists in this checkpoint.

Package A acceptance, M5 geography/field testing, M7/M8 production/account/backup/
monitoring obligations and #68/#70/#71/#72 remain. Catalogue research/reconciliation
and real imports need their own founder scope; no research sheet was created here.
