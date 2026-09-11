# Nib Atlas MVP Implementation Plan

**Status:** Ready for GitHub-based execution
**Version:** 1.3
**Last updated:** 7 September 2026

## Working model

All implementation happens in one GitHub repository. Repository documentation—not chat history—is authoritative.

### Responsibility split

| Area | Primary owner | Review/coordination |
| --- | --- | --- |
| Product direction, specifications, UX/design foundation, scope decisions | ChatGPT Work | Founder approval for genuine product changes |
| Responsive frontend, components, design-system implementation, map UI, Passport UI, stamp ceremony | Claude Code | Codex checks contracts/integration |
| Database, PostGIS, APIs, auth/infrastructure, CI, backend/integration tests, engineering review | OpenAI Codex | Claude reviews frontend contract impact |

Neither coding agent may silently change `PRODUCT.md`, product invariants, database/API contracts, migrations, or responsibility boundaries. Proposed changes belong in a PR note or ADR.

## Definition of done for every milestone

- Scope and explicit exclusions are respected.
- Acceptance criteria are demonstrated in the PR.
- Required checks pass locally/CI.
- New environment variables are documented in `.env.example` without values.
- Database changes include migration and tests.
- Frontend changes include mobile/desktop evidence and accessibility checks.
- Prototype data uses a small, source-reviewed subset of real shops already known to the project; uncertain fields are omitted or clearly marked, and no listing is presented as fully verified.
- Docs are updated when contracts or operational steps change.
- PR names assumptions, known gaps, and handoff owner.

## Milestone sequence

### Milestone 0 — Repository and engineering foundation

**Owner:** Codex

**Objective**

Create a reproducible, deployable skeleton with shared contracts and safe collaboration boundaries.

**Scope**

- Next.js App Router + TypeScript scaffold.
- Package manager and lockfile.
- Tailwind and semantic token foundation from `BRAND.md`.
- ESLint/formatting, strict TypeScript, Vitest, Testing Library, Playwright.
- Cloudflare OpenNext/Wrangler configuration.
- Supabase CLI layout and empty initial migration structure.
- `.env.example`, secret-handling policy, CI workflow.
- Root `AGENTS.md` and `CLAUDE.md` active.
- Shared domain/API TypeScript types and fixture contract.
- Minimal health route and Cloudflare-compatible build.

**Dependencies**

- GitHub repository access.
- Cloudflare account and zone can be added during milestone; no production domain required to start.
- Supabase CLI available locally/CI.

**Acceptance criteria**

- Fresh clone installs and runs from documented commands.
- `lint`, `typecheck`, unit test, build, and Playwright smoke command pass.
- Supabase local reset succeeds from empty migrations.
- Cloudflare preview build succeeds.
- No secrets are committed.
- Both agents can identify ownership and source-of-truth documents.

**Tests/checks**

- CI on a sample PR.
- Secret scan.
- Dependency lockfile check.
- Local/CI build parity.

**Do not build yet**

- Real shop database.
- Authentication UI/flows.
- Stamp verification.
- Admin CRUD.
- Production deployment.

### Milestone 1 — Frontend interaction prototype

**Owner:** Claude Code  
**Codex supplies:** product/interaction specifications and integration review.

**Objective**

Prove that map-first shop discovery and a tactile, believable Passport work responsively before production APIs, authentication, or visit verification are connected.

**Scope**

- Approved design tokens and font setup.
- Responsive app shell with three primary destinations: Map, Passport, and Me.
- Me as one conventional page for profile, countries/localities visited, account, settings, privacy, help, export/delete, and sign-out placeholders.
- MapLibre adapter using a small, source-reviewed subset of real shops already known to the project across launch geographies. Omit unverified details; do not imply catalogue completeness.
- Destination and shop-name search UI with prototype-local results.
- Marker states, clusters, selected halo, and a global Saved mode owned by Map.
- **Search this area** camera/committed-bounds behavior.
- Mobile Peek/Half/Full bottom sheet and desktop 65/35 map/list split.
- Marker/card synchronization and shop-detail presentation.
- Passport overview with shop stamps plus derived locality/country seal examples.
- Desktop Passport as a believable modern-passport object: closed cover state and open two-page spread.
- Mobile Passport as a single-page reading mode for the MVP.
- Spine-aware page turns, stamp ceremony, and reduced-motion equivalents.
- Component screenshots at representative breakpoints.

**Dependencies**

- Milestone 0.
- `PRODUCT.md`, `BRAND.md`, `UX.md`, `docs/passport-interaction-spec.md`, and the shared data contract.

**Acceptance criteria**

- User can complete: Explore map → select shop → open shop → simulate collection → see visited state → open Passport.
- The primary navigation is Map / Passport / Me. Discover appears only as contextual/editorial prompts; Saved is a global Map mode, not a primary destination.
- Recent Impressions is absent. The interface does not imply passive location tracking.
- Saved results can be viewed across locations and return to the relevant selected shop on the map.
- Passport desktop and mobile behavior matches the interaction specification, including the fixed spine, believable page stacks, keyboard controls, and reduced motion.
- Locality seals derive on the first verified shop stamp. Country seals derive at five verified shop stamps or completion of a versioned eligible set containing fewer than five shops; earned seals are never revoked.
- Standard stamps use exactly one ink from the shared eight-colour palette. Future dual/spectrum impressions do not appear in the MVP.
- Selected real-shop prototype records contain no invented operational facts and do not claim catalogue completeness.
- Map, list, and Passport status remain consistent.
- 360 × 800, tablet, and desktop evidence is included.

**Tests/checks**

- `pnpm verify`.
- `pnpm test:e2e`.
- `pnpm build:cloudflare`.
- Playwright coverage for map, sheet, collection, Passport, Me, Saved mode, keyboard, and reduced motion.
- Manual real-device PWA review on iOS Safari and Android Chrome.
- No frontend change to database migrations, API contracts, Cloudflare configuration, CI, or secrets.

**Explicitly deferred**

- Recent Impressions.
- Manual sideways phone-reading mode and rotate-phone cue (post-MVP, candidate for late closed beta).
- Multiple Passport books / “Library of places I’ve visited.”
- Real authentication, saves, visit verification, or check-ins.
- Dual-ink and spectrum/rainbow stamp editions.
- Feed, ratings, social graph, named trips, merchant tools, or catalogue-completion claims.

### Milestone 2 — PostGIS data foundation and read APIs

**Owner:** Codex

**Objective**

Replace fixture-only domain assumptions with a production-shaped, secured data spine.

**Scope**

- PostGIS/pg_trgm migrations.
- Core tables, constraints, indexes, RLS, seed vocabularies.
- Deterministic demo fixtures.
- Viewport, shop-detail, alias search, and Near Me RPCs/endpoints.
- Public projection separated from admin provenance.
- Antimeridian handling, result caps, cache headers.
- Shared generated types and API contract tests.
- Synthetic tens-of-thousands-shop performance dataset in test only.

**Dependencies**

- Milestone 0 contracts.
- `DATA-MODEL.md`.

**Acceptance criteria**

- Empty database migration/reset succeeds.
- Public can read only published shop projection.
- Draft/provenance data is inaccessible anonymously.
- Viewport filters and antimeridian tests pass.
- p95 database query meets agreed budget on synthetic dataset.
- API does not leak provider/database shapes into frontend contract.

**Tests/checks**

- pgTAP or SQL policy tests.
- Migration forward/reset test.
- API contract tests.
- Query plan/index assertions for representative bounds.
- Load/performance check.

**Do not build yet**

- Saves/authenticated state.
- Stamp issuance.
- Contributions/campaign tables beyond explicitly required compatibility.
- Real production shop import.

### Milestone 3 — Frontend/read-data integration

**Owners:** Claude Code frontend; Codex API/integration

**Objective**

Connect the approved map experience to real viewport contracts without regressing interaction quality.

**Scope**

- Frontend data adapter replacing fixtures behind the same interface.
- Loading, stale, error, empty, truncated-result states.
- Destination geocoder adapter and canonical shop search.
- Cache/debounce and request cancellation behavior.
- Stable shop URLs and metadata.

**Dependencies**

- Milestones 1 and 2.

**Acceptance criteria**

- Fixture and API modes render through one domain contract.
- Old results remain usable during a failed/slow viewport refresh.
- Selected shop survives safe refreshes and detail navigation.
- Geocoder destination results and canonical shop results are distinguishable.
- No continuous map-movement request storm.

**Tests/checks**

- Mocked network timing/error tests.
- Playwright marker/list/detail journey.
- API payload-size check.
- Cloudflare preview integration test.

**Do not build yet**

- User accounts/saves.
- Collect Stamp.
- Production analytics beyond technical smoke events.

### Milestone 4 — Authentication and saved shops

**Owner:** Codex auth/backend; Claude Code auth interruption and Saved UI

**Objective**

Add persistent personal planning without obstructing anonymous discovery.

**Scope**

- Supabase email OTP/magic-link auth.
- Google OAuth configuration before public beta; implementation may follow email flow within milestone.
- Auth callback and return-to-intent contract.
- Profile row creation and RLS.
- Save/unsave endpoints and optimistic UI with reconciliation.
- Saved screen and map status integration.
- Account/privacy shell.

**Dependencies**

- Milestone 3.
- Staging Supabase callback URLs and custom SMTP plan.

**Acceptance criteria**

- Anonymous exploration still works fully.
- Save interruption returns to the same viewport/shop and completes once.
- Users cannot access or mutate another user’s saves/profile.
- Saved state is consistent on map, card, shop page, and Saved.
- Session refresh/logout behavior is predictable.

**Tests/checks**

- RLS negative tests.
- Auth callback/returnTo integration tests.
- Playwright anonymous → save → login → saved journey.
- CSRF/open-redirect review.

**Do not build yet**

- Public profiles.
- Named trips.
- Social sharing/history.
- Stamp collection.

### Milestone 5 — Atlas Stamp verification and Passport data

**Owner:** Codex backend/security; Claude Code collection and Passport presentation

**Objective**

Complete the real-world core loop with privacy-safe, idempotent collection.

**Scope**

- Stamp and collection migrations.
- Verification attempts with 30-day retention.
- Short-lived nonce and throttled verification endpoint.
- Adaptive geofence, accuracy, freshness, duplicate logic.
- Atomic stamp issuance with historical snapshots.
- Immutable artwork-version and illustrator-credit data in each collected
  stamp snapshot.
- Permission explanation, retry, denial, outside-radius, duplicate, and support paths.
- Stamp ceremony connected to real issuance.
- Passport overview/country/locality backed by collections.
- Map/shop/Passport cache invalidation.

**Dependencies**

- Milestone 4 auth.
- Shop coordinates/timezones and active Atlas Stamp fixtures.

**Acceptance criteria**

- Successful eligible collection creates exactly one immutable record.
- Duplicate/concurrent requests cannot create duplicates.
- Raw coordinates are absent from database, analytics, and logs.
- Poor accuracy and denied permission yield useful recovery.
- Map, shop, and Passport update consistently.
- Collection date displays in the shop timezone snapshot.

**Tests/checks**

- Boundary tests inside/outside geofence.
- Accuracy/freshness tests.
- Concurrency/idempotency tests.
- RLS/direct-insert negative tests.
- Playwright mocked geolocation flows.
- Real-device staging test at multiple shop-like/mall conditions.

**Do not build yet**

- QR/NFC/merchant stamps.
- Historic self-attestation.
- Rewards, achievements, or campaigns.

### Milestone 6 — Founder admin and data import

**Owner:** Codex platform/data; Claude Code admin presentation only as needed

**Objective**

Make the catalogue maintainable without code deployments.

**Scope**

- Admin/editor server role checks.
- Shop/stamp CRUD and preview/publish workflow.
- Commissioned stamp-artwork upload, credit, motif-register and written-approval
  workflow.
- Provenance, freshness, image rights, and operational status fields.
- R2 upload/variant flow.
- CSV/JSON import contract, dry run, validation, deduplication report.
- Import batches and admin audit log.
- Basic verification anomaly list.

**Dependencies**

- Milestones 2, 4, and 5 schema.

**Acceptance criteria**

- Non-admin users cannot reach admin data/actions even by direct request.
- Founder can correct/publish/close a shop without code deployment.
- Import dry run reports row-level errors and changes nothing.
- Published imagery always has rights/source and alt text.
- Commissioned artwork cannot be published until its required source and export
  files, checksums, illustrator credit, maker-mark confirmation and written
  approval are recorded.
- Preview verifies the unchanged artwork in list, book and detail contexts; the
  delivery path resamples but never crops, recolours or draws over it.
- Every canonical admin change is audited.

**Tests/checks**

- Authorization negative tests.
- Import contract fixtures and idempotency tests.
- Malformed file/upload tests.
- R2 access-policy tests.
- Admin audit assertions.

**Do not build yet**

- Merchant dashboard/claim workflow.
- Public contribution forms.
- General-purpose CMS.

### Milestone 7 — Verified catalogue data and field test

**Owners:** ChatGPT Work/founder for research criteria; Codex pipeline; Claude Code presentation fixes

**Objective**

Populate a credible sourced catalogue and test the core loop in real conditions.

**Scope**

- Validate and expand sourced shop records from the catalogue actually available at implementation time. The existing Singapore, Japan, and Taiwan fixture is a starting dataset, not a coverage promise or rollout boundary.
- Coordinate, official-link, hours, status, type, service, and provenance checks.
- Authorized/rights-cleared imagery only.
- Field collection tests on Android/iOS and difficult indoor locations.
- Core event instrumentation.
- Five-user unmoderated usability pass plus qualitative interviews.

**Dependencies**

- Milestones 5 and 6.

**Acceptance criteria**

- No demo listing is represented as verified.
- Public catalogue scope is derived from actual records and framed as incomplete, without future-country or national-coverage promises.
- Founder can refresh/correct data through operations tooling.
- Field collection succeeds reliably enough to be trusted.
- Users understand **Search this area**, Saved, and Passport without coaching.

**Tests/checks**

- Import validation report.
- Duplicate/coordinate outlier review.
- Spot checks against official sources.
- Real-device field log.
- Usability issue severity review.

**Do not build yet**

- Additional countries.
- Contributions/moderation.
- Merchant or campaign features.

### Milestone 8 — Staging hardening and public MVP launch

**Owner:** Codex release/infrastructure; Claude Code frontend quality; ChatGPT Work product acceptance

**Objective**

Ship a secure, observable, accessible MVP with rollback and operating procedures.

**Scope**

- Cross-browser/responsive/accessibility hardening.
- Cloudflare staging and production deployment workflows.
- Backups, migrations, rollback, spend alerts, rate limits, and incident runbook.
- SEO/share metadata for shop pages.
- Privacy, terms, account export/deletion.
- Custom domain, SMTP, OAuth, analytics, and monitoring.
- Final performance/security review.

**Dependencies**

- Milestone 7 acceptance.

**Acceptance criteria**

- Launch checklist passes.
- Production deploy is reproducible from GitHub.
- Database backup/restore and application rollback are documented/tested.
- WCAG AA audit has no critical blockers.
- Location/privacy copy is plain and accurate.
- Spend/error alerts reach the founder.
- Production contains no demo labels/data leakage or test secrets.

**Tests/checks**

- Full Playwright suite.
- Lighthouse/performance budget.
- Accessibility audit.
- Dependency/secret/security scan.
- Migration rehearsal on staging snapshot.
- Rollback drill.

**Do not build yet**

- Phase 2 or later features.

### Milestone 9 — Evidence-led post-launch review

**Owner:** ChatGPT Work/founder with agent analysis support

**Objective**

Decide what deserves Phase 2 based on observed behavior and operational burden.

Evaluate:

- Are map exploration and shop discovery enjoyable?
- Do saved shops lead to visits?
- Does collection feel ceremonial but fast?
- Do users revisit Passport?
- Is data maintenance or product friction the greater burden?
- Which features are unnecessary?

Likely routing:

- data-maintenance bottleneck → contributions/moderation;
- planning behavior → named trips;
- collection retention → richer Passport/coverage statistics;
- merchant demand → claim/official-stamp discovery work, not automatic build.

## Recommended repository structure

```text
nibatlas/
├── PRODUCT.md
├── BRAND.md
├── UX.md
├── DATA-MODEL.md
├── ARCHITECTURE.md
├── IMPLEMENTATION-PLAN.md
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── .env.example
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy-staging.yml
│   │   └── deploy-production.yml
│   ├── pull_request_template.md
│   └── CODEOWNERS
├── app/
│   ├── (public)/
│   ├── (account)/
│   ├── admin/
│   └── api/v1/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── map/
│   │   ├── shops/
│   │   ├── passport/
│   │   └── stamps/
│   ├── features/
│   ├── domain/
│   ├── server/
│   │   ├── adapters/
│   │   ├── auth/
│   │   └── services/
│   ├── styles/
│   └── test/
├── public/
│   ├── brand/
│   └── fixtures/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
├── infra/
│   └── cloudflare/
├── scripts/
│   ├── data-import/
│   └── verify-env/
├── docs/
│   ├── adr/
│   ├── api/
│   ├── data-sourcing/
│   └── runbooks/
└── tests/
    ├── e2e/
    └── visual/
```

## Founder setup checklist before coding

### GitHub

1. Publish `avecging/nibatlas` under `AGPL-3.0-only` after the public-release audit passes. Keep branding, curated catalogue data, commissioned artwork, private agreements, personal information, and outreach records outside the software licence as recorded in `NOTICE.md`.
2. Confirm both ChatGPT/Codex and the machine running Claude Code have repository access. Do not share personal access tokens in chat.
3. After the foundation PR/initial commit exists, set the default branch to `main`.
4. Create a branch ruleset for `main`:
   - require pull request before merge;
   - require at least one approval when a human reviewer is available;
   - require conversation resolution;
   - require status checks: `lint`, `typecheck`, `unit`, `db-test`, `e2e-smoke`, `cloudflare-build` once workflows exist;
   - block force pushes and deletions;
   - prefer squash merge.
5. Enable secret scanning and Dependabot alerts/updates where available.
6. Create labels: `area:frontend`, `area:backend`, `area:data`, `area:infra`, `area:brand`, `agent:claude`, `agent:codex`, `needs:decision`, `blocked`, `milestone:0` through `milestone:9`.
7. If the GitHub plan supports private-repository Environments, create `staging` and `production`; restrict production deployments to `main` and require approval. GitHub documents private environments as requiring Pro/Team/Enterprise.
8. Do not add application secrets until workflows name the exact variables.

### Cloudflare

1. Add/confirm the intended domain in Cloudflare DNS; coding can begin before the final domain is chosen.
2. Enable Workers and choose the Workers Paid plan before persistent staging/production deployment; local foundation work can start on Free.
3. Create two Workers environments/services: `nibatlas-staging` and `nibatlas-production`.
4. Create separate R2 buckets: `nibatlas-staging-images` and `nibatlas-production-images`.
5. Enable Images transformations and decide a small fixed variant set during the image milestone.
6. Create least-privilege API tokens for GitHub Actions:
   - Workers Scripts edit;
   - Workers R2 Storage edit only when deployment/import requires it;
   - Zone/DNS read, not broad account admin;
   - scoped to the Nib Atlas account/zone.
7. Record `CLOUDFLARE_ACCOUNT_ID` and place deployment tokens only in GitHub environment secrets/Cloudflare secrets when requested by the workflow.
8. Reserve `staging.<domain>` and production root/app hostname.
9. Enable Web Analytics for production; use a separate dataset/marker for staging.
10. Add spend/usage notifications for Workers, R2, Images, and MapTiler before public launch.
11. Before closed beta, protect the beta Worker with Cloudflare Access using one-time PIN authentication and an exact tester-email allowlist. Preserve automated smoke tests with an Access service token; do not rely on a shared password or leave an unprotected workers.dev bypass. Follow `docs/runbooks/closed-beta-access.md`.

### Supabase and MapTiler preparation

Although the question emphasizes GitHub/Cloudflare, coding will also require:

1. Create separate Supabase staging and production projects in the nearest practical region; local development uses Supabase CLI.
2. Do not send database passwords, service-role keys, or recovery codes in chat.
3. Enable PostGIS through migrations, not one-off dashboard state.
4. Configure staging/production auth callback URLs only after hostnames exist.
5. Create MapTiler development/staging and production keys with origin restrictions and spending limits.

## Decisions required before implementation

No unresolved product or architecture decision blocks Milestone 0 or Milestone 1.

The following are later setup decisions, not reasons to pause coding:

- final production domain/hostname before staging auth callbacks;
- final custom-drawn SVG logo before public brand launch;
- Google OAuth consent details before public beta;
- whether staging Supabase stays on a pausable free project or adds roughly $10/month for always-on compute.

Default recommendations are documented above. Escalate only if a proposed change alters a product invariant, privacy rule, MVP boundary, or cross-agent contract.
