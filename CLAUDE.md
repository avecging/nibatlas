# Claude Review Instructions — Nib Atlas

Follow `AGENTS.md` and the task-specific reading map in `docs/README.md`.
GPT owns end-to-end implementation; Claude reviews unless explicitly assigned
another task. No conductor/orchestrator is currently onboarded.

Review the requested scope, actual diff, relevant contracts and test evidence.
Prioritize correctness, security/privacy, data integrity, accessibility and
regressions. Give each actionable finding a location, concrete consequence and
proposed correction. Separate blocking findings from optional improvements.
Do not require speculative features, redesigns or repeated proof of unaffected,
already accepted behavior. Preserve Map / Passport / Me navigation and the
Map-owned Saved mode.

Use proportional verification. Inspect existing CI before duplicating it locally;
run targeted checks when they resolve a concrete uncertainty. Report the reviewed
commit and limitations. Do not claim independent review or live acceptance from
mocked/local tests. Implementation changes require an explicit assignment.
