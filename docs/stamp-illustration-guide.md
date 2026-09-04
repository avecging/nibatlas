# Nib Atlas Stamp Illustration Guide

**Status:** Approved illustration and production direction  
**Version:** 1.0  
**Recorded:** 4 September 2026

This is the repository companion to the approved Nib Atlas Stamp Illustration
Guide deck v1.3. It records the decisions implementation and commissioned work
must preserve. Contract terms such as fees, revision rounds, deadlines and
licence scope belong in the individual commission contract.

## The job

A stamp answers: **why do I remember this?**

Nib Atlas already shows the shop, locality, country and collection date outside
the artwork. The illustration carries the memory: a counter, stairwell, repair
bench, ritual, strange object or other truthful detail of the visit.

Before drawing, agree one plain sentence that names the memory. Recognisable
people appear only with permission. Hands at a bench, a silhouette at a counter
or another unrecognisable figure will often carry it better.

## What every stamp contains

Every shop stamp, locality seal and country seal contains:

1. the correct name of the shop, locality or country;
2. one subject-specific detail;
3. one small truthful surprise for a closer look;
4. the illustrator's maker mark, drawn permanently into the artwork; and
5. exactly one approved Nib Atlas ink.

The illustrator chooses the maker mark and its position. Nib Atlas does not add,
move or replace it.

## The three levels

| Level | What the illustration should do |
| --- | --- |
| Shop stamp | Recall why this particular visit mattered. Draw the shop-specific thing a visitor remembers. |
| Locality seal | Use a resident-scale clue to the locality. A famous landmark is allowed when it is genuinely the strongest answer, but it is not the default. |
| Country seal | Give a broad, researched sense of the country without copying a flag, coat of arms, official seal or government device. |

Nib Atlas owns the motif register. Before work begins, Nib Atlas tells the
illustrator which motifs have already been used in that country.

## Shape and visual treatment

The master canvas is always `1200 × 800 px`, transparent and landscape (`3:2`).
The silhouette inside it may be circular, oval, arched, ticket-shaped, polygonal,
tall, wide or irregular. A portrait canvas is not currently supported, but a tall
silhouette may sit freely inside the landscape canvas.

There is no compulsory engraved-vintage house style. Flat, spare, graphic,
regionally grounded and richly hatched work can all belong to Nib Atlas. The
subject and local context choose the treatment.

Local imagery must be researched and respectful. Do not apply Japanese symbols
or a generic Japanese treatment to another place merely because station stamps
are one influence. Artwork must comply with applicable national rules,
copyright and personality rights.

## Ink

Use one approved ink at full strength, plus bare transparency. Hatching,
stippling and crosshatching may build tone. Do not use opacity, tints, gradients,
shadows or a second colour.

Approved inks are:

| Ink | Hex |
| --- | --- |
| Vermilion | `#C54B32` |
| Navy | `#102D46` |
| Teal | `#287A78` |
| Indigo | `#365E88` |
| Plum | `#6B3F63` |
| Moss | `#4F653F` |
| Ochre | `#846024` |
| Brick | `#8A4338` |

Colour does not indicate country, locality, shop, rarity, achievement or level.

## Two reading modes

List rows and book pages are browsing contexts. The detail overlay is the viewing
context. All three show the same approved artwork; the interface changes its
display size but does not redraw it.

At browsing size, the silhouette and one dominant form should distinguish the
stamp from its neighbours. At detail size, the full illustration and its small
surprise should reward closer inspection. If two stamps become interchangeable
when small, strengthen the big read rather than deleting detail.

The primary mobile list view is `78 CSS px`. On a `3×` phone that is `234` device
pixels. A two-device-pixel line on the `1200 px` master is
`2 × 1200 ÷ 234 = 10.26 px`, rounded up to `11 px`.

Use these production starting points:

- big-read lines: at least `11 px`;
- clear gaps between major forms: at least `11 px`;
- secondary detail: at least `6 px`;
- hatching marks: at least `4 px`;
- clear gaps between hatch marks: at least `6 px`.

These are legibility checks, not style limits. The final artwork is still tested
in the real list, book and detail views at relevant device densities. The
product's `0.3×` book floor is an emergency clipping state and does not set these
production values.

## What stays outside the artwork

The interface owns:

- shop/locality/country classification;
- collection date;
- translations;
- full **Illustrated by [name]** credit;
- accessibility text; and
- any other system or collection metadata.

Nib Atlas may place these beside the stamp. It must never crop, recolour,
translate over, draw over or otherwise alter approved artwork. Because level is
carried by the interface, artwork exported, shared or printed alone will not
identify its level. This is an accepted tradeoff.

## Delivery and approval

Deliver:

- editable source;
- clean SVG;
- outlined SVG; and
- transparent `1200 × 800 px` PNG.

The clean SVG contains no raster photographs, external fonts, scripts, filters,
network references, gradients, opacity shading or second colour.

The illustrator approves the exact final artwork and all exported files in
writing before release. The approval is attached to the actual version and file
checksums, not merely a concept image or screenshot. An exploratory submission
remains the illustrator's work unless a separate contract says otherwise.

Generated images may be used by Nib Atlas for internal moodboards and concept
references. Final commissioned artwork must be drawn by the illustrator.
