# Nib Atlas Agent Contract

Read these files before editing:

1. `PRODUCT.md`
2. `BRAND.md`
3. `UX.md`
4. `DATA-MODEL.md`
5. `ARCHITECTURE.md`
6. `IMPLEMENTATION-PLAN.md`

## Ownership

- ChatGPT Work: product direction, specifications, UX/design foundation, planning.
- Claude Code: frontend, responsive UI, map experience, Passport, components, design-system implementation.
- OpenAI Codex: backend, data model, APIs, PostGIS, auth/infrastructure, testing, engineering review.

Use the same repository and short-lived pull-request branches. Never silently change product invariants, MVP boundaries, schema/API contracts, migrations, CI, infrastructure, or root package configuration across ownership boundaries.

Fixture/demo data must be clearly marked and must never present invented business information as verified fact. Never commit credentials. Never store raw user coordinates.

If documentation and code conflict, stop and record the conflict in the PR. Product changes require an explicit decision; implementation details that preserve the contract may proceed with documented reasoning.
