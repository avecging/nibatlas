# Milestone 1.5 WP4 — sourced pen-specific shop value

Screenshots of the reordered shop page, the interim identity treatment, the
material-gap state, and the populated value layer, at the three breakpoints
`IMPLEMENTATION-PLAN.md` names.

**Regenerated 28 August 2026** after the founder's staging review: the actions are
back in the header with Save as a bookmark beside the name, `Collect Stamp` is
Plum before collection and the Vermilion visited step after it, unknown
operational status is an amber caution, nearby shops sit inside *Getting there*,
and the fragmented practical cards are one *Plan your visit* section in a single
reading column.

Regenerate with:

```sh
EVIDENCE=1 pnpm test:e2e --project=evidence tests/evidence/wp4-shop-value.spec.ts
```

Name the spec. The `evidence` project holds every work package's suite, so
running it unfiltered also rewrites WP1's, WP2's and WP3's captures — and those
are records of reviews that already happened.

Device state is seeded before the first script runs, so each page resolves
straight into the intended state rather than being toggled after paint.
Animations are disabled at capture time. The captures are full-page, so the
fixed bottom navigation appears once at its viewport position rather than at the
foot of the image.

## Naming

`<breakpoint>-<state>.png`

- `m` — 360 × 800
- `t` — 768 × 1024
- `d` — 1440 × 900
- `s` — specimen, captured at 900 px wide

## States

| Capture | What it shows |
| --- | --- |
| `shop-sourced` | Ginza Itoya, the fullest record in the catalogue, and the sparse-desktop case: identity plate with the Save bookmark, local-script name, why-visit sentence, the actions, the value section, `Plan your visit`, provenance and the correction route — one reading column, with no empty grid cell where an unsourced section would be |
| `shop-nearby` | Aesthetic Bay, which has a catalogue neighbour placed from a sourced street address: the trip context inside *Getting there*, with `Approx. 550 m away` and no separate distance disclaimer |
| `shop-gap` | SKB, the thinnest record: the amber `Status not confirmed` caution, one caution for the unknown value layer, one for the unpublished hours, no invented address, and no `Getting there` heading over an empty subsection |
| `shop-visited` | Pen House with an impression already collected: `View Atlas Stamp` on the restrained Vermilion visited surface, the collected line, and the Visited badge — the outcome colours, none of them the Plum invitation |
| `header-actions` | The revised header on Aesthetic Bay, above the fold: the Save bookmark beside the name, then Directions and the Plum `Collect Stamp` |
| `s-value-layer-specimen` | The populated value layer and the empty one, side by side on `/styleguide`. Drawn from a specimen record marked as invented, because no source in the prototype catalogue publishes a service, an in-store experience or a shop-only item |

## What these are not

Not desktop sign-off. `docs/milestone-1-5-product-refinement.md` records the
responsive desktop treatment as not designed and not approved; WP-D owns it, and
the 768 and 1440 captures here show responsive integrity only.

Not a claim that the catalogue carries pen-specific content. Every real shop page
shows the gap state, because no source in the catalogue supports a service, an
in-store experience, a shop-only item, a station, a payment method or a language,
and accepted decision 4 forbids inventing them. Populating the layer is a
sourcing task shared with the founder and Codex.
