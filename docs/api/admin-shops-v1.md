# Admin shop operations v1

All reads and mutations use verified cookie identity and the live database
`editor`/`admin` role. Audit reads retain their existing admin-only boundary.
No service-role credential, email allowlist or JWT metadata authorizes access.
Private data is never embedded in the HTML shell or persisted in browser storage.
`admin` includes every catalogue operation; `editor` is delegated catalogue
access. Founder is a responsibility fulfilled by an admin, not another stored
role or membership. Identity, role and shop calls use one request-scoped Supabase
client so token refresh cannot split the guard from the operation. Each database
RPC still checks the live role independently; trusted publication rules below apply.

| Route | Method | Body / query | Result |
| --- | --- | --- | --- |
| `/api/v1/admin/shops` | GET | Optional `q` (≤120 chars), UUID `after` | ≤50 summaries and nullable nextCursor |
| `/api/v1/admin/shops/options` | GET | None | Existing localities/types/services/specialties/brands |
| `/api/v1/admin/shops/options` | POST | kind=brands/specialties, label (1–300 chars) | Reused/created canonical id and refreshed options; no shop attachment/publication |
| `/api/v1/admin/shops/[id]` | GET | None | Private saved document, revision, publicationStatus, hasChanges, positionConfirmed, publicationErrors |
| `/api/v1/admin/shops` | POST | action=create, new UUID id, document={name,slug?} | Created private draft plus generated default in one transaction, 201 |
| `/api/v1/admin/shops/[id]` | POST | action=save, revision, full document | Saved private working copy |
| `/api/v1/admin/shops/[id]` | POST | action=confirm_position/publish/discard/archive/open/unknown/temporarily_closed/permanently_closed, revision | Updated record |

POST requires same-origin `Origin`, JSON content type and at most 131,072 body
bytes. Unexpected fields, queries and actions are rejected; no delete or restore
verb exists. Contract fields and controlled form metadata are in
`src/features/admin/shop-contract.ts`. SQL revalidates direct RPC requests.

401 means missing identity. 403 covers denied role/origin or a database permission
error; use the safe diagnostic stage to distinguish them. 400 means malformed request, 404 missing shop,
409 stale revision or duplicate identity, 422 field validation (`invalid_fields`), invalid data/reference/transition
or publication requirements, and 503 unavailable service. Raw provider errors
are never forwarded. A publication-incomplete response includes a bounded list
of actionable requirements. All responses are private/no-store; preview has no
public token or bypass. Role revocation is checked even after the HTTP guard.

Revisions are opaque. Pass the revision returned with the exact version edited.
After a lost mutation response, reload before deciding whether to retry. A
successful create whose response was lost will appear in the shop list; reusing
its UUID/slug produces a conflict, not a second record.

Save never changes public canonical fields. Publish applies the complete saved
revision atomically, preserving related source IDs and historical collections.
The SQL helper projection is not granted to any API role. The existing public
read RPCs continue to select published canonical tables only. See ADR 0012 and
the shop administration runbook for publication prerequisites and lifecycle rules.

## Request diagnostics

Responses include `X-Admin-Request-Id`; a failed request also includes
`X-Admin-Failure-Stage` (`identity`, `access`, `origin`, `validation`,
`catalogue_rpc`, or `response`). The browser console and server logs use the same
reference. These diagnostics contain no tokens, cookies, account identifiers,
request documents or provider messages. Server logs may include a SQLSTATE and
boolean origin comparisons. `X-Admin-Database-Reason`, when present, classifies
a permission failure as role denial, a table/function/schema privilege, row
security, or another permission error; it never includes provider error text. The audit transaction retains its own existing
request ID and authenticated actor attribution.

`X-Nib-Atlas-Release` and the page's `nibatlas-release` HTML metadata identify the
build commit. GitHub builds embed `GITHUB_SHA`; local builds say `development`.
This lets an investigation distinguish a stale page from the deployed route.

## Package B1 default initialization

Successful creation also calls the private `ensure_shop_generated_default` SQL
helper under the same current-role/shop locks and transaction. One approved
system-template version on one active stamp identity is prepared without media
manifests. This does not publish the shop or assert location/review/source facts.
Failure rolls back the entire create; reusing the create UUID still returns 409.
After a lost response, inspect the existing draft before retrying. Existing
working copies, publication gates and public projections are unchanged in B1;
trusted-admin publication is the next B2 contract slice, not already delivered.

Future import creation must reuse this initializer, with batch/row operation
idempotency outside it. It never replaces an existing stamp identity (including
retired or unfinished custom work), and consumes no upload quota. The helper
is not granted to any API role. See the media contract for explicit preparation
of older drafts and the plan for the mandatory 200-row import workflow.

## Shared input normalization

`normalizeShopDocument` is the shared pure boundary for manual save and future
mapped imports. It accepts a complete document with all relationship arrays.
Manual UI and HTTP call the same function. It trims surrounding whitespace,
preserves internal paragraph breaks and text postal/phone values, normalizes
country codes/UUID casing, accepts finite decimal strings and explicit
`true`/`false` cells, and keeps blank optional values unknown. It does not infer
geography, sources, dates, confirmations or review. Split/overnight hours remain
valid. Claim-line whitespace is normalized without manufacturing claims.

Malformed supplied fields produce HTTP 422 `{error:{code:"invalid_fields"},
fieldErrors:[{path,message}]}` with at most 100 issues. Paths address the complete
document (for example `shop.latitude`, `shop.opening_hours.entries.0.closes`,
`brands.1.source_id`). Messages never echo supplied values or provider errors.
The editor retains unsaved work, exposes invalid controls accessibly, and opens
collapsed sections before focusing a correction. Database-dependent vocabulary,
identity and concurrent-edit checks remain authoritative; their existing safe
RPC error codes are retained. This checkpoint does not claim every SQL error has
a field-level replacement.

Create now permits an omitted/blank slug. The server derives a bounded ASCII stem
(or `shop` for non-Latin-only names) plus the supplied new shop UUID. Retrying the
same logical create keeps that identity; the existing duplicate-create conflict
and reload recovery still apply. Explicit slugs are validated and retained.
Renaming an existing record never regenerates its URL.

Imports must resolve grouped mappings, merge omitted/blank fields against the
reviewed private document, apply deliberate clears and present before/after
changes **before** calling this full-document normalizer/save. Never feed a
partial CSV row directly to the replacement RPC. Batch/row/operation identities,
dry run/deduplication, correction/resume, bounded processing and selected batch
publication remain Package C work. The normalizer is not a shipped importer.

## B2b trusted editorial publication

The same editor/admin roles may publish a reviewed saved revision without sources,
claim tokens, reliability classification or evidence forms. Publication requires
name/slug, country/locality, street address, timezone, a finite coordinate pair,
one primary type, deliberate position confirmation and an active approved Atlas
Stamp. Optional postcode, hours, reference links, photos and editorial text do
not block it. Existing sources, claim dates and relationships remain available;
no source or per-field verification timestamp is synthesized.

`confirm_position` takes the exact saved revision, never a document. It locks the
current role/shop, checks base conflicts and records the actor, actual timestamp
and a fingerprint of the saved location. It advances the private revision.
Save cannot assert confirmation. Country/locality/display/address/postcode,
local-address/unit, coordinates or accuracy changes invalidate it. Reverting an
edit does not revive it; discard restores the canonical confirmation. Publish
checks it again under the shop lock. Existing records receive no inferred
confirmation or review during migration.

Explicit publish is the review event. The database supplies `reviewed_by` and
`reviewed_at`; clients cannot write them. Private save and preview never change
public review metadata. Public attribution says Nib Atlas and the real review
date, not that every fact was independently verified; account UUIDs stay private.
The original `last_verified_at` and source/claim timestamps remain separate.

The complete document adds optional scalar shop fields: `feature_headline`,
`field_note_heading`, `field_note_body`, `local_address`, `unit_floor`,
`nearest_station`, `station_exit`, `walking_guidance`, `entrance_notes`,
`editions_text`, `payment_methods`, `languages`, `holiday_note`, `internal_notes`
and `reference_links`. Text is bounded to 4,000 characters per field. Reference
links are one HTTP(S) URL per line. `short_description` remains the short intro;
paragraphs survive in the separate field-note body. `experiences` is an ordered
array of at most 100 `{id,category,title,description?}` rows; categories are
`fountain_pens`, `inks_paper`, `nib_testing`, `gifts`, `repairs`, `other`.
Existing appointment/accessibility/phone/postcode fields have public mappings.
Unknown appointment stays null; false remains No. Legacy documents without new
fields decode as unknown/empty. Migration keeps saved document bytes unchanged
and rebases only copies whose canonical base was current, preserving conflicts.

`internal_notes`, `reference_links`, evidence notes and actor/position metadata
never enter anonymous/ordinary-user APIs or public HTML. The shared editorial
preview uses an allowlist and omits private notes. RLS, current-role locks,
audited writes, revision/base checks and original stamp/collection history remain.
No upload is published or activated by a catalogue save or publish.

B3 canonical mappings/seven-section essentials, C's mandatory 200-row workflow
and D's full public preview/media choices remain. C must invoke position review
and publication deliberately against reviewed revisions, not copy attestations
from CSV cells. Omitted/blank import values preserve data; explicit clears and
safe merge/preview happen before this complete-document save contract.

## Mobile acceptance correction

Choice creation uses `admin_catalogue_choice`, current-role locking, serialized
create/reuse and fingerprint-only audit. Case and collapsed whitespace reuse an
existing name; existing IDs/slugs and old duplicate names are never merged or
rewritten. New choice creation is bounded by 10,000 items per vocabulary.
The selected shop relationship still requires an ordinary private save. Locality
creation and grouped import mapping remain B3/C work.

Save checks known locality/country and vocabulary references before mutation and
returns field paths. A fixed allowlist maps known database failures to safe field
errors; arbitrary provider text remains private. Revision conflicts retain the
existing reload/review requirement.

## B3 locality and type creation

`POST /options` additionally accepts `{kind:"localities",label,countryCode,adminAreaCode?}`
and `{kind:"types",label}`. These two kinds require **admin** in HTTP and SQL;
existing editor permission for brand/specialty creation stays intact. Labels are
bounded to 300 characters; country is two uppercase ASCII letters; optional
administrative area is bounded to 100 characters. Create/reuse is serialized.
Locality identity matches normalized case/whitespace label, country, administrative
area (case-insensitive) and a top-level parent; it never merges different countries,
areas or existing child places. Existing rows are not rewritten. Unknown locality
classification uses `other`, with no invented centroid or location attestation.
Each vocabulary remains capped at 10,000 rows; only actual insertions create audit
events. Selecting a newly created item stays in the editor until private save.

New type codes are immutable `type_<UUID with underscores>`. Public projections
carry `primaryTypeLabel` and detail `shopTypeLabels`, and readers require these
bounded labels for custom codes. Existing codes and the four approved public
filter categories remain unchanged. Custom types appear in unfiltered discovery,
Saved and detail; this slice adds no new filter categories or inferred mapping to
an existing category. The `test_venue` demo-only boundary remains intact.


## C3 saved-batch publication reuse

Package C3 adds owner-private batch review/publication operations around these
same saved-document, `confirm_position` and `publish` rules. The manual writer
and location invalidation contract are unchanged. The batch ledger binds exact
private and canonical state, records recoverable per-row outcomes and requires
fresh review after a change; imported drafts are never implicitly approved.
See `admin-import-v1.md` for the bounded wire contract and retention. Media and
artwork remain separately published/activated. C3 technical acceptance,
deployment and founder acceptance are tracked separately in its PR/runbook.
