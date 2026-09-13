# M6 WP2: private shop revisions and catalogue operations

Status: implementation decision within the founder-authorized M6 WP2 scope.

Existing WP1 roles and audit remain authoritative. Editor and admin can operate
on catalogue records; only admin reads audit history. No account-role assignment,
private Passport access, artwork approval, imports or media permissions are added.
Codex implements the minimal admin presentation authorized for this package;
existing public design ownership and product invariants remain unchanged.

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

- Draft → published requires sourced geography, locality, exactly one primary
  type, a dated source with URL or founder visit, and an active Atlas Stamp with
  approved artwork. Unknown operational status and absent optional facts remain
  valid. Existing public stamp constraints remain enforced.
- Published + saved changes → published atomically applies all edits. New shop
  publication waits for the next artwork package to prepare its required stamp;
  no placeholder art is automatically invented or approved here.
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

## Issue #30 semantics

Phone is a sourced contact string with no inferred country prefix. Postal code
is a separate string, never concatenated to a source-published address. The
optional record review date means an actual review of the record, not blanket
verification of all displayed claims. Source checked dates and claim-specific
review dates retain their independent meaning. All three stay omitted from the
public page, as allowed by #30; no presentation decision or date automation is
introduced. Source dates are entered deliberately; selecting a date stores UTC
midnight for that date. Unedited imported timestamps preserve their precision.
Appointment/accessibility remain internal pending their per-field provenance
contract. Unknown fields stay null; no source statement is silently broadened.
