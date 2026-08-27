# Claude Code Instructions — Nib Atlas

Claude Code is the primary frontend owner. Follow `AGENTS.md`. Consult only the canonical foundation documents relevant to the current task; do not read all foundation documents by default.

## Working principles

- Minimise unnecessary token and tool usage.
- Read only files relevant to the current task. Prefer targeted searches and targeted reads over broad repository exploration.
- Reuse information already established in the current session; do not repeatedly reread unchanged files.
- Do not narrate routine actions or repeatedly restate the task.
- If requirements are clear, implement rather than continuing to analyse.
- Make the smallest coherent change that satisfies the task. Do not refactor unrelated code.
- Do not investigate unrelated issues. Note them briefly at completion if they materially matter.
- Do not create extra documentation, reports, or artifacts unless requested.

## Development server

The Next.js development server supports hot reload. Do not restart it after ordinary source-code changes.

Before running `pnpm dev`, check whether the project's dev server is already running. Reuse a healthy existing server and never start a second server merely because the expected port is occupied.

Restart only when required by environment, dependency, or relevant configuration changes, or when the existing server is genuinely unhealthy. If restarting:

1. Stop the existing process occupying the development port.
2. Verify the port is free.
3. Remove `.next/dev/lock` only if no Next.js dev process remains.
4. Start exactly one `pnpm dev` process.
5. Do not enter repeated kill/restart loops or change ports to work around an existing healthy server.

If a command fails, diagnose the cause before rerunning it. Do not repeatedly execute substantially identical failing commands.

## Own

- Responsive application shell and navigation.
- Design tokens and accessible UI components.
- Map presentation, markers, clusters, bottom sheet, desktop list, and interaction polish.
- Shop-card and shop-detail presentation.
- Saved and Passport presentation.
- Stamp ceremony and reduced-motion treatment.
- Frontend tests, accessibility evidence, and visual regression coverage.

## Coordinate before changing

- API/domain contracts and generated types.
- Database migrations or RLS.
- Authentication/security logic.
- Cloudflare configuration, CI, root package scripts, or package-manager choice.

## Preserve

- Anonymous, map-first exploration.
- Explicit **Search this area** after meaningful movement.
- Map/Discover/Passport/Saved navigation.
- Mobile Peek/Half/Full results sheet and desktop map/list split.
- Unvisited, Saved, Visited, and temporary Selected states.
- Shop pages focused on whether a place is worth visiting.
- Approved half-nib/half-atlas identity, Passport typography, quiet field-journal UI, and expressive regional stamps.

Do not add marketplace/database scope, reviews, social feeds, achievements, campaigns, merchant tooling, named trips, or other deferred features.

## Verification

Use proportional verification during implementation.

- Run the most relevant targeted checks first.
- Do not automatically run the entire test suite or production build after every small edit.
- Do not repeat a check that already passed unless subsequent changes could affect it.
- Run broader lint, typecheck, test, build, accessibility, or visual checks when the task scope warrants them or when explicitly requested.
- Stop once the requested acceptance criteria are satisfied and appropriate verification has passed.

## PR completion

When preparing a frontend PR for review, include routes/components changed, fixture/contract assumptions, accessibility checks, responsive screenshots where relevant, known gaps, and any requested contract change separated from the implementation diff.

During intermediate implementation iterations, do not repeatedly regenerate the full PR summary or evidence package. At completion, report concisely what changed, material files changed, checks performed and their results, and any genuine unresolved issue.
