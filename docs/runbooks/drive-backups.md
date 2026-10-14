# Encrypted Google Drive backups

Approved setup: one full durable-data backup every three days, retaining the
latest ten verified sets in private Google Drive. This workflow never deploys
the app, pushes migrations, resets databases, changes Auth/RLS or writes to R2.

## Current source is live despite its staging name

The founder confirmed `nibatlas-staging` serves `app.nibatlas.com`. The fixed
Supabase ref is `xgyzsdrugtwqlpnkutfw`; the fixed R2 bucket is
`nibatlas-staging-images`. Both provider identity and Worker bucket binding are
checked before export. Do not change these constants on a guess during the
future production/staging split; preserve existing users and media keys.

## What each recovery set contains

- A consistent PostgreSQL 17 custom-format dump of all accessible non-system
  schemas, including `auth`, `public`, `stamp_private`, migration history,
  functions, constraints, policies, privileges and extensions.
- Role definitions without role password hashes, plus the archive table of
  contents. Missing required durable tables or a dump warning aborts the job.
- Every listed R2 object, retained historical/orphaned assets included, with
  original key, bytes, SHA256, content type, cache control and object metadata.
  Paths on disk use a key hash, so bucket keys cannot escape the export directory.
  Durable storage references are extracted from the consistent dump's COPY data
  (without executing SQL) and checked against the downloaded inventory. Missing
  referenced objects abort completion, including deletion before bucket listing.
- Git bundle of all fetched refs/history, pinned application dependencies,
  migrations and checked-in deployment/configuration documents.
- Supabase project/Auth settings and Cloudflare Worker configuration. These
  files may contain credentials and stay inside the encrypted archive.
- A manifest with file hashes, byte sizes, source identities and limitations.

Transient login/session/verification table data is explicitly omitted; schemas
remain. See `TRANSIENT_TABLES` in the exporter. Recovery requires fresh sign-in;
do not revive old sessions, one-time links or verification encryption keys.

Cloudflare does not return installed Worker secret **values**. Keep their
original values in the founder's password manager; the archive provides the
configuration/names only. Third-party provider settings such as Google OAuth
console configuration, SMTP account recovery and DNS zone configuration must
also remain recoverable independently. An upload verified by checksum is not
a restore drill or a guarantee that every external provider setting is captured.

If Vault/encrypted database columns are used later, separately verify encryption
root-key recovery before claiming full recovery readiness. Managed service
schemas/roles must be restored selectively into a compatible fresh Supabase
project, not blindly overwritten. Never restore this archive over the live ref.

## One-time setup (phone is sufficient for dashboard steps)

1. Create an R2 token with **Object Read only**, limited to
   `nibatlas-staging-images`. Store Access Key ID/Secret Access Key privately,
   then add repository Actions secrets `BACKUP_R2_ACCESS_KEY_ID` and
   `BACKUP_R2_SECRET_ACCESS_KEY`. No admin/write R2 permission is needed.
2. Download `scripts/backup/recovery-key.html` and open locally in current Chrome.
   It has a network-blocking CSP, no dependencies and no calls back to a server.
   Generate the key on the founder's device; save the private `AGE-SECRET-KEY-1…`
   value in the password manager under “Nib Atlas Backup Recovery”, then confirm
   saved. Keep an offline spare later. Never upload or paste the private key into
   GitHub, Drive, chat or a PR. Add only the public `age1…` key to the repository
   Actions variable `BACKUP_AGE_RECIPIENT`. Do not enable backups if local key
   generation/copying/saving fails; use official `age-keygen` locally instead.
3. In the existing Google Cloud account, enable Google Drive API and create a
   **dedicated** OAuth web client for backup upload; don't alter the app's Google
   sign-in client or Supabase login redirects. Use the non-sensitive
   `https://www.googleapis.com/auth/drive.file` scope, offline access and the
   founder's Google account. An external OAuth app left in Testing can issue
   refresh tokens that expire after seven days. Resolve its production/personal
   app status and verify ongoing authorization before enabling the schedule.
4. Save the uploader's client ID, client secret and refresh token directly into
   repository Actions secrets `BACKUP_GOOGLE_CLIENT_ID`,
   `BACKUP_GOOGLE_CLIENT_SECRET`, `BACKUP_GOOGLE_REFRESH_TOKEN`. Never send them
   through chat. The limited scope permits the uploader's own files; it cannot
   automatically see the ChatGPT-created partial-backup folder. The job therefore
   creates a separate private **Nib Atlas Automated Backups** folder and marks
   it with the fixed source ref, refusing duplicate or shared folders.
5. Existing deployment credentials are read in the `staging` GitHub environment
   because that currently supplies the live resources. Verify that the selected
   URL/password/token refer to the fixed live source. The Supabase management
   token needs project details, session-pooler config and Auth config **read**
   access. If the deploy token cannot read Auth config, add a separately scoped
   `BACKUP_SUPABASE_ACCESS_TOKEN`; it takes precedence without changing deployment
   credentials. The existing Cloudflare deploy token must be able to read Worker
   settings.
   The management API's verified shared-pooler host/user may be returned with
   transaction port 6543; the exporter always uses session port 5432 on that same
   host, as documented by Supabase. No host is guessed from the region.
   All Postgres commands set read-only transactions and TLS with `verify-full`,
   authenticating the server hostname against the system CA store.
   If the pooler requires the project's downloadable public CA, save its PEM text
   as Actions variable `BACKUP_POSTGRES_CA_CERT`. Do not weaken certificate checks
   to make a failed connection succeed. Never enter a private key in this field.
6. Merge only reviewed code with required CI passing. The backup workflow rejects
   exporting from any ref except `main`; the branch-only job runs synthetic tests
   without credentials. `BACKUP_ENABLED` is absent/false by default. A main push
   does not trigger this workflow or deploy the app.
   The Ubuntu 24.04 runner's built-in Python 3.12 is checked explicitly, and
   dependencies are installed in a temporary virtual environment. No additional
   action needs to be added to the repository's existing action allowlist.
7. Manually run **Encrypted Drive backup** from `main`. It must validate sources,
   complete all exports, encrypt, upload into an exclusively private folder,
   download the ciphertext and match its SHA256 before marking it complete.
8. Decrypt the first real archive privately with the founder-held key. Verify
   file hashes and perform a separately scoped restore rehearsal in an isolated
   compatible target. No recovery key belongs in CI. Record actual size/duration,
   tested access boundaries and external configuration gaps.
9. Only after successful first-backup acceptance set repository Actions variable
   `BACKUP_ENABLED=true`. Verify GitHub Actions failure notifications reach the
   founder and check freshness in Drive. Alerts/notification delivery aren't
   configured by this workflow itself and must be checked before activation.

## Cadence, retention and failure behavior

The hourly lightweight scheduler checks the newest completed receipt. It exports when at
least 72 hours have elapsed since that successful receipt, not `*/3` on the
day-of-month. This avoids a daily check turning a three-day interval into four
days because the prior upload finished a few minutes after its start. The next
check normally adds at most about one hour. Manual runs force a new backup before migrations/imports.
GitHub can delay scheduled jobs and public-repository schedules can stop after
60 days without repository activity, so an independent freshness check is still
needed. Three days is the intended interval, not a guaranteed maximum data loss.

Only ciphertext is uploaded. No private export is published as a CI artifact.
Subprocess/provider errors suppress raw messages and response bodies. Temporary
plaintext exists only in private ephemeral runner scratch and is removed after
success/failure; do not add debug tracing or artifact upload steps.

An upload remains `pending` until download/checksum validation completes.
Only `complete` receipts for this source affect cadence/retention. After a verified
upload, older completed sets beyond ten are moved to **Drive Trash**, not
permanently deleted. Pending and unrelated files remain untouched. Google Trash
still uses quota and has its own expiration; budget for it. Failure retains good
backups. Private folder checks happen on every run.

Initial limits are 10,000 R2 objects and a 2 GiB total recovery set. Exceeding
them fails closed rather than silently truncating. Restore data is not executed
during backup. This implementation is a single-current-source MVP; after the
split add staging only through an explicit, separately reviewed source mapping.

## Recovery and rollback

To pause, set `BACKUP_ENABLED=false`; manual backup remains available. If a key
is rotated, retain old private keys while old encrypted sets remain. Revoke only
the dedicated backup credentials when needed, preserving live app credentials.

Use official `age` to decrypt privately and check `manifest.json` hashes before
restoring. Review `database-toc.txt`, `roles.sql` and managed Supabase schema
compatibility; restore to a new isolated target with outbound email and production
integrations disabled. Restore R2 files using their original keys/metadata and
compare all manifest hashes. Reconcile post-backup account deletions, invalidate
old sessions and test auth/RLS/admin/private collection boundaries before any
route switch. Never use `--clean` or restore commands against the live project.

Decryptability and full end-to-end restore timing remain unverified until the
founder performs the initial acceptance and isolated recovery rehearsal.

## Primary sources

- https://www.postgresql.org/docs/17/app-pgdump.html
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/identity/protocols/oauth2/
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://c2sp.org/age@v1.0.0
