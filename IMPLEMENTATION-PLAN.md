# Nib Atlas MVP Implementation Plan

**Status:** Active implementation; see current-work table
**Version:** 1.5
**Last updated:** 20 September 2026 (Singapore)

## Working model

All implementation happens in one GitHub repository. Repository documentation—not chat history—is authoritative.

### Responsibility split

GPT owns end-to-end implementation and initiates independent review under
`AGENTS.md`; Claude is an optional reviewer. The founder approves product
and scope decisions. A conductor/orchestrator has not been onboarded. `AGENTS.md`
is the shared working contract. This assignment covers every milestone; frontend work is not reserved for Claude.

## Current work — Q4 stability and admin/import sequence, 20 September 2026

| Area | State / next action |
| --- | --- |
| M0–M4 foundations | Implemented: app, catalogue reads, frontend integration, auth and saves. Production setup is separate. |
| M1.5 | WP1–WP7 implemented; preserve the historical record unchanged. WP-D desktop review still needs founder feedback. |
| M5 | Verification and account collection integration implemented. Geographic seal persistence/versioned coverage sets and broader indoor field validation remain outstanding. |
| M6 WP1/WP2 | Authorization/audit and shop operations implemented. Founder confirmed draft creation; broader admin acceptance is separate. |
| M6 WP3 | Issue #73 governs simplified MVP uploads. Photo/logo picker, private attachment/publication delivery, and truthful stamp draft → PNG → list/Passport/detail preview → admin activation → versioned delivery/creator credit are merged in PR #74 at `3732018a0ca023a2dc7e8ae0eef7a26061e8470a`; main CI 35446023895 and staging deployment 35446031047 passed. Remote acceptance is separate. Generated defaults/history/duplicate protection remain intact; #70/#71/#72 stay deferred. Remote JPEG, photo/logo display and stamp end-to-end acceptance remain unverified; see `docs/runbooks/media-uploads.md`. |
| M6 WP4 | Mandatory usable CSV/JSON onboarding for approximately 200 shops: shared contracts first, then dry run/mapping/dedupe/private import, safe correction/resume/updates and selected batch review/publication. Bring forward before final rich-editor polish; no 200-form manual-entry substitute. |
| M6 anomaly list | Inventory implementation and give an explicit disposition in Package E; not established complete by this inspection. |
| M7/M8 | Catalogue quality, production setup, account export/deletion, monitoring, backup/restore, rollback and launch acceptance remain. Public commitment is Q4 2026. October is the working target; November/December are contingency, not expanded scope. |

Passport animation remains in place for launch despite known roughness;
[issue #68](https://github.com/avecging/nibatlas/issues/68) tracks post-launch investigation and the opening-geometry decision.

Read `docs/runbooks/launch-backlog.md` for existing issue dispositions. Acceptance
records live with the feature: shop-admin in its runbook, phone checks in
`staging-phone-test.md`, PNG/JPEG transport in `media-uploads.md`. Do not infer
untested behavior from a neighboring feature's success.

## Approved delivery sequence and acceptance matrix

This table is the authoritative sequencing/status record. The approved admin
rework and supplemental Q4 handoffs (20 September) govern scope; the prototype
is a layout/behaviour reference, not verified catalogue content. Packages may
span sessions; finish coherent reviewed draft PRs rather than concurrent edits
to shared migrations/contracts. No package here authorizes production release.

| Package | Required result | Current acceptance / dependencies |
| --- | --- | --- |
| A — Stability | Investigate 1102 against route/release and authorized resource telemetry; useful non-JSON recovery; independent WebGL fallback; separate media acceptance. | Recovery implementation under review. Original 1102 root cause unresolved: authenticated reproduction and Worker telemetry unavailable. See staging and media runbooks; CI is not remote acceptance. |
| B — Shared contract and essentials | One normalized manual/import draft and publication contract; additive compatibility/public decoding; trusted-admin review without mandatory claim tokens; protected private working copies; idempotent audited generated defaults for new shops; canonical locality/brand mapping/creation; essential seven-section editor. | Next implementation package after A checkpoint. Ship a real end-to-end slice. Retain IDs/slugs, legacy provenance, relationships, custom art and impressions. Optional creator name/link, with name required for a supplied link; no invented verification facts. |
| C — Bulk onboarding | Versioned downloadable CSV/JSON template, column and grouped vocabulary mapping, dry run/dedupe, selected private import, correction reports, stable row identity/operation revisions, resumable safe updates and batch review/publication. | Mandatory before catalogue preparation; at least 200 synthetic mixed-quality rows in isolated tests. Omitted/blank fields preserve data; explicit clearing and before/after preview; draft/public revision conflicts require re-review. Bounded chunks/concurrency, private batch audit/retention and formula-safe reports. Dry run does not mutate catalogue/media/stamps. C1 ingestion alone does not complete C2 publication. |
| D — Complete approved editor | Shop & story; experiences; location; visit details; photos/logo; stamp; review. Full editorial/paragraph fields, repeatable experiences, optional practical fields, split/overnight hours and dated exceptions, gallery cover/order/captions, private pending media/stamp selection, accurate mobile/desktop public preview and field-level Fix actions. | Carry B/C data without re-entry. Review/publication binds the reviewed revisions and reports recoverable partial outcomes; draft saves never silently publish media/activate artwork. Optional postcodes/references/hours/photos are not arbitrary blockers. |
| E — Catalogue and core acceptance | Locate actual founder dataset; map once, dry-run/correct/import, review genuine coordinates/timezones/unknowns; truthful public About; geographic seal/versioned coverage and anomaly-list dispositions; changed admin/public flows, field checks and five-user usability. | No fabricated catalogue or verification dates. Keep WP-D founder desktop feedback, broader device/indoor checks and #17 About accuracy explicit. Imports never create visits or derive award denominators from batch size. |
| F — Production and release | Production/auth/domain/SMTP/OAuth, server account export/deletion consistent with immutable history/privacy, monitoring/spend alerts, terms/privacy, backups/restore and rollback drills, accessibility/performance/security, launch publication audit and founder acceptance. | Infrastructure discovery and independent account lifecycle work can start before D/E finish. Actual promotion follows authorized gates. Read closed-beta runbook before gating; preserve automation/alternate-route protection; no tester invitations here. |

Bulk catalogue import is distinct from mass media upload: retain 100 upload
manifests/account/rolling 24 hours and 50 attachments/50 stamp versions per shop.
Generated defaults support onboarding without 200 uploads. Never scrape or fetch
arbitrary image URLs in catalogue import. Measure aggregate preview/page/request
work; select bounded processing budgets from observations, not an assumed plan
upgrade or an unmeasured queue requirement. Coordinate confirmation and admin
review require deliberate attestations, not successful import or decimal precision.

Preserve anonymous discovery, Saved state, current-role checks, private notes,
existing accepted PNG/phone/draft results, immutable history and duplicate
protection. Keep #68 animation, #70 recollection, #71 commissioning, #72 photo
paperwork, personal notes, social/sharing and itineraries deferred. No M5–M8
obligation disappears because it is outside the editor.

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

M0–M5 sections below preserve the original scope and acceptance criteria as a
reference. Their "do not build yet" lists applied at those milestones, not to
current work. Use the current-work table above to choose the next task.

### Milestone 0 — Repository and engineering foundation

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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
- Implementer and reviewer can identify ownership and source-of-truth documents.

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

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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
- No unrelated changes to migrations, API contracts, Cloudflare configuration, CI or secrets.

**Explicitly deferred**

- Recent Impressions.
- Manual sideways phone-reading mode and rotate-phone cue (post-MVP, candidate for late closed beta).
- Multiple Passport books / “Library of places I’ve visited.”
- Real authentication, saves, visit verification, or check-ins.
- Dual-ink and spectrum/rainbow stamp editions.
- Feed, ratings, social graph, named trips, merchant tools, or catalogue-completion claims.

### Milestone 2 — PostGIS data foundation and read APIs

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

**Objective**

Make the catalogue maintainable without code deployments.

**Scope**

- Admin/editor server role checks.
- Shop/stamp CRUD and preview/publish workflow.
- Founder/admin stamp-artwork upload, truthful origin, creator credit, version preview and activation per #73. Commissioning paperwork is deferred to #71.
- Catalogue provenance, freshness and operational status fields. Photo/logo metadata is optional per #73/#72.
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
- Photo/logo upload and publication require no paperwork or mandatory description; accessible fallback text remains truthful.
- Stamp uploads accept founder-created, commissioned and AI-assisted artwork with truthful attributes and optional creator link. MVP activation must not require source/SVG bundles, rights evidence or external illustrator sign-off (#73); existing version/history integrity remains mandatory.
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
- A new contribution moderation platform; existing public forms/Sheets intake remain supported.
- General-purpose CMS.

### Milestone 7 — Verified catalogue data and field test

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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

- Unsourced geographic expansion or public coverage promises; sourced records may be added in any country.
- A new contribution moderation platform beyond the existing forms/Sheets intake.
- Merchant or campaign features.

### Milestone 8 — Staging hardening and public MVP launch

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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

**Owner:** GPT implementation; review per `AGENTS.md`; founder product acceptance.

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

## Setup and verification references

The application already exists. Use `docs/runbooks/local-development.md` for
setup and the six established CI job names; use `docs/runbooks/staging-deployment.md`
for staging configuration. Do not create another scaffold or duplicate workflow.

Production setup remains M8: separate Supabase/Worker/R2 credentials, final
hostnames and auth callbacks, SMTP/OAuth, spend/error alerts, backup/restore and
rollback. Before closed beta follow `docs/runbooks/closed-beta-access.md`.
Brand launch validation remains in `BRAND.md`; licensing in `NOTICE.md`.

Preserve PR-before-merge, required checks and conversation resolution; retain
review approval when configured and squash merging. Do not weaken branch
protection, allow force pushes/deletions, or skip secret/dependency scanning to
complete a task. Production promotion requires its configured approval gate.
Use least-privilege environment-scoped deployment tokens and origin-restricted
MapTiler keys. Enable provider spend limits/alerts before launch. Public release
still requires the publication audit; private agreements, personal information,
artwork rights and catalogue licensing boundaries in `CONTRIBUTING.md` and
`NOTICE.md` remain in force.

## JPEG continuation

PR #66 is merged and deployed to staging. Continue remote runtime verification
from `docs/runbooks/jpeg-intake-handoff.md`; do not reopen the completed merge
steps. Attachment/public delivery and the founder photo interface remain later
WP3 work. Existing generated/commissioned artwork is never replaced in place;
new #73 uploads are additive versions on the same stamp identity. WP4 remains imports.
