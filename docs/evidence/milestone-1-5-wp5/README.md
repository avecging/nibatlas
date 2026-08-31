# Milestone 1.5 WP5 — impression, seal and responsive visual fidelity

Screenshots of the one impression family, the two seal anatomies, the shared
detail sheet, the corrected application frame, and the Passport's own navigation
inside the initial viewport — at the three breakpoints `IMPLEMENTATION-PLAN.md`
names, plus the reduced-height mobile screen the frame defect actually showed up
on.

Recorded 31 August 2026, against the WP5 implementation record in
`docs/milestone-1-5-product-refinement.md`.

Regenerate with:

```sh
EVIDENCE=1 pnpm test:e2e --project=evidence tests/evidence/wp5-impression-materials.spec.ts
```

Name the spec. The `evidence` project holds every work package's suite, so
running it unfiltered also rewrites WP1–WP4 and WP6's captures — and those are
records of reviews that already happened.

Every capture seeds the sample collection into the normal-mode device store, so
the Passport has something in it, and disables animation at capture time. The
captures are viewport-sized unless the table says otherwise: the frame is half
of what is under review, so cropping it away would hide it.

## Naming

`<breakpoint>-<state>.png`

- `m` — 360 × 800
- `t` — 768 × 1024
- `d` — 1440 × 900
- `s` — 360 × 568, the reduced-height mobile screen

| State | What it shows |
| --- | --- |
| `impression-list` | Shop impressions as List rows: the compact composition on its own sheet, with the date, place and provenance in real text beside it. Full page |
| `impression-book` | The same impressions pressed onto a book page, where the leaf is the paper and the plate contributes no stock of its own |
| `impression-detail` | The enlarged shop impression: tier overline and close control in the header, the impression on the enlarged plate, the facts, then **Open shop** |
| `seal-country` | A country seal at the head of its section. Element crop |
| `seal-country-detail` | The same seal enlarged: the Nib Atlas device, the double rule, a country and an earned date, and no **Open shop** |
| `seal-locality` | A locality seal beside its subheading. Element crop |
| `seal-locality-detail` | The same seal enlarged: cornered frame, the country named above the locality, and no **Open shop** |
| `shop-identity-plate` | The shop page's identity plate and its stamp watermark. Element crop |
| `shop-collected-impression` | The collected impression a shop page shows, through **View Atlas Stamp**. This is the artefact the enlarged Passport impression has to belong to the same family as |
| `long-name-list` | `Ginza Itoya Main Store` and `銀座 伊東屋 本店` in a List row and in an impression. Full page |
| `long-name-impressions` | `NAGASAWA Stationery Center Main Store` and `East District, Tainan` wrapping inside their own impressions rather than being shrunk onto one line |
| `frame-shop` | The shop page at rest |
| `frame-passport` | The Passport at rest, captured immediately after `frame-shop` on the same device so the two can be compared directly |
| `passport-initial-viewport` | The Passport in Book mode, closed, with nothing scrolled: the List/Book toggle, the pager with **Open** and **Contents**, and the section navigation all inside the first frame |
| `styleguide-impressions` | The styleguide's Atlas Stamps section: three tiers enlarged, the same three compact, the long-name specimens, and the eight motifs on an uncollected sheet. Element crop |

The `s` set is smaller on purpose: it carries the four states the reduced-height
defect touched — the closed book, the open book, the enlarged impression, and the
Shop/Passport framing pair.

## What to look at

**The family.** `impression-detail` and `shop-collected-impression` are the two
surfaces the founder's WP3 decision named. They are now the same sheet and the
same paper; what differs is the copy above the impression and the actions below
it, which is content rather than treatment.

**The anatomies.** `seal-country-detail`, `seal-locality-detail` and
`impression-detail` side by side: a shop stamp reads from the left with its own
motif to the right; a locality seal is centred with its country named above it;
a country seal is centred and led by the Nib Atlas device, because it is derived
rather than pressed at a place. No colour carries any of that.

**The frame.** `frame-shop` and `frame-passport` at each breakpoint were captured
back to back on the same device. The same header, the same gutter, the same
section navigation at the foot of the same viewport.

**The reduced-height screen.** `s-passport-initial-viewport` is the capture the
whole viewport correction is for. Before WP5, at this height the Passport was a
scrolling document around a fixed-size object and this pager sat about 140 px
below the fold.

## What these are not

The 768 × 1024 and 1440 × 900 captures show responsive integrity only.
`docs/milestone-1-5-product-refinement.md` records the desktop treatment as not
designed and not approved; WP-D owns that, and nothing here is desktop sign-off.
At and above 1024 px the Shop and Passport reading columns deliberately take
different measures, so `frame-shop` and `frame-passport` at `d` are a check that
nothing is broken rather than a claim that the two match.

Nothing here is a verified visit. The impressions come from the normal-mode
device store seeded for the capture, exactly as a tester's own would.
