# Shop administration — M6 WP2

Use `/admin/shops` on the staging site after Deploy staging finishes. Sign in with
the existing founder account. Roles are separate in staging and production; use
[the existing setup procedure](admin-authorization.md) if access is missing.
The [HTTP contract](../api/admin-shops-v1.md) documents the bounded API.
No new secret, storage service or account-role setup is required for an existing
admin. Editor can maintain catalogue; admin alone can read the audit endpoint.
Role meanings, bootstrap and revocation are defined once in
`admin-authorization.md`. Publication, evidence, revision and archival rules
apply to every permitted operator.

1. Choose **Create a draft shop**. Enter name and a unique lowercase URL name.
2. Open the draft and enter only sourced facts. Choose the existing locality and
   one primary shop type. Add dated sources and the specific claims each supports.
   Use the exact claim tokens listed in the publication errors; active dated
   sources must support each populated public field. Name and Location are
   required; Address, Opening hours and other fields need their own matching
   tokens. A source confirming another fact does not qualify. Reference those
   sources from services/types/brands where supported. A new
   vocabulary or locality currently requires a separate data change.
3. Choose **Save changes privately**, then **Preview saved version**. The public
   listing remains unchanged. Another account without editor/admin access cannot
   read the preview even with its URL or UUID.
4. Resolve the listed publication requirements. In particular, a new shop needs
   an active approved Atlas Stamp. New drafts receive a generated default
   automatically. For an older draft with no stamp, use **Prepare generated
   default** in the stamp section. This preserves existing artwork/retired
   identities and private edits; no upload or creator credit is needed. Never
   manufacture a verified date to clear a catalogue gate.
5. Choose **Publish saved version**, then confirm. Check the public page afresh.
6. To close a published shop, first finish or discard its saved edits. Choose
   the appropriate **Mark …** operation and confirm after checking the evidence.
   A closure remains visible on the public page. Mark open only on actual evidence.
7. **Archive shop** and confirm to remove public discovery/detail permanently in
   this interface. This preserves all collected impressions and duplicate checks.
8. On **Revision conflict**, reload the saved version, review the other changes
   and reapply your intended edits. Unsaved editor navigation asks before leaving,
   including global links and browser Back. Do not blindly retry a publication after a
   lost response: reload first to determine whether it already succeeded.

## Staging acceptance (founder)

Use clearly named demo/test drafts; do not invent facts about real businesses.

The founder has confirmed the draft-create fix. Broader shop administration
acceptance below remains separate; draft creation alone does not prove
publication, closure, archival, conflicts or audit review. Keep these instructions
for new regressions, not a mandatory repeat of the confirmed fix:


1. In your existing signed-in staging browser, open `/api/v1/admin/access` and
   confirm `{"role":"admin"}`. No second role assignment is needed.
2. Open `/admin/shops`. Confirm the catalogue list loads without the access error.
3. Choose **Create a draft shop**, name it **Admin acceptance test draft**, and
   give it a unique URL name, such as `admin-acceptance-test-20260914`.
4. Choose **Create draft**. Change the name to **Admin acceptance test draft edited**
   and choose **Save changes privately**.
5. Return to **All shops**, reopen the draft, and confirm the changed name is
   still present. Choose **Preview saved version**. Keep this test draft private.
6. In a signed-out browser, confirm `/admin/shops` asks for sign-in and its APIs
   reject access. An ordinary signed-in account must also remain denied.

The confirmed create-draft fix requires migration
`20260914000100_m6_deferred_catalogue_constraint.sql` as well as the Worker
release. The normal staging deployment applies it automatically. There is no
role reassignment or second catalogue membership to maintain. The regression
runs real Auth/PostgREST requests through the compiled Worker and checks refresh
cookies and transaction completion; no token manipulation is needed manually.

If a request fails, retain the `shop_admin_failure` browser-console reference.
It identifies the HTTP phase and a safe database-error category without account
information or credentials. The page's `nibatlas-release` metadata and response's
`X-Nib-Atlas-Release` identify the deployed commit. See the
[authorization diagnosis](admin-authorization.md#confirmed-draft-create-failure-after-pr-64).

- Mobile and desktop: create an incomplete draft, save a changed name, preview,
  and confirm the signed-out public URL is unavailable.
- Existing demo shop with approved stamp: save a small factual/demo edit, verify
  public data still shows the old value, publish, then verify a fresh public read.
- Record a temporary closure, reopen, and record a permanent closure; confirm
  public status and collection refusal. Restore only the known fixture status.
- Archive a disposable test record, confirm fresh discovery/detail exclude it.
  Do not archive the phone venue while field tests are still pending.
- Two tabs: save in one; attempt a save with the older revision in the other.
  Expect a conflict, with no overwritten changes.
- Admin: inspect `/api/v1/admin/audit` for account, request ID, entity and status
  changes. UUID pagination is not chronological. Keep account history private.
- Existing impressions remain unchanged after editing/closure/archive. Sign out;
  private admin fields disappear and direct APIs reject access.

Automated tests use explicit demo fixtures. Phone collection acceptance is
recorded in `staging-phone-test.md`; it is separate from admin acceptance.

## Deployment and rollback

Migrations run before the Worker via the existing Deploy staging workflow. This
migration preserves old public APIs and existing data. Reverting the Worker to
pre-WP2 removes the editor but does not lose canonical or private saved data.
Do not roll back by deleting tables or impressions. Retain the new published
geography constraint and audit history. A pre-WP2 CDN response may persist until
its previous TTL expires; use a fresh/no-cache acceptance request or purge old
cached catalogue URLs. New responses are no-store.
Shop detail and correction pages explicitly render on each request; they do not
retain statically generated HTML after publication or archival.

Package B1 completes the default-stamp prerequisite, not the entire admin
rework. B2 removes the legacy claim-token gates through DB/API/public contracts;
B3 completes canonical vocabulary and essential seven-section editing, then C
ships usable 200-shop import/review/publication before D rich-editor polish. About accuracy #17 remains before real catalogue launch; geographic seal
labels #27 stay with seal delivery.

Catalogue tables reject `TRUNCATE`, including operator SQL, because it bypasses
row audit. Use audited row operations. Publication matches case/whitespace only:
`Name`, `Location` (country/locality/timezone/coordinates), `Short description`,
`Address`, `Neighbourhood`, `Phone`, `Postal code`, `Website`, `Opening hours`,
`Operational status`, `Local-script name`, `Alias: <alias>`,
`Official link: <link type>`, `Shop type: <label>`, `Service: <label>`,
`Specialty: <label>` and `Brand: <name>`. A linked relationship uses the specified
source; services require a source UUID. Unavailable/stale sources do not clear
publication gates. Adding a token records the founder's evidence assessment;
never add one just to dismiss an error.

## B1 acceptance and preservation

On the B1 revision, create a clearly named synthetic private draft; confirm a
generated default appears without upload or geography. Save/reopen known location
details and verify the preview uses them. Existing older drafts may explicitly
prepare a missing default; reloading/retrying preserves identity and causes no
new versions. New custom drafts belong to that same stamp and do not activate
until the separate admin confirmation. Do not test by resetting real collections
or by replacing founder content. These are pending deployed acceptance steps,
not a claim that they were executed on staging. Local/CI evidence lives in the PR.

Until B2, the legacy claim-token UI and server publication gates below remain
implemented. They are known work to replace, not an additional founder obligation
or a reason to fabricate evidence. A generated default satisfies only the stamp
prerequisite. The complete approved field/section map and remaining checkpoints
are in `IMPLEMENTATION-PLAN.md`. Package A remote telemetry/recovery, JPEG/photo/
logo/artwork/device checks and existing deferrals remain unchanged.

## B2a checkpoint

New drafts need only a name: leaving URL name blank creates a stable assisted
URL name once. Renaming the shop later keeps it. Manual saves now identify
malformed fields in a correction list; select a message to focus its control.
Failed validation retains unsaved work. Optional blank fields remain unknown;
zero coordinates, text postal codes, paragraphs and valid split/overnight hours
are retained. Database conflicts still require reloading/reviewing the saved
version, not blindly overwriting it.

Uploaded stamps may omit credit; a link requires a name. Generated public detail
uses the active stored art, matching the admin template preview and future
collection snapshot. Existing historical impressions remain unchanged.

This is only B2a. Trusted publication without claim/evidence paperwork, truthful
reviewer/time attribution, admin-only notes/references, deliberate position
confirmation/invalidation and remaining B2 fields are pending B2b. B3 essential
sections/vocabularies and the mandatory 200-shop CSV/JSON Package C workflow are
also pending. Existing founder acceptance and Package A media/device/recovery
checks remain as recorded above; no new hosted/founder acceptance is inferred.
