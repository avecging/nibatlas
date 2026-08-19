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
- `pnpm build:cloudflare`

`pnpm test:e2e` builds and starts the application itself, then runs the journey,
accessibility, and reduced-motion suites at 360 × 800, 768 × 1024, and
1440 × 900.

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

## Local Supabase

The hosted staging project is not required for Milestone 0. After Docker Desktop is running:

- `pnpm exec supabase start`
- `pnpm exec supabase db reset`
- `pnpm exec supabase stop`

Never commit `.env.local`, `.dev.vars`, database passwords, service-role keys, or API tokens.

For the controlled Cloudflare staging deployment and its MapTiler verification,
see `docs/runbooks/staging-deployment.md`.
