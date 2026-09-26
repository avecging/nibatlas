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
array of at most 100 `{id,category,title,description?,icon?}` rows; categories are
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


## Curated experience icons

An experience may carry an optional `icon` key: `pen`, `nib`, `ink`, `swatch`,
`paper`, `book`, `tools`, `gift`, `workshop`, or `chat`. These are presentation
choices independent of category. The editor shows labelled native radio choices;
old entries with absent/null icons still render the existing Writing (`pen`) icon.
Arbitrary SVG, URLs and unknown icon names are rejected in the shared normalizer,
SQL validator and public decoder. The public renderer and both saved preview
implementations use the same icon component.

The icon follows the existing complete-document private save, revision conflict,
explicit publication and audit contracts. It is not a media upload or stamp-artwork
choice. Import v1 still does not accept experiences; safe updates preserve existing
experience rows and their icons. The additive validator migration changes no stored
catalogue/draft rows, fingerprints, grants or artwork history.

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

## D1 editor behavior (no wire/schema change)

The hours UI writes the same `opening_hours: null | {note?,entries?}` document.
Rows still contain only day/opens/closes/closed/note; split/overnight rows and
unknown flags survive. Day copy preserves every source row/note and explicitly
replaces only the chosen destination. Whole-hours clear writes null; clearing a
summary does not clear entries or the separate `holiday_note`.

The D2 addition is `opening_hours.exceptions?: {date,opens?,closes?,closed?,note?}[]`
on the same complete shop document. Dates are real ISO `YYYY-MM-DD` shop-local
calendar dates; at most 100 rows. A date can have multiple open periods, including
overnight spans, or one closed row. Open and closed rows cannot coexist on a date;
times come in pairs and a closed row has no times. Unknown remains distinct from
closed. Missing exceptions decode as empty and do not alter old weekly rows or
holiday prose. Shared manual/import normalization and the SQL writer enforce the
same shape; v1 CSV/JSON import does not accept exceptions as a mapped column and
preserves existing hours. The published detail returns `openingHoursExceptions`
only from the published revision. A private save never publishes these entries.

Failed-save comparison uses the existing GET and never swaps in its revision for
local unsaved edits. A current revision is adopted only with the returned saved
mutation document or a deliberate reload. The saved-text preview is labelled as
such and excludes unsaved/private maintenance content; full public rendering and
pending-media/artwork review integration remain D follow-ups. Catalogue save
continues to advance private state and invalidate C3 bindings as specified above.


## D3 saved public-renderer preview

`/admin/shops/[id]/preview?revision=<opaque revision>` is a private client shell,
not a public preview token. It embeds no catalogue data in initial HTML and uses
only the existing authorized, private/no-store shop, options and media GETs. It
rejects a mismatched saved revision rather than silently previewing newer content.
Unsigned/ordinary accounts remain denied by those existing server boundaries.
Changing accounts unmounts the in-memory snapshot. Preview routes never mount the
normal saved-shop/collection providers, so opening a preview cannot trigger a
local-save import or pending account action. No new mutation endpoint is added.

The editor embeds this route at real 360/1280 px viewport widths. A public-field
allowlist feeds the same public decoder/adapter and `ShopDetailView` used on the
shop page. It previews the saved content as it would look after editorial
publication; unsaved form values, private notes/references, evidence notes and
actor metadata never enter the rendered model. Incomplete required identity,
location/timezone/type data produce an incomplete-preview notice, not invented
facts. Weekly split/overnight/open-unknown labels now share the actual renderer.

The frame shows only approved images in their saved order, through authenticated
private delivery (also for unpublished shops). Draft images and stamp activation
choices are excluded. This is a current media snapshot, not revision-bound media
publication approval; refresh to reread. Gallery/zoom interactions work. Account
actions are inert and link activation is suppressed within the frame. Nearby
recommendations, account state and the future editorial review date are not
invented. Stamp art remains in its own review section, matching the current public
page's absence of a stamp identity header. Private save/publish/activation APIs,
audit, C3 review bindings and historical impressions are unchanged.

Migration `20260925083746_d3_public_preview_option_order.sql` only adds the public
projection's `code` tie-break after `sort_order` to type/service/specialty options.
It changes no rows, IDs, labels, grants or current-role checks; grouped import
mapping retains exactly the same vocabulary. Deploy it before claiming ordering
parity. Integrated pending media/artwork review remains the next D checkpoint.


## D4a saved media/artwork comparison

Review includes a separate read-only comparison of saved photo/logo attachments
and active or uploaded draft stamp versions. It uses existing private/no-store
shop, media and stamp GETs. The shop ID and opaque saved revision must match both
before and after the separate media reads; any failed, denied or malformed read
withholds the whole comparison. The existing account-keyed editor unmounts this
memory on account change/sign-out. No browser storage, public token, mutation,
new endpoint, provider key or private source field is introduced.

Approved photos stay included; optional draft photos retain saved gallery order.
One logo is selected, initially the approved logo. Stamp choices default to the
active version and allow uploaded drafts only after their PNG has been saved.
Historical inactive approvals are not offered for reactivation. Existing exact
private bytes and creator credits are reused; generated previews use stored
template/ink and saved known labels. Missing artwork is not substituted.

Comparison choices reset on reload, leaving Review or a changed saved revision.
The selected gallery reuses the public gallery/zoom renderer, but it is separate
from D3's unchanged approved-only public-page frame. Choosing or publishing the
shop does not publish those media choices or activate artwork. Each existing
mutation still requires its own explicit confirmation and server revision check.
Media can change after these independent reads; this is not an atomic snapshot,
a durable review receipt or combined publication approval. Those execution and
recovery semantics remain the next D increment.

### D4b integrated selected preview

The comparison can now open **Preview these choices on the page**: a separate
360/1280 px frame using the actual public renderer with the selected private
photos and replacement (or absent) logo. Approved photos remain included and the
saved gallery order/captions are preserved. The exact selected stamp and creator
credit appear in a separately labelled collection-artwork section, not in the
public identity header. The existing approved-only D3 frame remains available.
This adds no upload interface or publication/activation action.

The selected frame receives only bounded IDs, the saved shop revision and a
SHA-256 fingerprint of the compared media/artwork metadata through an in-memory
message. Both ends check the same origin and exact parent/frame window; the
receiver checks the signed-in account, shop and revision, strictly decodes the
selection and accepts it once per frame mount. No private choice, credit, image
bytes or fingerprint enters a URL, initial HTML or browser storage. The URL's
`mode=selection` flag alone is not a preview token; a standalone frame has no
selection and shows instructions to open Review.

The frame independently repeats the authorized shop/media/stamp reads and reads
options. It compares the saved shop revision before/after media reads, checks
all media/artwork membership, order, status, opaque revisions, displayed metadata
and active-design state against the comparison fingerprint, then resolves only
eligible IDs. A stale, missing, malformed or denied result withholds the whole
selected view and requires explicit comparison reload/reselection. It never
silently adopts newer media. Changing choices remounts the frame; changing
viewport width does not. Reloading/leaving Review or changing accounts discards
choices. Refresh selected preview rechecks the same choices. Private byte delivery
continues to enforce current access; exact uploaded PNGs and retained history are
untouched. Ordinary D3 incomplete-preview guidance is unchanged.

This is still a read-only, temporary preview over separate current reads, not an
atomic snapshot, durable review receipt or authorization to publish. Changes
after the last read are not pushed into an already displayed frame; refresh to
recheck. The next dependency is a durable server-owned review bound to the shop,
media and artwork revisions, followed by explicit combined publication and
recoverable outcomes. No existing writer consumes this preview fingerprint.
