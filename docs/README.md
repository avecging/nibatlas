# Documentation reading map

Read `AGENTS.md`, then the current-work section of `IMPLEMENTATION-PLAN.md`.
Choose the relevant row below; read other files only for a concrete dependency.
Rules are shared by Astra, Sol and Claude; no model-specific copies are needed.

| Task | Read |
| --- | --- |
| Scope/product decision | `PRODUCT.md`; relevant `UX.md` section |
| UI/design | Relevant `UX.md` and `BRAND.md` sections |
| Passport | `docs/passport-interaction-spec.md`; `docs/api/collections-v1.md` for account state |
| Stamp illustration | `docs/stamp-illustration-guide.md`; `BRAND.md` for product/design authority |
| Public catalogue/API | `docs/api/v1-shop-reads.md`; database RPC detail in `docs/api/milestone-2-read-contract.md` |
| Fixtures/domain mapping | Relevant sections of `docs/api/fixture-contract.md`; current domain types |
| Auth/saves | `docs/runbooks/auth-local-staging.md`; `docs/api/saved-shops-v1.md` |
| Collection/verification | `docs/api/stamp-verification-v1.md`, `docs/api/collections-v1.md`; operations in `docs/runbooks/stamp-verification.md` |
| Shop administration | `docs/api/admin-shops-v1.md`, `docs/adr/0012-shop-administration.md`; founder steps in `docs/runbooks/shop-administration.md`; open frontend/backend boundary in `docs/api/admin-b3-contract-handoff.md` |
| Bulk onboarding / import preview | `docs/api/admin-import-v1.md`; shared validation/publication in `docs/api/admin-shops-v1.md` |
| Roles/audit | `docs/runbooks/admin-authorization.md` |
| Media/uploads | `docs/api/admin-media-v1.md`, `docs/runbooks/media-uploads.md`; illustration guide for artwork |
| Database | Relevant `DATA-MODEL.md` section, migrations and SQL tests; directory READMEs for execution |
| Local checks | `docs/runbooks/local-development.md`; actual package scripts and CI workflow |
| Deployment | `docs/runbooks/staging-deployment.md`; feature-specific setup runbooks |
| Contributions | `docs/runbooks/contribution-intake.md` |
| Phone collection test | `docs/runbooks/staging-phone-test.md` only when testing/reviewing that acceptance |
| Closed beta | `docs/runbooks/closed-beta-access.md` (planned; dashboard state must be verified) |
| Licensing/public contributions | `NOTICE.md`, `CONTRIBUTING.md`, `SECURITY.md` |

## Authority and history

Current product rules belong in the foundations; wire/security behavior belongs
in feature API contracts; operational steps belong in runbooks. ADRs explain
specific engineering decisions; their dated agent/owner assignments are historical
and do not override current `AGENTS.md` responsibilities. Their technical decisions
remain applicable unless superseded. The implementation plan sequences work and does
not replace any feature contract. Follow `AGENTS.md` when these disagree.

The following are historical, not required reading or current instructions:

- `docs/milestone-1-5-product-refinement.md`: preserved verbatim by founder
  instruction. Deprecated as an agent entry point; read only if explicitly asked.
- `docs/milestone-1-prototype-acceptance.md` and
  `docs/frontend/milestone-1-interaction-prototype.md`: original prototype briefs.
- `docs/evidence/`: evidence of named past reviews, not today's UI or new acceptance.
  Do not regenerate historical captures as routine verification.

`docs/future/` contains deferred ideas, not implementation requirements.
JPEG runtime verification continues from `docs/runbooks/jpeg-intake-handoff.md`;
the code is already merged and deployed to staging. Passport animation polish and
the opening-geometry decision are deferred until after launch in [issue #68](https://github.com/avecging/nibatlas/issues/68).
Keep the current animation until that work is scheduled.
