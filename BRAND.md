# Nib Atlas Brand and Design Foundation

**Status:** Approved visual direction; implementation-ready and intentionally evolvable
**Version:** 1.4
**Last updated:** 31 August 2026

## Brand idea

Nib Atlas helps people find places where the fountain pen hobby can be experienced, then preserves those visits as a personal geographic collection.

> **Find the places. Make the journey. Keep the impression.**

The approved hybrid gives each visual influence a defined role:

1. **Identity — Contemporary Eki Atlas:** a half-nib / half-atlas symbol makes the product recognizable.
2. **Voice — Well-Travelled Passport:** editorial typography gives the collection maturity and permanence.
3. **Interface — Cartographer’s Field Journal:** warm, quiet surfaces make map exploration comfortable.
4. **Reward — Regional stamp art:** expressive ink impressions make verified visits memorable.

This is a living product design system, not a frozen corporate identity. Usability evidence may refine details, but the hierarchy above should remain intact.

## Positioning and personality

Nib Atlas is:

- exploratory;
- tactile but not skeuomorphic;
- quietly nostalgic;
- knowledgeable without gatekeeping;
- playful without being childish;
- international and locally respectful;
- contemporary enough for a dense map product;
- personal enough to feel worth keeping for years.

Nib Atlas is not:

- a generic luxury fountain-pen brand;
- corporate SaaS;
- Yelp, TripAdvisor, or a Google Maps clone;
- a Pokémon-style collection game;
- crypto/NFT collecting;
- a scrapbook covered in faux paper effects;
- a generic “Japanese” theme applied indiscriminately to Singapore and Taiwan.

## Logo direction

### Primary concept

The approved mark is a vertically split circular symbol:

- one half forms a fountain-pen nib;
- the other half forms an atlas/globe using a restrained latitude/longitude grid;
- the centre slit/breather detail creates the visual join;
- the circle reads equally as globe, seal, and stamp boundary.

The mark should feel drawn and owned, not assembled from a stock nib icon and a stock globe icon.

### Required production work

The deck concept is a construction direction, not final vector artwork. Before public launch, produce a custom SVG master and test it at:

- 16 px favicon;
- 24–32 px navigation mark;
- 48–64 px app/icon contexts;
- 120 px and larger brand/header contexts;
- one-colour stamp/imprint use.

At small sizes, simplify the globe grid and nib detail rather than allowing visual mud.

### Lockups

- **Primary horizontal:** symbol + `NIB ATLAS` wordmark.
- **Compact:** symbol only.
- **Editorial/Passport:** centred symbol above wordmark, optional tagline below.
- **One-colour:** Atlas Navy, Paper reversed, or Sumi. Vermilion is reserved for stamp/visited contexts, not the default corporate logo.

### Clear space and minimum size

- Clear space: at least the width of the nib breather hole around all sides.
- Minimum symbol size: 20 px digital after simplified small-size artwork exists; otherwise 28 px.
- Minimum full lockup width: 128 px.

Do not stretch, rotate, add gradients, add drop shadows, place on noisy photography, or use the symbol as an arbitrary map pin without the marker rules below.

## Typography

### Typeface roles

| Role | Primary | CJK fallback | System fallback |
| --- | --- | --- | --- |
| Editorial headings, Passport, collection dates | Source Serif 4 | Noto Serif JP, Noto Serif TC | Georgia, serif |
| UI, map labels, controls, body, metadata | Inter | Noto Sans JP, Noto Sans TC | system-ui, sans-serif |

Use variable font files where practical and self-host production webfonts to reduce layout shift and external dependencies.

### Typography rules

- Serif communicates place, memory, ceremony, and editorial hierarchy.
- Sans-serif handles dense, interactive, multilingual, and small text.
- Do not use serif for map controls, filters, form fields, long utility copy, or tiny metadata.
- Use uppercase sparingly for short country labels, stamp text, and overlines; never for paragraphs.
- Support Japanese and Traditional Chinese line breaking; never force letter spacing onto CJK text.
- Test long local shop names before approving layouts.

### Type scale

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `display` | 40/44 desktop, 32/36 mobile | Serif 600 | Major Passport/editorial moment |
| `h1` | 32/38 desktop, 28/34 mobile | Serif 600 | Page title |
| `h2` | 24/30 | Serif 600 | Section title |
| `h3` | 20/26 | Sans 650 | Component/section heading |
| `body-lg` | 18/28 | Sans 400 | Introductory copy |
| `body` | 16/24 | Sans 400 | Default content |
| `body-sm` | 14/20 | Sans 400–500 | Supporting content |
| `label` | 13/16 | Sans 600 | Controls and short metadata |
| `caption` | 12/16 | Sans 500 | Dates, sources, tertiary detail |

## Colour system

### Core palette

| Token | Hex | Role |
| --- | --- | --- |
| `paper-50` | `#FBF8F1` | Primary app background |
| `paper-100` | `#F3EDE1` | Raised paper surface, selected regions |
| `paper-200` | `#E5DAC7` | Dividers and warm borders |
| `atlas-900` | `#102D46` | Primary brand navy, high-emphasis text |
| `atlas-800` | `#183B57` | Hover/secondary navy |
| `sumi-950` | `#1C211F` | Primary text |
| `sumi-700` | `#4D5551` | Secondary text |
| `sumi-500` | `#737B76` | Muted metadata |
| `teal-700` | `#287A78` | Saved state and exploratory accent |
| `teal-100` | `#DCEBE7` | Saved-state surface |
| `vermilion-700` | `#C54B32` | Collected/visited impression |
| `vermilion-100` | `#F3DED4` | Collected-state surface |
| `indigo-700` | `#365E88` | Approved stamp-ink option |
| `plum-700` | `#6B3F63` | Stamp-collection action, and an approved stamp-ink option |
| `plum-800` | `#56324F` | Darkened Plum for collection hover/pressed |
| `brass-600` | `#98723D` | Rare ceremonial accent only |
| `white` | `#FFFFFF` | High-contrast surface where needed |

The everyday interface is dominated by Paper, Sumi, and Atlas Navy. Teal marks
intent/saving. **Plum marks the invitation to collect a stamp; Vermilion marks the
result** — the impression, the collected line, visited status, and the ceremony.
Stamp artwork may use approved palette inks independently of country or tier.
Brass is not a default button or status colour.

### Plum is the collection action, not the impression

Recorded 28 August 2026, from the founder's staging review of Milestone 1.5 WP4.

`Collect Stamp` was Vermilion before anything had been collected, which made an
invitation read as a warning and collapsed the action and its outcome into one
colour. The uncollected action is now solid Plum:

- **Reserved.** Plum is for stamp-collection actions. Nothing else in the
  interface may claim it.
- **It carries no data.** It does not indicate country, locality, rarity, tier,
  or the ink the shop's own stamp is printed in. A collection button is never
  coloured from a shop's `stamp.ink` — that palette is chosen blind, and reading
  it back out through a control would give it meaning it does not have.
- **After collection**, `View Atlas Stamp`, the collected line, the marker and the
  impression itself keep the existing restrained Vermilion visited treatment.
- **Centralized.** `plum-700` is declared once in the palette and consumed by two
  independent registries — the stamp inks and `action-collect`. Components use
  the semantic token; literal Plum values never appear in a component.

### Semantic UI colours

| Semantic token | Value | Usage |
| --- | --- | --- |
| `bg-canvas` | `paper-50` | App background outside the map |
| `bg-surface` | `white` | Cards, bottom sheet, menus |
| `bg-surface-warm` | `paper-100` | Passport/editorial sections |
| `text-primary` | `sumi-950` | Default text |
| `text-secondary` | `sumi-700` | Supporting text |
| `text-muted` | `sumi-500` | Tertiary metadata; verify AA at actual size |
| `action-primary` | `atlas-900` | Primary actions |
| `action-primary-hover` | `atlas-800` | Primary hover |
| `action-secondary` | `teal-700` | Save/planning actions |
| `action-secondary-text` | `teal-800` | Text-sized links, where `teal-700` misses AA at caption size |
| `action-collect` | `plum-700` | Stamp-collection action before collection. White text: 8.35:1 |
| `action-collect-hover` | `plum-800` | Collection hover/pressed. White text: 10.69:1 |
| `state-visited` | `vermilion-700` | Collected stamp and visited status |
| `state-saved` | `teal-700` | Saved status |
| `state-unvisited` | `atlas-900` | Unvisited marker outline/text |
| `focus-ring` | `#2477B3` | Keyboard focus; 2 px plus offset |
| `success` | `#2F7653` | Operational success, including a confirmed-open shop. Never visit state |
| `warning` | `#9A651D` | Caution/stale information; the icon on both amber states |
| `warning-surface` | `#F7EBD7` | Filled amber ground: a **confirmed closure**, the loudest status. Primary ink on it: 13.8:1 |
| `warning-soft` | `#CFA96F` | Soft amber outline: a status **nobody has confirmed**, quieter than a closure |
| `success-surface` | `#E3F0E6` | Pale ground behind a confirmed-open badge. Primary ink: 13.9:1; `success` on it: 4.7:1 |
| `error` | `#B33A32` | Destructive/error state |
| `disabled` | `#A9AEA9` | Disabled controls, paired with opacity/copy |

Never communicate status with colour alone. Pair it with shape, icon, label, or
pattern. Two worked examples: the Save bookmark carries its state in the glyph
(outlined versus filled), in `aria-pressed`, and in an accessible name that
changes between *Save shop* and *Remove saved shop*; an unconfirmed operational
status carries it in the alert icon and the words *Status not confirmed* as well
as in the amber outline.

### Operational status has three levels of attention

Recorded 30 August 2026, from the second staging review of Milestone 1.5 WP4.

| Status | Treatment |
| --- | --- |
| Open | `success` on `success-surface`, check icon |
| Temporarily / permanently closed | `warning` on `warning-surface`, alert icon — the loudest |
| Status not confirmed | `warning-soft` outline on the surrounding surface, secondary ink, alert icon |

A confirmed closure outranks everything: turning up to a shop that has closed is
the failure a shop page exists to prevent. An unconfirmed status is said plainly
and no louder — it is not a claim that anything is wrong. `Open` takes the success
green rather than the Teal saved token, because saving is something the reader
did and being open is something the world is doing.

### Derived interaction tokens

These implementation tokens are approved derivations of the core palette. They
support interaction and motion without expanding the primary brand colours.

| Semantic token | Value | Usage |
| --- | --- | --- |
| `state-visited-hover` | `#B0422C` | Darkened Vermilion hover step for visited and collected actions |
| `overlay-scrim` | `rgba(16, 45, 70, 0.42)` | Atlas Navy scrim behind modal dialogs |
| `shadow-nav` | `0 -2px 10px rgba(16, 45, 70, 0.06)` | Subtle separation above mobile navigation |
| `stamp-pressure-highlight` | `rgba(255, 255, 255, 0.42)` | Light edge of the stamp-pressure animation |
| `stamp-pressure-fade` | `rgba(255, 255, 255, 0)` | Transparent endpoint of the stamp-pressure animation |
| `shadow-overlay` | `0 24px 60px rgba(16, 45, 70, 0.32)` | The one depth every modal surface uses |

Keep these values centralized as semantic CSS variables. They are supporting
interaction values, not standalone colours for arbitrary component use.

### Impression material

Recorded 31 August 2026, from Milestone 1.5 WP5.

An Atlas Stamp is ink on paper, and the paper is part of the artefact. Before
WP5 each surface supplied its own: the collection ceremony drew a bordered paper
ground, the Passport's enlarged overlay drew the impression straight onto the
dialog, and List rows and book pages drew it onto whatever happened to be
behind. Three approximations of one idea, so the enlarged Passport impression
and the collected impression a shop page shows did not read as the same object.

The stock is now declared once and consumed by one shared plate.

| Semantic token | Value | Usage |
| --- | --- | --- |
| `impression-paper` | `passport-page` | The sheet an impression is pressed onto |
| `impression-paper-shade` | `#f4ecdc` | The shaded corner of that sheet |
| `impression-edge` | `rgba(16, 45, 70, 0.13)` | Its hairline edge |
| `impression-contact` | `rgba(16, 45, 70, 0.16)` | The contact shadow under a stamp being pressed |
| `impression-grain` | `rgba(16, 45, 70, 0.028)` | Paper tooth. Sub-pixel and widely spaced; never behind text |
| `impression-tilt` | `-2.4deg` | The one press angle in the system |

Rules:

- No component may put an impression on a ground of its own.
- Texture stays restrained. A book page is the one exception that carries no
  plate stock at all, because there the leaf *is* the paper.
- The tilt is the plate's only irregularity. The imperfect edge, the registration
  shift and the pressure mottle are drawn inside the impression itself.

## Map visual language

The basemap should be calm, pale, and cartographic—not faux parchment. Reduce commercial POI noise so Nib Atlas destinations remain legible. Preserve essential roads, transit, neighbourhood labels, water, and orientation cues.

### Marker states

| State | Shape | Colour | Additional cue |
| --- | --- | --- | --- |
| Unvisited | Outlined pin with nib slit | Atlas Navy on Paper | Open centre |
| Saved | Filled rounded pin with bookmark notch | Teal | Bookmark glyph/notch |
| Visited | Circular ink-seal marker | Vermilion | Check/impression texture |
| Selected | Existing state plus outer halo | Focus blue/Atlas Navy | 2–3 px halo and scale change |
| Cluster | Circular seal with count | Atlas Navy/Paper | Count label; visited composition may be shown subtly |

Rules:

- Selected is temporary interaction state, never a fourth persisted status.
- Visited takes precedence over saved for the main marker, while saved remains visible in shop UI.
- Keep marker silhouettes distinct at 24–32 px.
- Use consistent anchors and hit areas of at least 44 × 44 px.
- At dense zoom levels, cluster before markers overlap.
- Do not animate markers continuously.

## Stamp visual language

Atlas Stamps draw from eki stamps, passport impressions, rubber stamps, local architecture, landmarks, ink bottles, nibs, and stationery culture.

### MVP stamp system

- Templated but distinct: a shared construction system with local motif, locality label, shop name, and one approved ink from the global stamp palette.
- Use exactly one approved ink colour per stamp.
- Allow slightly imperfect edges, mild registration shift, and pressure variation.
- Preserve legibility at Passport-card size.
- Include shop identity, locality/country, and Nib Atlas provenance.
- Avoid heraldic clutter, fake official-government language, game rarity tiers, metallic gradients, neon effects, or NFT badge styling.

### Global stamp-ink rules

- The stamp system uses one shared eight-colour global palette.
- No colour belongs to a country, locality, shop tier, rarity, or achievement state.
- New countries do not require or introduce new colours.
- Tier is communicated through frame and stamp anatomy, never through colour ownership.
- Every generated stamp pins the palette version used so regeneration remains deterministic.
- Shop stamps are the primary collected objects.
- A locality seal is derived when the user's first verified shop stamp in that locality is acquired. If check-in is later introduced, it must emit the same canonical verified-visit event rather than create a parallel rule.
- A country seal is derived after five verified shop stamps in that country, or after the complete eligible curated set when that versioned set contains fewer than five shops.
- Once earned, a geographic seal is never revoked because the curated catalogue later expands.
- Milestone 1 may demonstrate these derived seals with selected real-shop prototype data; it must not imply unversioned global completeness.
- Dual-ink and spectrum/rainbow impressions are reserved future treatments. They must remain one coherent physical impression with irregular colour boundaries and pressure variation, not gradients or rarity tiers. The Taiwan Sun-Star Coiro reference supplied by the founder is the physical benchmark for this future direction.

### Three anatomies

Recorded 31 August 2026, from Milestone 1.5 WP5, as the working-out of "tier is
communicated through frame and stamp anatomy".

All three artefacts share one canvas, one tier overline, one foot — the local
date at the left, `NIB ATLAS` at the right — one ink treatment and one frame
weight. They differ in composition, and only in composition:

| Artefact | Composition | Frame |
| --- | --- | --- |
| Shop stamp | Asymmetric: the shop's name reads from the left, its own motif is pressed to the right | Rounded |
| Locality seal | Symmetric: the country named above, the locality's name centred, its motif centred beneath | Square, with corner ticks |
| Country seal | Symmetric, led by the Nib Atlas device | Double rule |

A **country seal carries the mark's own geometry rather than a motif**: a
simplified circle, meridian grid and nib breather, drawn as strokes at the
motifs' weight. A country seal is derived from verified visits and issued by Nib
Atlas, so borrowing a street motif from one of its shops would say something the
seal does not know. This is exactly the one-colour imprint context the logo
direction above already asks for simplified artwork in.

An impression drawn smaller than roughly 6 rem uses a **compact composition**:
the date, the provenance and the place line are dropped rather than pressed
illegibly, and what remains is set large enough to read. Every surface that uses
it states those facts in real text beside the impression.

Long shop, locality and country names **wrap inside the impression** rather than
being shrunk until they fit on one line.

### Regional respect

Local imagery must be specific and researched. Do not apply Japanese symbols to Taiwan or Singapore merely because the system is inspired by eki stamps. Motifs should come from the shop, neighbourhood, city, architecture, or local fountain-pen culture.

### Collection ceremony

- Duration target: 600–900 ms total.
- Sequence: poised stamp → quick press/impact → ink settles → date/place appears.
- One soft haptic cue where supported and user-permitted.
- No confetti, coins, rarity reveal, streaks, or prolonged celebration.
- Reduced motion: instant impression plus short opacity transition under 150 ms.

## Iconography

- Simple 1.75–2 px strokes at 24 px.
- Rounded joins but not cartoonishly soft.
- Recognizable utility icons for search, locate, filter, save, directions, accessibility, and hours.
- Custom nib/stamp icons only where they clarify a pen-specific concept.
- Do not use decorative icons as a substitute for labels on unfamiliar actions.

## Layout and UI tokens

### Spacing

Use a 4 px base unit:

| Token | Value |
| --- | ---: |
| `space-1` | 4 px |
| `space-2` | 8 px |
| `space-3` | 12 px |
| `space-4` | 16 px |
| `space-5` | 20 px |
| `space-6` | 24 px |
| `space-8` | 32 px |
| `space-10` | 40 px |
| `space-12` | 48 px |
| `space-16` | 64 px |

### Radius

| Token | Value | Use |
| --- | ---: | --- |
| `radius-sm` | 6 px | Chips, compact controls |
| `radius-md` | 10 px | Inputs, buttons, cards |
| `radius-lg` | 16 px | Bottom sheet and large panels |
| `radius-round` | 999 px | Pills, circular controls |

Avoid excessive rounded “SaaS card” styling. Passport stamp frames may use straighter 4–6 px corners.

### Borders and elevation

- Default border: 1 px `paper-200`.
- Strong divider: 1 px at 20–24% Atlas Navy.
- Card shadow: `0 4px 16px rgba(16,45,70,.10)`.
- Bottom-sheet shadow: `0 -8px 28px rgba(16,45,70,.16)`.
- Focus ring: 2 px `focus-ring` with 2 px Paper/White offset.
- Prefer borders and layering over heavy shadows.

### Motion

- Micro interaction: 120–180 ms.
- Sheet/panel transition: 220–300 ms.
- Easing: standard ease-out for entrances; ease-in for exits.
- Respect `prefers-reduced-motion` everywhere.

### Breakpoints

- Mobile baseline: 360 px.
- Compact tablet: 640 px.
- Desktop map/list split begins at 1024 px.
- Wide desktop max content width for non-map pages: 1280 px.

## Representative component treatments

### Map screen

- Map occupies the working canvas.
- Search uses a white/Paper surface with Atlas Navy text.
- Filters use compact chips; active filters use Atlas Navy or Teal depending on meaning.
- **Search this area** is a high-contrast Atlas Navy pill, visually detached from map controls.
- Bottom sheet is a clean white surface with a subtle warm border; texture is not applied behind dense lists.

### Shop card

- Clear name and locality first.
- Type and specialty metadata in sans-serif.
- Saved and Visited states use both icon and text.
- One restrained image; no marketplace-like price or inventory treatment.

### Shop page

- Editorial serif title, practical sans-serif facts.
- Primary actions: Save, Directions/official site, Collect Stamp when eligible.
- Opening-hours uncertainty and last checked information are visible without dominating.

### Passport

- Warm Paper surface and stronger serif hierarchy.
- Country/locality dividers feel archival but remain modern.
- Stamp artwork supplies most colour.
- Empty states invite exploration without showing locked mystery rewards.

## Accessibility and implementation rules

- Meet WCAG AA contrast at the final text size and background.
- Use semantic HTML and visible labels.
- All map operations must have non-map/list equivalents.
- Touch targets are at least 44 × 44 px.
- Support keyboard selection between list and markers where technically practical.
- Test English, Japanese, and Traditional Chinese shop names.
- Do not place texture behind maps, inputs, small text, or dense data.
- Implement all values as semantic CSS variables/design tokens; do not scatter literal hex values.
