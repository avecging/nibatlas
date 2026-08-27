# Milestone 1.5 WP3 — the Passport's information architecture

Screenshots of both Passport modes, the redesigned cover, the contents index and
the enlarged impression, at the three breakpoints `IMPLEMENTATION-PLAN.md` names.

Regenerate with:

```sh
EVIDENCE=1 pnpm test:e2e --project=evidence tests/evidence/wp3-passport.spec.ts
```

Name the spec. The `evidence` project holds every work package's suite, so
running it unfiltered also rewrites WP1's and WP2's captures — and those are
records of reviews that already happened.

The spec is `tests/evidence/wp3-passport.spec.ts`. Device state — reviewer
choice, collection, remembered mode, whether the cover has been opened before —
is seeded before the first script runs, so each page resolves straight into the
intended state rather than being toggled after paint. Animations are disabled at
capture time so the frames are deterministic.

## Naming

`<breakpoint>-<state>.png`

- `m` — 360 × 800
- `t` — 768 × 1024
- `d` — 1440 × 900

## States

| Capture | What it shows |
| --- | --- |
| `list-empty` | A clean normal device. It says nothing has been collected, names where stamps come from in one line, and offers the map. No fake stamps, no locked silhouettes, no invented history |
| `list` | List mode with a collection: three counts, then per country its name, stamp count and country seal *as artwork* where earned, then per locality a subheading and rows of `thumbnail · shop name · local-script name · locality · date` |
| `list-locality` | `/passport/jp/chuo-tokyo` in List mode. A locality URL is its own destination, not the overview scrolled down |
| `book-cover` | The redesigned cover: textured passport stock, the issuing line at the top, the mark in the middle, `PASSPORT` below it and `VOLUME I` at the foot. The two decorative foil rules are gone. The way in is **Open**, in the pager — the floating button that overlapped the pill at 360 px is gone |
| `book-opening` | The opening spread — country seals on the left, the most recently collected locality on the right. Portrait reading opens on that locality, so the first thing a reader with stamps sees is their stamps |
| `book-index` | The contents spread: the identity page facing the country/locality index, with a leader rule and a page number per entry. Reached by the labelled **Contents** control rather than by paging |
| `book-locality` | A locality spread reached by its own URL, with no cover sequence first |
| `stamp-detail` | The enlarged impression: the stamp at a useful size, its tier, the shop name and local-script name, locality, country, local collection date, and **Open shop** |
| `seal-country` | The enlarged country seal: the artwork at size, **Country seal**, the country and the earned date. No shop fields and no **Open shop** — a seal is derived from visits, not one of them |
| `seal-locality` | The enlarged locality seal: the same, with the locality named as well as the country |
| `book-locality-seal` | The locality seal opened from the Book rather than from List. `book-locality` above shows the page it was pressed on, where the seal is selectable artwork with concise supporting text in place of WP3's text-only *Locality seal earned…* line |
| `identity-named` | The identity page with a display name from the account seam |
| `identity-fallback` | The same page with no display name: **Your Passport**. Never anything derived from an address |
| `book-reduced-motion` | The opening spread with reduced motion: no three-quarter tilt, no perspective, every page and control unchanged |
| `book-cover-reduced-motion` | The cover with reduced motion, for the same comparison |

## Scope

The 768 × 1024 and 1440 × 900 captures are evidence of responsive integrity
only. `docs/milestone-1-5-product-refinement.md` records the desktop treatment
as not designed and not approved, WP-D owns it, and nothing here is founder
sign-off on a desktop layout.

Material fidelity — paper texture, the stamping ceremony, the impression's
printed character — is WP5. The cover here is the approved WP3 *structure* plus
restrained grain and debossing, not WP5's full material pass.
