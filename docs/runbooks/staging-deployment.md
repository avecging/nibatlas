# Staging deployment

The staging Worker is `nibatlas-staging`. The workflow runs on pushes to
`staging` or an explicit **Actions → Deploy staging → Run workflow** on the
intended ref (normally reviewed/merged `main`). It does not automatically run
on a main push or an old integration branch. Production is separate.

## Required GitHub repository secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `NEXT_PUBLIC_MAPTILER_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

The workflow fixes `NEXT_PUBLIC_CATALOGUE_MODE=api-demo`; it is not a secret and
must not be changed to fixture mode. The URL and publishable key are browser-safe
but remain environment-scoped repository secrets so staging cannot accidentally
point at another Supabase project. A service-role key is neither required nor
permitted for these reads.

The MapTiler browser key must be restricted to the exact staging origin. Never
write any of these values to workflow output, repository variables, or files.

`SUPABASE_ACCESS_TOKEN` must be a short-lived scoped token restricted to the
`nibatlas-staging` project. Grant only Project Settings read and Connection
Pooling read. The deployment queries that project directly, verifies its name,
and retrieves its IPv4 pooler connection for GitHub-hosted runners. It combines
the pooler URL with the separately stored database password only in process,
masks the derived URL before use, and never writes it to disk. Do not replace
the identity check with account-wide project enumeration or Supabase CLI
linking, either of which requires broader token access.

`SUPABASE_DB_PASSWORD` is used only by the CLI migration connection. Neither
Supabase credential is exposed to the application build or Cloudflare Worker.

## Feature prerequisites

The build-time list above is separate from Worker runtime secrets/bindings:

| Feature | Setup source |
| --- | --- |
| Email/Google login | `auth-local-staging.md`: Supabase provider configuration and redirects |
| Collection and media | `stamp-verification.md`: existing server-only `SUPABASE_SERVICE_ROLE_KEY`; shared by both features |
| Contribution forms | `contribution-intake.md`: `CONTRIBUTE_SCRIPT_URL`, `CONTRIBUTE_SHARED_SECRET`, `TURNSTILE_SECRET_KEY` |
| Private media | `media-uploads.md`: private environment-separated R2 buckets, `MEDIA_BUCKET`, `MEDIA_ENV`, and `PHOTO_IMAGES` for JPEG |

Keep runtime secrets in the staging Worker, not browser/build variables. The
workflow does not provision these dashboard settings. A green deployment smoke
is not acceptance of every configured feature. Never reuse production secrets.

## Deployment

`.github/workflows/deploy-staging.yml` installs the locked dependencies, runs
lint, type checking, and unit/component tests, builds through OpenNext, and
deploys with Wrangler. The workflow obtains the resulting `workers.dev` URL
from Wrangler's output rather than hard-coding the Cloudflare account subdomain.

After deployment, a Playwright staging check verifies:

- the same-origin MapLibre worker and shared module are served;
- MapTiler and OpenStreetMap attribution is rendered;
- multiple MapTiler style/geography resources return successfully;
- the browser reports no console or page errors; and
- the deterministic demo database projection completes marker → card → detail →
  Back through the public v1 boundary;
- the returned detail is visibly identified as demo data;
- Near Me sends its coordinates in POST JSON, never in its URL; and
- a 1440 × 900 screenshot is retained as workflow evidence for one day.

The staging projects disable Playwright traces because browser request URLs
contain the browser-visible MapTiler key. Evidence uploads contain only rendered
screenshots and never traces, network archives, POST bodies, or environment
files. The catalogue smoke uses a published demo shop's coordinate, not a user's
position, and asserts no latitude or longitude appears in a request URL.

The normal PR CI remains authoritative for the complete breakpoint,
accessibility, reduced-motion, database-reset, and Cloudflare-build suites.

## Catalogue boundary

`api-demo` is staging-only and additionally accepts demo records marked
`sourceQuality: "demo"` with their own fixture notice and `demo_fixture` evidence.
It also accepts valid sourced records; it is not a demo-only catalogue filter.
It does not transform demo provenance into a real source kind. Production uses
`api`, which fails closed on those records. Production catalogue import remains
Milestone 6/7 work and is not performed by this deployment.

## Promotion boundary

Staging success does not merge or promote the branch. The final PR remains open
until its normal CI and controlled staging checks pass. Production deployment is
out of scope for this workflow.

## Package A stability checkpoint — 20 September 2026 (Singapore)

The unchanged baseline is main `3732018a0ca023a2dc7e8ae0eef7a26061e8470a`
(#74 merged), with CI 35446023895 and staging deployment 35446031047 successful.
PR #75 is merged at `7074656bdc3e7aa945ad208a0fbdd036410fac82`. Main CI
35458434251 passed all six jobs; staging deployment 35458739061 succeeded at
that exact commit (Worker `fcf8fb29-ad9c-4501-9a96-5abe2a8f4b0b`). Both public
map/catalogue smoke checks passed; the remote database was already up to date.
The retained screenshots could not be downloaded/visually inspected (HTTP 403),
and the interactive browser still timed out after recovery. This is an access
limitation, not evidence of application outage or authenticated acceptance.

Package A changes client recovery, not Worker limits, account plan,
auth/session behaviour, database contracts or media processing. Until merged and
explicitly deployed, these recovery changes are not staging acceptance.

### Outstanding 1102 diagnosis

Historical incident: `/admin/shops/c8dfb3bf-2231-4e82-8c7b-b54a6985788b`
(THINK), 2026-09-19T16:01:54Z, Ray `a3d9cfc85b0b0b21`. Prior inspection
reported HTML in place of JSON and then Cloudflare 1102 on document reload.
The original error page was still open during Package A; one reload reached the
app's signed-out admin screen. This is a different session state and does not
prove authenticated recovery or identify the original failing API request.

Cloudflare dashboard inspection was blocked at security verification; subsequent
browser recovery timed out. No authorized Worker telemetry connector/credential
was available in the task runtime. Two separate anonymous terminal GET probes
(`/api/health` and the THINK admin API) returned plain-text HTTP 403 at
16:56:38Z / 16:56:47Z, Rays `a3da1ff75a230b21-LAX` and
`a3da203339a90b21-LAX`, without application release/request headers. Those
responses do not establish an application authorization defect or repeat 1102.
No further load or authenticated media operations were attempted.

Source investigation: the shop page mounts the client editor. It reads shop and
vocabulary in parallel, then separate media/stamp lists and image previews.
Shop RPC authorization shares one cookie-bound client with identity/role checks.
Media previews check permission before and after private R2 reads; they stream
stored PNG and do not execute the JPEG decoder on GET. All saved gallery/version
previews currently render together (up to the existing 50/50 limits); aggregate
load needs measurement before bulk onboarding. These are call-path observations,
not evidence of CPU exhaustion, memory exhaustion or a decoder cause. Do not
weaken role checks, add caching across users, or upgrade plans speculatively.

Next authorized operator steps:

1. Open **nibatlas-staging** Worker logs/metrics in the existing Cloudflare
   account. Correlate the incident time and Ray with available retention; if
   expired, capture one fresh bounded reproduction using the existing admin
   account and THINK record. Do not create/reset test businesses or publish it.
2. Separate document, auth/session, shop/options, media/stamp list and preview
   requests. Record route (no query/body/cookies), UTC time, response status,
   release, safe Ray/request ID, Worker outcome and CPU/wall duration. Inspect
   resource/exception evidence and actual configured budget/plan. A 1102 code
   alone does not distinguish CPU from memory exhaustion; see
   [Cloudflare errors and exceptions](https://developers.cloudflare.com/workers/observability/errors/).
3. Compare one existing draft editor with THINK and public list/detail. Only
   repeat enough to distinguish the route/session/preview boundary. Correlate
   existing `shop_admin_failure` stages when present; infrastructure termination
   may happen before application diagnostics exist. Never log request bodies,
   tokens, raw user locations, private source notes or media bytes.
4. Fix only a supported cause through a reviewed PR. Verify the actual deployed
   release afterwards. Record missing evidence explicitly if correlation fails;
   do not close the root-cause gate on CI or a single successful anonymous load.

### Client recovery checks

Admin shop, photo/logo and stamp JSON requests now reject HTML/empty/malformed
responses with HTTP status and a validated support reference when supplied.
A mutation warning says it may already have completed: reload saved state before
retrying. Existing structured error codes, draft state and upload-session recovery
remain intact. Diagnostic logs contain only allowlisted status/reference/release;
never infrastructure bodies or parser excerpts. No automatic mutation retry is
introduced. A full-document infrastructure error still belongs to Cloudflare.

MapLibre 6.4 can return a partial map after WebGL2 initialization fails before
creating gesture handlers. The former `disableRotation` access outside the
constructor guard then crashed the page. The guard now includes runtime,
constructor and control initialization, best-effort partial teardown and the
existing list fallback. This is separate from server 1102; it does not imply a
universal phone map outage or repair arbitrary later tile/context failures.

On this deployed revision, check the still-pending admin failure/reload flow and map fallback on mobile
and desktop separately from ordinary map interaction. Local component tests use
partial/throwing MapLibre doubles; the E2E regression disables WebGL contexts to
exercise the actual locked constructor and preserve the list/navigation. Feature
remote acceptance remains in `media-uploads.md`; preserve previously accepted
PNG/phone/draft results and all historical impressions.
