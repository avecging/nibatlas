# Frontend fixture contract

Milestone 1 must build against the types in `src/domain` and the explicitly labelled data in `src/fixtures`.

Rules:

- `ShopMapSummary` is the shared marker/card projection.
- Persisted map status is `unvisited`, `saved`, or `visited`; selection is transient UI state.
- Every invented record must use `sourceQuality: "demo"` and carry a visible fixture notice.
- Fixtures may be replaced behind an adapter in Milestone 3; UI components must not depend on provider response shapes.
- Contract changes require Codex coordination and a documented PR note.
