# Milestone 1.5 WP1 — reviewer-mode evidence

Paired screenshots of the same pages with reviewer mode **off** (what a
non-technical tester receives) and **on** (what internal review receives), at the
two breakpoints the founder's review covers.

Regenerate with:

```sh
EVIDENCE=1 pnpm test:e2e --project=evidence
```

The spec is `tests/evidence/wp1-reviewer-mode.spec.ts`. It seeds the device
choice before the first script runs, so each page resolves straight into the
intended mode rather than being toggled after paint. Reduced motion is emulated
so the captures are deterministic.

## Naming

`<breakpoint>-<screen>-reviewer-<off|on>.png`

- `m` — 360 × 800
- `d` — 1440 × 900

## Screens

| Screen | Route | What the pair shows |
| --- | --- | --- |
| `map` | `/` | The "Prototype sample" badge beside the result count is gone; reviewer mode adds a strip over the map with the marker, its exit control, and the basemap diagnostic |
| `shop` | `/shops/ginza-itoya-main-store` | One provenance sentence versus the full per-field source list, the *Map position* precision row, and the prototype-catalogue badge |
| `shop-omitted` | `/shops/skb-kaohsiung` | The same on a record with fields omitted, including the one opening-hours caution |
| `me` | `/me` | Four paragraphs of location explanation reduced to one sentence; milestone chips replaced by plain reasons; no prototype reset control; **About Nib Atlas** added |
| `passport` | `/passport` | Country seals without coverage-set version strings |
| `privacy` | `/privacy` | The fuller location explanation is retained in both modes; the build note is reviewer-only |
| `about` | `/about` | The WP1 destination. Product-facing only — there is no reviewer-only content beyond one note |
| `collect-preflight` | `/shops/nagasawa-penstyle-den` | The collection dialog: two short honest sentences plus a Privacy link, versus the same plus the diagnostic note |

## Scope

**The 1440 × 900 captures are evidence of the copy and visibility pass only.**
`docs/milestone-1-5-product-refinement.md` records the responsive desktop
treatment as *not designed and not approved*; WP-D owns that audit and it is
gated on founder desktop feedback. Nothing here is desktop sign-off.

Milestone 1's own evidence set remains in `docs/evidence/milestone-1/`.
