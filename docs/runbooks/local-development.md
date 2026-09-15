# Local development

## Prerequisites

- Node.js 24
- pnpm 11.19.0 through Corepack
- Docker (Docker Desktop where appropriate) for the local Supabase stack
- Supabase CLI 2.117.0 for database/auth integration work, matching CI; install it separately and make `supabase` available on PATH. It is not a package dependency.

## Start the web application

1. Copy `.env.example` to `.env.local` and leave provider values blank for offline fixture work; configure local providers only for the feature you are testing.
2. Run `corepack enable`.
3. Run `pnpm install`.
4. Run `pnpm dev`.
5. Open `http://127.0.0.1:3000`. Use that same origin for local auth; do not mix it with `localhost`.

## Verify

Start with checks relevant to the change. Required GitHub checks remain unchanged:

| CI job name | Purpose |
| --- | --- |
| Quality | Lint, TypeScript, unit/component tests and Next.js build |
| E2E smoke | Fixture-mode browser journeys, accessibility and responsive regression |
| API-mode integration | HTTP-backed integration journeys with a local RPC double |
| Cloudflare build | OpenNext build compatibility |
| Database reset | Clean reset, seed repeatability, SQL tests, concurrency and 50k performance |
| Worker authentication | Real local Auth/PostgREST through the compiled Worker |

`.github/workflows/ci.yml` is the executable source of truth. These are CI job
names, not six commands to run after every edit. Database tests are documented in
`supabase/tests/README.md`; Worker tests require the setup in the CI job.

Available application checks:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm exec playwright install chromium`
- `pnpm test:e2e`
- `pnpm test:e2e:api`
- `pnpm build:cloudflare`

`pnpm test:e2e` builds and starts the application itself, then runs the journey,
accessibility, and reduced-motion suites at 360 × 800, 768 × 1024, and
1440 × 900.

`pnpm test:e2e:api` starts a local, deterministic public-RPC double and builds
the application in `api-demo` mode. It proves marker → card → detail → Back,
failed-refresh retention and Retry, and the separation of place and canonical
shop search. The double is a test process only: application code has no test-mode
branch and no provider payload bypasses the v1 routes or decoders.

Screenshot baselines are opt-in because rendering differs between container
images:

- check them with `VISUAL=1 pnpm test:e2e --project=visual`;
- refresh them with `VISUAL=1 pnpm test:e2e --project=visual --update-snapshots`.

## Map basemap

Without `NEXT_PUBLIC_MAPTILER_KEY` the map uses a deterministic paper background
for offline development and tests. Set a restricted browser key in `.env.local`
before `pnpm build` to work against real MapTiler geography. The build copies the
matching MapLibre worker modules into `public/maplibre/`; an explicit worker URL
is needed only when the app is mounted below a path prefix. See
`docs/adr/0002-maplibre-worker.md`.

## Catalogue mode

`NEXT_PUBLIC_CATALOGUE_MODE` selects which catalogue every surface reads. It is
read at build time, so a change needs a rebuild.

| Value | Effect |
| --- | --- |
| unset or `fixture` | The deterministic prototype catalogue. The default, and what tests, reviewer mode, and offline frontend work run against. |
| `api` | The same-origin `/api/v1/shops/*` read API. Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. |
| `api-demo` | `api`, and additionally accepts the demo-quality staging projection (`demo_fixture` sources paired with `sourceQuality: "demo"`). |
| anything else | Treated as a misconfiguration. Surfaces say the catalogue is unavailable. |

A failed or unconfigured API is never answered with fixture data: an outage that
rendered demonstration records would look like a working catalogue with most of
its shops missing. An unrecognised value is a misconfiguration for the same
reason. In reviewer mode the map overlay names the live supplier.

API mode uses authenticated saves and real account collections. Simulated
impressions remain isolated in fixture/reviewer state and are never imported as
verified visits. Account history stays in memory; sign-out clears private state.
Use `docs/runbooks/auth-local-staging.md`, `docs/api/saved-shops-v1.md`, and
`docs/api/collections-v1.md` for feature contracts. Production import remains M6/7.

Hosted staging uses `api-demo` only. Production must use `api`: accepting
`demo_fixture` there would let invented staging records present as catalogue
listings. The production catalogue import itself remains Milestone 6/7 work.

## Local Supabase

Use a disposable local database, never a hosted project for reset/testing. After Docker is running:

- `supabase start`
- `supabase db reset`
- `supabase stop`

Never commit `.env.local`, `.dev.vars`, database passwords, service-role keys, or API tokens.

For the controlled Cloudflare staging deployment and its MapTiler verification,
see `docs/runbooks/staging-deployment.md`.
