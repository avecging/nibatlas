# Founder authorization and audit foundation

M6 WP1 uses existing `profiles.role`: `user`, `editor`, `admin`. Founder is an
operational responsibility, not a fourth role. Assign the founder `admin`.

| Name | What it means today |
| --- | --- |
| `admin` | Full access to the current administration tools, including catalogue operations and audit reads. No second catalogue assignment. |
| `editor` | Delegated catalogue access: list, create, edit, preview, publish, close and archive, subject to the same workflow rules. No admin audit access or role assignment. |
| Founder | The person responsible for Nib Atlas; their account uses `admin`. It is not a stored role, claim or membership. |
| `user` | Ordinary account; no catalogue administration access. |

Role assignment itself remains a database-owner operation. Full administration
access does not bypass publication evidence, approved artwork, revision checks,
private user data boundaries, or functions that have not been built yet.

## Security contract

- Verified cookie-session claims establish identity, never authorization from
  user-editable metadata, email strings, request headers or a cached JWT role.
- Every admin request invokes `admin_access()` with the ordinary user client.
  It reads the current database role. No service-role key is used here.
- Shop identity verification, role resolution and catalogue RPCs share that
  same request-scoped client, including any refreshed session. Never construct
  another cookie client after checking access and use it for the operation.
- `GET /api/v1/admin/access` permits editor/admin; everyone else gets 401/403.
- `GET /api/v1/admin/audit?after=<UUID>` permits admin only. The audit RPC checks
  the live role again inside its security-definer read. Editors do not need
  account-role history to edit catalogue data in a later package.
- Both endpoints are dynamic, private/no-store, return allowlisted fields and
  generic failures, and reject unexpected parameters. There are no mutation
  verbs. Future writes require same-origin checks, narrow contracts, a fresh
  role check inside their transaction and atomic audit; this read guard alone
  is not a write-security implementation.
- Direct audit table access is denied to anon/authenticated/service-role clients.
  Profile role UPDATE/INSERT/DELETE is removed from the service role; existing
  auth provisioning and own permitted profile edits continue to work.
- `assign_profile_role(uuid,text)` is a security-invoker function callable only
  by the database owner/operator. No browser/admin-account role-assignment API.
- Profile role changes append audit rows in the same transaction, including
  direct operator SQL updates. No-op assignments create no false audit event.
  Provisioning remains the default `user`; pre-migration roles are not invented
  as historical audit events. Audit begins with this migration.
- Audit contains actor UUID if an authenticated account exists, otherwise
  `database_operator`, target UUID, before/after role, request UUID and time.
  A SQL-editor bootstrap honestly has no app-account actor. No email, secrets,
  request body, precise coordinates, IP, user agent or free-form JSON is stored.
- Audit UPDATE/DELETE/TRUNCATE is blocked. Database owners can always alter
  schema; this is application append-only history, not external tamper-proof
  storage. Account lifecycle/retention policy remains part of M8 review; no
  automatic purge/deletion of administrative accountability is introduced.
- UUID cursor pages are bounded at 100 entries and ordered by UUID, not time.
  Start a new read without a cursor to pick up concurrent new entries. A later
  audit UI may add chronological pagination; do not label this a time feed.

## Assign Gin's account in staging

Do this after **Deploy staging** succeeds for the merged M6 commit. Staging and
production accounts/roles remain separate. No credential is needed in chat.

1. Sign in to the staging Nib Atlas site once with the account you want to use.
2. Open Supabase and select **nibatlas-staging**. Confirm the project name before
   using SQL Editor. Do not select the production project.
3. Open **Authentication → Users**. Find the exact account you just used and
   copy its **User UID**. Email and Google login can refer to the same identity;
   match the actual account rather than assuming a sign-in method creates one.
4. Open **SQL Editor → New query**. Replace both `PASTE-USER-UID` values below.
   Run the first SELECT by itself, then confirm it shows your expected email and
   existing role. Do not publish or paste the result into a PR/chat.

```sql
select u.id, u.email, p.role
from auth.users u join public.profiles p on p.id = u.id
where u.id = 'PASTE-USER-UID'::uuid;
```

5. Once the identity is correct, run:

```sql
select public.assign_profile_role('PASTE-USER-UID'::uuid, 'admin');
```

6. In the same browser where you signed into staging, open
   `/api/v1/admin/access` after the staging site's address. Expect
   `{"role":"admin"}`. You do not need to sign out or refresh a token for role
   changes to take effect.
7. Open `/api/v1/admin/audit` on that same site. Expect the assignment event with
   `database_operator`, the previous role and `admin`. Keep this account history
   private. The admin editing interface comes in a later package.
8. Sign out (or use a signed-out browser) and reopen the access/audit endpoints.
   Expect `authentication_required`, with no audit rows. An ordinary signed-in
   account gets `forbidden`.

To revoke, use the same verified project and UID with role `'user'`. This creates
another audit event; it does not erase history. Do not demote your only admin
unless intentional; the database-owner procedure remains the recovery path.
Production assignment is a separate deliberate setup at production launch.

## Validation and deferred packages

Unit/direct-request tests cover unauthenticated, ordinary, editor, admin,
metadata/header spoofing, role revocation, unsupported verbs/parameters, bounds,
provider error redaction and explicit nested projection. SQL tests cover RLS,
direct-request grants, audited assignment, no-op assignment, immutable history,
role spoofing and revocation with the same JWT.

Catalogue edit/preview/publish/close, canonical-change audit hooks, commissioned
approval/credits/R2, photo processing, imports/deduplication/dry runs and anomaly
review are later focused packages. This role foundation grants no new direct
canonical-table writes, private Passport reads or verification diagnostics access.

## M6 WP2 extension

Shop operations are now at `/admin/shops`; see [the operating guide](shop-administration.md).
The restrictions described above as future writes are implemented for shop
catalogue operations: editor/admin only, same-origin requests, live role locks,
revision checks and atomic audit. The audit endpoint also projects catalogue
status/fingerprint summaries. Role changes remain operator-only, audit read
remains admin-only, and artwork/media/import work remains separate.

## M6 catalogue-access regression (14 September 2026)

The reported combination was a successful `{"role":"admin"}` access check and
a catalogue `forbidden` response. Inspection found one role system, not two.
A read-only staging diagnostic confirmed current migrations, authenticated-only
RPC grants, and successful access/list/options calls under an existing admin
profile. It did not change roles, grants, records or RLS, or expose account IDs.

The shop HTTP route nevertheless created two independent cookie clients. A
regression using the real Supabase SSR client reproduces `403` when the guard
refreshes its session but the second client sees the original request cookies
and its refresh fails. The route now uses one client throughout. The test fails
before this change and passes afterward; the founder's exact browser session
was not accessible during diagnosis, so live acceptance remains necessary.

This is an application deployment, with no migration or second founder-role
assignment. If the problem remains after deployment, check the access endpoint
in the same browser and staging origin first. A successful admin response means
do not reassign roles; investigate the failed catalogue request/session instead.
If access itself fails, use the existing verified-project/UID setup procedure.
