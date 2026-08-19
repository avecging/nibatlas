# Staging deployment

The staging Worker is `nibatlas-staging`. It is deployed by GitHub Actions from
the `staging` branch, from the Milestone 1 integration branch while PR #2 is
open, or through an explicit manual workflow run.

## Required GitHub repository secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `NEXT_PUBLIC_MAPTILER_KEY`

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
- a 1440 × 900 screenshot is retained as workflow evidence for 14 days.

The normal PR CI remains authoritative for the complete breakpoint,
accessibility, reduced-motion, database-reset, and Cloudflare-build suites.

## Promotion boundary

Staging success does not merge or promote the branch. PR #2 remains draft until
the founder reviews the clickable deployment and Codex reports the final gate.
Production deployment is out of scope for this workflow.
