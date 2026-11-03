# Production and isolated staging — resumed 3 November 2026

## State and authority

On 3 November 2026 the founder authorized proceeding with the phased production/
staging split. Preserve the running production resources while provisioning and
verifying isolated staging. This runbook does not authorize purchases: obtain
the selected organization and a current cost quote, then approval of any nonzero
charge before creating resources. Account authentication may require founder input.
Do not change the public domain or production data merely to correct resource names.

The live app is `app.nibatlas.com`, served by `nibatlas-staging`, using Supabase
`xgyzsdrugtwqlpnkutfw` (display name `nibatlas-staging`) and R2
`nibatlas-staging-images`. These resources contain production users and history.
Never run staging resets, demo fixtures or staging migrations against them.

The resumed preparation reconciles main
`d7e9036ece0b92592d0c43b22afec62e072be59e` and live staging
`db8fba1e39cedb858486238426ec7bff85575dd4`. It retains the deployed PNG-upload
fix, admin authorization, illustrated error pages and existing backup safeguards.
No app deployment follows a main push.

Production checks on 3 November found Nib Atlas on Pro, 54 applied migrations,
118 shops, 15 Auth accounts, 7 collected stamps and 180 artwork versions. These
are a baseline, not a recovery set. Cloudflare plugin reads now independently
confirm app.nibatlas.com routes to `nibatlas-staging`, using the existing live R2
bucket and `staging/` namespace.

The founder subsequently selected a separate Free organization and created staging
project `quvnezszorpvhdyipboz`. The project-scoped Supabase Staging connection
successfully queried PostgreSQL 17.11. No production data was copied. The first
25 of 54 source migrations are installed through `20260920000600`, with all stored
SQL SHA-256 checksums and original version/name pairs verified against the source.
The next migration, `20260920000700_b3_catalogue_choices.sql`, was not applied:
connector confirmations expired. Resume the remaining 29 through the scoped
connection or the existing guarded CLI workflow, which recognizes the original
history entries. Do not replay completed files manually. Staging still has zero
shops, Auth users and collected stamps; every public table currently has RLS.
These partial-schema checks do not replace verification after all 54 migrations.

Cloudflare staging resources are created: private R2 bucket
`nibatlas-staging-isolated-images` (public r2.dev access disabled) and Worker
`nibatlas-staging-isolated`. The Worker currently runs only the versioned 503
placeholder in `scripts/deploy/staging-placeholder.worker.js`, not Nib Atlas.
Its public hostname is protected by Access application
`82a186d1-2d68-4e3e-88fe-f61510ddbf62`, covering both the hostname and the Worker
(including previews). Its sole Allow policy requires the founder's exact email
and membership of the existing Cloudflare account. An unsigned browser request
was observed redirecting to Cloudflare sign-in before reaching the placeholder.
Preview URLs remain disabled.
CI service authentication, runtime secrets, Auth configuration and end-to-end
application acceptance remain pending.

| Target | Live production, preserved | New isolated staging |
| --- | --- | --- |
| Supabase | `xgyzsdrugtwqlpnkutfw`, existing Pro organization | `quvnezszorpvhdyipboz`, separate founder-created Free organization |
| Supabase display name | Keep `nibatlas-staging` until a reviewed rename updates identity checks | `nibatlas-og-staging` |
| Worker | Existing `nibatlas-staging` remains live; proposed `nibatlas-production` is not released | `nibatlas-staging-isolated` |
| R2 | Existing `nibatlas-staging-images` | `nibatlas-staging-isolated-images` |
| GitHub environment | Existing `staging` retains live/backup credentials during preparation; proposed `production` is unconfigured | `staging-isolated` |
| Application accounts | Existing accounts, roles and sessions stay in place | Fresh test accounts and signing keys |
| Media keys | Existing `staging/` paths and immutable history stay intact | Separate physical bucket; its own `staging/` paths |
| External services | Existing Google login, SMTP, contribution destination and analytics | Separate OAuth client, test-only mail/destination; analytics disabled or separate |

Sharing a provider account/billing organization does not share database rows or
R2 objects. A person may use the same Google account to sign in to both apps, but
Supabase identities, profiles, tokens, roles and collections must remain separate.

## Immediate deployment safety

PR #156 is merged to main and promoted to staging. The promoted staging workflow
was observed skipping (run `41588895550`), with no live deployment. Both branches
now contain the new isolation guards. Do not dispatch older workflow versions.

Staging remains off unless `ISOLATED_STAGING_ENABLED=true`. It uses only
`STAGING_` credentials in `staging-isolated`, accepts main/staging refs, and checks
the exact registered project, Worker and bucket before database operations. Keep
that opt-in off until the setup below is complete. Main pushes do not deploy the
application. Production's code-level release blocker remains false.

## Operator setup, in order

1. Completed: the founder created the new staging project in a separate Free
   organization and authorized its project-scoped connection. Preserve the live
   Pro project. Keep the staging database password private.
2. Register `quvnezszorpvhdyipboz` in `scripts/deploy/targets.json` and verify the
   target guard. The configured display name is `nibatlas-og-staging`; confirm it
   matches the dashboard before the first CLI deployment, since the project-scoped
   connection exposes its URL but not organization/display-name metadata.
3. Completed: separate private R2 bucket and staging Worker exist. The Worker runs
   a generic 503 placeholder and has no Supabase or application runtime credentials.
   Keep its existing Access protection during application deployment. Its staging
   configuration explicitly enables workers.dev and disables preview URLs.
4. Completed: founder-only Access protection covers the Worker and its hostname.
   Create an expiring staging-only CI service token, store its two values privately
   in GitHub, and add a **Service Auth** (`non_identity`) policy matching only that
   token to this Access app. Do not use a bypass or all-service-token policy.
   No CI service token has been created by this setup, because the GitHub connector
   cannot write environment secrets and one-time secrets must not be exposed in
   chat or discarded.
5. Create GitHub environment `staging-isolated`. Add the following names there;
   never paste values into chat, issues, PRs or the repository. A separate
   deployment API token must have access only to staging resources where the
   provider permits it. Creating resources may need an account administrator;
   do not broaden the production deploy token to work around that requirement.

   - `STAGING_CLOUDFLARE_ACCOUNT_ID`
   - `STAGING_CLOUDFLARE_API_TOKEN`
   - `STAGING_NEXT_PUBLIC_SUPABASE_URL`
   - `STAGING_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `STAGING_SUPABASE_ACCESS_TOKEN`
   - `STAGING_SUPABASE_DB_PASSWORD`
   - `STAGING_NEXT_PUBLIC_MAPTILER_KEY`
   - `STAGING_NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `STAGING_CF_ACCESS_CLIENT_ID`
   - `STAGING_CF_ACCESS_CLIENT_SECRET`

   The Supabase token needs project-only Project Settings Read and Connection
   Pooling Read; the database password supplies migration privileges. Analytics
   is optional: omit its token or use a separate PostHog project with
   `STAGING_NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and variable
   `STAGING_NEXT_PUBLIC_POSTHOG_HOST`. Restrict browser keys to staging origins.
6. Configure runtime secrets only on the new staging Worker, including its own
   `SUPABASE_SERVICE_ROLE_KEY`. Give Turnstile its own site/secret and hostnames.
   Keep contributions disabled until a separate test destination/shared secret
   exists. Never use the live Apps Script destination for test submissions.
7. Configure the new Supabase Site URL and exact callback allowlist for staging.
   Use a separate Google Web OAuth client and the new project's Supabase Auth
   callback. Keep its client secret separate from live login and the Drive
   uploader. Use test-only mail settings; do not copy accounts, sessions, private
   profiles, collections or editorial audit history from production.
8. After final-head CI/review, promote the registered target commit to staging.
   Verify all credentials, Access policies and runtime/Auth settings first.
   Enable only `ISOLATED_STAGING_ENABLED`, then
   run **Deploy staging** on reviewed main/staging. App checks and OpenNext build
   precede migrations. CLI pushes original migration files only to the fixed
   new project using verified TLS/session port 5432; no seed or fixture runs.
9. Create fresh founder/test identities on staging and assign its admin role
   separately. Add a small, clearly marked test catalogue with approved test
   artwork. No production clone is required.

The old phone-fixture publisher and hosted catalogue reset are retired. The reset
SQL now refuses every connection. Old reset instructions in historical runbooks
must not be followed. Local Docker CI proves this refusal preserves fingerprints.

## Production release is deliberately blocked

The manual **Release production** workflow is preparation only. Besides main,
typed `RELEASE`, an Actions opt-in and successful latest main CI, it requires
`production.releaseReady=true` in the reviewed target registry. It is currently
**false**, blocking its deployment, package script and database preflight.
Turning on an Actions variable alone cannot release production.

The blocker is legacy media compatibility. `MEDIA_ENV` currently controls both
storage paths and SQL production policy, including rejection of demo shops.
Switching it to production would make historical staging media unavailable;
retaining staging for a newly declared production app would not enforce all
production demo-data guards. A separate reviewed compatibility change must
decouple those concerns and pass real-history/dummy-data regression tests before
changing releaseReady. Do not rewrite or delete historical object keys to hide
this issue. This preparation does not claim production is ready to switch.

The proposed workflow checks migration history with `supabase migration list`;
it never pushes production migrations. If a reviewed release needs schema changes,
review the exact forward migration and rollback limitations separately, take a
fresh verified backup, and approve that production operation explicitly.

After compatibility work and isolated-staging acceptance, prepare the exact
production commit, runtime secret mapping and domain cutover for manual approval.
Preserve the old Worker as a rollback target. Update backup Worker configuration
checks to the actual production Worker as part of that reviewed cutover.

## Acceptance and rollback

Before claiming staging isolation, verify:

- Project references, service keys, OAuth client credentials and R2 buckets differ.
- A staging migration/upload/edit changes only staging; production counts and
  sampled public media remain unchanged. Do not create a test write in production.
- Production tokens are rejected by staging and staging tokens by production.
  Use dedicated test identities and never log tokens or user records.
- Signed-out and unauthorized staging requests are blocked by Access; CI can
  reach staging with its service token. Access credentials never reach MapTiler,
  Supabase browser requests or a redirected login provider.
- Staging admin authorization, private drafts, uploads, stamp/history reads and
  collections work with fresh accounts. Ordinary users cannot access admin APIs.
- Wrong-project, unregistered-project, shared-bucket, unreviewed-ref and automatic
  production-release attempts fail before writes. Production history drift blocks
  release, and the code-level production blocker cannot be bypassed by a variable.
- Existing production login, photos, artwork, saved shops and collections work
  before and after the separately approved final cutover.

If staging setup fails, unset its enable flag and disable its workflow. Restore
the last known working staging Worker version only; production stays on the
existing Worker/database/bucket. Never restore old deployment configuration that
points staging at live. A destructive staging reset also needs separate approval.

For final cutover failure, move app.nibatlas.com back to the retained old Worker
and restore its previous bindings/version. Because users/media remain in the
same live project/bucket, a Worker rollback does not need data rollback. A schema
rollback is different: destructive migrations may be irreversible, so use
backward-compatible schema changes and a separately rehearsed recovery plan.

## Costs, backup checkpoint and limits

Measured on 14 October: the first encrypted Drive recovery set is 125,207,859
bytes, including 23 R2 objects totaling 23,994,626 bytes. The job completed in
about five minutes and downloaded/verified the ciphertext checksum. Production
database physical size measured earlier was 29,658,259 bytes. These are different
measurements; archive size includes repository history and compresses database
and media content. A ten-set retention estimate at today's archive size is about
1.25 GB, excluding trash and growth.

Production remains on Pro; the founder selected Free/Nano in a separate organization
for staging. Free staging may pause after inactivity and has no included automatic
database backups; keep its test data reproducible. No paid staging instance was
created. For comparison, current published Micro compute is
$0.01344/hour (about US$10/month); organization-level compute credits are shared,
not an additional allowance for every new project. This is indicative pricing,
not a provisioning quote or approval. Obtain the selected organization's current
quote before purchase. The connected provider quoted US$10/month on 3 November
for a new project inside Nib Atlas Pro; the founder instead selected separate
Free staging to avoid that recurring charge. Pro daily database backups do not replace separate media
backup coverage; verify that a usable post-upgrade backup actually exists.
Cloudflare billing/usage was inaccessible, so no zero-cost Workers/Images claim
is made. Reuse the existing plan and test a small catalogue;
measure actual staging traffic and image transformations before estimating its
ongoing usage. Existing CI covers the PR; focused guard tests add seconds, not
another continuous database service.

The 14 October checkpoint recorded the Drive schedule off and its OAuth uploader
in Testing with a seven-day authorization limit. On 3 November, recent backup
runs include skips and a failure; a fresh successful recovery set and a completed
isolated restore have not been established. Verify current authorization, backup
freshness and recoverability before production mutations; do not overwrite live
data with an older recovery set. The private recovery identity stays only in the
founder's password manager/device.

References: Supabase billing FAQ, PostgreSQL verify-full documentation, OpenNext
Cloudflare CLI documentation, and Google OAuth refresh-token expiration guidance.
