# Shop administration — M6 WP2

Use `/admin/shops` on the staging site after Deploy staging finishes. Sign in with
the existing founder account. Roles are separate in staging and production; use
[the existing setup procedure](admin-authorization.md) if access is missing.
The [HTTP contract](../api/admin-shops-v1.md) documents the bounded API.
No new secret, storage service or account-role setup is required for an existing
admin. Editor can maintain catalogue; admin alone can read the audit endpoint.
`admin` automatically includes all catalogue permissions. “Founder” describes
the person using that admin account; there is no separate founder role or
catalogue membership to maintain. Ordinary accounts remain denied. All roles
still obey the publication, evidence, revision and archival rules below.

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
   its active approved Atlas Stamp, prepared by the following artwork package.
   Do not manufacture a verified date or invent artwork to clear this gate.
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

For the catalogue-access fix, after **Deploy staging** succeeds:

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

The fix needs only the normal Worker deployment, not a database migration.
The automated session-refresh regression covers an expiring session as well as
fresh sessions; no token manipulation is needed for this manual check.

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

Automated tests use explicit demo fixtures. Real-phone permission denial,
backgrounding/network interruption, duplicate/reload persistence and sign-out
isolation remain separately pending in [the phone checklist](staging-phone-test.md).
Prior indoor collection success does not complete that checklist. Use an account
that has never collected the test stamp for pre-issuance GPS steps. Never erase
impressions, rotate stamp IDs or bypass throttles to repeat a test.

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

Next packages stay separate: artwork/media #32 with #19/#28, then catalogue
imports. About accuracy #17 remains before real catalogue launch; geographic seal
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
