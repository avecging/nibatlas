# Shop administration — M6 WP2

Use `/admin/shops` on the staging site after Deploy staging finishes. Sign in with
the existing founder account. Roles are separate in staging and production; use
[the existing setup procedure](admin-authorization.md) if access is missing.
The [HTTP contract](../api/admin-shops-v1.md) documents the bounded API.
No new secret, storage service or account-role setup is required for an existing
admin. Editor can maintain catalogue; admin alone can read the audit endpoint.
Role meanings, bootstrap and revocation are defined once in
`admin-authorization.md`. Publication, review, revision and archival rules
apply to every permitted operator.

1. Choose **Create a draft shop**. Enter name and a unique lowercase URL name.
2. Open the draft and enter what is known. Choose the existing locality and
   one primary shop type; add the street address, timezone, coordinates and stated
   accuracy. Internal notes and reference links are optional and private. Legacy
   sources remain editable but no claim tokens or dated evidence forms are needed.
   New vocabulary/locality preparation remains B3 work.
3. Choose **Save and review** to save privately and move into the saved preview.
   **Save changes privately** remains available when continuing edits. The public
   listing remains unchanged. Another account without editor/admin access cannot
   read the preview even with its URL or UUID.
4. Resolve the listed publication requirements. In particular, a new shop needs
   an active approved Atlas Stamp. New drafts receive a generated default
   automatically. For an older draft with no stamp, use **Prepare generated
   default** in the stamp section. This preserves existing artwork/retired
   identities and private edits; no upload or creator credit is needed. Never
   manufacture a verified date to clear a catalogue gate.
5. Choose **Confirm saved shop position** and deliberately confirm the saved
   location. Address/coordinate/accuracy changes invalidate this confirmation.
   Then choose **Publish saved version**, review its confirmation and publish.
   The actual editor/time are recorded automatically; no blanket field
   verification is claimed. Check the public page afresh.
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

B1 defaults and B2 input/editorial contracts are implemented on PR #77's draft
branch; check its current CI and deployment before testing. B3 canonical mappings
and the essential seven-section layout, then C's usable 200-shop CSV/JSON workflow
remain required. D adds full rich-editor/media/public-preview integration. About
accuracy #17 and geographic seals #27 remain outstanding.

Catalogue tables reject `TRUNCATE`; use audited row operations. Existing source
identities, evidence notes and dates are retained. Never invent claims or dates
just to complete an editor form.

## B1 acceptance and preservation

On the B1 revision, create a clearly named synthetic private draft; confirm a
generated default appears without upload or geography. Save/reopen known location
details and verify the preview uses them. Existing older drafts may explicitly
prepare a missing default; reloading/retrying preserves identity and causes no
new versions. New custom drafts belong to that same stamp and do not activate
until the separate admin confirmation. Do not test by resetting real collections
or by replacing founder content. These are pending deployed acceptance steps,
not a claim that they were executed on staging. Local/CI evidence lives in the PR.

Package A telemetry/recovery, JPEG/photo/logo/artwork/device acceptance and
existing deferrals remain unchanged. No new hosted acceptance is inferred.

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

## B2b checkpoint and acceptance

Trusted publication, actual reviewer/time, private notes/references, deliberate
position review and the B2 story/experience/location/practical fields now share
storage/API/editor/public mappings. This is not the final seven-section design.
Dated exceptions/day-copy controls, full rich layout, gallery and pending-art
integration remain D; B3 and mandatory 200-shop C remain required.

In an isolated synthetic demo: save paragraphs/experiences/private notes, reload,
preview, confirm the saved position and publish with sources/references/postcode/
hours/photos absent. Public detail must show the editorial review and public
content but no private notes/reference URLs or actor IDs. Change a coordinate,
address or precision: save must clear confirmation and leave public detail
unchanged. Reverting a saved change must not revive confirmation; discard restores
the public version. Try a stale second tab and verify a conflict. Existing real
sources, stamp identity and impressions must remain intact. These checks are
covered by local/CI regression tests as recorded in the PR; hosted/founder visual
acceptance remains separate, as do Package A's outstanding checks.

## Founder mobile acceptance correction after PR #77

PR #77 merged at `28742a3454abab9c40a9cc48402e0242b97be509`; main CI
35471228640 and staging deployment 35471233475 passed. Founder phone feedback
identified empty Brand/Specialty choices, poor save progression, tedious image
saving and errors without useful destinations. This is failed usability
acceptance, despite green technical CI.

The correction adds a persistent Save and review action, exact validation focus
and inline errors, publication Fix destinations, add/reuse for Brand/Specialty
names, and hidden optional legacy source/date fields. Unavailable choice lists
state why they are empty and cannot add an unfillable row. Photo/logo/stamp file
selection starts PRIVATE upload/attachment; explicit publish/activation remains
separate. Pending selected files participate in the same leave-page warning as
unsaved catalogue edits.

Retest on a phone: save/review and return to editing; invalid country/locality
and nested fields retain work and focus the correction; create/reuse a brand
and specialty then save/reopen; select a supported image, verify automatic
private save, interrupt/retry and verify no duplicate attachment; deliberately
publish/activate after checking the preview. Hosted and founder acceptance of
this correction remain pending until it is explicitly deployed and tested.

## B3 seven-section editor rebuild

The approved seven-section design in `nib-atlas-admin-rework-handoff.md` and
`nib-atlas-admin-prototype.html` is now the editor's actual structure. The
backend contract this depends on is `docs/api/admin-b3-contract-handoff.md`;
Codex owns everything listed there.

**How the editor is laid out.** Shop & story, Experiences, Location, Visit
details, Photos & logo, Stamp, Review — reachable in any order from the section
navigation, never as a forced sequence. The layout adds no field and removes
none: `editor-sections.ts` is a view over the same shared `SHOP_FIELDS` and
`GROUPS` contract that a Package C import will write, and a unit test fails if
any approved field or repeatable group stops being reachable.

**Where feedback appears.** One notice region sits at the top of the work area
and stays in view while the page scrolls. Routine success (save, position
confirmed, image shown or hidden) is a notice and never moves focus. A failure
moves focus to the first field that has to change, or to the notice when there
is no such field. Decisions that are hard to reverse — publish, discard,
archive, close, confirm position, show or hide an image, delete an image — open
a centred dialog rather than a panel appended below the section.

**The persistent action.** A fixed bar holds the save and review actions at
every scroll position, sitting above the app's own Map/Passport/Me navigation
below 1024px. It shows whether work is unsaved, saved privately or in progress,
and it disables itself while a request is in flight so a second tap cannot
submit twice. A successful **Save and review** opens the Review section on the
saved version.

**Timezone.** A searchable list of every IANA zone the runtime supports, showing
the readable place and its *current* UTC offset. The stored value is always the
IANA identifier; a fixed offset such as `Etc/GMT-8` is labelled as a fixed
offset and sorted below real places. An existing valid identifier the runtime
does not list — a legacy alias — is kept and remains selectable. A country
suggestion is offered only where the country has one civil timezone, and is
never applied for the editor.

**Images.** Each image shows its state in words: *Private to this draft* or *On
the public page*. **Show on public page** and **Remove from the public page**
are per-image admin actions and are spelled out in the dialog, including that
hiding leaves the image saved in the draft. A failed upload keeps the chosen
file on screen with **Retry saving this photo** and **Discard this file**;
nothing has to be found again. Permanent deletion appears only when the media
service advertises a `remove` capability; until request A in the contract
handoff ships, the section says so instead of showing a control that cannot
succeed. The Review section states how many images are saved and how many are
on the public page, so the path from upload to public visibility is visible
where publication is decided.

**Position confirmation** now sits beside the coordinates it attests to, in the
Location section, and states that an address, coordinate or accuracy change
clears the previous confirmation.

**Stamps** are their own section. The generated default still needs no upload
and no creator credit; uploaded artwork still requires an explicit admin
activation, and saving ordinary shop details still activates nothing.

Retest on a phone: reach all seven sections from the navigation; save and see
the confirmation without scrolling; enter an invalid coordinate, follow the
error to the field, correct it and save successfully; search the timezone list
for a city; upload a photo, show it on the public page, take it off again, and
open the public shop page to check; confirm the position after changing an
address; publish from Review. Hosted and founder acceptance remain pending
until this is deployed and tested on a real device.
