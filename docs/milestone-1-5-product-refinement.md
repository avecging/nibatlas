# Milestone 1.5 — Production-like product refinement

**Status:** Founder-approved direction. **WP1, WP2 and WP3 implemented**;
WP4–WP7 and WP-D not started.
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

**Amended 27 August 2026, after the founder's staging review of WP2.** *Report
incorrect information* is not a row in Me. A global control cannot name the shop
the reader is looking at, which is the part of this decision that makes the mail
useful, and as an unrouted row it was prototype scaffolding rather than a feature
preview. It belongs on the shop page, and WP7 owns it there.

Its copy is approved as natural product language rather than an instruction:

> Found something wrong with this listing? Let us know and we&rsquo;ll look into it
> as soon as possible.

WP7 attaches the `[Shop correction]` route to that, carrying the shop name.

**Help and contact is also WP7's, and is deliberately not specified here.**
Recorded 27 August 2026, with the same amendment. It was the last row in Me
carrying *Not open yet* and was removed for the same reason as the correction
row. Its destination, subject line and copy are open questions — an address may
not be the right answer at all, and unlike the two contribution routes above,
this decision has never been made. WP7 owns making it. Nothing in WP2 invents
it.

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
data, Clear data on this device) · **Contribute** (Suggest a pen shop) ·
Privacy · About Nib Atlas.

**Signed in** — optional display name and account identity · **Places visited**,
compact and clickable, where a country entry opens that country's Passport
section or filtered List view · Privacy and your data (export, download) ·
Contribute · About · Sign out · then a separated **Danger** group with
**Delete account** in `--error`, behind a confirmation.

*Amended 27 August 2026:* **Preferences and accessibility** is not part of either
state. See the staging-review record below — it returns when there is something
to set.

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
| **WP2** | Me restructure: signed-out/signed-in split, compact Places Visited linked into Passport, local-data controls, Contribute entries, Danger group | WP1 | **Implemented** |
| **WP3** | Passport IA: List/Book toggle, opening spread on content, country/locality index and linked routes, stamp detail overlay, first-run-only cover, cover redesign, display name on the identity page | WP1 | **Implemented** |
| **WP4** | Shop value layer: the data-model extension, sourced content, reordered page, native directions, contextual report | WP1, sourcing | Not started |
| **WP5** | Visual fidelity: shop identity system, interim hero, paper and cover texture, stamp at large size, ceremony material pass | WP3, WP4 | Not started |
| **WP6** | Filter drawer: segment plus drawer, active count, one-tap clear | WP1 | Not started |
| **WP7** | Contact and contribution routes: the contextual shop-page correction, help and contact, and the `/suggest-shop` page later. *Suggest a pen shop* is routed in WP2 | WP2 | Not started |
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
is no hydration mismatch, and no reviewer material is ever *rendered* for a
normal tester — there is nothing to flash and nothing in the readable document.
The cost is paid on the reviewer's side: they see production copy for one frame
before the instrumentation appears.

**What that does and does not mean for the payload.** Corrected after the first
Codex review, which found the original claim here overstated. Reviewer-only
material is not rendered in normal mode, but some of the *data* behind it is
still serialised:

- `ShopProvenance` and `ShopPositionDiagnostic` are client components that
  receive the whole `shop` object as a prop, so `shop.sources` — labels, URLs,
  retrieval dates, `confirms` lists — and `positionPrecision` are in the RSC
  payload of every shop page regardless of mode. None of it is displayed, and
  none of it is sensitive: it is public provenance about public businesses. It is
  recorded here so nobody reads the mechanism as a data boundary. Narrowing the
  props would be a reasonable tidy-up; it is not a correctness fix and was not
  made inside a copy pass.
- Reviewer-only *prose* on server-rendered pages does stay out of the payload,
  because it is authored inside client components
  (`src/features/reviewer/ReviewerNotes.tsx`) rather than passed in as children.
  It lives in the client JS bundle instead, which is inherent to any client-side
  gate.
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
- **Exit removes `review` from the address bar**, via `history.replaceState`, and
  keeps every other parameter and the hash. Remembering the choice is not
  sufficient: an explicit parameter outranks the remembered one, so a reviewer
  who exited while still on `/me?review=1` was put back into reviewer mode by
  their own next reload. `hrefWithoutReviewerParam` is pure and unit-tested;
  the reload-the-same-page journey is covered end to end.

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
   `src/components/shops/provenance.ts` names every distinct source kind a record
   rests on, strongest first, and a date clause that says what its date means —
   *"Details from the shop's own website and a community shop list, checked 26
   August 2026."* where the sources share a day, and *"…; oldest source checked
   16 March 2026."* where they do not. A record with **no** source gets no line
   at all rather than a vague one. *(Revised twice after review; see revision 3
   below.)*
2. **Unknown opening hours keep one caution.** Ordinary unknowns stay omitted,
   but arriving at a closed shop is the failure the page exists to prevent, so
   *"Opening hours are not confirmed. Check with the shop before travelling."*
   stands as the one concise caution accepted decision 1 allows. The duplicate
   "Always confirm" line now appears only where hours *are* listed.
3. **Milestone chips became reasons, not silence.** A row that cannot be used
   still says why — "Not available yet", "Signing in will sync them later",
   "Nothing to sign out of" — because hiding the label would leave a row that
   looks tappable. The milestone numbering is the reviewer form of the same fact.
   *(Wording revised after the first Codex review: the earlier "Needs an account"
   labels were untrue for saving and collecting, which work locally.)*
4. **Legally required attribution is not gated.** `MapStyleProvider` now
   separates `attribution` (a licence obligation, always shown) from
   `diagnosticAttribution` (which supplier resolved, reviewer-only). The offline
   style draws only a graticule generated in this repository, so its line carries
   no licence and is reviewer-only; MapTiler's own style sources carry theirs and
   are untouched.
5. **The shop-page meta description became product copy**, built from the
   fields the record actually carries (`src/components/shops/shop-metadata.ts`).
   It previously read "Prototype catalogue record — a small sourced sample, not a
   complete listing", which is shared and indexed. The catalogue's limits are
   stated on About. *(The generated fallback was revised after the first Codex
   review; see revision 4 below.)*
6. **About coverage is counted from the catalogue at build time**, not written as
   prose, so the page cannot drift. It reports plain counts with no denominator,
   per the `PRODUCT.md` invariant.
7. **`.privacy-page` was renamed `.prose-page`** in `app/globals.css`. It was
   always a generic prose layout and now has a second consumer. No values
   changed.
8. **Me was shortened, not restructured.** The signed-out/signed-in split,
   Places Visited deep links, local-data controls, the Contribute group and the
   Danger group are WP2 and were not built. **About Nib Atlas** was added as a Me
   row because WP1 owns that destination. Its account copy was corrected after
   the first Codex review; see revision 5 below.
9. **Local collection state is namespaced by mode**, in `localStorage`. See
   revision 1 below for the reasoning and the keys.

### WP1 revisions after the first Codex review

Recorded 26 August 2026, after review submission `5030605734`. Six defects, one
approved clarification, and one documentation correction. None of them reopened
an accepted decision.

#### 1. Normal mode starts empty (`collection-store.tsx`)

The defect: a clean device opened on `prototypeSeedCollections` — six stamps
across three countries, two saved shops — before the tester had done anything.
On a reviewer's screen that is a demonstration fixture. On a tester's screen Me
and Passport present it as *their* history, which reads as though something had
been following them around. This was the most serious finding in the review and
it was not on a changed line.

**Two stores, one per audience**, keyed separately:

| Scope | Key | Baseline |
| --- | --- | --- |
| normal | `nib-atlas.collection.v3` | empty |
| reviewer | `nib-atlas.collection.reviewer.v3` | the seeded demonstration collection |

Distinct namespaces rather than one key plus a flag, because the requirement is
not only "start empty" but "switching modes must not overwrite or misrepresent a
tester's real local state". With separate keys that property is structural: a
tester's saves survive a trip through reviewer mode untouched, and the seed can
never be mistaken for them. The provider waits for reviewer mode to resolve
before hydrating, and refuses to persist into a scope it did not load from, so a
mode change cannot write one audience's collection into the other's store.

**Legacy key.** Milestone 1's `nib-atlas.prototype-collection.v2` (session
storage) only ever held seeded state, so it belongs to reviewer mode. It is moved
there once — never overwriting an existing reviewer store, never promoting an
unparseable blob — and removed. That is what stops a staging session opened
before this change from carrying the seed into normal mode.

**`localStorage`, not `sessionStorage`.** Me and Privacy now tell the reader
their saves stay on the device until they clear browser data, and session storage
would have made that false the moment they closed the tab.

**Test arrangement.** Journeys that browse a populated Passport now *arrange* the
collection in the ordinary normal-mode store (`tests/support/local-state.ts`) — a
tester who has genuinely collected things is what those journeys are about. The
defect was creating that state silently, not its existence.

#### 2. About no longer certifies every entry as a walk-in shop

SKB's own source confirms a company base and a dealer directory but not a public
retail shopfront, and its page says so. About claimed every record was "a real
place someone can walk into", which was false for exactly that record. It now
says most are shops you can walk into and that the ones whose sources do not
confirm a shopfront say so — the claim a catalogue of ten can actually support.

#### 3. Provenance credits every source kind (`provenance.ts`)

The first implementation named only the highest-ranked source. For TY Lee that
produced "Details from the shop's own website" when the website confirms nothing
but the local-script name and the name, address and district come from a
community list — official backing claimed for facts that do not have it, with the
detailed breakdown hidden outside reviewer mode.

The sentence now names **every distinct source kind**, strongest first: *"Details
from the shop's own website and a community shop list, checked 26 August 2026."*
Kinds, not labels — that is what keeps it a sentence rather than the source dump
reviewer mode already provides.

**The date, and what the line is allowed to say about it.** The policy is the
**oldest** retrieval among the named sources, because a page is only as current
as its stalest fact: Pen House's website was read in August but its district came
from a March visit note, and claiming August would present the whole record as
five months fresher than part of it is.

The first attempt applied that policy but kept the plain wording, which traded
one inaccuracy for another — *"Details from the shop's own website and a Nib
Atlas visit, checked 16 March 2026"* says the website was read in March, and it
was not. Corrected in the second revision, the clause names what it means:

| Sources | Clause | Example |
| --- | --- | --- |
| one date across all of them | `, checked <date>.` | Ginza Itoya, TY Lee |
| dates that differ | `; oldest source checked <date>.` | SKB, Pen House |
| no readable date | *(no clause)* | — |

The reader gets a floor on the record's freshness either way, and is never told
that a source was read on a day it was not. Still one subordinate sentence; the
per-source dates stay in reviewer mode, where the full list already carries them.
An unreadable date is dropped rather than guessed at, and does not by itself
count as a disagreement.

#### 4. Link previews name only present fields (`shop-metadata.ts`)

The fallback meta description promised "Address, hours, and what you can do
there" on every record. NAGASAWA PenStyle DEN has neither an address nor hours,
and TY Lee and Juspirit have no published hours, so the indexed preview
advertised precisely the fields those pages omit. Every clause is now derived
from a field the record carries; a record with none says less instead.

#### 5. Me and Privacy describe device storage, not an account

Both claimed saving a shop and keeping a Passport need an account. Neither does —
they are local and always have been, and the approved direction keeps them that
way. The honest distinction is device-local versus synced, so that is what the
copy says: saves and impressions stay in this browser, do not sync, and go when
browser data is cleared; an account will later carry them between devices. This
is copy only. The signed-out/signed-in structure remains WP2.

#### 6. Exit reviewer mode is durable

See **The way out** above.

#### 7. `AGENTS.md` data-honesty invariant clarified

The automated review read the `prototype*` module namespace as evidence that the
catalogue holds invented businesses, and asked for a fixture badge back on every
normal-mode page. The founder declined that and approved a clarification instead,
now written into `AGENTS.md`: invented businesses and invented facts about real
businesses must be labelled, while a **real** business with unsupported fields
omitted satisfies the invariant through one accurate subordinate provenance line.
An implementation namespace is not evidence of invention. The same clarification
adds the rule the other two defects broke: product copy must not generalise
across records in a way that is false for one of them.

#### 8. One incidental fix

`/saved` at mobile widths had no heading element at all once the empty state
became reachable — the "Nothing saved yet" title was a paragraph styled as one.
It is now an `h3`.

### WP1 revisions after the second Codex review

Recorded 26 August 2026. Two wording defects, both introduced by the first
revision pass rather than by the original WP1 work.

#### 9. The provenance date clause names what its date means

The conservative oldest-date policy was right; stating it as a plain "checked"
was not. See the table under revision 3 above for the corrected wording and the
tests that pin both cases as exact strings. `AGENTS.md` carries the rule with it,
so the invariant no longer describes the date inaccurately either.

#### 10. Reviewer copy no longer calls the store a browser session

Two reviewer-only notes still said saves and simulated collections were held "in
this browser session" — true before revision 1 moved the store to mode-namespaced
`localStorage`, false afterwards. Me's prototype-controls note now reads *"kept on
this device only, in this browser's local storage under a reviewer-only key. They
survive a reload and a new tab, they are separate from the normal-mode store, and
nothing is sent anywhere."* Privacy's reviewer note is corrected in the same
terms. Reviewer copy may name the storage — that audience is the reason it
exists — but it has to name it correctly.

Both are asserted end to end, including a `browser session` count of zero on the
pages that carried the phrase, so the claim cannot come back unnoticed.

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

Added with the review revisions:

- `src/features/collection/collection-store.test.tsx` — the empty normal
  baseline, the seeded reviewer baseline, per-scope keys, a mode round trip that
  leaves a tester's save intact, and the legacy-key migration including its
  refusal to overwrite or to promote a corrupt blob.
- `src/components/shops/shop-metadata.test.ts` — no generated preview names a
  field its record omits, checked across the whole catalogue.
- `src/components/shops/provenance.test.ts` — every source kind credited; exact
  strings for a same-date record (Ginza Itoya, TY Lee) and a mixed-date one (SKB,
  Pen House); repeated and unreadable dates handled; and a catalogue sweep that
  requires the qualified wording wherever a record's sources disagree.
- `src/features/reviewer/reviewer-mode.test.ts` and
  `ReviewerModeProvider.test.tsx` — parameter stripping, and exit followed by a
  reload of the same URL.
- `tests/e2e/reviewer-mode.spec.ts` — a clean device across Me, Passport and
  Saved; seeded reviewer state; a mode round trip preserving a real save; the
  legacy session; and one test per copy fix.
- `tests/support/local-state.ts` — the shared arrangement helper.

## WP2 implementation record

Recorded 27 August 2026. WP2 is the *Revised Me structure* above, built as
written: two distinct states, four named groups, a compact Places Visited that
links into the Passport, working local-data controls, the Contribute entries, and
a separated Danger group.

### The problem it solves

Milestone 1's Me was one undifferentiated list that mixed four unrelated things —
a profile that was not a profile, geography, settings, and data controls — and
told the reader about each of them at length. WP1 shortened the copy but left the
shape alone, and explicitly deferred the restructure here.

The shape matters more than the wording did. A reader arrives at Me for one of
three reasons: to find out what is being kept about them, to get back to
somewhere they have been, or to change something. The restructure gives each of
those its own group, in that order, and removes the sections that existed only to
narrate compliance.

### Two states, not one screen with extra rows

Authentication is Milestone 4, so the signed-in state cannot be real yet. The
options were to build only the signed-out half, or to build the seam the real
thing will plug into and make the signed-in half reviewable behind the flag WP1
already established. The second was taken, because the approved structure is a
*pair* and half of it cannot be reviewed on its own.

`src/features/account/account-session.ts` is that seam. Its rules:

- **Normal mode is always signed out.** No parameter, no storage entry and no
  control can move a tester's device into the signed-in state. The check is in
  `resolveAccountSession` itself, not only in the interface, so a preview key
  left behind by an earlier reviewer session is ignored outright rather than
  merely unreachable. `tests/e2e/me.spec.ts` asserts exactly that.
- **Reviewer mode may preview it,** from a reviewer-namespaced key, and the
  preview says so where it renders rather than only where it is switched on.

Milestone 4 replaces `resolveAccountSession` with a real session lookup and
deletes the preview. Every consumer keeps the same shape.

### Precise implementation decisions

1. **Places visited is omitted, not zeroed, on a clean device.** Milestone 1
   rendered three zero stat cards and a "No visits yet" line. A section whose
   only content is a report that it has no content is the acceptance checklist
   answering itself again. It appears on the first stamp.
2. **Seal progress is folded into the country row, and stays a separate fact.**
   The Milestone 1 review found seals standing in for visits, which hid two of
   three countries the reader had genuinely been to. The row now states the visit
   from the stamps and the seal threshold beneath it, and the earned case shows a
   seal chip instead of a progress line. The separate *Seal progress* section is
   gone; it was a second rendering of the same data.
3. **Country and locality are separate links, not nested.** A link inside a link
   is invalid, and a reader who wants Chūō should not have to go through Japan.
   The country heading links to `/passport/[country]`; the localities beneath it
   are chips linking to `/passport/[country]/[locality]`. Those two routes existed
   and were orphaned; WP2 gives them their first product entry point. WP3 owns
   what they render.
4. **Download local data works, and says what it is.** There is no server, so
   this is not "export my account" — it is a copy of what this device holds,
   written as it is stored, `simulated: true` carried through and the store it
   came from named in the file. A reviewer's export can never later be read as a
   record of real visits. The payload builder is pure (`src/features/me/local-data.ts`);
   the browser half is a thin wrapper that reports failure rather than appearing
   to succeed when a browser blocks object URLs.
5. **Clear data writes an empty store rather than removing the key.** This is not
   cosmetic: on a reviewer device the *key absent* baseline is the seeded
   demonstration collection, so removing the key would reseed six stamps on the
   next visit. Clearing twice would have done it even where clearing once did
   not, because an unchanged state writes nothing. Pinned in
   `collection-store.test.tsx`.
6. **Destructive controls ask with an inline panel, never `window.confirm`.** The
   native dialog cannot be styled, cannot be screenshotted for review evidence,
   is suppressible by the browser, and reads out of context to assistive
   technology. The panel takes focus when it opens and returns it to the row when
   it closes.
7. **A confirm button never repeats its row's label.** A row's accessible name is
   its title and detail together, so *Clear data on this device* and *Clear this
   device* are two addressable controls where two identical labels would have
   been one ambiguous one.
8. **Standing text is not a live region.** The Danger row's preview note is
   present from first paint, so it is plain text; only the result of using a
   control is `role="status"`. Two permanent status regions on one screen is
   noise to a screen reader, not information.
9. **Me's Location section was removed.** The approved structure does not carry
   one, and the sentence belongs where the position would actually be requested —
   the collect preflight, which WP1 already built — with the full account on
   Privacy. Privacy remains one tap away and its row now names location, so the
   route to the explanation is unchanged. The reviewer note moved with it, and is
   asserted at the preflight.
10. **Privacy's data paragraph was corrected.** It promised an export and a
    deletion in the future tense. Both act on this device today, so it names them
    and links to the group that holds them; the account-scoped versions are
    described separately, still in the future tense, which is where they belong.
11. **`/account` redirects to `#me-account`.** The old `#me-profile` anchor no
    longer exists.
12. **Suggest a pen shop is routed; the correction is not.** Revised after the
    Codex review, which read the WP2 brief as requiring the route now — correctly:
    accepted decision 8 already fixes the address and the subject tag, so
    deferring it was deferring nothing but the wiring. It is a `mailto` to
    `hello@nibatlas.com` with subject `[Suggest shop]`, built in
    `src/features/contribute/contribute-links.ts` so the address and both tags
    exist once and can be asserted exactly, encoded and decoded.

    **Report incorrect information** stays with WP7, and after the founder's
    staging review it is not in Me at all — see revision 19 below. Decision 8
    says that mail should name the relevant shop, and that context lives on the
    shop page, not in a global Me row.

13. **Preferences and accessibility is copy, not rows** — and then, after the
    founder's staging review, is not on the page at all. See revision 20 below.
    Recorded here because the intermediate step is the useful part of the
    reasoning: Milestone 1 rendered reduced motion and accessibility as list
    items with a pending badge (*No in-app override*, *Reference only*), the
    Codex review replaced them with two sentences of copy, and the staging review
    then asked the question neither pass had — whether the content belongs on
    this page at all.
14. **Local-data copy says what the controls do, and no more.** Also from the
    Codex review, and the most substantive of its copy findings. Clearing acts on
    this scope's store alone, so:
    - the result no longer reads *"Nothing from Nib Atlas is stored on this
      device now"* — the reviewer choice, the account preview and whatever else
      the browser holds are untouched — but names the two things it removed;
    - the question asks about *"your saved shops and collected impressions"*
      rather than *"everything Nib Atlas has stored"*;
    - **preferences** are no longer listed as stored or cleared, because neither
      control touches them and Nib Atlas stores none of its own;
    - removing the app from a home screen is no longer stated as deleting its
      data: whether it does depends on the platform, and on several it does not.
      Privacy names the browser's own site-data control instead, which is the
      thing that really removes everything;
    - `clearLocalData`'s interface documentation said it removed the storage key.
      It deliberately writes an empty one — an absent key is a scope's cue to
      reseed — and the comment now says so, along with the scope limit that the
      copy above depends on.

    Each claim is pinned by an assertion, in `MeScreen.test.tsx`, `me.spec.ts`
    and `reviewer-mode.spec.ts`, so none of them can come back unnoticed.
15. **Download and Clear are held until the store has been read.** From the Codex
    review, and a real defect rather than a copy one. The collection store reads
    `localStorage` in an effect, so between the first paint and that effect a
    returning reader's store is the *empty baseline*. A fast interaction in that
    window would have exported an empty file that looks exactly like a successful
    export of nothing, or cleared the baseline over their real collection.

    The guard lives in `exportLocalData`, which owns the whole action, so a
    second caller cannot forget it; the rows also carry `disabled` for the same
    interval. It is one frame, so the treatment is deliberately understated — a
    heavier one would read as a permanently unavailable control, which these are
    not. `local-data.test.ts` proves a seeded collection cannot be exported
    before hydration, and a static render of Me — which *is* the first paint,
    since effects have not run — proves both controls are inoperable in it.
16. **A destructive confirmation opens on Cancel.** From the Codex review.
    Opening the panel and confirming it were otherwise one keystroke apart:
    pressing Enter twice, an ordinary way to work down a list of buttons, would
    have destroyed a collection whose question was never read. Focus now lands on
    **Cancel** for destructive panels, the destructive button is one Tab away,
    and focus returns to the originating row on both cancel and completion.
    Covered from the keyboard in `me.spec.ts` and by focus assertions in
    `MeScreen.test.tsx`.

17. **A row's result is a sibling of its button, not a descendant.** From the
    Codex review of the pull request. A native button's descendants are
    flattened into its accessible name, so a `role="status"` nested inside one is
    never exposed as a live region — the announcement simply does not happen. It
    hid the only feedback in the case that has no other: a download the browser
    blocked. Each result is now its own named region beside the row, present in
    the document even when empty (a live region has to exist before its text
    arrives) and collapsed with padding rather than `display: none`, which would
    take it back out of the accessibility tree.
18. **A clear in one tab is not undone by another.** Also from the pull-request
    review, and the more serious of the two: a broken promise rather than a
    missed announcement. With Nib Atlas open twice, tab A clears and is told the
    removal cannot be undone; tab B still holds the old arrays in React state,
    and its persistence effect writes them straight back the next time anything
    changes there. The collection returns.

    `CollectionProvider` now listens for `storage` and adopts what another tab
    did to its own scope — which also fixes the quieter half, a save made in one
    tab going missing in another. `storage` fires only in tabs that did not make
    the change, and a `lastWrittenRef` stops the echo that comes back when the
    other tab persists what it adopted, so two tabs cannot answer each other
    indefinitely. Covered in the store's own tests and by a two-tab journey; both
    were confirmed to fail with the listener removed.

19. **Report incorrect information leaves Me.** From the founder's staging
    review. It was a row carrying *Not open yet*, and the objection is the one
    this milestone was opened over: a visible control that cannot be used is
    prototype scaffolding, not a feature preview. Removing it is not a deferral —
    the correction route is WP7's and always was, and decision 8 is amended above
    with the founder's approved copy for it on the shop page, where the mail can
    name the shop the reader is looking at.

    **Suggest a pen shop** keeps its working route and subject tag, with shorter
    copy: *"Tell us about a fountain pen shop that isn't on the map."* The
    trailing *"Opens an email."* is gone — a link that opens a mail client
    announces itself by opening one.
20. **Preferences and accessibility leaves Me entirely.** Also from the staging
    review, and the more interesting of the two.

    Both earlier passes argued about *presentation* — rows with a badge, then two
    sentences of copy — and neither asked whether the content belonged on the
    page. It does not. Me is where a person changes their own settings, and there
    is nothing here to change; general statements about reduced motion, keyboard
    behaviour and colour use are a description of how the product works, and
    putting that on a personal-settings page makes it read as a specification of
    itself.

    Nothing about the behaviour changed, and its technical documentation stays in
    the repository. It was **not** moved into Terms of Use. A user-facing
    accessibility or help destination may be worth having later, if it earns its
    place.

    The section returns when there is something to set — *Light / Dark / Follow
    system*, a text-size adjustment, colour-vision options, a motion override.
    None of those are built here.
21. **Copy that narrates the interface is gone.** The founder's general
    direction, applied across Me: a download result no longer says the file was
    *prepared and* downloaded, the export no longer promises the data *exactly as
    it is stored here*, signing out no longer explains what stays behind, and the
    clear row no longer pre-announces the consequence its own confirmation panel
    exists to state.

    Truthfulness, consequences and privacy explanations are untouched — the
    device-storage paragraph, the clear result naming what it removed, the
    blocked-download message and the confirmation panels all read exactly as
    before. The rule is that the interface should not describe mechanics the
    interaction already demonstrates, not that it should say less about what it
    is doing to the reader's data.

22. **Help and contact leaves Me, and the section is renamed with it.** The
    founder settled the item revision 19 raised: it was the last row carrying
    *Not open yet*, and the reasoning that removed *Report incorrect
    information* applies to it unchanged. A visible control that cannot be used
    is prototype scaffolding whether or not it is the only one left.

    The group it sat in was called **Help and about**. With no help in it, that
    heading is the same inaccuracy one level up, so the section is now **About**
    — holding Privacy policy and About Nib Atlas signed out, and About Nib Atlas
    and Sign out signed in. Its anchor moved from `#me-help` to `#me-about`;
    nothing linked to the old one.

    Its routing is recorded under WP7 and deliberately **not** specified here:
    destination, subject line and copy are all open, an address may not be the
    right answer, and unlike the two contribution routes that decision has never
    been made. See the amendment to accepted decision 8.

    **Nothing that works was touched.** *Suggest a pen shop* keeps its route and
    subject tag, *Privacy policy* still reaches `/privacy`, and *About Nib
    Atlas* still reaches `/about` — asserted together in one test, in both the
    component suite and the journeys, so a future removal cannot take one of
    them with it.

    Me now carries no unusable control at all. *Not available yet* on **Sign in**
    and **Export account data** is a different claim and stays: it describes an
    account that will exist, which is product information rather than a control
    that cannot be pressed. A test asserts the count of *Not open yet* across the
    whole page is zero.

### WP2 revisions after the founder's staging review

Recorded 27 August 2026, after the founder read WP2 on staging as an ordinary
user, and one follow-up settled straight after it. Four refinements, all copy or
structure, no behaviour change: revisions 19 to 22 above.

The reviewer-mode organisation was reviewed and kept as it stands.

One item was raised rather than settled in that pass — **Help and contact**, then
the only remaining row carrying *Not open yet* — and the founder settled it
immediately after: remove it, on the same reasoning. Recorded as revision 22
below.

### WP2 revisions after the Codex review

Recorded 27 August 2026. Six required fixes, all accepted and all implemented;
five accepted decisions were confirmed unchanged — the reviewer-only account
seam, normal mode being structurally forced signed out, omitting Places visited
on a clean device, folding seal status into each country while keeping it
distinct from the visit, and writing an empty reviewer collection store rather
than deleting its key.

The fixes are recorded above as decisions 12 to 16, plus the tablet breakpoint
added to the WP2 evidence suite: `IMPLEMENTATION-PLAN.md` names three review
breakpoints and the first pass captured two.

A second Codex pass, on the pull request itself, raised two P2 findings. Both
were real defects in code this work package added, both were small and local,
and both are recorded above as decisions 17 and 18.

### Deliberately not done in WP2

- **No authentication.** The signed-in state is a labelled preview. Nothing
  signs in, nothing syncs, and no account can be created or deleted.
- **Merging local saves on account creation** is named in the approved structure
  as something to offer *on* account creation. There is no account creation, so
  there is nothing to offer it at.
- **Desktop layout was not touched.** The 1440 × 900 evidence shows the
  restructure on the existing Milestone 1 desktop treatment and is not desktop
  sign-off; WP-D still awaits founder feedback.
- **Passport's own information architecture** is WP3. Me links into the routes
  that exist; it does not change what they render.

### Coverage

- `src/features/account/account-session.test.ts` — the resolution rules,
  including a stored preview being ignored in normal mode; display-name
  normalisation and bounds; persisted-record parsing.
- `src/features/me/local-data.test.ts` — the export payload shape, deterministic
  ordering, the carried `simulated` marker and the named store, and the filename.
- `src/features/collection/collection-store.test.tsx` — clearing empties the
  store, leaves it present rather than absent, survives being done twice, is not
  the reviewer reset, and does not touch the other mode's store.
- `src/features/me/MeScreen.test.tsx` — both states as structure: the groups each
  one has, the Danger group's absence when signed out, the confirmations, the
  download's success and failure paths, and the display name surviving a Save
  pressed without typing.
- `tests/e2e/me.spec.ts` — the journeys: the signed-out groups, Places Visited's
  counts and deep links, clearing with and without confirmation (asserted against
  storage, since the arranged state is an init script and a reload would re-seed
  it), a real download parsed back, and the signed-in preview end to end.
- `tests/e2e/accessibility.spec.ts` — an axe audit of the signed-in state and of
  the destructive confirmation open, neither of which exists in the signed-out
  audit.
- `src/features/contribute/contribute-links.test.ts` — the mailbox, both subject
  tags, and the encoding, asserted as the exact href and as the decoded subject.
- `tests/evidence/wp2-me.spec.ts` and `docs/evidence/milestone-1-5-wp2/` — every
  state at 360 × 800, 768 × 1024 and 1440 × 900. WP1's evidence set is a record
  of that review and is deliberately not regenerated here.

## WP3 implementation record

**Implemented:** 27 August 2026 · Claude Code · branch
`claude/m1-5-wp3-passport-31di6u`.

Scope was WP3 only. Nothing in WP4–WP7 or WP-D was started, no accepted decision
above was reopened, and the reviewer, collection and account seams from WP1–WP2
were extended rather than modified. This section records how WP3 was built and
the implementation choices a reviewer would otherwise have to infer from the
diff.

### The problem it solves

Root cause E: the Passport had one mode and no navigation model. The book was
built, the List view was dropped, `/passport/[country]` and
`/passport/[country]/[locality]` existed but nothing linked to them, and the
opening spread was identity plus seals — so a reader with six stamps opened their
Passport and saw no stamps at all. Nothing enlarged an impression, so the
artwork existed only at thumbnail size, which is where the founder's review found
it.

WP3 is therefore mostly *structure*: the same collection, presented two ways,
with real destinations and one overlay that makes a stamp worth looking at. The
material pass — paper, cover fidelity, the stamping ceremony — is WP5 and is
deliberately not here.

### Two modes over one collection

`src/components/passport/PassportScreen.tsx` is the single screen behind all
three routes. The route decides *what* is shown; the reader's remembered choice
decides *how*. `/passport/[country]` and `/passport/[country]/[locality]` are no
longer separate views: they are the same collection, narrowed, and they have to
narrow in whichever mode the reader last used.

- **List** (`PassportList.tsx`) is the accessible browsing baseline: block flow,
  no transforms, no gestures, no fixed heights. Three counts, then per country
  its name, stamp count and country seal *as artwork* where earned, then per
  locality a subheading and rows of
  `thumbnail · shop name · local-script name · locality · date`.
- **Book** (`PassportBook.tsx`) is unchanged as an object. The committed spine
  geometry, the leaf model, the drag and turn controller, the reduced-motion
  treatment and the focus handling were preserved exactly; what changed is the
  list of pages it presents and where it opens.

The toggle is **List on the left, Book on the right**, as two buttons carrying
`aria-pressed` rather than a radiogroup: each one is a control that switches the
view immediately, and `aria-pressed` is what states which view is showing.

### The page order, and the one judgment call in it

`buildPassportPages` now produces:

```
  0  identity   inside front cover — who the volume belongs to
  1  contents   the country / locality index
  2  seals      country seals
  3  locality   the most recently collected locality   ← opening spread
  4… locality   the rest, newest locality first
  n  blank      room for the next impression
```

The opening position is page 3, so the opening spread is pages 2 and 3 — country
seals on the left, the most recent locality on the right, exactly as approved.
Portrait reading opens on page 3 as well, which is the same promise in one page:
the reader's newest impressions rather than the front matter.

**The judgment call.** The approved wording is *"identity content on the inside
front cover, not as the routine opening spread."* The committed geometry cannot
carry durable content on the cover's back face: once the cover has swung open it
lies behind the left page on desktop (`z-index: 1`) and fades out entirely in
portrait mode, so anything printed there is visible only mid-animation. Rather
than modify the cover geometry — which decision 10 asks to preserve — the inside
front cover is realised as **page 0**, tinted as endpaper rather than page stock,
facing the contents page as a front-matter spread one turn behind the opening
spread. That satisfies both halves of the requirement: identity is where a
passport keeps it, and it is not what the reader lands on. The cover's own inside
face is now plain endpaper, and the sentence WP1's copy pass would have removed
from it ("This passport records visits you chose to make…") is gone.

**The contents index** sits at page 1 rather than at the back, and is reached by
a labelled **Contents** control in the pager next to **Cover**, so a reader
looking for a country never pages blindly. Each entry carries a leader rule and
the page it starts on, the way a contents page sets one, and turns the book
directly to that page.

**Locality pages are ordered by recency**, newest first, because a passport fills
up in the order it was stamped — and because that is what makes the most recently
collected locality the opening spread's right-hand page without a special case.
List mode keeps the alphabetical grouping `buildPassport` already produced, which
is also what Me's Places visited shows. `buildPassport` itself was **not**
reordered: doing so would have quietly changed Me, which is accepted work.
`PassportCountry` and `PassportLocality` gained a `mostRecentOn` key and
`countriesByRecency` / `localitiesByRecency` sort a copy, so both orders are
deterministic and neither surface reorders the other.

### Precise implementation decisions

1. **A default is not a choice** (`passport-view-state.ts`). A device that has
   never used the toggle keeps `mode: null` on disk and the audience default is
   computed every time: List in normal mode, Book in reviewer mode. Writing the
   default down would make a later change of default silently ineffective and
   would tell a reviewer the reader had picked List when they had picked nothing.
   The store is only written when the reader actually does something — chooses a
   mode, opens the cover, turns to a spread, scrolls the list.

2. **The view record is namespaced by audience**, alongside the collection
   stores: `nib-atlas.passport-view.v1` and
   `nib-atlas.passport-view.reviewer.v1`. One key plus a flag would let a
   reviewer's Book choice become a tester's, and the two audiences have different
   defaults to fall back to. A reviewer session therefore cannot change what a
   tester's device does, in either direction.

3. **The remembered spread is content, not geometry** — and it is the screen's,
   not the book's. Milestone 1's `nib-atlas.passport-position.v1` session key is
   gone, with no migration written for it, because it lived in `sessionStorage`
   and never outlived the tab that wrote it. The record stores a
   `place` — `{ kind: "locality", countryCode, localitySlug }`, or `front`, or
   `seals` — never a page number. Page numbers move as the collection grows, so a
   stored index would silently drift by one every time an impression was
   collected. `pageIndexForPlace` resolves a place back to a page and returns
   `null` when it no longer exists, which lands the reader on the opening spread
   rather than on an error. `parsePassportView` canonicalises the country code
   and locality slug, and discards anything it cannot read.

4. **Mount-time resume and route-driven requests are separate props**
   (`initialPageIndex` and `requestedPageIndex`). This is a defect found and
   fixed during implementation, worth recording because it is not obvious: the
   screen derives its target partly from the *remembered* spread, and the book is
   what updates that memory. Feeding every change of one prop back into the book
   made a page turn recompute a target and turn again — pressing Home landed on
   the identity page and then jumped forward to the contents page. The resume
   target is now read once; only a route's own request is watched, because that
   one genuinely arrives late (the collection resolves from device storage after
   mount, so a Passport opened at a freshly collected impression renders once
   before that locality exists).

5. **The cover opens once, and a deep link never opens it.** `coverSeen` is
   recorded on the first activation rather than when the swing finishes, so a
   reader who navigates away mid-animation is not shown the cover again. A
   requested country or locality opens directly and deliberately does *not*
   consume the first-run moment: a reader who followed a link to Ginza asked for
   Ginza, not for a ceremony, and their own first visit to `/passport` still gets
   the cover once.

6. **An impression is a button, not a link.** Tapping a stamp in either mode
   opens `StampDetailOverlay`: the impression at a useful size, its tier, the shop
   name and local-script name, locality, country, the local collection date, and
   **Open shop**. The shop is one step further on, from inside the overlay, so a
   reader can look at a stamp without leaving the Passport. It shows what the
   impression itself records and nothing more — no rating, no note, no sharing, no
   visit history.

7. **Return context is carried and validated.** The overlay's shop link is
   `?from=passport&back=<the Passport route>`, so the shop page's one back
   control returns to the locality the reader was on rather than to the overview.
   `passportReturnHref` honours only a path inside `/passport`, so a crafted link
   cannot turn the back control into a redirect elsewhere. Browser Back is
   unaffected and restores the exact route; the mode and the spread come from the
   record.

8. **List-mode scroll memory is the overview's only.** A country or locality
   route is short and is its own destination, so restoring the overview's offset
   onto it would be actively wrong. The offset is written at most once per frame.

9. **The empty state is the same in both modes.** An empty book is a real object
   with real pages, but it cannot offer the one thing this state needs to offer,
   which is the way to the map. So a device with nothing collected gets one
   notice — *No stamps collected yet*, one line naming where stamps come from, and
   **Explore the map** — with the toggle still present, because that is what makes
   the audience default observable. No fake stamps, no invented history, no locked
   silhouettes.

10. **The cover was restructured, not decorated.** The two foil rule frames are
    gone. In their place: a fine two-directional fibre tooth and a shallow deboss
    field on the board, an issuing line at the top, the mark in the middle,
    `PASSPORT` below it and `VOLUME I` at the foot, all in the same strong serif
    the rest of the Passport uses. No handwriting face anywhere. This is the
    approved WP3 *structure* plus restrained grain and debossing; WP5 owns the
    full material pass.

11. **The identity page carries the display name from the existing account seam**,
    with **Your Passport** as the fallback. It reads `session.displayName` only —
    never `identityLabel`, which is an address — so no name can be derived from an
    email address. The palette version that used to print on that page is now
    reviewer-only: it proves an impression regenerates identically later, which is
    a review concern rather than something a keepsake should carry.

12. **The book's hidden layers are `inert` as well as `aria-hidden`.** A second
    defect found during implementation. The opening spread now carries real
    controls — every impression on it is a button — so the closed book's
    `aria-hidden` spread, and a leaf in flight, were focusable subtrees that no
    screen reader would announce. Milestone 1 never hit this because its opening
    spread was identity plus seals and had nothing focusable on it. An axe audit
    of Book mode is now part of the accessibility suite.

13. **The pager wraps at 360 px.** A third defect, and the one with the widest
    effect. Adding **Contents** made the control strip wider than a 360 px
    screen; because the Passport field is a centred grid, an over-wide strip
    widened the whole column, and the book — sized correctly — was pushed right
    and clipped by the field's own `overflow: hidden`. The strip is now two
    groups (where to jump, how to turn) that wrap onto two rows below 480 px and
    sit on one row above it. Worth recording because the symptom appeared on the
    book rather than on the control that caused it.

14. **Two icons were added** (`list`, `book`) for the toggle and the Contents
    control. `ResizeObserver` gained a no-op stub in `src/test/setup.ts`, next to
    the existing `matchMedia` and `scrollIntoView` shims, because the book
    measures its field and jsdom has no layout.

15. **Two contrast fixes.** The caption-sized text in List rows and in the
    overlay's fact list started on `--text-muted`, which is 4.1:1 on the canvas
    at 12 px and therefore below AA. Both now use `--text-secondary` at 7.2:1.
    Found by the axe audit, not by eye.

### Copy

Written to the founder's WP2 direction. The Passport says less than it did:

- the closed-book line *"Open the cover to read your impressions"* is gone — the
  **Open Passport** button says that;
- the open-book hint is now only the thing that is *not* visible in the interface:
  *"Drag a page, or use the arrow keys"*, or *"Arrow keys turn pages"* with
  reduced motion;
- the identity page's *"A private record of shops visited and the ink each visit
  left behind"* and its shared-ink count are gone;
- the blank page's *"The next impression you collect is pressed here"* is gone;
  the heading already says it;
- the empty state is a heading, one line and a route, not three paragraphs.

The seals page's explanation of how a seal derives was kept. It is WP1-reviewed
copy, and it states a rule that is genuinely not self-evident — which is the one
case the direction leaves room for.

### Deliberately not done in WP3

- **No shop-page or shop-data work** (WP4). The overlay's **Open shop** goes to
  the existing page unchanged.
- **No material-fidelity pass** (WP5). Paper texture, the impression's printed
  character and the stamping ceremony are untouched; the cover carries WP3's
  structure and restrained grain only, and the ceremony was not opened.
- **No map filtering** (WP6) and **no contact or contribution routes** (WP7).
- **Desktop layout was made responsive, not designed.** The list is a centred
  reading column and the book keeps its committed spread; the 1440 × 900 evidence
  shows integrity at that width and is not sign-off. WP-D still awaits founder
  feedback.
- **No Passport Library and no second volume.**
  `docs/future/passport-library.md` stays a later idea, and nothing in the cover
  or the identity page anticipates it.
- **No authentication.** The display name comes from WP2's reviewer-only preview
  seam; a normal device is always signed out and always sees **Your Passport**.
- **No completion denominators anywhere new.** The only `x / y` in the Passport
  remains the one an explicitly versioned curated set licenses, on the seals page.
- **No sideways reading mode**, per `docs/future/passport-sideways-reading-mode.md`.

### Coverage

- `src/features/passport/passport-view-state.test.ts` — the resolution rules in
  both directions, the per-audience keys, and fifteen unparseable or hostile
  stored values including a bad mode, a bad place, a negative and a `NaN` scroll
  offset; plus the round trip and the property that a default is never written
  down as a choice.
- `src/features/passport/passport-pages.test.ts` — the page order, the opening
  spread being seals facing the newest locality, recency ordering of locality
  pages, the display name and its fallback, every indexed country and locality
  resolving to a real page, the country seal being counted separately from the
  countries indexed, and `placeForPage` / `pageIndexForPlace` including a stale
  locality and the blank end page.
- `src/domain/passport.test.ts` — that the grouping order Me and List share is
  unchanged and alphabetical, that `mostRecentOn` is derived correctly, that the
  recency projections do not disturb it, and that a same-day tie breaks
  deterministically.
- `src/components/passport/PassportScreen.test.tsx` — the toggle's order and its
  two defaults, an explicit choice outranking a default, a corrupt record falling
  back, the two audiences' records staying apart, the List counts and links, the
  narrowed country and locality routes, both stale-destination notices, the empty
  state carrying no seeded history, and the overlay as a modal dialog: an
  accessible name, its facts, the carried return route, Escape, the close control
  and focus restoration to the stamp that opened it.
- `tests/e2e/passport.spec.ts` — the journeys: both clean-device defaults, a
  choice surviving navigation and reload in both directions, a reviewer choice not
  becoming a tester's, collection isolation across a mode switch, deterministic
  ordering across a reload, the country and locality URLs, both stale
  destinations, remembered scroll, the cover shown once and the spread resumed,
  the **Cover** and **Contents** controls, index navigation to a country and a
  locality, a deep link skipping the cover, a stale remembered locality falling
  back to the opening spread, the enlarged stamp from List and from Book by
  keyboard with focus returned, **Open shop** preserving the route, a crafted
  `back` parameter being refused, browser Back restoring mode and spread, the
  post-collection link, Me's Places visited, the identity name and fallback, and
  reduced motion in both modes. The Milestone 1 acceptance list for the book — the
  spread, the portrait page, forward and reverse turns, rapid input, the keyboard
  journey, focus on turn, no Recent Impressions — is carried over intact.
- `tests/e2e/accessibility.spec.ts` — an axe audit of the enlarged stamp, of Book
  mode opened, and of the contents spread, none of which existed before; the
  keyboard test now enters Book mode through the toggle.
- `tests/e2e/reduced-motion.spec.ts` and `tests/e2e/explore.spec.ts` — updated for
  the new mode toggle and the locality route's heading level.
- `tests/visual/breakpoints.spec.ts` — `passport-list` replaces
  `passport-closed`, and `passport-book-closed` records the redesigned cover.
- `tests/evidence/wp3-passport.spec.ts` and
  `docs/evidence/milestone-1-5-wp3/` — every state at 360 × 800, 768 × 1024 and
  1440 × 900. WP1's and WP2's evidence sets are records of those reviews and are
  deliberately not regenerated; because the `evidence` project holds every work
  package's suite, the WP3 README now names the spec file in its regenerate
  command rather than running the project unfiltered.

### Conflicts found in the documentation

Recorded rather than resolved silently.

1. **`UX.md` still describes the Passport overview as "the Passport book"** and
   gives one hierarchy (overview → country → locality → stamp). WP3's approved
   direction adds List as a peer mode and makes it the normal-mode default, so the
   overview is now either presentation. The implementation follows
   `docs/milestone-1-5-product-refinement.md`; `UX.md` was left alone because
   editing accepted product documentation is not this work package's to do.
2. **`docs/passport-interaction-spec.md` state model says "Persist the user's
   current logical page for the session."** WP3's approved returning behaviour is
   per device and durable, not per session, so the record moved from
   `sessionStorage` to `localStorage` and from a page index to a place. The
   spec's acceptance checks are all still met.
3. **The inside front cover.** Recorded above under *the one judgment call*: the
   approved wording and the committed geometry cannot both be honoured literally,
   and preserving the geometry was ranked higher per accepted decision 10.

## Open items still needing founder input

- Which pen-specific fields exist for each of the ten catalogue shops (WP4).
- Desktop feedback, before WP-D can be designed.
- Whether a permission request to the ten shops for storefront photography should
  be drafted, and by whom.
