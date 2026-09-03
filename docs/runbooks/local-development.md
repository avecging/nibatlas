# Local development

## Prerequisites

- Node.js 24
- pnpm 11.19.0 through Corepack
- Docker Desktop only when running the local Supabase stack

## Start the web application

1. Copy `.env.example` to `.env.local` and leave values blank for the Milestone 0 shell.
2. Run `corepack enable`.
3. Run `pnpm install`.
4. Run `pnpm dev`.
5. Open `http://localhost:3000`.

## Verify

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

In `api` mode the simulated stamp collection is withheld — a simulated
impression beside real records would read as a verified visit — and the global
Saved scope lists nothing, because listing every saved shop needs the account
that Milestone 4 introduces. Production catalogue import remains Milestone 6/7
work.

Hosted staging uses `api-demo` only. Production must use `api`: accepting
`demo_fixture` there would let invented staging records present as catalogue
listings. The production catalogue import itself remains Milestone 6/7 work.

## Local Supabase

The hosted staging project is not required for Milestone 0. After Docker Desktop is running:

- `pnpm exec supabase start`
- `pnpm exec supabase db reset`
- `pnpm exec supabase stop`

Never commit `.env.local`, `.dev.vars`, database passwords, service-role keys, or API tokens.

For the controlled Cloudflare staging deployment and its MapTiler verification,
see `docs/runbooks/staging-deployment.md`.
