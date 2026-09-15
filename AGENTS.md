# Nib Atlas Agent Contract

## Start here

Read this contract and the current-work section of `IMPLEMENTATION-PLAN.md`.
Use `docs/README.md` to select only the documents relevant to the assigned task.
Do not read every foundation document by default. Historical documents and
`docs/evidence/` are not current instructions. Read the preserved M1.5 refinement
record only when the founder explicitly asks; its file is intentionally unchanged.

## Responsibilities

- GPT (including Astra and Sol) owns implementation end to end: frontend,
  backend, database, infrastructure, tests, documentation and integration.
- The implementer initiates independent review under the policy below. Claude
  is an optional reviewer, not a required reviewer for every PR.
- The founder decides product direction and scope. A conductor/orchestrator has
  not been onboarded; do not assume one exists or wait for it.

Use one repository and short-lived PR branches. Inspect current main, the task's
branch, CI and reviews before continuing existing work. Coordinate concurrent
changes to migrations, shared contracts, generated types, CI and package/runtime
configuration. Do not silently change product invariants or expand the task.

## Independent review

- For meaningful code changes, the implementer automatically starts a fresh
  reviewer agent when available; no founder prompt is needed. Minor documentation
  corrections need proportionate accuracy/link/diff checks, not a second agent.
  Material changes to agent policy or security/product contracts also get review.
- Give the reviewer the founder's requirements and approved decisions, relevant
  contracts, base/head or working diff, and test evidence. Prefer fresh context
  over the implementer's conversation. The reviewer must inspect source and
  verify claims independently; the implementer's explanation is not proof.
- Review correctness, regressions, security/privacy, data integrity, accessibility,
  unnecessary complexity and missing meaningful tests. Report actionable findings
  with severity, location, concrete impact and evidence or reproduction where
  feasible. Separate optional suggestions from blockers. Do not invent findings,
  demand unrelated work or reopen settled product decisions. Neither agreement
  nor criticism is required; "no actionable findings" is a valid result.
- Review agents report findings without editing the implementation. The implementer
  fixes supported findings, records evidence for disagreements and requests a
  focused recheck of substantial fixes. Do not dismiss serious findings without
  evidence or loop through cosmetic reviews indefinitely.
- Authentication, authorization, migrations, privacy, uploads and stamp integrity
  require deeper review of affected boundaries and tests. Consider another model
  such as Claude when available; cross-model review is not a universal gate.
  Founder visual acceptance remains separate from technical review.
- Resolve routine technical corrections autonomously. Escalate product decisions
  and unresolved material disagreements to the founder. If independent review
  cannot be obtained, report that limitation; do not relabel self-review as
  independent review or waive required repository gates. Finish reviewable work.
- Record the reviewed revision/diff and limitations. Before an authorized merge,
  check final-head CI and whether later edits invalidate earlier review. This
  policy does not itself authorize merging, deployment or external messages.

## Working and verification

- Use targeted searches and reads; reuse unchanged information from the session.
- Implement the smallest coherent authorized change. Avoid unrelated refactors,
  repeated summaries, speculative work and unnecessary new documents.
- Reuse a healthy development server. Restart only for configuration/dependency
  changes or a diagnosed failure; never start duplicate servers to evade a port
  conflict. Diagnose a failed command before repeating it.
- Run relevant checks first; broaden for affected risks and required gates.
  Do not rerun unchanged passing checks or the whole suite after every small edit.
- Before merge, inspect the final head's required CI and review outcome. Do not
  claim a reviewer checked work unless that review actually happened. Report local,
  CI, staging and founder acceptance separately, including anything untested.
- Update the authoritative contract/runbook when behavior changes. Keep completed
  investigation detail in PR history rather than copying it into many documents.

## Product boundaries

Preserve anonymous map-first discovery, explicit **Search this area**, and
**Map / Passport / Me** navigation; Saved is a global Map-owned mode. Visited
outranks Saved only for marker presentation; filters read the independent sets.
Do not add marketplace, social, merchant, itinerary or other deferred scope.

Keep Passport private by default, collection server-controlled and idempotent,
and historical impressions immutable. Raw user coordinates must never be stored
or logged. No credentials in source, chat, issues, evidence or logs. Preserve
current-role checks, RLS, audited writes, same-origin mutation checks, private
staging/production separation and versioned artwork approval. Approved artwork
stays intact and credited; transport validation is not approval or publication.
Consult the relevant API/runbook for exact limits rather than inferring them here.

### Data honesty

Approved product clarification, 26 August 2026: decision 1 in the preserved
`docs/milestone-1-5-product-refinement.md` (reference only; no default reread).

Invented businesses, and invented facts about real businesses, must be clearly marked as fixture or demo data and must never be presented as verified.

A record for a **real** business whose unsupported fields are omitted rather than filled in is not invented data, and satisfies this invariant with **one accurate subordinate provenance line** on the page — naming every source kind the record actually rests on, and a date the reader can rely on. Where the sources were read on one day, the line may say it was checked then; where they were read on different days it must name the oldest date **as the oldest** rather than implying every source was read on it. No global prototype or fixture badge is required on a surface built only from such records; a badge on every screen makes the product unreadable to a non-technical tester without making it more honest. Implementation identifiers such as a `prototype*` module namespace are not evidence that the businesses are invented.

Where a record's own sources do not support a claim the surrounding copy would imply — a public shopfront, an address, opening hours — the page must say so or omit the claim. Product copy must never generalise across records in a way that is false for one of them.

## Conflicts

The founder's explicit task and approved decisions govern scope. Current product
invariants and feature contracts govern intended behavior; code and CI establish
what is implemented and tested. Historical notes do not override current rules.
If these disagree materially, record the conflict and pause the affected change
for a decision; continue independent authorized work. Do not silently treat a
code defect as a new product rule. Implementation details that preserve the
contract may proceed with documented reasoning.
