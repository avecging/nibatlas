# M6 WP2: private shop revisions and catalogue operations

Status: implementation decision within the founder-authorized M6 WP2 scope.

Existing WP1 roles and audit remain authoritative. Editor and admin can operate
on catalogue records; only admin reads audit history. No account-role assignment,
private Passport access, artwork approval, imports or media permissions are added.
Codex implements the minimal admin presentation authorized for this package;
existing public design ownership and product invariants remain unchanged.

### Authorization clarification and session repair — 14 September 2026

`profiles.role` is the only account-role authority. `admin` includes all catalogue
operations plus current admin-only tools; `editor` delegates catalogue operations
without admin audit access. Founder is the operational name for the existing
admin account, never another role or table membership. Workflow prerequisites
apply equally to admins and editors.

The founder acceptance report exposed a request-session defect: the role guard
and catalogue RPC used independently constructed cookie clients. During refresh,
the second client could reuse stale incoming cookies and lose the session that
the guard had verified. Share one request-scoped client across identity, live-role
and operation calls. Database guards/grants/RLS already permit admin and remain
unchanged. This implements the existing documented contract; no new hierarchy,
schema, migration, email allowlist or role assignment is introduced. Real-client
route regressions and the full admin SQL lifecycle supplement the existing
editor SQL tests and mocked frontend journeys. Staging diagnostics confirmed
database access, while the exact founder browser session remains a manual check.

## Working copies

Save creates/replaces one private working copy per shop. Public canonical tables
remain unchanged until explicit publication. Preview renders the saved copy via
current-role protected, no-store APIs; no public token, URL, cookie bypass or
preview parameter exists. The UI previews catalogue content; full media/artwork
proofing belongs to WP3. Internal evidence notes are not shown in the preview.

Draft creation needs only name and unique slug. Country, timezone and location
may now be null for unpublished shops, with a database constraint keeping all
three mandatory for publication. This is an intentional additive migration so
unknown geography is never represented by an invented coordinate or timezone.
The existing nullable appointment field retains its unknown/false distinction.

The full edit contract has explicit fields and bounded arrays: shop scalars,
opening hours, names/aliases, links, sources/claim tokens, and relationships to
existing type/service/specialty/brand vocabularies. Vocabulary and locality
creation remain separate data work. Sources retain stable UUIDs; same-shop
references, URL protocols, dates, coordinates, timezone and enums are checked
inside SQL as well as the HTTP boundary. No verification date is synthesized.

## Publication and transitions

- Draft → published requires valid geography/locality, street address, exactly
  one primary type, deliberate saved-position confirmation and editorial review,
  and an active Atlas Stamp with approved artwork. B2b removes mandatory dated
  sources/claim tokens without synthesizing provenance. Unknown operational status and absent optional facts remain
  valid. Existing public stamp constraints remain enforced.
- Published + saved changes → published atomically applies all edits. Package B1 now prepares the established generated template atomically on
  new shop creation; older drafts with no stamp have an explicit idempotent
  preparation action. This is a system default, not uploaded/custom approval.
  B2b trusted-review prerequisites are shared by manual and future import writes.
- Published shops can be marked open, temporarily closed, permanently closed or
  unknown. Each distinct transition is explicit. Both closure statuses keep the
  public detail available; the existing discovery/issuance rules apply.
- Draft/published → archived removes public discovery/detail. Archive is terminal
  in this interface. No delete or restore operation is exposed.
- Discard removes a private working copy only. Closure/archive require publishing
  or discarding pending changes first; neither silently applies unrelated edits.

Every mutation locks the current role and shop through commit. Revision tokens
reject stale writes, and a canonical fingerprint rejects publishing a copy whose
base was changed by an operator. Verification already holds a shared shop lock
through issuance; canonical edits serialize with collection snapshot creation.
Existing impressions, artwork versions, stamp IDs and duplicate protection are
untouched. Audit triggers cover shop, working copy and related catalogue writes,
including operator SQL, with atomic account/operator attribution and request ID.
Allowlisted status changes and fingerprints are recorded, not raw fields,
coordinates, evidence notes or request bodies. Fingerprints identify changes;
the audit is not a content rollback system. Audit is still admin-only/append-only.

## Fresh public reads

Public HTTP reads and Supabase fetches now use `no-store`. The previous CDN
window could serve a closed/archived listing for hours. This deliberately trades
cross-request CDN reuse for correct small-catalogue operations until a measured,
reliable invalidation mechanism exists. React per-request memoization remains.
Already-open browser result sets refresh on the existing explicit reload/search
flow; an archive cannot erase a page someone has already loaded. Issuance checks
canonical state on every attempt. Deploying this change does not purge a response
cached by an older Worker; allow its old TTL or explicitly purge during rollout.

## Review and practical details — B2b

Phone and postal code are separate optional public strings; no inferred country
prefix or rewritten address. Appointment null remains unknown, false remains No.
New editorial publication permits these practical fields without per-field source
paperwork. Existing legacy verification/source dates stay intact and independent.
The actual publishing editor and timestamp are recorded server-side; the public
review line expressly does not claim independent verification of every detail.
Private notes and references stay behind the existing role/table boundary.

Position confirmation belongs to the saved location, with private actor/time and
fingerprint. Address/coordinates/accuracy changes clear it, including changes
made directly through RPCs. Confirmation advances revision, rejects stale bases,
and cannot be asserted by a save/import document. Canonical confirmation and
public content stay unchanged during private edits; discard restores them.
See the current admin API contract for the exact field/confirmation allowlists.

## Deferred constraints at the API transaction boundary

The M5 published-shop stamp checker originally ran as its invoker. PostgREST
fires deferred constraints after the M6 write RPC's SECURITY DEFINER scope has
ended, so an authenticated admin could pass authorization and perform the write
but still lose the transaction to a private-table permission error. The checker
now runs with its trusted owner's read authority, an empty search path, and no
direct API execute grants. The invariant, table/RLS boundary, current-role lock
and atomic audit are unchanged. SQL tests force deferred checks before restoring
the operator role; the compiled Worker browser suite also checks real commits.
