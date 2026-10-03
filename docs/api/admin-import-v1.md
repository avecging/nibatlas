# Bulk shop import — table workflow and guarded operations

## Current interaction (#123)

`/admin/shops/import` is one job table, not a numbered wizard. Upload automatically
maps recognized headers and validates in bounded requests. All rows remain in the
table; valid rows are preselected across filters, invalid/duplicate rows are
blocked. Filters are All / Ready / Needs fixing / Duplicates / Failed. Column and
shared-value mapping are optional disclosures; unknown columns are explicitly
reported. Inline editing is deferred.

**Save selected as drafts** drives the existing per-row review → execute calls.
**Publish selected** uses the same draft path, then existing publication review,
optional deliberate position confirmation and publish calls. One confirmation
panel covers selected publication; checking its position attestation is explicit,
never inferred from upload or import success. Imported coordinates must match the
positions displayed for this decision. No server fast path bypasses review.

Rows continue independently after validation, conflict or network failures.
The table shows concise imported/published and remaining counts and focuses on
exceptions after an action. A final ledger read recovers lost responses. Saved
jobs use the existing owner-private 30-day operation ledger. Unsubmitted/invalid
source rows remain in memory: keep the source file; this UI does not claim raw
uploads are durably stored. There is no dedicated history UI.

Correction CSV contains all supported input columns plus `correction_format`,
`errors` and `how_to_fix`, a UTF-8 BOM, reversible formula-safe transport escaping,
and stable `row_id`. Re-upload replaces only matching rows; unknown or repeated
IDs are rejected. Other rows and deliberate deselections remain. Newly valid
corrected rows are selected. Original source uploads remain limited to 2 MiB;
recognized generated correction reports allow 8 MiB for repeated annotations,
with unchanged 500-row, 64-column and 4,000-character cell bounds.

A corrected saved row is bound to its original shop ID. The additive
`20261002235545_import_row_corrections.sql` migration permits a new operation
revision only for an explicit update of that exact target, with the previous
operation identity and a fresh validated review key. Completed operation outcomes
remain intact and replay-safe; failed/pending operations retain their existing
supersession behavior. Published corrections save privately until deliberately
published. Unchanged corrected rows return to their saved state without writing.

The draft execute HTTP response now includes the ledger's `resultRevision`.
Immediate publication compares this with the saved publication state, refusing
concurrent unseen edits. Refresh/reopen loads current saved documents when their
revision differs from the import result, so inspection shows current content
before binding publication to it. Preview supplies the effective merged address
and coordinates, including preserved existing values, for the explicit position
attestation; publication rejects any mismatch with the freshly saved state.
Database authorization, vocabulary, duplicate,
revision, transaction, position, publication and audit rules remain authoritative.

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
an opened batch retain those identities. Use **Start a new job** only
for a distinct import; changing a file does not reset the current batch identity.

Grouped values resolve countries using the existing country selector and
localities/types/brands/specialties against current canonical IDs. Exact unique
labels/IDs may match automatically; ambiguous labels require explicit selection.
Locality mappings include country scope; omitted country on an update can select
from all existing localities, with the merged country enforced by shared/SQL
validation. Selections apply once to every matching value and can be reused when
reselecting a corrected file in the same signed-in workspace. Nothing creates
vocabulary. Brands/specialties use `|`-separated cells and add/reuse relationships;
shop_type selects exactly one main store type, replacing the previous type rows.
Reusing the same type retains its legacy notes and source metadata; a different
type does not inherit that evidence. Blank/omitted shop_type preserves the saved
type, and an explicit clear leaves it unassigned in the private draft. Multiple
legacy types require deliberate selection before saving. Secondary features such
as vintage/used stock and nib/repair work are maintained manually in Experiences.

Canonical shop-type codes (for example `distributor`) resolve from the
existing database `shop_types.code` via the admin options response, as do
unique UUIDs and display labels. The importer never creates a missing choice.
The forward migration `20260925000100_singapore_import_vocabulary.sql` supplies
the five reviewed brands in the first Singapore batch and the Singapore
locality for fresh environments. It reuses an existing brand with the same
case-insensitive normalized name rather than replacing its UUID or creating a
duplicate. `LAMY` and `Lamy` therefore resolve to the same row; Graf von
Faber-Castell and Faber-Castell remain distinct brand entries. Beste is the
distributor/service operator, not a brand entry. Other brand names require
separate review and canonical creation before import. Specialties are also
controlled choices; services are outside the v1 import file. Existing shop
links, sources, notes and publication rules are unaffected.

Blank/omitted/null cells preserve existing values. `clear_fields` contains
`|`-separated supported field names, deliberately clears scalars or the whole
selected relationship group, and appears as EXPLICIT CLEAR with before/after.
Name, slug and required status/precision cannot be cleared. Supplied value plus
clear is rejected. Sources/other aliases/experiences/services/opening hours, legacy
classification/review dates, media, artwork and attestations are not import
inputs in v1; their existing values survive. Arbitrary image URLs are never
fetched. Preview itself creates no stamp/default, publication, visit or audit writes.

The founder can filter/search the whole job table (up to 500 rows), see actionable
field errors and source row IDs, inspect duplicates and proposed changes, and
download a re-uploadable CSV correction report with original field values and instructions. Each cell is quoted/escaped and formula-like
leading content is neutralized, including leading whitespace/control characters.
The report contains private admin data: download is explicit, never automatic.
Re-upload corrections by row_id; affected rows receive a fresh preview, with file duplicates checked across the whole job.

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

The UI automatically selects valid new or exact-ID update rows. Invalid and
possible-duplicate rows stay blocked; no-change rows need no draft write.
**Save selected as drafts** performs reviewed plans and their execution sequentially
within one bulk action, with per-row progress, partial outcomes and links to saved
drafts. Publication warnings do not block an otherwise valid draft. Existing
canonical/public records remain intact.

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
revised. Corrections use a new UUID and incrementing revision,
require the latest previousOperation ID and fresh preview/review; a superseded unresolved
operation becomes skipped and drops its payload, while completed operations remain
intact. Corrections after a completed operation must retain its original target. A failed/interrupted request can
be reopened after reload: confirmed successful outcomes are never executed twice.
An unknown transport outcome is shown on that row while independent rows continue;
the final ledger read recovers outcomes, or Refresh job retries recovery.

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

## Saved-batch review, position confirmation and publication (C3)

The whole-job table loads saved publication summaries through the existing
25-row API pages (maximum 500 rows), without exposing pagination or a separate
publication workflow. Published, unresolved private-import, archived and
base-conflicted rows cannot be selected for a new publication review. Imported
drafts can be selected for publication without repeating the private save.

**Inspect fields and changes** exposes imported values and their before/after
projection. When a saved revision differs from the import result, refresh and
recovery load the current complete document for inspection before publication.
Private fields stay private. **Open saved shop** opens the normal editor.
Incomplete rows show the existing exact publication requirements.

**Publish selected** displays one deliberate confirmation panel. It drives the
existing per-row publication review, optional position confirmation and publication
calls. Review binds the exact private revision, complete document and canonical
base/status using the existing review hash; it creates no public review date.
The position checkbox explicitly attests to the displayed selected addresses and
coordinates. SQL calls `admin_shop_write('confirm_position')`; the revision
advances and replaces that publication operation's binding atomically. Confirmation
is never inferred from imported coordinates. Existing valid manual confirmation
is honored. Later private changes invalidate the publication review; location
changes also invalidate position confirmation under unchanged fingerprint rules.
Old confirmations do not revive when coordinates are reverted.

Each one-row POST remains a separate transaction. A row with unmet publication
prerequisites stays a draft with actionable blockers; other selected rows continue.
SQL checks the current reviewed binding under the shop lock, then calls unchanged
`admin_shop_write('publish')`. Document validation, canonical relationships, source
IDs, stable IDs/slugs and review attribution apply. Catalogue publication neither
publishes images nor activates artwork, and never creates visits, collections or
impressions. Existing active approved artwork is required.

### Wire contract

`/api/v1/admin/import/publication` uses the same ordinary request-scoped session,
live admin role, same-origin POST protection and private/no-store headers as C2.
GET accepts only `batch=<UUID>` plus `offset=0..499` for 25-row summary pages,
or `import=<UUID>` for one same-batch full detail. POST accepts exactly:

- `review`: version, batchId, importId, operationId, reviewKey, previousOperation
  (null for the first review, otherwise the latest publication operation UUID).
- `confirm_position` / `publish`: version, batchId, importId, operationId only.

No client document, position, review date or publish-all flag is accepted. HTTP
bodies retain the 256 KiB ceiling; SQL mutation payloads are at most 4 KiB.
The corresponding RPCs are `admin_import_publication_read(batch,offset,import)`
and `admin_import_publication(action,batch,import,operation,payload)`.
Reads/mutations enforce owner and unexpired batch checks. Mutations lock live
admin authority, batch, import operation, publication operation and shop. New
ledger tables have RLS enabled and no API table grants/policies. Helpers are not
granted to API roles. Editor and revoked users cannot use this admin-only flow.

### Durable outcomes and retry

`import_publications` references completed C2 operations and preserves review
revisions, hashes, actual event times and statuses (`reviewed`, `published`,
`conflicted`, `failed`). It retains no source cells or full documents. Review
operation UUIDs bind their initial hash; repeating review/confirmation/publication
returns current outcomes without repeating a completed write. A superseded
operation cannot publish a newer review. Successful publication operations cannot be replayed. A later correction to the
same row needs a new reviewed private operation and a separate publication decision.

Known per-row validation/conflict failures persist without rolling back successes
in other rows. Unexpected transaction/transport failure is recorded per row; independent rows
continue and the final ledger read recovers durable outcomes. **Refresh job**
recovers again if that final read fails. A transient failed row can retry its same operation if the reviewed
binding remains current. Corrections/staleness require a new explicit review
revision (maximum 100, matching C2). Published rows are excluded from retry.

Minimal `publication_*` events append to the existing immutable import audit;
confirmation/publication events link to catalogue request IDs. Superseded review
and failure history remains available to operators. The UI concentrates on current outcomes and exceptions; it does not expose
audit tables or add a dedicated history workflow. Existing
30-day owner-private recovery expiry applies. Publication tombstones contain no
payload needing the C2 cleanup job; all original C2 retention/export protections
remain intact. No remote schedule is changed.

## Acceptance and launch obligations

C3 implements the remaining bulk review/publication path; automated acceptance,
staging deployment and founder acceptance remain distinct. See the PR for exact
checks/revision and the combined checklist in the shop-administration runbook.
No founder acceptance is inferred from passing CI. Package D rich editor/media
integration, Package A/M5 field acceptance, M7/M8 production/account/backup/
monitoring obligations and #68/#70/#71/#72/#87 remain separate.
Catalogue research/reconciliation and real imports need their own founder scope.

## Social/contact columns (#110)

Both v1 downloadable templates and CSV/JSON mapping accept flat string columns
`facebook`, `instagram`, `tiktok`, `xiaohongshu`, `threads`, `x`, `youtube`,
`whatsapp`, `telegram`, `line`, `wechat`, `messenger`, `kakaotalk`.
They use the same channel normalizer as manual saves (see `admin-shops-v1.md`).
Existing files and the current version remain valid; the column/file/row limits
are unchanged. URLs or handles are accepted where safely derivable; copy-only
contact IDs remain IDs rather than fabricated URLs.

On explicit shop-ID updates, an omitted or blank channel preserves that row
byte-for-byte. A supplied channel updates that platform's existing row in place,
retaining its ID/label/order/official flag and all unrelated links. New rows have
deterministic IDs derived from the target/proposed shop ID and platform, so
repeated previews/resume agree. Multiple legacy accounts for a supplied platform
block with a request to resolve them in the editor; no account is guessed.

`clear_fields=instagram|wechat` explicitly removes those platform rows. Supplying
a value and clearing the same column is invalid. Before/after changes identify
the platform, including clear actions. Existing safe duplicate targeting,
revision conflicts, private import, saved previews and deliberate publication
remain authoritative; no new review step or vocabulary creation is introduced.

## Local-name columns

CSV/JSON templates and column mapping accept optional `local_name` and
`local_name_language` (for example `ja-JP` or `zh-Hant`). Supply both together;
the language uses the existing manual-editor tag validation and is never inferred
from country. `name` remains the main display name. Combined English/local name
cells are not automatically split. No other alias kinds are import inputs.
Existing v1 files and file/row/column limits remain compatible.

Blank/omitted pairs preserve all existing aliases exactly. A supplied pair adds
one `local_name` alias or updates the sole existing local name in place, retaining
its ID. Multiple existing local names block replacement with an editor correction
message; no name is guessed. Other alias kinds remain intact. New alias IDs derive
from the target/proposed shop ID, so preview, review and retry produce the same
complete document. Shared normalization and the existing private save/publication
path validate and persist the alias; no database migration is required.

`clear_fields=local_name` deliberately removes all local-name aliases and their
language tags, preserving other kinds. Leave both name/language cells blank when
clearing. The language cannot be cleared independently. Preview shows name and
language before/after values and explicit clears. Published names use the existing
single-local-name display beneath the main shop name; importing only saves a
private draft and never publishes automatically.

## Supported-field persistence audit (#123)

The template is generated from `FIELDS`, the same field registry used by parsing,
mapping and preparation. `field-persistence.test.ts` asserts exhaustive coverage
of the registry for both CSV and JSON. `039_import_field_persistence.sql` checks
the real private writer, normal editor reader, position confirmation, publication,
canonical map geometry, relationship values and same-target corrections.

| Input | Persisted representation / behavior |
| --- | --- |
| All supported scalar fields, including editorial text, visit/contact details and private notes | `document.shop.<field>` through shared normalization and the normal private writer; canonical scalar fields on publication. Internal notes/reference links remain private. |
| latitude / longitude | Numeric private shop fields, including negative values and zero; same normal editor fields; published PostGIS point uses longitude as X and latitude as Y. Position confirmation is independent and invalidated by location changes. |
| country / locality | `shop.country_code` / `shop.locality_id`, canonical choices validated together. |
| shop_type / brands / specialties | A supplied shop type replaces the previous main type; blank preserves it. Supplied brands/specialties add or reuse relationships while retaining untouched metadata. Secondary features stay in manually authored Experiences. |
| local_name / local_name_language | Deterministic local-name alias and its explicit language tag. |
| All 13 social/contact columns | Deterministic links using the shared channel normalizer; copy-only contact IDs remain IDs. |
| clear_fields | Explicit clearing instruction, reflected in before/after; not a stored catalogue field. |
| row_id / shop_id | Job identity / explicit target identity; not shop attributes. |

Recognized headings are case/space normalized; lat, lng and lon map explicitly to
latitude/longitude. Previously those variations could be ignored by exact-header
mapping. The audit found no unconditional coordinate stripping in the canonical
save path; these regressions cover both mapping and persistence without claiming
to have reproduced the founder's original file.
