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

## Local Supabase

The hosted staging project is not required for Milestone 0. After Docker Desktop is running:

- `pnpm exec supabase start`
- `pnpm exec supabase db reset`
- `pnpm exec supabase stop`

Never commit `.env.local`, `.dev.vars`, database passwords, service-role keys, or API tokens.
