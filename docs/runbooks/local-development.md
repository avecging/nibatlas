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

Without `NEXT_PUBLIC_MAPTILER_KEY` the map uses an offline demo basemap: a paper
background with the demo markers and clusters on top, and no tile provider. Set
the key in `.env.local` to work against MapTiler, and read
`docs/adr/0002-maplibre-worker.md` first — the MapLibre worker does not start
under the Turbopack build, so tiled sources cannot parse yet.

## Local Supabase

The hosted staging project is not required for Milestone 0. After Docker Desktop is running:

- `pnpm exec supabase start`
- `pnpm exec supabase db reset`
- `pnpm exec supabase stop`

Never commit `.env.local`, `.dev.vars`, database passwords, service-role keys, or API tokens.
