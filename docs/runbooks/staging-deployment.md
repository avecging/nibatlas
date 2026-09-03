# Staging deployment

The staging Worker is `nibatlas-staging`. It is deployed by GitHub Actions from
the `staging` branch, from the Milestone 3 WP3 integration branch while its final
PR is open, or through an explicit manual workflow run.

## Required GitHub repository secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `NEXT_PUBLIC_MAPTILER_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The workflow fixes `NEXT_PUBLIC_CATALOGUE_MODE=api-demo`; it is not a secret and
must not be changed to fixture mode. The URL and publishable key are browser-safe
but remain environment-scoped repository secrets so staging cannot accidentally
point at another Supabase project. A service-role key is neither required nor
permitted for these reads.

The MapTiler browser key must be restricted to the exact staging origin. Never
write any of these values to workflow output, repository variables, or files.

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

`api-demo` is staging-only and accepts only records already marked
`sourceQuality: "demo"` with their own fixture notice and `demo_fixture` evidence.
It does not transform demo provenance into a real source kind. Production uses
`api`, which fails closed on those records. Production catalogue import remains
Milestone 6/7 work and is not performed by this deployment.

## Promotion boundary

Staging success does not merge or promote the branch. The final PR remains open
until its normal CI and controlled staging checks pass. Production deployment is
out of scope for this workflow.
