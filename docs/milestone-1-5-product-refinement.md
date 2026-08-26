# Milestone 1.5 — Production-like product refinement

**Status:** Founder-approved direction. Not yet implemented.
**Recorded:** 26 August 2026
**Owner:** Claude Code (frontend), with founder and Codex on sourcing
**Depends on:** Milestone 1 (PR #5) landing as the corrected technical foundation

## Why this milestone exists

Milestone 1 was reviewed on staging by the founder as an ordinary user. The
interaction foundation held up; the product did not. It read as mid-fidelity,
generic, over-explanatory, and not something to hand to a non-technical tester.

This document records the root-cause analysis, the accepted direction, and the
work packages. Milestone 1 (PR #5) is explicitly **a technical interaction
foundation**, not a design direction to defend.

## Root causes

The founder's sixteen observations reduce to five causes plus two semantic
errors.

### A. Built to the acceptance checklist rather than to the experience

Almost every line of `docs/milestone-1-prototype-acceptance.md` is satisfiable by
rendering the requirement itself. "Show a prototype data notice" became a badge
on every screen. "Explain location and check-in" became four paragraphs in Me.
"Do not imply completeness" became a coverage-set version string on the page.
"Coordinates are unsurveyed" became a *Map position* row. Each is individually
defensible in review, and together they produce an interface that narrates its
own compliance instead of being self-evident.

### B. Reviewer instrumentation and product surface are the same surface

Prototype badges, the word "simulated", "Arrives in Milestone N" chips, the
prototype reset control, coverage-set version strings, coordinate precision — all
of it is scaffolding for the founder and Codex, and all of it ships to the
tester. A non-technical tester cannot tell the product from its instrumentation,
so their feedback will be about the instrumentation.

### C. Data thinness was answered with disclosure instead of design

Sourcing is thin and no image rights exist. Milestone 1 solved that by telling
the user about the gap on every record. The correct response was to design a shop
page whose value does not depend on the missing fields, and keep provenance
available but subordinate.

### D. The shop record is structurally a directory entry, not a hobby guide

The founder's prototype models what a visitor can *do*: services with an access
mode and duration ("Nib alignment & tuning — walk-in, ~30 min"; "Custom grind —
booking, 3–5 days"), in-store experiences ("Test bench — 40+ nibs, free, no
appointment"), in-store-only items ("House ink — Bench No.4, in-store only"),
plus nearest station and walking time, building and floor notes, payment methods
and languages spoken.

Milestone 1 models name, address, hours, brands and links. That is the shape of a
general mapping listing, so it reads as one. This is the single most important
item in the review.

### E. The Passport has one mode and no navigation model

The book was built and the founder's List view, country/locality index and
stamp-detail overlay were dropped. Locality stamps exist — they are most of the
pages — but nothing links to them and nothing enlarges them. The opening spread
is identity plus seals, so a user with six stamps opens their Passport and sees no
stamps at all. The founder's prototype opens on country seals plus a city of shop
stamps.

### F. State colour leaked into achievement colour

Vermilion means *collected / visited* on a marker. As a filled red chip labelled
"Country seal earned" it reads as an alert to dismiss, while genuine danger
(Delete account) is styled as an ordinary row. The two are inverted.

### G. Fidelity was pursued through motion rather than material

Page turns and the ceremony are correct and well-timed, but there is no texture,
no imagery, and no stamp at readable size. "Too polished" means graphically tidy
and materially flat — not a typeface problem.

## Accepted decisions

These are settled. Implementations must not relitigate them.

### 1. Fixture and prototype labelling

Real-shop records with unsupported fields omitted, plus **one subordinate
provenance line**, satisfy the honesty requirement in `PRODUCT.md` and
`AGENTS.md`. Normal users do not need prototype badges on every screen.

- Omit ordinary unknowns silently. Do **not** replace every omitted field with
  "information is being researched".
- Where missing information **materially affects a visit**, use one concise
  caution.
- Near the bottom of each shop page, one contribution invitation:
  *"Know this shop? Help us improve this listing."* It may link to
  `mailto:hello@nibatlas.com` until the contribution flow exists.

### 2. Collect Stamp on staging

The action stays visible with honest, natural product copy. No long simulation
explanations in the user path. Diagnostic wording and controls move into reviewer
mode.

### 3. Reviewer mode

A URL parameter remembered per device:

- `?review=1` enables it.
- `?review=0` disables it.
- Normal staging and closed-beta access default to production-like mode.
- Reviewer mode is for the founder and development reviewers, not every beta
  tester.

Cloudflare Access remains the separate mechanism controlling who may enter the
closed beta; see `docs/runbooks/closed-beta-access.md`.

### 4. Pen-specific sourcing

Shared between the founder and Codex. Claude Code may define the optional schema
and the sourcing rules, and must **not** invent services, experiences,
exclusives, or practical details.

### 5. Photography

Development does not pause for permission requests. Use a deliberately designed
interim hero carrying the Nib Atlas mark, the shop identity, and a restrained
"Photos coming soon" treatment. Do **not** render repeated empty gallery slots.
The founder continues research and permissions separately.

Worth recording: the founder's own prototype had no photographs either — it used
`linear-gradient(135deg,#EFE9DC,#E2D9C9)` with a photo-count badge and a 1+2
gallery with a "+N more" overlay. The difference was that it was *designed to look
like a product*, where Milestone 1 looks like a missing asset. This is a design
problem, not a licensing one.

### 6. Passport

- Toggle order: **List on the left, Book on the right.**
- Production-like mode defaults to **List** unless the user has chosen otherwise.
- Reviewer mode may default to **Book**, because the physical interaction needs
  review.
- Remember the user's last selected mode per device.
- Opening spread: **country seals plus the most recent locality.**
- The first-ever Book visit may show and open the cover; later visits resume the
  previous spread.
- The optional display name appears on the inside identity page, with
  **"Your Passport"** as the fallback. Never derive a name from an email address.
- **No handwriting fonts.** Continue with strong serif typography plus material
  texture.
- Remove the decorative foil border; make the cover resemble contemporary
  textured passport stock.
- Country/locality navigation and enlarged stamp detail are Milestone 1.5 work.

### 7. Distance and Near Me

Deferred. Do not build the location-permission path in this milestone.

### 8. Contribution routing

Until Milestone 6:

- **Suggest a pen shop** → pre-addressed email to `hello@nibatlas.com`, subject
  `[Suggest shop]`.
- **Report incorrect information** → the same address, subject
  `[Shop correction]`, including the relevant shop name where possible.

The dedicated `/suggest-shop` form is a later implementation.

### 9. Scope

WP1–WP7 below are Milestone 1.5. PR #5 must not grow indefinitely.

### 10. Technical foundation

Preserve the committed-bounds camera model, the page/leaf geometry, the seal
derivation approach, the data seams, and the other sound foundations unless a
concrete defect requires modification.

## Proposed experience

### Map

Search, then map, then results. Filters move behind a labelled filter button
opening a drawer, following the founder's prototype `.fsheet`, with an
active-count badge. Status becomes a three-way segment (All / Saved / Visited);
shop type and availability live in the drawer. Cards lead with a shop identity
block and one *specific* line ("Same-day nib alignment", "Ink wall, 300+
bottles") rather than a category name. No prototype badge anywhere.

### Shop detail

A visual header, then: identity and local-script name → one line on why it is
worth the trip → **what you can do there** → **what is only available here** →
practical access (station and walking time, building or floor note, payment,
languages, hours) → actions (Save · Directions · Collect) → a quiet provenance
line and the contribution invitation.

Directions open the platform's own maps application. The *Map position* row is
removed from the user surface.

### Passport

Two modes over one collection, per accepted decision 6.

### Me

Compact, two distinct states, no milestone labels, no reset control, no essays.

## Visible versus reviewer-only

**Moves into reviewer mode:** prototype and demo badges; the word "simulated";
"Arrives in Milestone N" chips; the prototype reset control; coverage-set version
strings; coordinate-precision rows; per-field source lists with retrieval dates;
the offline-basemap attribution line.

**Stays visible, as product copy:** one provenance line per shop page ("Details
from the shop's own website, checked 26 August 2026"); **Report incorrect
information**; an **About Nib Atlas** entry covering what the catalogue is and its
current coverage; one sentence about location at the moment it is requested, with
the full text on the Privacy page.

## Revised Passport information architecture

**List mode** — three stat cards; then per country: country name, stamp count,
and the country seal *as artwork* when earned; then per locality a subheading and
rows of `stamp thumbnail · shop name and local name · locality · date`. This is
where finding things happens, and it is the accessible baseline when 3D
transforms are unavailable.

**Book mode** — the object. Opening spread is country seals (left) plus the most
recent locality (right). Identity moves to the inside front cover.

**Country / locality navigation** — three routes into a locality: List mode; a
country/locality index spread in the book; and deep links from Me's Places
Visited. `/passport/[country]` and `/passport/[country]/[locality]` become real,
linked destinations rather than orphaned routes.

**Stamp enlargement** — tapping any stamp in either mode opens a detail overlay:
the impression at large size, tier, shop and local name, locality and country,
collection date, and **Open shop**.

**Cover behaviour** — the first-ever visit plays the cover opening once;
afterwards Passport lands on the last spread read, with a **Cover** control to
return to it. Recorded for accuracy: the founder's stated justification for the
cover — choosing among many passports — is the deferred Library concept in
`docs/future/passport-library.md`. The cover's real value in Milestone 1.5 is the
first-run moment.

**Cover design** — remove the two foil rule frames; add cover-stock grain and a
debossed emboss; restructure as a passport does, with an issuing line at the top,
the mark in the middle, `PASSPORT` below, and `VOLUME I` at the foot.

**Returning users** — last mode, last spread, last scroll position. Returning
from a shop lands on that stamp's page in either mode.

## Revised Me structure

**Signed out** — sign-in invitation (one line on what an account adds) · Places
visited, if local stamps exist, linked into Passport · Preferences and
accessibility · **On this device** (what is stored locally, that it does not sync
and is lost if browser data is cleared or the PWA is removed, Download local
data, Clear data on this device) · **Contribute** (Suggest a pen shop, Report
incorrect information) · Privacy · Help · About Nib Atlas.

**Signed in** — optional display name and account identity · **Places visited**,
compact and clickable, where a country entry opens that country's Passport
section or filtered List view · Preferences and accessibility · Privacy and your
data (export, download) · Contribute · Help · About · Sign out · then a separated
**Danger** group with **Delete account** in `--error`, behind a confirmation.

Anonymous users may save shops and preferences locally on that browser or device,
with a clear explanation that local data does not sync and can be lost. On
account creation, offer to merge eligible local saves and preferences. Real
verified stamp collection may still require an account; do not invent anonymous
verification or migration rules.

## Shop pages beyond a generic listing

Additions to the shop record, all optional and all sourced:

| Field | Why it matters |
| --- | --- |
| Services with access mode and duration | Separates a repair bench from a shelf |
| In-store experiences | Test bench and nib count, ink wall and sampling policy, paper library, clinics and whether they need booking |
| Only available here | Shop-exclusive inks and limited editions — the reason a pen traveller detours, and the field a general listing can never have |
| Getting in | Nearest station with walking time, and the building or floor note that actually matters |
| Practical | Payment methods, languages spoken, appointment requirement |
| Nearby pen shops | Walking time between them: trip-shaped without being an itinerary |
| Your impression | The collected stamp shown on the shop page |

Sourcing is shared with the founder and Codex per accepted decision 4. Claude
Code defines the schema and never invents entries.

## Where the review was modified rather than accepted

Recorded so the reasoning is not lost.

- **Handwriting font — declined for structure and UI.** Shop names include
  銀座 伊東屋 本店 and 文寶房名品. No handwriting face covers Japanese and
  Traditional Chinese at quality, so fallback would be inconsistent precisely on
  the names that matter most, and `BRAND.md` rules out the faux-paper scrapbook
  direction. "Too polished" is addressed with cover grain, paper texture,
  off-register impressions, ink bleed and denser page furniture. A handwriting
  face may be revisited only for genuinely user-authored content.
- **"Passports do not have borders" — accepted with a correction.** The two foil
  rules go. But the target is textured cover stock, an issuing-authority line, a
  mark, the word PASSPORT and an e-passport symbol — that structure plus texture,
  not simply deleting the frame.
- **Cover open/close — accepted as first-run only,** not removed, per accepted
  decision 6.
- **Set-progress pips from the prototype — declined.** The prototype's
  `cityMine: 2 / cityAll: 24` is an unversioned completeness denominator, which
  `PRODUCT.md` lists as an invariant violation: `x / y` only where the curated
  set is explicitly defined and versioned. Plain counts, with a denominator only
  for curated country sets.
- **Distance and "at the door" — deferred,** per accepted decision 7. Map-first
  exploration with no permission request is a product invariant.
- **Unlicensed photography — declined even on staging,** per accepted decision 5.

## Required audit: responsive desktop treatment

**Status: not designed, not approved.**

The founder's review covered the mobile staging experience. Desktop feedback has
not been supplied. Milestone 1.5 therefore includes a **required desktop audit**
covering at minimum:

- the map/list split at 1024 px and above, and the filter drawer's desktop form;
- shop detail on a wide viewport, including where the visual header and the
  practical columns sit;
- Passport List mode on a wide viewport, and whether Book mode remains the
  desktop default in reviewer mode only;
- Me at wide widths, where the current single narrow column leaves large empty
  areas;
- the shell: whether the inline desktop navigation, the header, and the page
  furniture still read correctly once prototype badges are removed.

No desktop design in this document is approved. Nothing here should be read as
founder sign-off on a desktop treatment, and desktop work should not begin until
that feedback exists.

## Work packages

| WP | Scope | Depends on |
| --- | --- | --- |
| **WP0** | The five PR #5 review findings. **Milestone 1, not 1.5.** | — |
| **WP1** | Reviewer mode plus the copy pass: the flag, migrating every badge and milestone label behind it, production copy for location and collection, About Nib Atlas | WP0 |
| **WP2** | Me restructure: signed-out/signed-in split, compact Places Visited linked into Passport, local-data controls, Contribute entries, Danger group | WP1 |
| **WP3** | Passport IA: List/Book toggle, opening spread on content, country/locality index and linked routes, stamp detail overlay, first-run-only cover, cover redesign, display name on the identity page | WP1 |
| **WP4** | Shop value layer: the data-model extension, sourced content, reordered page, native directions, contextual report | WP1, sourcing |
| **WP5** | Visual fidelity: shop identity system, interim hero, paper and cover texture, stamp at large size, ceremony material pass | WP3, WP4 |
| **WP6** | Filter drawer: segment plus drawer, active count, one-tap clear | WP1 |
| **WP7** | Contribution flows: `mailto` routing now, `/suggest-shop` page later | WP2 |
| **WP-D** | **Required desktop audit** across all of the above | Founder desktop feedback |

WP1 is the smallest package with the largest effect on testability: it is what
makes staging sendable to a non-technical tester. WP3 and WP4 are the substantial
ones. WP4 is gated on data, so its schema work can run in parallel with WP3.

## Open items still needing founder input

- Which pen-specific fields exist for each of the ten catalogue shops (WP4).
- Desktop feedback, before WP-D can be designed.
- Whether a permission request to the ten shops for storefront photography should
  be drafted, and by whom.
