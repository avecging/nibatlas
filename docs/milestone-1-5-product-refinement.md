# Milestone 1.5 — Production-like product refinement

**Status:** Founder-approved direction. **WP1 implemented**; WP2–WP7 and WP-D not started.
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

| WP | Scope | Depends on | Status |
| --- | --- | --- | --- |
| **WP0** | The five PR #5 review findings. **Milestone 1, not 1.5.** | — | Landed in PR #5 |
| **WP1** | Reviewer mode plus the copy pass: the flag, migrating every badge and milestone label behind it, production copy for location and collection, About Nib Atlas | WP0 | **Implemented** |
| **WP2** | Me restructure: signed-out/signed-in split, compact Places Visited linked into Passport, local-data controls, Contribute entries, Danger group | WP1 | Not started |
| **WP3** | Passport IA: List/Book toggle, opening spread on content, country/locality index and linked routes, stamp detail overlay, first-run-only cover, cover redesign, display name on the identity page | WP1 | Not started |
| **WP4** | Shop value layer: the data-model extension, sourced content, reordered page, native directions, contextual report | WP1, sourcing | Not started |
| **WP5** | Visual fidelity: shop identity system, interim hero, paper and cover texture, stamp at large size, ceremony material pass | WP3, WP4 | Not started |
| **WP6** | Filter drawer: segment plus drawer, active count, one-tap clear | WP1 | Not started |
| **WP7** | Contribution flows: `mailto` routing now, `/suggest-shop` page later | WP2 | Not started |
| **WP-D** | **Required desktop audit** across all of the above | Founder desktop feedback | Not started |

WP1 is the smallest package with the largest effect on testability: it is what
makes staging sendable to a non-technical tester. WP3 and WP4 are the substantial
ones. WP4 is gated on data, so its schema work can run in parallel with WP3.

## WP1 implementation record

**Implemented:** 26 August 2026 · Claude Code · branch
`claude/m1-5-wp1-reviewer-mode`.

Scope was WP1 only. Nothing in WP2–WP7 or WP-D was started, and none of the
accepted decisions above were reopened. This section records how WP1 was built
and the implementation choices a reviewer would otherwise have to infer from the
diff.

### The mechanism

`src/features/reviewer/reviewer-mode.ts` holds the resolution rules as pure
functions; `ReviewerModeProvider` owns the URL and the storage.

- `?review=1` / `?review=0`, with `true/false`, `on/off` and `yes/no` also
  accepted. An unrecognised value is **not** a decision: it falls through to the
  remembered choice rather than being read as `false`.
- The choice is remembered in `localStorage` under
  `nib-atlas.reviewer-mode.v1`. Session storage would have forced the parameter
  onto every reload, which is the thing accepted decision 3 removes.
- An explicit parameter is written even when it matches the default, so
  `?review=0` on a fresh device records a real choice.
- A device that has never chosen resolves to **off**.

**Resolution is client-side and post-mount, deliberately.** The server render and
the first client paint are always the product, so the two renders agree and there
is no hydration mismatch, and reviewer material never enters the HTML or the RSC
payload a normal tester's browser receives. The cost is paid on the reviewer's
side: they see production copy for one frame before the instrumentation appears.

Two consequences worth naming:

- Reviewer-only *prose* on server-rendered pages lives inside client components
  (`src/features/reviewer/ReviewerNotes.tsx`), not as children passed into a
  reviewer gate. Wrapping server children would have serialised the text into
  every visitor's payload — hidden in the interface, present in the document.
  The copy is still in the client JS bundle; that is inherent to any client-side
  gate and is not the exposure the requirement is about.
- No route became dynamically rendered. `useSearchParams` would have forced that
  or a Suspense boundary around the shell, so the provider reads
  `window.location.search` directly. The parameter always arrives with a document
  load, which is how it is used.

### The way out

Reviewer mode marks itself and offers its own exit — never a way *in*, which
would put the control in front of testers.

- `ReviewerModeBadge`: a "Reviewer mode" chip plus an exit control, in the shell
  header, in Me, and in a strip over the map.
- Map needed its own slot: the shell header is `display: none` below 1024 px on
  the map variant, and the results sheet's summary row is too tight at 360 px to
  hold a badge and a control without clipping one. The strip in the map overlay
  also carries the basemap diagnostic.

### What moved behind the flag

| Moved | Where it was | Where it is now |
| --- | --- | --- |
| "Prototype data" badge | Shell header, every page | Reviewer marker |
| "Prototype sample" badge | Beside every result count | Removed; reviewer strip on the map |
| "Prototype" badge | Me header | Reviewer marker |
| "Prototype catalogue" badge | Every shop page | Reviewer provenance block |
| "Simulated collection…" | Ceremony | Reviewer-only; product line replaces it |
| "(simulated)" suffixes | Collect button, collected line, confirm button | Reviewer-only |
| "Arrives in Milestone N" chips | Me, five rows | Reviewer-only; plain-language reasons in normal mode |
| Prototype reset control | Me | Reviewer-only section, absent from the document otherwise |
| Coverage-set version strings | Me, Passport country seals | Reviewer-only |
| *Map position* precision row | Every shop page | Reviewer-only |
| Per-field source list with retrieval dates | Every shop page | Reviewer-only; one provenance sentence in normal mode |
| Offline-basemap attribution line | MapLibre attribution control | Reviewer strip |
| Four-paragraph location essay | Me | One sentence plus a Privacy link |
| Two-paragraph simulation notice | Collect preflight | Two short sentences, honest, no simulation vocabulary |

Nothing was deleted. Every diagnostic above is still reachable, with the same
precision, at `?review=1`.

### Precise implementation decisions

These are implementation choices inside WP1's remit, recorded so they are not
mistaken for product decisions:

1. **The provenance sentence is derived, not authored.**
   `src/components/shops/provenance.ts` picks the strongest source — the shop's
   own website over a dealer listing over a community list — and formats its
   retrieval date, producing *"Details from the shop's own website, checked 26
   August 2026."* A record with **no** source gets no line at all rather than a
   vague one.
2. **Unknown opening hours keep one caution.** Ordinary unknowns stay omitted,
   but arriving at a closed shop is the failure the page exists to prevent, so
   *"Opening hours are not confirmed. Check with the shop before travelling."*
   stands as the one concise caution accepted decision 1 allows. The duplicate
   "Always confirm" line now appears only where hours *are* listed.
3. **Milestone chips became reasons, not silence.** A row that cannot be used
   still says why — "Needs an account", "Not available yet", "Sign-in not
   available yet" — because hiding the label would leave a row that looks
   tappable. The milestone numbering is the reviewer form of the same fact.
4. **Legally required attribution is not gated.** `MapStyleProvider` now
   separates `attribution` (a licence obligation, always shown) from
   `diagnosticAttribution` (which supplier resolved, reviewer-only). The offline
   style draws only a graticule generated in this repository, so its line carries
   no licence and is reviewer-only; MapTiler's own style sources carry theirs and
   are untouched.
5. **The shop-page meta description became product copy.** It previously read
   "Prototype catalogue record — a small sourced sample, not a complete listing",
   which is shared and indexed. The catalogue's limits are stated on About.
6. **About coverage is counted from the catalogue at build time**, not written as
   prose, so the page cannot drift. It reports plain counts with no denominator,
   per the `PRODUCT.md` invariant.
7. **`.privacy-page` was renamed `.prose-page`** in `app/globals.css`. It was
   always a generic prose layout and now has a second consumer. No values
   changed.
8. **Me was shortened, not restructured.** The signed-out/signed-in split,
   Places Visited deep links, local-data controls, the Contribute group and the
   Danger group are WP2 and were not built. **About Nib Atlas** was added as a Me
   row because WP1 owns that destination.

### Deliberately not done in WP1

- `/styleguide` keeps its milestone wording and component badges. It is an
  internal reference page, unlinked from product navigation, and is a reviewer
  surface by nature. Gating it would hide the badge components from the page
  whose purpose is to show them.
- **Report incorrect information** and the contribution invitation are named in
  *Visible versus reviewer-only* above but are WP7's routing work. The Milestone 1
  line that promised them with a milestone number was removed rather than
  replaced, so normal mode currently offers no correction route. WP7 restores it.
- Desktop layout was not touched. The 1440 × 900 evidence shows the copy and
  visibility pass on the existing Milestone 1 desktop treatment and is not
  desktop sign-off; WP-D still awaits founder feedback.

### Coverage

- `src/features/reviewer/reviewer-mode.test.ts` — the resolution rules.
- `src/features/reviewer/ReviewerModeProvider.test.tsx` — default off, both
  parameters, remembered choice, the exit control, and blocked storage.
- `src/components/shops/provenance.test.ts` — source ranking, date formatting,
  and a line for every catalogue shop.
- `src/components/shops/ShopActions.test.tsx`,
  `src/components/stamps/StampCeremony.test.tsx` — collection copy in both modes.
- `tests/e2e/reviewer-mode.spec.ts` — the acceptance criteria end to end,
  including a ten-pattern sweep for reviewer-only material across nine product
  routes at all three breakpoints.
- `tests/evidence/wp1-reviewer-mode.spec.ts` — the paired screenshots, opted into
  with `EVIDENCE=1`. Output in `docs/evidence/milestone-1-5-wp1/`.

## Open items still needing founder input

- Which pen-specific fields exist for each of the ten catalogue shops (WP4).
- Desktop feedback, before WP-D can be designed.
- Whether a permission request to the ten shops for storefront photography should
  be drafted, and by whom.
