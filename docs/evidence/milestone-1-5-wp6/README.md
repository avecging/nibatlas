# Milestone 1.5 WP6 — map filter drawer and card/marker interaction

Screenshots of the four-way visit segment, the filter drawer as a transaction,
the applied count and one-tap clear, the separated card states, and the
card-to-marker highlight, at the three breakpoints `IMPLEMENTATION-PLAN.md`
names.

Recorded 30 August 2026, against the WP6 implementation record in
`docs/milestone-1-5-product-refinement.md`.

Regenerate with:

```sh
EVIDENCE=1 pnpm test:e2e --project=evidence tests/evidence/wp6-map-interactions.spec.ts
```

Name the spec. The `evidence` project holds every work package's suite, so
running it unfiltered also rewrites WP1–WP4's captures — and those are records of
reviews that already happened.

Every capture commits a viewport over Ginza first, so the result set is a real
committed search rather than the opening world view, and raises the mobile sheet
to Full because Peek deliberately shows no filters. The pointer is moved off the
results afterwards, so a resting state is captured resting rather than with a
card under the cursor. Animations are disabled at capture time. The captures are viewport-sized rather than full-page: the drawer
and the marker highlight are both positioned against the viewport.

## Naming

`<breakpoint>-<state>.png`

- `m` — 360 × 800
- `t` — 768 × 1024
- `d` — 1440 × 900

| State | What it shows |
| --- | --- |
| `filters-rest` | The resting filter row: All / Unvisited / Saved / Visited, and one **Filters** button |
| `filters-drawer` | The drawer open: shop type, availability, the recorded-status note, and **Clear** beside **Apply filters** |
| `filters-draft` | A draft held but not committed: two dimensions selected, the exact match count, and the results behind still unchanged |
| `filters-active` | After **Apply filters**: the count badge on the button, and **Clear filters** beside it |
| `card-states` | A card's states as separate facts: operational status about the shop, `Visited` where it applies, and `Saved` carried by its own control |
| `card-highlight` | A focused card and its marker highlighted together |

## What these are not

The 768 × 1024 and 1440 × 900 captures show responsive integrity only.
`docs/milestone-1-5-product-refinement.md` records the desktop treatment as not
designed and not approved; WP-D owns that, and nothing here is desktop sign-off.

The mobile `card-highlight` capture is taken with the results sheet at Full, so
the map — and with it the highlighted marker — sits behind the sheet. The marker
side of that synchronisation is legible in the tablet and desktop captures, and
is asserted directly in `tests/e2e/explore.spec.ts`.
