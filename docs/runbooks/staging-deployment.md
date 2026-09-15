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
