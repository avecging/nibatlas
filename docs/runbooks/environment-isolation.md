# Production and isolated staging — preparation, 14 October 2026

## State and authority

The founder authorized split PR preparation and isolated staging setup. A merge,
live production release, domain cutover, production migration, secret rotation,
purchase or production data move is not authorized by this document.

The live app is `app.nibatlas.com`, served by `nibatlas-staging`, using Supabase
`xgyzsdrugtwqlpnkutfw` (display name `nibatlas-staging`) and R2
`nibatlas-staging-images`. These resources contain production users and history.
Never run staging resets, demo fixtures or staging migrations against them.

Main `824d106e9250ad520b3c7964ceb4583b3f6a287c` and staging
`09a4a504be63108f0954ffd4f0f81042fd6c4878` were reconciled in this preparation.
Staging's already-deployed admin authorization and illustrated error pages are
preserved, as are main's backup safeguards. No app deployment follows a main push.

| Target | Live production, preserved | New isolated staging |
| --- | --- | --- |
| Supabase | Existing fixed project reference | New project, reference initially unregistered |
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

Until this PR is explicitly merged and promoted, the old staging workflow still
targets live resources. Do not push to staging or dispatch old workflow versions.
In GitHub Actions, temporarily disable **Deploy staging** while preparing the
split; the connector cannot change that setting. This changes no running app.

The proposed staging workflow is off unless `ISOLATED_STAGING_ENABLED=true`.
It uses only `STAGING_` credentials in `staging-isolated`, accepts main/staging
refs, and checks the registered project and bucket before any database operation.
An unset registration or the existing live project ID fails closed.
Main and staging must both contain these safeguards before re-enabling the
workflow. Promoting the reconciled main commit with the enable flag unset skips
deployment; never force-reset a branch or re-run an old deployment.

## Operator setup, in order

1. In the existing **Nib Atlas** Free organization, create
   `nibatlas-og-staging` in Singapore. Confirm the console shows $0 and no
   upgrade. Save its unique database password in the password manager. Share only
   its public project reference with the implementer.
2. Register that reference in `scripts/deploy/targets.json` through a reviewed
   PR. Keep the live production reference unchanged. Supabase project creation
   and cost-confirmation operations were unavailable through the connected tool;
   no new project has been created by this code preparation.
3. In Cloudflare, create private R2 bucket `nibatlas-staging-isolated-images`.
   Keep public bucket access off. Create the staging Worker under the exact new
   name, initially without application traffic. Do not touch app.nibatlas.com's
   current route or its existing bucket. Reuse the current account/plan only;
   verify that it supports the existing 1000 ms CPU and Images binding. No plan
   change is part of the setup.
4. Protect the new staging hostname with Cloudflare Access: allow the founder's
   account and a separate service-auth policy for the CI service token. Create
   an expiring staging-only service token; save its values privately. Protect
   the workers.dev address: this workflow uses it for smoke tests. Protect any
   custom hostname too; no alternate address may bypass the gate. Switching to
   custom-host-only testing requires a reviewed workflow URL change.
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
8. After explicit merge authorization and final-head CI/review, promote the
   safeguarded commit to staging. Enable only `ISOLATED_STAGING_ENABLED`, then
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

Supabase lists two active Free projects as an allowance; only one project was
visible during preparation. Account eligibility and the actual creation screen
must confirm $0. Cloudflare billing/usage was inaccessible, so no zero-cost
Workers/Images claim is made. Reuse the existing plan and test a small catalogue;
measure actual staging traffic and image transformations before estimating its
ongoing usage. Existing CI covers the PR; focused guard tests add seconds, not
another continuous database service.

The Drive schedule remains off. Its OAuth uploader is still Testing with a
seven-day authorization limit; publishing/token renewal is paused at the founder's
request. The saved ciphertext remains available after uploader authorization
expires. Decryption and an isolated restore have not yet been rehearsed. The
private recovery identity stays only in the founder's password manager/device.

References: Supabase billing FAQ, PostgreSQL verify-full documentation, OpenNext
Cloudflare CLI documentation, and Google OAuth refresh-token expiration guidance.
