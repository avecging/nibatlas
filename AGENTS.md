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

### Data honesty

Invented businesses, and invented facts about real businesses, must be clearly marked as fixture or demo data and must never be presented as verified.

A record for a **real** business whose unsupported fields are omitted rather than filled in is not invented data, and satisfies this invariant with **one accurate subordinate provenance line** on the page — naming every source kind the record actually rests on and the date by which all of them had been checked. No global prototype or fixture badge is required on a surface built only from such records; a badge on every screen makes the product unreadable to a non-technical tester without making it more honest. Implementation identifiers such as a `prototype*` module namespace are not evidence that the businesses are invented.

Where a record's own sources do not support a claim the surrounding copy would imply — a public shopfront, an address, opening hours — the page must say so or omit the claim. Product copy must never generalise across records in a way that is false for one of them.

Recorded as an approved product clarification on 26 August 2026, consistent with accepted decision 1 in `docs/milestone-1-5-product-refinement.md`.

Never commit credentials. Never store raw user coordinates.

If documentation and code conflict, stop and record the conflict in the PR. Product changes require an explicit decision; implementation details that preserve the contract may proceed with documented reasoning.
