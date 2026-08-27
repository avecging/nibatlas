# Milestone 1.5 WP4 — sourced pen-specific shop value

Screenshots of the reordered shop page, the interim identity treatment, the
material-gap state, and the populated value layer, at the three breakpoints
`IMPLEMENTATION-PLAN.md` names.

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
| `shop-sourced` | Ginza Itoya, the fullest record in the catalogue: identity plate, local-script name, why-visit sentence, the value section, address and official site, published hours, actions, provenance, correction route |
| `shop-nearby` | Aesthetic Bay, which has a catalogue neighbour placed from a sourced street address: the trip-context section with a straight-line distance and the note saying so |
| `shop-gap` | SKB, the thinnest record: one caution for the unknown value layer, one for the unpublished hours, no invented address, and nothing else claimed |
| `shop-visited` | Pen House with an impression already collected, so the visited state and the collected line are in frame |
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
