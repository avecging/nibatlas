# Milestone 1.5 — Production-like product refinement

**Status:** Founder-approved direction. **WP1–WP6 implemented**, WP3 including
the two corrections from its staging review, WP6 including the three staging
findings recorded against the map surfaces, and WP5 including the impression
family, the seal anatomies, the overlay consolidation, the application-frame
correction and the Passport navigation fix; one interaction correction recorded
after WP5; and WP7 including the two real forms, the help page and the amendment
to accepted decision 8 recorded below. WP-D not started.
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

**Amended 30 August 2026, during WP6.** The segment carries **four** choices —
All / Unvisited / Saved / Visited — not three. WP6's first pass read the staging
finding about conflated card states as a reason to drop `Unvisited`; the founder
corrected that. The finding was about how three states were *drawn on a card*,
not about which filters exist, and the four choices are independent sets rather
than four points on one axis. See the WP6 implementation record.

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
| **WP4** | Shop value layer: the data-model extension, sourced content, reordered page, native directions, contextual report | WP1, sourcing | Implemented; content awaits sourcing |
| **WP5** | Visual fidelity: shop identity system, interim hero, paper and cover texture, stamp at large size, ceremony material pass, and the **one presentation family** for enlarged impressions and seal overlays recorded below | WP3, WP4 | Implemented |
| **WP6** | Filter drawer: segment plus drawer, active count, one-tap clear; and the **card and marker interaction** recorded below, with its documentation update | WP1 | **Implemented** |
| **WP7** | Contact and contribution routes: the contextual shop-page correction, help and contact, and the `/suggest-shop` page later. *Suggest a pen shop* is routed in WP2 | WP2 | **Implemented**, with decision 8 amended below |
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

**The judgment call, confirmed in review on 27 August 2026.** The approved wording
is *"identity content on the inside front cover, not as the routine opening
spread."* The committed geometry cannot
carry durable content on the cover's back face: once the cover has swung open it
lies behind the left page on desktop (`z-index: 1`) and fades out entirely in
portrait mode, so anything printed there is visible only mid-animation. Rather
than modify the cover geometry — which decision 10 asks to preserve — the inside
front cover is realised as **page 0**, tinted as endpaper rather than page stock,
facing the contents page as a front-matter spread one turn behind the opening
spread. That satisfies both halves of the requirement: identity is where a
passport keeps it, and it is not what the reader lands on. The cover's own inside
face is now plain endpaper, and the sentence WP1's copy pass would have removed
from it ("This passport records visits you chose to make…") is gone. Accepted in
review as the reading of the approved direction; the committed cover and leaf
geometry stays as it is.

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
   opens the detail overlay (`PassportDetailOverlay` after the staging review,
   which generalised it over seals as well): the impression at a useful size, its
   tier, the shop
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

### Conflicts found in the documentation, and how they were settled

Raised in the WP3 pull request and settled in review on 27 August 2026. All three
are corrections to stale documents rather than new product decisions.

1. **`UX.md` described the Passport overview as "the Passport book".** Corrected.
   `UX.md` now states that List and Book are peer presentations of one collection,
   that the overview is whichever one the reader last chose, that production-like
   mode defaults to List and reviewer mode may default to Book, and that the
   hierarchy holds in both. Its Browse Passport journey now names the three routes
   into a locality and the enlarged impression.
2. **`docs/passport-interaction-spec.md` said "Persist the user's current logical
   page for the session."** Corrected: the remembered page is durable per device,
   not per session, and is remembered as content the page holds rather than as a
   page number. Two acceptance checks were added there — the exact page inside a
   locality that spans more than one, and a remembered page surviving a new
   browser session.
3. **The inside front cover as page 0 — confirmed.** The identity page, tinted as
   endpaper and facing Contents one turn behind the opening spread, is the accepted
   reading of *"identity content on the inside front cover, not as the routine
   opening spread"*. The committed cover and leaf geometry stays as it is.

### WP3 revisions after the Codex review

Three defects, all in remembered state, all found by review on commit
`a498eb4`. CI was green and the structure was accepted; these are the corrections.

#### 1. A locality that spans pages remembered only the locality

`STAMPS_PER_PAGE` is four, so a locality with five or six impressions has a
continuation page — and a remembered place naming only the country and locality
resolved every one of them back to the locality's first page. A reader on the
second page who opened a stamp, visited its shop and came back landed on the
first page.

The remembered place gained an optional `collectionId`: the id of an impression
*on that page*. It is a stable content identifier, which a page number is not —
page indices move as the collection grows — and it is not a display string.

- `placeForPage` anchors a locality page to its first impression, so the two pages
  of one locality no longer describe themselves identically.
- `pageIndexForPlace` resolves the anchor, and checks that the page it lands on is
  in the locality the record named. A record written before the anchor existed, an
  impression that has since been cleared, and an anchor carried across from the
  other audience's collection all fall back to the locality's first page rather
  than erroring.
- The **deep-linked locality route** needed more than the record, because the
  route asks for a locality and cannot name a page inside it. Two things fixed
  it. `?stamp=<collection id>` is now carried by the overlay's **Open shop** link
  and by the ceremony's **Open in Passport** link, kept internal to Passport
  routes and whitelisted by name in `passportReturnHref` — which was rewritten to
  parse the whole href, reject anything that resolves off-origin or outside
  `/passport`, and re-encode only that one parameter. And at mount, a remembered
  place *inside* the locality the route asked for now outranks the locality's
  first page: a reload while reading page two asks for the locality, and the
  record is the same destination only more precise.
- The anchor is read from the URL at mount rather than through `useSearchParams`,
  which would take the statically prerendered `/passport` route out of static
  rendering for a parameter that only ever arrives on a client navigation.
- Route-driven requests and the mount-time resume are kept apart, as they already
  were: the watched prop stays free of the remembered place, so turning a page
  past the end of a locality cannot recompute a target and drag the reader back.
- One adjacent defect surfaced while testing this. On a desktop spread the
  remembered place came from the right-hand page, which on the final spread is the
  blank page a book always ends on — so a reader on the last real page was
  remembered as being nowhere. The right page still names the spread; when it has
  nothing to name, the left page does.

#### 2. One tab could erase another tab's record

`usePassportView` wrote its whole in-memory snapshot and never listened for
`storage`. A tab open since before the reader chose Book would write `mode: null`
back over that choice on its next scroll, and the same race could reset
`coverSeen` or the remembered place.

Both halves are now in place, mirroring `collection-store.tsx`:

- **Every write is a patch against what is stored**, re-read immediately
  beforehand. `mergePassportView` is the one place that combines them, so a field
  the patch does not name always survives.
- **Changes made elsewhere are adopted**, through a `storage` listener scoped to
  this audience's key. `lastWrittenRef` absorbs the echo, so two tabs cannot
  answer each other indefinitely. `localStorage.clear()` resolves to "nothing
  remembered", which is what a device that has never chosen holds.
- `coverSeen` is treated as a durable fact rather than a current state: no patch,
  and no rewritten storage, can bring the first-run ceremony back once a device
  has opened the cover.
- Adopting a mode or an opened cover does **not** move the page under the reader.
  A tab sitting on the closed cover stays there; it simply does not ask again next
  visit.
- The audiences stay isolated: the listener ignores the other key, and a default
  is still never written down as a choice.

#### 3. List scroll restoration was armed once per mount

The latch was set on the first List render and never reset, so a reader who
scrolled down, switched to Book — whose shorter document clamps `window.scrollY` —
and switched back was left wherever the clamp had put them.

- The latch is now re-armed whenever the overview list is left, for Book mode or
  for a country or locality route. It is a per-visit guard, not a per-mount one.
- The offset is re-applied for a short fixed frame budget rather than once,
  because the list is not yet tall enough on the frame a mode change commits and
  because the App Router scrolls a new route to the top *after* the render
  commits. Genuine input — wheel, touch, a key — cancels the rest of the budget,
  so it can never be mistaken for the page moving under the reader.
- A second defect fell out of testing this, and it is the one that made route
  navigation fail rather than merely clamp. The router scrolls to the top as it
  *begins* a navigation, before the URL changes and before this component
  unmounts, so the still-attached listener recorded 0 over the reader's real
  position. Recording now stops the moment a navigation starts — a click on a
  link, or Back — and re-arms on the next visit.
- The overview's offset is still never applied to a country or locality route,
  which is its own destination and starts at its own top.

#### Coverage added

- `src/features/passport/passport-view-state.test.ts` — the anchor's parsing,
  including a legacy record that must not gain a `collectionId` key, four
  unusable anchor values, and that the anchor is not case-folded; and
  `mergePassportView` in full: fields the patch does not name, fields it does,
  the durability of `coverSeen` in both directions, and that it never invents a
  mode.
- `src/features/passport/passport-pages.test.ts` — a synthesised locality of six
  impressions: that it really splits into two pages, that the two pages anchor
  differently, that a continuation page resolves back to itself, that every
  impression resolves to its own page, and the three fallbacks (no anchor, a
  cleared impression, an anchor from another locality).
- `src/components/shops/ShopBackLink.test.ts` — `passportReturnHref` against
  absolute, protocol-relative, `javascript:`, prefix-lookalike and traversal
  inputs; that only the anchor parameter survives; and that what
  `passportHrefWithAnchor` writes reads back unchanged.
- `src/components/passport/PassportScreen.test.tsx` — the two-tab rules as
  structure: adopting a mode chosen elsewhere, adopting an opened cover *without*
  springing the book open, ignoring the other audience's key, not erasing a field
  it was never told about, keeping an opened cover against a stale write, and
  resolving a cleared storage area to nothing remembered.
- `tests/e2e/passport.spec.ts` — the journeys. A locality across two pages:
  reload from `/passport` and from the locality route, a stamp opened from the
  continuation page returning to it by the back control and by browser Back, a
  stale anchor, an anchor from another locality, and List mode showing all six
  impressions regardless. Two tabs: a real second page adopting a mode choice
  without a reload, an opened cover, and neither tab erasing the other's work;
  plus a stale tab that missed the notification failing to erase anything. Scroll:
  List → Book → List, List → country route → List, and the overview's offset not
  reaching a locality route.
- `tests/support/local-state.ts` — `seedPagedLocality` and the fixture behind it.
  Six catalogue shops gathered into one locality with descending dates, so the
  page split is the same every run.

All three revisions are to remembered state rather than to what the Passport
looks like, so the WP3 evidence captures and the visual baselines were regenerated
and came back byte-identical. `pnpm verify`, `pnpm test:e2e`,
`pnpm build:cloudflare`, the visual suite and the WP3 evidence suite are all green
on the revised commit.

### WP3 revisions after the founder's staging review

**Reviewed:** 27 August 2026. Two corrections, both about things the Passport was
already carrying but not letting the reader reach.

#### 1. Derived seals are viewable

The founder found country seals rendered as artwork nobody could touch, and
locality seals reduced to a line of text — *"Locality seal earned 2026-03-14"* —
which is the one place in the Passport where a seal was not shown at all. A seal
is meaningful artwork; if a shop stamp enlarges, a seal has to.

`StampDetailOverlay` became `PassportDetailOverlay`, generalised over a subject
union rather than duplicated:

```ts
type PassportDetailSubject =
  | { kind: "impression"; collection: StampCollection }
  | { kind: "seal"; seal: EarnedSeal };
```

A union rather than one shape with optional fields, because the two are not
interchangeable in content. Each branch states what its own kind records:

- **A shop stamp** keeps exactly what it had — tier, shop name, local-script name,
  locality, country, the local collection date, and **Open shop**.
- **A country seal** shows the artwork at size, *Country seal*, the country, and
  the earned date.
- **A locality seal** shows the artwork at size, *Locality seal*, the locality, the
  country, and the earned date.

**No derived seal offers Open shop, and none reports a collection date.** A country
seal derives from five stamps or a complete curated set and a locality seal from
the first stamp there, so there is no single shop for either to lead to; offering
one would misreport what a seal is. The overlay simply ends on the earned date,
and says nothing about why (see the final review below). The reasoning stays in
the component as a code comment.

Where the seals became selectable:

- **List, country** — the artwork already sat at the head of each country section
  and is now a button. Still artwork, not a chip: WP1's filled vermilion "Country
  seal earned" badge is not coming back.
- **List, locality** — the text note in the locality heading is replaced by the
  seal artwork itself, as a button, sized as a mark beside a subheading rather
  than as a section emblem.
- **Book, seals page** — each earned country seal is a button. The *Not yet* row
  for an unearned one is unchanged and is not a control.
- **Book, locality page** — the text line is replaced by the seal artwork as a
  button, with *Locality seal · Earned <date>* as concise supporting text beside
  it. The stamp grid's top margin came in slightly to keep four impressions and a
  seal on one page.

**Nothing is shown for an unearned seal in List.** No locked silhouette, no
placeholder — `PRODUCT.md` and `UX.md` both rule that out, and an absent seal is
already legible from the seals page.

Two properties worth naming because they are easy to lose:

- A seal is a `<button>`, which the book's drag handler already refuses to start a
  page turn on — so pressing a seal enlarges it rather than dragging the leaf. The
  existing `closest("a, button, [data-no-drag]")` guard covers it with no change.
- The artwork inside each seal button is `aria-hidden`, and the accessible name is
  one line beside it: *"Country seal, Singapore, earned 2026-06-03"*. Without that
  the button would announce the impression's own long description twice over, and
  *"Japan"* alone would not say what had been earned.

Book geometry, the page order, continuation-page behaviour and the modal
guarantees — keyboard, touch, focus containment, Escape, a visible close control,
focus restoration — are unchanged and apply to seals exactly as to stamps.

#### 2. One control for the cover

At 360 px the floating **Open Passport** button sat partly behind the pager pill.
The two controls were the same idea from opposite ends — the way between the cover
and the pages — so they are now one control in one place, the first position in
the pager:

| Book | Visible label | Accessible name |
| --- | --- | --- |
| Closed | **Open** | Open Passport |
| Open | **Cover** | Cover |

The visible label is the shorter word so the strip fits at 360 px; the accessible
name is the longer one, and *Open* is contained in *Open Passport*, so the
label-in-name requirement holds. The same treatment applies at every breakpoint —
there is no reason for it to differ, and one control is simpler everywhere.

The floating button and its styles are gone. The pager already wraps onto two rows
below 480 px from the Codex-review pass, so removing the overlap needed no further
layout change.

The strip itself gained `role="group"` and the name *Passport pages*, which is
what the List/Book toggle already had. It names a set of related controls for a
screen reader, and it gives the tests a handle that is not a hashed CSS-module
class name — the first attempt at the 360 px test matched `_pagerCover_` as well
as `_pager_` in development and neither in the production build.

#### Coverage added

- `src/components/passport/PassportScreen.test.tsx` — the seals as structure: one
  country seal and five locality seals as named controls in List, nothing where
  none is earned, each overlay's own facts, the absence of **Open shop** and of a
  collection date, focus restoration for both kinds, the Book's country and
  locality seals, the disappearance of the text-only treatment, and that the
  shop-stamp overlay is untouched. Plus the pager: one Open control inside the
  strip, the same position becoming Cover, and returning through it.
- `tests/e2e/passport.spec.ts` — the journeys at all three breakpoints. A country
  seal opened by keyboard with focus contained and returned; a locality seal
  opened and closed by its own control; the Book's seals page; the Book's locality
  page proving the text line is gone and that pressing a seal does not turn the
  page; the shop stamp unchanged. And for the pager: one Open control in the
  strip beside Contents, the same position exposing Cover, and a 360 px check that
  the document does not overflow sideways, that every control is inside the
  viewport with a real tap target, and that the control still opens the book.

#### Evidence

Three captures were added at each of the three breakpoints — `seal-country`,
`seal-locality` and `book-locality-seal` — and the `book-cover` row now records
that the way in is **Open** inside the pager. The `passport-list` visual baselines
were regenerated, because the locality seals really are a visible change to that
screen; every other baseline still matches.

#### Deliberately not done

- **The sign-in explanation is unchanged**, as instructed.
- **No speculative redesign** of the areas the founder called *slightly odd*
  without concrete direction.
- **No WP5 material work.** The two overlays share one interaction and one layout;
  making them share a visual presentation family with the shop page's collected
  impression is recorded below as WP5's.
- **No Map changes.** The pointer and touch decisions from the same review are
  recorded below as WP6's.

### WP3 revisions after the final review

#### A seal overlay ends on its facts

The seal overlay carried one closing line — *"Derived from verified visits, not
collected on its own."* — added on the reasoning that an overlay ending straight
after the earned date would read as though **Open shop** had gone missing. The
review rejected that reasoning: the interface should not narrate why an
inapplicable action is absent, and the line was the same over-explicit pattern
the founder has asked us to drop elsewhere. It is gone, with nothing in its place,
along with its `.sealNote` rule. Why a seal has no shop to open stays where it
belongs — a code comment on `SealDetail`. `.facts` loses its bottom margin when it
is the last thing on the sheet, so the seal overlay closes on the earned date
rather than on a gap.

#### Two evidence captures were wrong

Regenerating the captures showed `stamp-detail` and `seal-locality` were
byte-identical, and `book-locality-seal` identical to `book-locality`:

- `stamp-detail` selected the first button containing *2026-03-14*. The locality
  seal for Chūō, Tokyo derives from that same stamp, so it carries that date too
  and now sits ahead of the rows — the capture was photographing the seal. It
  selects **Ginza Itoya Main Store** by name instead, which is what the row is
  identified by everywhere else in the suite.
- `book-locality-seal` opened the Book's locality page, which `book-locality`
  already shows. It now opens the seal from that page, which is the state the
  founder's correction was actually about; the README says which capture shows
  which.

Both were evidence defects only — `tests/e2e/passport.spec.ts` had targeted the
row by shop name from the start, so nothing about the interface was unverified.

## WP4 implementation record

Delivered on `claude/m1-5-wp4-shop-value`. Scope was WP4 only: the pen-specific
schema, the reordered shop page, the interim identity treatment, native
directions, nearby shops, and the contextual correction route. Nothing in
WP5–WP7 or WP-D was started, and no accepted decision was reinterpreted.

### The problem it solves

Root cause D: Milestone 1's shop record modelled name, address, hours, brands and
links, which is the shape of a general mapping listing, so the page read as one.
The founder's prototype modelled what a visitor can *do* — a service with an
access mode and a duration, an in-store experience with a nib count, an
in-store-only ink, the station you walk from and the floor you climb to.

WP4 builds that layer, in the order
[Proposed experience → Shop detail](#shop-detail) approves.

### The order, and where the actions sit

1. the designed identity plate, carrying the page's `h1`;
2. the shop's own name in its own script, then one concise line on why it may be
   worth the trip;
3. **what you can do there** — services with mode and duration, then in-store
   experiences, under two labelled subheadings;
4. **only available here**;
5. practical access — station and walking guidance, floor note, address, payment,
   languages, accessibility, official links — then opening hours, then brands as
   supporting information;
6. Save · Official site · Directions · Collect Stamp;
7. nearby pen shops;
8. the quiet provenance line, then the correction route.

The actions moved **below** the practical information, which is where the
approved order puts them and is a change from Milestone 1, where they sat in the
header. It is recorded here because it is the one place in the order where a
usability argument pulls the other way: on a 360 px screen Save and Collect are
now below the fold. The approved order was followed rather than split, because
the page's job is to answer "is this worth the trip?" before it offers to act on
the answer — and the founder's own prototype ordered it that way.

**Decided by the founder, 27 August 2026:** do not duplicate the action block in
the header for now. Keep the approved information order and evaluate it on
staging; Save and Collect sitting below the first mobile viewport is not
automatically a defect.

**Superseded 28 August 2026 by the staging review.** Judged on staging, the
placement was wrong on both mobile and desktop. The actions are in the header,
and they are not duplicated — see the revisions section below.

### The data, and the one honest outcome of it

No source in the prototype catalogue publishes a service, an in-store
experience, a shop-only item, a nearest station, a payment method or a language
for any of the ten real shops. Accepted decision 4 forbids inventing them, and
this work package did no new sourcing. So **every real shop page currently shows
the gap state**: one concise caution — "We have not confirmed what you can do at
this shop — services, in-store experiences, or anything sold only here." — and
the invitation "Know this shop? Help us improve this listing.", routed to
`hello@nibatlas.com` with subject `[Shop correction]` and the shop's name.

That is the designed answer to a material gap rather than a placeholder. It is
also the reason WP4's table row above reads *content awaits sourcing*: the layer
is built, tested and reviewable, and populating it is a sourcing task shared with
the founder and Codex.

The populated design is reviewable on `/styleguide`, from
`src/fixtures/shop-value-specimen.ts` — one invented record, marked `demo`,
carrying its own fixture notice, named so it cannot be mistaken for a business,
and rendered nowhere else. Putting the specimen on the internal styleguide rather
than on a shop page is the whole point: the design gets reviewed without a real
business being described by content its sources do not support.

### Every claim names a source that confirms it

Each pen-specific entry carries `confirmedBy`, holding the stable UUID `id` of
one of the record's own `sources` entries — and `shopEvidenceIssues` requires the named
source's own `confirms` list to cover *that* claim, not merely to exist.

The first version of this check used labels and tested source existence alone, which Codex's
review correctly called a P2: TY Lee's official source confirms only the shop's
local-script name, so a nib-grinding service could have cited it and the
catalogue test would have passed. Fixed by comparing a canonical evidence token —
`Service: Custom grind`, `Nearest station` — produced by one helper used by both
the data and the validator, so support is a lookup rather than a substring guess.
Comparison normalises case and whitespace and nothing looser.

Access and practical facts are now sourced **per field** rather than per block, so
a source that publishes a station cannot implicitly vouch for a payment method or
a spoken language. That makes the hole unsayable rather than merely detectable,
and lets one block rest on two sources.

The evidence registry keeps its source list, retrieval dates and `confirms`
breakdown, while `ShopSourceRef` now adds the stable UUID identity required by
the database-backed v1 detail projection. Reviewer mode still renders the list
in full — the tokens are readable English precisely because it prints them
verbatim.

`docs/api/fixture-contract.md` carries the field-by-field contract note, including
the two Milestone 1 fields folded into the new sourced blocks, the `services`
shape change, the per-field access and practical shapes, and the Milestone 3
mapping. **Decided by the founder, 27 August 2026 and implemented in Milestone 3
WP1:** the projection and deterministic fixtures use stable source UUIDs rather
than display labels, so rewording a label cannot silently break an evidence
reference.
`ShopMapSummary` is untouched.

### Photography

Accepted decision 5, implemented as a design rather than as a disclosure: a
paper-stock plate carrying the Nib Atlas mark, the shop name, and the shop's own
Atlas Stamp motif as a watermark in the impression's own ink, so the marker, the
page and the stamp read as one identity. One "Photos coming soon" caption, once.
No repeated empty gallery slots, and no photo-count badge — a count would be a
claim about images that do not exist.

### Directions

Native, per the approved experience: an Apple Maps universal link on Apple
platforms, the `geo:` intent on Android, and OpenStreetMap's directions page where
there is no application to hand to. The platform is read with
`useSyncExternalStore` so the server and client agree on the first render. Only
the destination travels; nothing sends a user position, and there is no embedded
itinerary. The *Map position* row stays reviewer-only, as WP1 left it.

### Nearby pen shops

Derived from the same catalogue the map reads. A distance appears only where both
records were placed from a sourced street address, rounded to 50 m under a
kilometre and labelled straight-line; a locality-centroid coordinate gets "Also
in Kobe" instead of a number it cannot support. Walking time is **not** shown —
that needs a routing source this repository does not have, so the section departs
from the wording in [Shop pages beyond a generic listing](#shop-pages-beyond-a-generic-listing)
and offers distance instead. No ordering to follow, no route, no named trip.

### One accessibility fix beyond the feature

`--action-secondary` (`#287a78`) measured 4.34:1 for the contribution invitation
at 14 px on the warm paper surface, failing AA. A darker step of the same accent,
`--teal-800` / `--action-secondary-text`, was added for text-sized links and
applied to the two inline links on the shop page, including the reviewer-mode
source links, which had the same latent failure.

### WP4 revisions after the founder's staging review

Recorded 28 August 2026. The sourced-value and provenance work was accepted; the
findings were about action hierarchy, redundant information, sparse desktop
composition, and where visit-planning information sits. The correction link was
accepted unchanged.

**The actions moved back to the header, and the earlier decision is reversed.**
The 27 August decision — keep the approved order, judge it on staging — was
judged on staging and the answer was no: an action block below the practical
detail was poorly placed on both mobile and desktop. Deciding whether to go and
being able to act on it belong together. The controls are now, in order: the Save
bookmark beside the shop's name, then Directions, then Collect Stamp. They are
not duplicated anywhere.

**Save is a bookmark, not a button.** As a full Atlas Navy button it competed
with Collect Stamp, which is the action the page is built around. It is now a
44 × 44 icon control beside the name — outlined unsaved, filled on the existing
Teal saved surface. State is carried three ways so colour never carries it alone:
the glyph fills, `aria-pressed` flips, and the accessible name changes between
*Save shop* and *Remove saved shop*. Behaviour and telemetry are unchanged, and
it stays a bookmark rather than a heart, per `UX.md`.

**Plum is the collection action; Vermilion stays the outcome.** Collecting was
Vermilion before anything had been collected, which made an invitation read as a
warning and collapsed action and outcome into one colour. `--action-collect`
(`plum-700`, `#6B3F63`, white text at 8.35:1) and `--action-collect-hover`
(`plum-800`, 10.69:1) are declared once; `plum-700` sits in the core palette and
is consumed independently by the stamp-ink registry and by the action, so neither
reads the other. A collection button is never coloured from a shop's own
`stamp.ink`. After collection, `View Atlas Stamp`, the collected line and the
impression keep the restrained Vermilion visited treatment. The ceremony,
preflight, reviewer wording and Passport transition are untouched. `BRAND.md`
carries the rule.

**The Official site button is gone.** The website was on the page twice. It stays
once, as a labelled contextual link inside *Before you go*, and the action-layer
lookup that fed the button went with it.

**`Getting there` became `Plan your visit`.** Payment, languages and a website do
not belong under a heading about arriving. One section now holds two subsections:
*Getting there* — station, walking guidance, floor note, address, nearby shops —
and *Before you go* — hours, appointment, payment, languages, accessibility,
official website. A subsection with nothing in it does not render, heading
included. Unknown hours keep their one caution.

**Nearby pen shops moved inside *Getting there*.** Which other shops are within
reach is part of planning the journey, not a separate topic, and a full-width
card for one or two links read as a larger feature than it is. Copy is now
`Approx. 550 m away`; the straight-line paragraph went with the move, because
`Approx.` carries the qualification and the honesty that matters is in
`nearbyPenShops`, which still offers no figure at all unless both records were
placed from a sourced street address. `Also in Kobe` is unchanged. Still no
route, order, or walking-time estimate.

**Unknown operational status is now a caution.** `Status not confirmed` blended
into the interface, so a shop nobody has verified read like one that had been. It
takes the warning semantic with a new pale amber ground (`--warning-surface`,
`#F7EBD7`; primary ink on it 13.8:1), paired with the alert icon and the same
wording. Not Vermilion, not Plum. Open is unchanged; the closed statuses keep the
warning treatment they already had.

**The desktop grid is one reading column.** The two-column grid presented a
sparse record as a few small boxes with an implied empty cell, which made a shop
that is honestly thin look unfinished. A single measured column has no cell to
leave empty. Nothing reserves space for what is absent: no placeholder cards, no
minimum heights, no filler, and no invented facts. Ginza Itoya still needs a
sourcing pass — this changes how its thinness reads, not what is known about it.
This is composition only; WP-D still owns the desktop audit.

### WP4 revisions after the second staging review

Recorded 30 August 2026. Three tightly scoped fixes; everything else the review
raised is WP6's and is recorded below rather than built here.

**The Save bookmark leads a fixed two-column title row.** A long or wrapping name
— `NAGASAWA Stationery Center Main Store`, `銀座 伊東屋 横浜元町` — pushed the
control beneath the name, so where it sat depended on the shop. The row is now
`grid-template-columns: var(--tap-target) minmax(0, 1fr)`: the control's own
44 px, then the name, which wraps inside its own column. States, `aria-pressed`,
both accessible names, the title, the telemetry and the behaviour are unchanged.

**Operational status has three levels of attention, not two.** The first review
made `Status not confirmed` amber because as a neutral badge it read as verified;
this one found the fix overshot, competing with an actual closure and leaving
`Open` invisible.

| Status | Treatment | Contrast |
| --- | --- | --- |
| `Open` | Success green on `--success-surface` (`#E3F0E6`), check icon | label 13.9:1, icon/border 4.7:1 |
| `Temporarily`/`Permanently closed` | Unchanged filled amber, alert icon — still the loudest | label 13.8:1 |
| `Status not confirmed` | Soft amber outline (`--warning-soft`) on the surrounding surface, secondary ink, alert icon at full strength | label 7.2:1 on Paper, 7.7:1 on white |

Wording and operational meaning are unchanged in all four cases, and no status
relies on colour alone. `Open` takes the success token rather than the Teal saved
one deliberately: saving is something the reader did, being open is something the
world is doing. The badge is shared, so this reaches the map and results cards
too — WP6 verifies it in the map context.

**The preflight's confirm button is Atlas Navy.** `I am at this shop`, and its
reviewer-mode wording, confirm an intent; they are neither the collectible entry
point nor a successful verification, and in Plum they read as the same step as
the header action. Cancel stays quiet. Dialog behaviour, focus management,
location copy, telemetry and the ceremony transition are untouched, and the
founder has accepted the Plum collection action and the Vermilion collected state
for this milestone.

### Staging findings recorded for WP6

Found in the second staging review of WP4 and **deliberately not implemented in
that work package**, because they are map-surface work and WP4 is a shop-page
package.

1. **Map-card state presentation conflates three dimensions.** `Visited`,
   `Not visited` and `Saved` share one pill treatment on the card, but they are
   not one axis: visited and saved are separate persisted states a reader owns,
   and "not visited" is the absence of one of them. WP6 separates them.
2. **Map filter buttons are not functioning.** Reported from staging; WP6 owns
   the diagnosis and the fix.
3. **`Open` has not been obvious enough on the map surfaces.** The shared status
   badge changed in WP4's second revision — success green for open, a soft amber
   outline for unconfirmed, filled amber kept for a closure — which should help.
   WP6 must verify it in the map and card context rather than assume it.

### Deliberately not done in WP4

- **No new sourcing.** This session did no web research, per its brief.
- **No invented service, experience, exclusive, station, payment method or
  language on any real record.**
- **No floor note derived from a Singapore unit number.** `#03-33` could be read
  as "third floor of The Adelphi", but that is an interpretation of the address,
  and the address is already shown verbatim. **Decided by the founder,
  27 August 2026:** keep the sourced address as it stands and do not duplicate an
  inferred reading of it.
- **No photographs**, and no gallery scaffolding waiting for them.
- **No reviews, ratings, social features, inventory, product catalogue,
  marketplace, merchant tooling, or community publishing.** The correction route
  is a pre-addressed mail, not a submission surface.
- **No Near Me or distance-from-user**, which accepted decision 7 defers.
- **No change to `ShopMapSummary`**, the map, the results sheet, or the Passport.
- **No desktop sign-off.** The 768 and 1440 captures show responsive integrity;
  WP-D owns the desktop treatment.
- **No map-card, filter, or map-interaction work.** The three findings above are
  recorded for WP6 and nothing in WP4 touches those surfaces.

### Coverage

- `src/domain/shop-evidence.test.ts` — the evidence rule in both halves: an
  unattached source, an attached but unrelated one (the real TY Lee official
  source against a nib service), one supported field failing to validate another
  in the same block, two sources supporting two fields of one block, a falsy
  claim still needing evidence, similar wording never counting as support, and
  the fully supported specimen passing. Plus the value-layer gap predicate.
- `src/domain/nearby-shops.test.ts` — distance rounding, the street-precision
  requirement, the radius, ordering, the cap, and the real catalogue pairs.
- `src/components/shops/directions.test.ts` — platform detection and the three
  hrefs, including that no user position is ever carried.
- `src/components/shops/ShopSaveButton.test.tsx` — the bookmark's toggle
  behaviour, its two accessible names, the non-colour state cue, that it is a
  bookmark rather than a heart, and that it writes to the shared store.
- `src/components/ui/StatusBadge.test.tsx` — the three-level operational
  hierarchy, that no status relies on colour alone, and that marker state is
  left alone by it.
- `src/components/shops/ShopDetailView.test.tsx` — the information order, the
  populated value layer, the gap state, silent omission of ordinary fields, the
  identity treatment, nearby honesty, and the correction subject.
- `src/fixtures/prototype-catalogue.test.ts` — every record's claims resolve, and
  no record carries an invented service, experience, exclusive, access or
  practical block.
- `tests/e2e/shop-value.spec.ts` — the journeys at all three breakpoints.
- `tests/evidence/wp4-shop-value.spec.ts` — the review screenshots in
  `docs/evidence/milestone-1-5-wp4/`.

## Founder decisions recorded for later work packages

Approved on 27 August 2026 during the WP3 staging review, recorded here so they
are not lost, and **deliberately not implemented in WP3**.

### For WP5 — one visual presentation family

> Enlarged shop impressions in Passport should use the same visual presentation
> family as the collected impression shown on a shop page. Country and locality
> seal overlays should belong to that same family while retaining type-appropriate
> facts and actions.

WP5 owns the shared visual treatment and the component consolidation behind it.
The two surfaces that have to converge are `PassportDetailOverlay` and the shop
page's *Your impression* block; WP3 has already made the Passport side one
component with one subject union, which is the seam that consolidation plugs into.

**Implemented in WP5.** The shop page's collected impression is the sheet
**View Atlas Stamp** opens, so `StampCeremony` was the second surface; both are
now built from `ImpressionSheet` and `ImpressionPlate`. See the WP5
implementation record below.

What must survive the consolidation, because it is content rather than treatment:
a shop stamp reports a collection date and leads to its shop; a derived seal
reports an earned date and leads nowhere. A shared presentation family is not a
shared fact list.

### For WP6 — Map card and marker interaction

Approved Map interaction, for WP6 to implement together with the corresponding
update to the Map interaction documentation:

- Hovering a shop card on pointer-capable desktop highlights and synchronises its
  marker.
- Keyboard focus gives the equivalent highlight.
- Activating the body of a shop card opens the shop detail page.
- On touch devices, tapping the card opens shop detail rather than merely selecting
  it.
- Clicking or tapping a map marker may continue to select and reveal its
  corresponding card.
- Explicit controls such as **Save** perform their own action without opening the
  shop.

WP6 owns implementation and the documentation update. **Map behaviour is unchanged
in WP3**, and `UX.md`'s map sections were deliberately left alone: correcting them
before the behaviour exists would put the documentation ahead of the product,
which is the opposite of the two corrections WP3 made to it.

**Implemented in WP6**, together with the `UX.md` correction. See the WP6
implementation record below.

## WP6 implementation record

Recorded 30 August 2026. WP6 is the filter drawer, the approved card and marker
interaction, and the three staging findings recorded against the map surfaces
during the second WP4 review. Scope was WP6 only: nothing in WP5, WP7 or WP-D was
started, no accepted decision above was reopened, and the shop page, Passport, Me
and collection seams were left alone.

### What WP6 changed

**1. Filters have a commit action of their own.** This is finding 2 — *map filter
buttons are not functioning* — and the diagnosis is that they were functioning
exactly as Milestone 1 built them. Every filter went into a *draft* set that took
effect only on the next committed search, so pressing `Saved` moved nothing and
the only signal was a line of small print reading *Search this area to apply*.
That is indistinguishable from broken, and a reader is right to call it broken.

What replaces it is an explicit transaction rather than no transaction at all:

- The **visit segment** is a top-level control, decided over the result set
  already in hand. Pressing it *is* its commit: it lands whole, on the same
  frame, with no request and no new search.
- The **drawer is a transaction.** Shop type and availability are edited as a
  draft and commit together on **Apply filters**, which also closes the drawer.
  Closing or cancelling discards the draft. **Clear** inside the drawer clears
  the draft controls, and applying that cleared state is what updates the
  results.

The reader never sees one dimension land while another waits on a query, which
is the failure the split had: availability would apply instantly while shop type
sat waiting. The drawer's scrim covers the segment while it is open, so a segment
press can never interleave with a drafted change either.

**Applying may carry the camera.** A reader who pans and then filters should get
one commit, not two: when the camera has moved far enough to be offering
**Search this area**, Apply commits those bounds together with the filters and
settles the offer — and the button reads *Apply and search this area* rather than
doing it silently. **Search this area** itself is untouched and remains the
commit for camera movement alone. The committed-bounds camera model of accepted
decision 10 is preserved.

**2. Segment plus drawer, with an active count and a one-tap clear.** Following
the founder's prototype `.fsheet`:

- Visit status is a segment — **All / Unvisited / Saved / Visited** — always
  visible beside the results. All four choices are kept: the staging finding was
  about how three states were *drawn on a card*, not about which filters exist.
- **Filters** is one labelled button opening a drawer holding shop type and
  availability. On mobile the drawer is a bottom sheet clear of the persistent
  navigation; from 1024 px it anchors to the results panel.
- The button carries a badge counting the criteria *applied* inside the drawer —
  never a draft, because the badge describes the results on screen. The segment
  is not counted there, because counting a choice the reader can already see
  labels nothing.
- The drawer names the number of shops the draft matches, which is the plainest
  possible evidence that a filter will do something. It is shown only when it can
  be counted **exactly** from the results already loaded, and the drawer says
  *Apply to see what matches* rather than guessing when it cannot: a draft that
  *widens* the committed shop types asks about shops the source never returned,
  and a truncated result set is a lower bound on any question at all.
- **Clear** inside the drawer clears the controls the drawer *holds* — shop type
  and availability. It deliberately leaves the visit segment alone: that control
  is outside the drawer, and silently resetting a choice a reader made out there
  is not what a drawer's clear is for.
- **Clear filters** appears beside the button whenever anything is applied, the
  segment included, and clears everything in one press from outside the drawer.

**Availability is honest about what it knows.** The options are *Any recorded
status*, *Recorded as open* and *Hide recorded closures* — worded so they cannot
be read as *Open now* — and they filter the operational status a record carries.
The drawer repeats it underneath in as many words: opening hours are not
modelled, current availability is never inferred from partial hours, and an
availability filter that implied otherwise would be a claim the catalogue cannot
support.

**3. The visit segment reads the reader's own sets as independent sets.** Saved,
visited and unvisited are not four points on one axis:

- **Unvisited** is *not in the visited set* — a shop the reader saved but has not
  been to is in it.
- **Saved** is *in the saved set*, whether visited or not.
- **Visited** is *in the visited set*, whether saved or not.

A shop that is both saved and visited has the marker state `visited`, because
`UX.md` gives visited priority in the marker. That is a *presentation* rule.
Used as a *filter* rule it dropped saved-and-visited shops out of Saved, which is
wrong: the reader still saved them. The filter reads the saved and visited sets
directly, and the marker keeps its documented priority.

**4. Card states are separated.** This is finding 1, and it is a *presentation*
change only — no filter was removed for it. `Visited`, `Not visited` and `Saved`
shared one pill treatment, which drew three things as three positions on one
axis. They are not one axis:

- **Visited** is its own badge, drawn only when it applies.
- **Saved** is carried by the card's own **Save** control, which already states
  it in text, icon and pressed state. A second identical pill directly above that
  control said the same thing twice.
- **Not visited** is drawn as nothing at all, because the absence of a state is
  not a state.

**5. The approved card and marker interaction**, as recorded above:

- Hovering a card on a pointer-capable device highlights and synchronises its
  marker. The check is `(hover: hover) and (pointer: fine)`, so a touch tap —
  which also raises `mouseenter` — never strands a highlight with no way off it.
- Keyboard focus gives the equivalent highlight.
- Activating the body of a card opens the shop. The card name is the link and it
  covers the card, so the whole body opens the shop on touch as on a pointer.
- Clicking or tapping a marker still selects and reveals its card.
- **Save** is above the card-wide link and performs its own action only.

A highlight is not a selection. It never changes the shared selected shop, never
moves the camera, and does not survive the pointer or focus leaving — so it is
drawn as a lighter ring on the marker and a warm edge on the card, distinct from
the selection halo. It is applied to the marker element in place rather than by
rebuilding it, so a pointer sweeping down the results does not churn the marker
layer.

**A clustered shop still answers.** Where the highlighted shop's own marker does
not exist at the current zoom, the cluster standing for it takes the ring.
Clustering is not rearranged to suit a hover — pinning the hovered shop out of
its cluster would make markers appear and disappear under the pointer — and
without this the synchronisation would silently do nothing wherever the map is
dense, which is most of the opening view.

The card's `Shop details` button is gone. With the body of the card opening the
shop it was a second control for the same destination, and Milestone 1 only
needed it because the card itself did nothing a reader could see.

**6. Finding 3 — operational status on the map surfaces — is verified rather than
assumed.** WP4's second revision gave the shared badge three levels of attention;
`tests/e2e/explore.spec.ts` now asserts them as rendered colour *on a map card*:

- `Open` — the success green (`rgb(227, 240, 230)` on `rgb(47, 118, 83)`), which
  is what finding 3 asked for.
- `Status not confirmed` — the softer amber outline, transparent on
  `rgb(207, 169, 111)`, still labelled and still carrying its icon.
- A confirmed closure — the stronger filled amber, asserted as the distinct
  `--warning-surface` token the unconfirmed status deliberately does not take.
  No record in the catalogue is closed, so the closed treatment is asserted
  against the token rather than invented on a fixture.

The same test confirms operational status stays separate from the reader's own
state: it is about the shop, `Visited` and `Saved` are about the reader, and no
`Not visited` pill appears alongside either.

### Corrections made during review

Recorded because each was a real defect rather than a preference.

1. **The founder's correction: `Unvisited` was removed and should not have
   been.** WP6's first pass read finding 1 — three conflated states on a card —
   as a reason to drop the `Unvisited` filter. It was not. The finding was about
   presentation; the filter set is unchanged, and the four choices are the
   independent sets described above. The 26 August *Proposed experience*
   paragraph carries a dated amendment saying so.
2. **The founder's correction: the drawer had no commit action.** The first pass
   removed the draft/committed split entirely, which fixed the "not functioning"
   report by making availability apply instantly while a shop type still waited
   on a query — the inconsistency this record now describes as the thing to
   avoid. The drawer is a transaction instead.
3. **The drawer's Clear reset the visit segment.** Found by the review bot. It
   replaced the whole draft with the empty set, so Apply silently cleared a
   segment choice made outside the drawer. It now preserves the segment.
4. **A clustered shop's highlight did nothing.** Found by the review bot. Only
   single-shop markers were tracked, so wherever the map was dense — most of the
   opening view — hovering or focusing a card highlighted nothing at all. The
   cluster standing for the shop now takes the ring.
5. **The drawer did not trap focus.** Found by the review bot. `aria-modal` does
   not make the rest of the page inert, so Tab walked out behind the scrim. It
   uses `useDialogFocus`, the modal focus contract every other dialog here
   already used and which the first pass should have reached for.

### Interaction consequences worth recording

- **Saved mode no longer flies the camera from a card.** Selecting a saved shop
  used to move the map to it; the card now opens the shop, which is what the
  approved interaction asks for. The Saved banner copy was corrected to match
  rather than left describing behaviour that no longer exists.
- **The mobile Peek state still shows no filters.** Peek shows the count and the
  top of the first or selected card, per `UX.md`; the segment and the button
  appear from Half.

### Deliberately not done in WP6

- **No visual-fidelity work.** The shop identity system, paper and cover texture,
  the stamp at large size and the ceremony material pass are WP5.
- **No contact or contribution routes.** WP7 owns them.
- **No new filter criteria beyond the approved set**, and none removed. No
  distance, no rating, no price, no opening-hours filter — the last because hours
  are not modelled, and no current availability is inferred from partial ones.
- **No change to the shop page, Passport, Me, or the collection ceremony.**
  `MarkerStateBadge` keeps its collapsed single-state form where exactly one
  marker state applies by definition.
- **No desktop sign-off.** The 768 and 1440 captures show responsive integrity;
  WP-D owns the desktop treatment.

### Coverage

- `src/domain/filters.test.ts` — all four visit choices, the four choices read as
  independent sets, the two counts, equality including availability, and
  availability filtering on recorded operational status only.
- `src/domain/user-state.test.ts` — that a saved-and-visited shop stays in the
  Saved segment while its marker stays visited, that a saved-but-unvisited shop
  stays in Unvisited, and availability filtering after the merge.
- `src/features/explore/explore-state.test.ts` — the segment committing on press
  with no round trip; the drawer holding a draft, committing every dimension in
  one request, discarding on close, and needing no request when nothing the
  source resolves has changed; the draft clear needing an apply and leaving the
  segment alone; applying with
  and without the moved camera; the one-tap clear; and the predicate that decides
  whether a draft can be counted exactly.
- `src/components/map/MapFilters.test.tsx` — the four-choice segment, what the
  drawer holds, drawer controls drawn from the draft, the badge counting only
  applied criteria, the draft clear and its scope, the two Apply labels, the
  count shown only when it is exact, the one-tap clear, and the drawer's focus
  trap, Escape and scrim behaviour.
- `src/components/shops/ShopList.test.tsx` — the card body as a link, hover
  highlighting only on a fine pointer, keyboard focus giving the equivalent,
  selected and highlighted drawn apart, the separated states, and Save acting
  without opening the shop.
- `tests/e2e/explore.spec.ts` — the drawer holding a draft until applied,
  discarding on close, committing every dimension together, the draft clear, the
  segment committing on press with Unvisited including a saved shop, applying
  after a pan, the card/marker synchronisation including a clustered shop
  highlighting its cluster, card activation versus Save, and finding 3's three
  rendered operational-status treatments on a map card.
- `tests/e2e/accessibility.spec.ts` — the drawer audited open with axe, plus its
  keyboard contract: focus in on open, back to the trigger on close, and Escape
  closing without applying. The audit caught a real contrast failure — the
  drawer's group labels were `--text-muted` at 12 px bold, 4.35:1 — which is
  fixed rather than excluded.
- `tests/e2e/results-sheet.spec.ts` — marker selection still keeping the sheet,
  the summary and the card in step.
- `tests/evidence/wp6-map-interactions.spec.ts` — the review screenshots in
  `docs/evidence/milestone-1-5-wp6/`.
- `tests/visual/breakpoints.spec.ts-snapshots/` — the map and Saved baselines
  refreshed for the new filter row and card.

## WP5 implementation record

Recorded 31 August 2026. WP5 is the impression and seal material system, the
detail-overlay consolidation, the application-frame correction, and the Passport
navigation fix. Scope was WP5 only: nothing in WP7 or WP-D was started, no
accepted decision above was reopened, private visit notes (issue #11) were not
implemented in any form, and the map's filter semantics, the shop page's content
order and the Passport's information architecture were left alone.

### What WP5 changed

#### 1. One impression family

`ImpressionPlate` is the paper an Atlas Stamp is pressed onto, and it is now the
only thing that supplies one. It owns the stock, the hairline edge, the tooth,
the pressed depth and the single press angle, all from the new `--impression-*`
tokens recorded in `BRAND.md`. Four sizes: a List row's thumbnail, a seal beside
a section heading, a book page — the one case that carries *no* plate stock,
because there the leaf is the paper — and the enlarged sheet.

`ImpressionSheet` is the surface an enlarged impression is shown on: the scrim,
the dialog, the tier overline, the close control, the spacing rhythm and the
`dvh` height cap. The Passport's enlarged shop stamp, its two seal overlays and
the collection ceremony a shop page opens are all built from it, which is what
the founder's WP3 decision asked for — the enlarged Passport impression and the
collected impression a shop page shows are now visibly the same object.

The audit found four approximations of one idea: two scrim opacities, three
shadows, two paper stocks, two maximum widths, a `vh` cap on one overlay and a
`dvh` cap on another, and the tier label above the artwork in one place and below
it in the next.

#### 2. Three anatomies for three artefacts

`BRAND.md` already said tier is carried by frame and anatomy rather than by
colour. It was carried by the frame alone: a locality seal was a shop stamp with
square corners, drawn with a street motif borrowed from one of its shops.

- A **shop stamp** stays asymmetric — name from the left, its own motif pressed
  to the right, rounded frame.
- A **locality seal** is symmetric: its country named above, its own name
  centred, its motif centred beneath, cornered frame.
- A **country seal** is symmetric and led by the Nib Atlas device — a simplified
  circle, meridian grid and nib breather — rather than by any one shop's motif,
  because a country seal is derived from verified visits rather than pressed at a
  place. Double rule.

No fact was added or removed. A shop stamp still reports a collection date and
leads to its shop; a derived seal still reports an earned date and leads nowhere;
the explanatory sentence WP3's final review removed from beneath a seal has not
returned, and `PassportDetailOverlay.test.tsx` asserts that in both seal
branches.

#### 3. Small impressions are legible, enlarged ones reveal detail

A List row drew the full six-line composition at 4.75 rem, where the 600-unit
canvas scales by about an eighth: the date, the provenance and the place line
were mottle rather than type. Impressions below roughly 6 rem now use a
**compact composition** that drops those three lines and sets what remains large
enough to read — and every surface that uses it already states them in real text
beside the impression. The thumbnail itself went from 4.75 rem to 5.5 rem.

At the other end, the enlarged impression was capped at 13 rem by a `max-width`
on the figure inside a dialog with far more room. The cap is gone; the plate
sizes the impression.

**Long names wrap.** Milestone 1 stepped the font size down to hold a name on one
line at any cost, so `NAGASAWA Stationery Center Main Store` ran under the motif.
`fitStampTitle` now picks a size and a set of lines together, breaking Latin at
word boundaries and full-width scripts between characters. Width is estimated
rather than measured, so the same impression draws identically on the server, in
a test renderer and in the browser.

#### 4. The application frame — the viewport root cause

The founder reported that the effective viewport felt different between Shop and
Passport. It was, and there were three independent causes.

**Every full-height surface computed the available height for itself.** The map
subtracted `var(--nav-height)` on mobile — a token that does not include the
navigation's own 1 px top border, so the map document was permanently one pixel
taller than the viewport — and a hard-coded `3.5rem` at desktop. The Passport's
book asked for `height: 100%` from an ancestor whose height was only a
*minimum*, so it silently fell back to the book's intrinsic height. At the
360 × 800 screenshot size that happened to fit. On a real phone showing its
browser chrome, or on any shorter device, it did not: at 360 × 640 the Passport
document was 791 px tall, the page scrolled, and the pager — the way into the
book — sat about 140 px below the fold.

`AppShell` now owns the available height. Documents keep `min-height: 100dvh` and
grow; surfaces that are *objects* rather than documents declare
`data-app-frame="fixed"` and the frame locks to `100dvh`, so `1fr` means the
space actually left. The map is always one; the Passport is one in Book mode and
is not one in List, which is why the shell reads the screen's own declaration
through `:has()` rather than the route — a browser without `:has()` falls back to
today's behaviour rather than to anything broken. No surface subtracts chrome by
hand any more, and the book measures the stage it is given rather than the field
minus a hand-tuned 132 px constant.

**The shell's rows were auto-placed.** The map hides the header with
`display: none`, which takes it out of the grid entirely — so every remaining
child moved up a row and the section navigation, not the screen, took the `1fr`.
It went unnoticed while the shell was only a minimum height; the moment the frame
was locked it made the map 192 px tall and the navigation 608. The three rows are
now named explicitly.

**A specimen with a wide minimum widened the styleguide document.** At 360 px the
styleguide laid out at 614 px, and a mobile browser answered by zooming the whole
page out — literally a different effective viewport from every other screen in
the product. Two causes: a grid track's automatic minimum is its content's
min-content width, and the shop-value specimen's `max-width: 34rem` clamped that
minimum at 544 px; and `.badge` sets `white-space: nowrap`, which is right for a
status pill and wrong for the prototype notice, which holds a sentence.

Also corrected while auditing viewport units: the Passport overlay capped itself
against `100vh` — the *largest* viewport — so on a mobile browser showing its
toolbars the sheet could be taller than the space it had. Every modal sheet now
caps against `100dvh` and pads for the safe area at top and bottom.

#### 5. Passport navigation from the first frame

The affected control was not one control. In Book mode the frame defect put the
whole Passport chrome outside the initial viewport: at 360 × 640 the List/Book
toggle had already scrolled off the top by the time the book opened, and the
pager sat below the fold. Fixing the frame fixed both, with no duplicate control
and no new floating button — WP3 had already merged the floating opener into the
pager, and that stays one control.

Two smaller corrections went with it. The List/Book toggle's buttons were
`--tap-target` less 6 px, so the Passport's own mode control was a 38 px target;
the track gives up its padding instead. And the book is now centred on its stage
by position rather than by alignment: a grid item larger than its area has its
start edge pinned rather than being centred, which put the scaled book below the
stage and behind the pager on a short screen.

#### 6. Two defects found while auditing, fixed

- **The identity plate broke a lone shop name two characters to a line.**
  `.heroNameRow` is a two-column grid — the Save bookmark's 44 px, then the name
  — and auto-placement put a name with no bookmark beside it into the bookmark's
  column, where `overflow-wrap: anywhere` did the rest. Only the styleguide
  specimen renders the plate without a Save control, which is why the shop page
  never showed it.
- **Reduced motion moved the mobile Passport cover off centre.** The
  reduced-motion block restated `--book-shift` for a closed book at equal
  specificity and later in the file, overriding the portrait reader's own
  `0px` — so with motion reduced the closed cover sat half a leaf to the left.
  The reduced-motion block owns the tilts and the transitions; it does not own
  where the object sits.

### Deliberately not done

- **No private visit notes.** Issue #11 depends on authentication, Supabase
  persistence and owner-only row-level security. Nothing device-local was added,
  and nothing anywhere presents a note as account-private.
- **No WP7 contribution routes and no WP-D desktop treatment.** The 768 × 1024
  and 1440 × 900 work is responsive integrity only; the reading-column comparison
  in `tests/e2e/app-frame.spec.ts` is skipped at and above 1024 px because the two
  surfaces take different measures there on purpose, and that is WP-D's to
  decide.
- **No new shop research, photography, or stamp commissions.** No shop artwork,
  logo, photograph or fact was invented; the country seal's device is the Nib
  Atlas mark's own geometry, which claims nothing about a place.
- **No API, schema, Supabase, authentication or deployment changes.**
- **The map's results sheet keeps its own `dvh` fractions.** They are WP6's, they
  are measured against a frame that is now correct, and reworking them was not
  what the brief asked for.
- **The scroll-restoration parallel-load flake was not chased.** This work did not
  make it consistently reproducible, and the instruction was to leave it.

### Coverage

- `src/components/stamps/stamp-title.test.ts` — the fitting rules in both
  directions, every catalogue name against its own width budget, full-width
  script breaking, an unbreakable word, and determinism.
- `src/components/stamps/StampArt.test.tsx` — one canvas and one foot for all
  three tiers, ink taken from the design and never from the tier, the three
  anatomies apart, the compact composition dropping exactly the lines it should
  while keeping the same accessible description, and long names wrapping.
- `src/components/passport/PassportDetailOverlay.test.tsx` — the three overlays
  audited together for dialog semantics, header and dismissal placement, Escape,
  the close control, the backdrop, the enlarged plate, the fact list and the
  machine-readable date; then each kind's own content, including the removed
  explanatory sentence staying removed.
- `tests/e2e/app-frame.spec.ts` — no route wider than its viewport and no browser
  zoom-out on any of them, the map and the book filling the frame without
  scrolling it, Shop and Passport sharing one reading band, the section
  navigation reachable from the initial viewport at every width, the Passport's
  toggle and pager in view before any scrolling in both modes, and the same at
  360 × 568 under the `@short` tag.
- `tests/e2e/accessibility.spec.ts` — the touch-target audit extended across the
  Passport, both overlays and Book mode, and the collection dialogs audited after
  their entrance settles now that the ceremony shares the sheet's animation.
- `playwright.config.ts` — a `mobile-360x568` project that runs the `@short`
  cases.
- `tests/visual/breakpoints.spec.ts` — three new states at each breakpoint
  (`passport-book-open`, `impression-detail`, `seal-detail`) plus
  `passport-book-short` at 360 × 568.
- `tests/evidence/wp5-impression-materials.spec.ts` — the review screenshots in
  `docs/evidence/milestone-1-5-wp5/`.

### Visual baselines

Every baseline in `tests/visual/breakpoints.spec.ts-snapshots/` was recaptured.
The container this branch was developed in ships a newer Chromium than the one
that produced the committed set, and it renders text differently: `privacy` and
`about`, which this branch does not touch at all, differed by 0.07–0.09 of their
pixels before any WP5 change was applied. The spec's own header already records
that a different image needs one `--update-snapshots` pass.

The baselines that changed for WP5 reasons, as opposed to renderer drift:

| Baseline | Why |
| --- | --- |
| `passport-list-*` | Impressions on plates, the compact composition, a wider thumbnail, a 44 px toggle |
| `passport-book-closed-*` | The book measures the stage; the closed fit changed with it |
| `styleguide-*` | 584 px wide at a 360 px viewport before, 360 px after; new impression specimens |
| `map-*`, `saved-mode-*` | The map no longer subtracts chrome by hand, so the document is exactly the viewport |
| `shop-detail-*`, `shop-detail-omitted-*` | The identity plate's name row |

`passport-book-open-*`, `impression-detail-*`, `seal-detail-*` and
`passport-book-short-mobile-360x568` are new.

## Correction after WP5 — viewing an impression already collected

**Implemented:** 31 August 2026 · Claude Code · standalone, outside any work
package. Raised by the founder from staging.

**The defect.** After WP4 the shop-page action correctly reads **View Atlas
Stamp** once an impression exists. Tapping it opened the collection preflight
anyway, retitled *You already have this stamp*, whose confirm button read *Show
the impression* — so a control that announced it would show the stamp asked the
reader to confirm a collection they had already made, and then showed it. Three
taps for a thing the button had already named.

Worse than the extra tap: that confirm button called `collectStamp` on a shop
that was already collected. The store is idempotent — it finds the existing
collection and returns it before constructing anything — so nothing was
corrupted and no date moved. But the product was routing a read through a write
path, and recording a `stamp_collected` event with `outcome: "duplicate"` for
something that was not a collection attempt at all.

**The correction.** Viewing and collecting are two acts and now take two paths.
An owned impression opens its `ImpressionSheet` directly from the button, in one
tap. The preflight is once again only ever the pre-collection dialog, so its
`existing` branches — the alternate title, the *Opening it again does not issue a
second stamp* paragraph, and the *Show the impression* label — are gone rather
than left unreachable.

**What did not change.** First-time collection is untouched: the same preflight,
the same location copy, the same reviewer diagnostic, the same ceremony with its
press. `StampCeremony` needed no modification — `alreadyCollected` already
suppresses the press and already titles the sheet *Already in your Passport* —
and WP5's `ImpressionPlate` and `ImpressionSheet` primitives are not modified at
all. No second stamp is issued, `collectedOn` does not move, and the impression
the sheet reports is the same object the Passport holds.

**The duplicate outcome survives, narrowed.** `confirmCollection` can still be
reached with an impression in place, by one route only: another tab collecting
this shop while the preflight is open. The cross-tab listener the WP2 store owns
makes that reachable, the store resolves it to the impression that already
exists, and the event still says `duplicate`. What no longer happens is a
collection event for a reader who only pressed *View*.

**Coverage.** `src/components/shops/ShopActions.test.tsx` gains five assertions:
one tap with no dialog in between, no second impression and no moved date, no
press replay, focus taken and handed back, and first-time collection unchanged.
`tests/e2e/explore.spec.ts` loses the two removed steps from both collection
journeys and gains an assertion that the preflight does not appear.
`tests/evidence/wp5-impression-materials.spec.ts` reaches the same WP5 specimen
in one tap; the baseline it captures is unchanged.

## WP7 implementation record

**Implemented:** 31 August 2026 · Claude Code · branch
`claude/nibatlas-wp7-contribute`

### Accepted decision 8, amended again

The 27 August amendment fixed `mailto:` as the destination "until Milestone 6"
and called the dedicated `/suggest-shop` form "a later implementation". The
founder settled otherwise: **both contribution routes are real forms now.**

Two things changed the arithmetic. The catalogue is not small — 280+ known
businesses researched, against the ten fixtures the prototype carries — and
correction volume scales with listings, not with visitors. And a `mailto:` fails
silently for anyone on webmail, which is not a rare configuration.

**The email addresses stay, and are not vestigial.** They are what each form
offers when it cannot deliver, because an address has no service behind it to be
unavailable. Nothing else links to them, and both are still asserted exactly.

**Help and contact is settled.** Decision 8 recorded it as never having been
decided — destination, subject line and copy all open, and "an address may not
be the right answer at all". The founder's answer is a page: a short walkthrough
of how the product works, then the questions people actually ask, with the
address as the last line rather than the headline. A person who can find their
answer would rather not write to anyone.

### Where a submission goes, and what this repository owns

The browser posts to `POST /api/contribute` on the Nib Atlas Worker; the Worker
verifies a Cloudflare Turnstile token and forwards to a Google Apps Script Web
App; the script appends a row to a spreadsheet the research team reads.

**The Worker exists to keep the browser out of it.** An Apps Script Web App set
to *Anyone* is a public, unauthenticated write endpoint, so a page posting to it
directly would publish both the deployment URL and the shared secret to whoever
opened the network tab. The URL and both secrets are Worker secrets and never
reach a build.

**This is not the backend, and it is not Supabase.** Nothing here writes to a
database, defines a schema, or commits the project to the `contributions` table
`DATA-MODEL.md` reserves for Phase 2. When the real pipeline arrives, the sheet
becomes an import source. `scripts/apps-script/contribute.gs` is the script's
source of truth and `docs/runbooks/contribution-intake.md` is its setup.

### What WP7 changed

**`/suggest-shop` is a real page with a real form.** Nine fields, of which two
are required — the shop's name and its country. Two sentences of context sit
before the fields, saying that listings are checked by hand and that not every
suggestion becomes one.

**Required is marked, and the legend says what the mark means.** The first draft
marked *optional* instead, on the argument that six of nine fields are optional
so asterisks would decorate the page. The founder's staging review rejected it:
the convention a reader already knows beats a cleverer inversion, and *optional*
repeated six times reads as a form apologising for itself. Each required control
also carries `required`, so assistive technology announces it rather than relying
on a character a screen reader may skip.

**The city stopped being required**, in the same review. A form that refuses a
lead over a missing field loses the lead, and a shop name with a country is
researchable.

### The staging review of the form

The founder's verdict on the first draft was that it read as machine-written
rather than human. Five changes, all of them removals or plain-language
substitutions:

- **Two paragraphs of justification are gone** — the one explaining what
  research does with a suggestion at length, and *"The shop's name and where it
  is are the parts we need… a detailed description of a shop we cannot find, we
  cannot"*, which lectured the reader about their own submission.
- **The closing paragraph is gone**, which explained that a correction is a
  different job and linked to About. Someone who came here to name a missing shop
  does not need routing elsewhere at the end of it.
- **"Name in the local script" became "Local name"**, and its hint gives two
  real examples from the catalogue — 激墨 and ナガサワ文具センター — rather than
  describing the concept.
- **The confirmation offers a blank form.** Somebody who knows one missing shop
  often knows two, and *Suggest another shop* clears the previous answers so the
  second is not the first one edited.

### The second review: the voice, and a form that only knew how to complain

**The confirmations were corporate, and `BRAND.md` already forbids it.** *"Thank
you — that reached us"* over *"Someone will check this against the shop's own
sources"* is the register of a support-ticket auto-reply, and the personality
list names *corporate SaaS* as something Nib Atlas is not. They are now
**Thanks for contributing!** and **Thanks for reporting!**, and the body speaks
as us rather than about an unnamed someone: *"We'll take a look and get the
listing updated. If you left an email, we might write if we have a question."*

**The correction list only knew how to complain.** Six entries, every one of
them a fault. A reader who had just found something *good* — a service the
listing never mentioned, a shop doing more than we knew — had nowhere to put it
except *Something else*, which frames a gift as a grievance. Two entries now
cover those: **Something's missing that should be here** and **They do more than
we've listed**, and they lead the list rather than trailing it. The order runs
from the additions through the corrections to the closure, so the first thing a
reader sees is not a way to tell us we were wrong.

The page lede follows: *"Tell us what needs fixing — or what we've missed."* The
founder-approved entry-point copy on the shop page is untouched.

**Two labels, and one control that lied.** *What kind of thing is wrong* became
**What needs to be fixed?**, and *What we have wrong, and what it should say*
became **Tell us more**, with the specifics moved into a hint — neither label
works once the answer might be an addition. The select's *Choose one* prompt was
a selectable option, so the placeholder could be submitted as an answer; it is
`disabled` now, and the control's `required` makes the empty value fail
validation.

**The correction lives at `/shops/[slug]/report`.** The listing is in the route,
so the page resolves the shop and names it in the heading — not in a prefilled
field somebody has to read and verify. The reader never identifies the listing,
which is what decision 8 asks for and what the `mailto:` could only approximate.
Both existing entry points — the foot of the page and the material-gap
invitation — go to the same form. The approved copy is unchanged, word for word.

**The listing is resolved server-side.** `POST /api/contribute` looks the slug up
in the catalogue and supplies `shop_slug` and `shop_name` itself;
`normaliseSubmission` drops both if a request names them. A correction filed
against a shop that does not exist is refused. This was found by its own test,
which is the argument for having written it: the first implementation spread the
request over the resolved context, and a client could have chosen the listing.

**A name is required exactly when an email is given.** Both are optional; an
address with nobody to address is not useful. Neither is required for a
submission to be accepted, and an anonymous one is not treated differently. When
accounts land, the pair fills from the profile instead.

**Nothing reports a success it did not get.** The confirmation replaces the form
only after the route answered `ok`. Every failure — the intake down, the network
gone, the challenge unverified — keeps every character that was typed exactly
where it was typed, says plainly that it did not send, and offers the email.

**Turnstile cannot be switched off by omission.** A production build with no
`TURNSTILE_SECRET_KEY` refuses submissions rather than accepting unverified
ones; locally and in the end-to-end suite there is no key, no widget, and the
check is skipped. The failure mode of a misconfigured deployment is that nothing
arrives, never that anything arrives unchecked.

**Everything is validated twice, from one definition.**
`src/features/contribute/contribute-schema.ts` is what the form renders from,
what the browser checks against, and what the route checks against. The third is
the control; the first two are a courtesy to the person typing.

**Help returns to Me, and the section is renamed with it.** Revision 22 removed
the help row for carrying *Not open yet* and renamed the group from "Help and
about" to "About", on the grounds that a heading naming help that does not exist
is the same inaccuracy one level up. Both halves now run the other way. The
anchor stays `#me-about`: `/account` links to it, and renaming a heading is not
a reason to break a route.

**Privacy says what leaves the browser.** A new section names what is sent, that
Google processes it, that name and email are optional, and that Turnstile is not
an advertising product. *"Nothing Nib Atlas holds for you today leaves this
browser"* became *"leaves this browser on its own"* — the claim was about saved
shops and impressions and is still true of them, but a page with two send
buttons on it cannot state it unqualified.

**About's promise is redeemed.** *"a way to do that is coming"* is now the two
routes. Nothing else on that page was touched — its content needs a rework of
its own, raised as issue #17 and deliberately left alone here.

### Coverage is named in one place

Help does not restate which countries are covered. *Where does Nib Atlas cover*
links to About, which derives its list from the catalogue.

This is not tidiness. A written country list can drift from catalogue-derived
counts as soon as sourced records change. Two pages both naming countries would
be two places to be wrong. An end-to-end test asserts Help names no country
list.

**The underlying fix is not WP7's.** The international-content foundation now
accepts ISO alpha-2-shaped country codes, derives display labels with
`Intl.DisplayNames`, and stores each local shop name's BCP 47 language tag
explicitly. It does not infer language from country, and seals remain generic
over `CountryCode`. Public coverage copy is derived from the catalogue and
describes only what it currently contains; it makes no promise about future
geographic rollout or national completeness. No Korean or Malaysian
shop data was added by this infrastructure change.

### Two defects found on the way

**Four places where JSX ate a space.** `</strong>` followed by a word wrapped
onto the next source line renders as `informationat`. It is invisible in review —
the source reads correctly and only the output is wrong. Two were WP7's; **two
were already live on Privacy** (*"Collect Stampwhile you are at a shop"* and
*"on this device.It is held"*). All four are fixed with an explicit `{" "}`, and
`tests/e2e/prose-integrity.spec.ts` now asserts no prose route renders two words
run together across an inline element, so this cannot come back unseen.

**The site key never reached the browser.** The form read it as
`process.env["NEXT_PUBLIC_..."]`. Next inlines a `NEXT_PUBLIC_` value by matching
the literal dot-access expression, and the bracket form is not matched — so it
compiled, would have deployed, and was `undefined` in the browser: no widget, and
every production submission refused with nothing on screen explaining why. Found
by loading the page with Cloudflare's always-passes test key, not by any test,
which is why the staging job now asserts the value reached the built bundle. The
staging deploy was not passing the key to the build either.

**Six contrast failures on the optional markers.** `--text-muted` measured 4.3:1
against the page ground at label size, under the 4.5:1 small-text minimum. Caught
by the axe audit, which the three new routes were added to; the marker is
`--text-secondary` now.

### Deliberately not done in WP7

- **No public reviews, comments, community profiles, merchant tooling or
  moderation platform.** The correction categories are about the listing and
  there is deliberately no *bad experience* option; a test asserts none appears.
- **No Supabase, no migration, no `contributions` table.** Phase 2 owns that.
- **No rate limiting beyond Turnstile.** A per-IP limit needs a KV or Durable
  Object binding, which is infrastructure this stage does not need. Recorded as
  the next control if the challenge proves insufficient.
- **No retention period in figures.** Privacy says submissions are kept while
  there is something to do about them and that contact details are cleared after.
  A stated period needs a founder decision and can be added in one line.
- **About was not reworked.** Issue #17.
- **No production Worker configuration.** Only `nibatlas-staging` exists.
  Nothing here creates or assumes `nibatlas-production`, and the runbook records
  the production steps as a future deployment task rather than part of this
  setup — the Turnstile hostname, whether production shares this spreadsheet, and
  the build-time site key wherever that build runs.
- **The country expansion was not started.** Scheduled after WP7.
- **No desktop treatment.** WP-D still awaits founder feedback.

### Coverage

- `src/features/contribute/contribute-schema.test.ts` — what each kind asks for,
  the conditional contact rule, and that neither the reviewing team's columns nor
  a client-named listing can be written.
- `app/api/contribute/route.test.ts` — the shared secret, the followed redirect,
  server-side revalidation, the unknown shop, the oversized body, all four
  Turnstile paths, and failing closed in production.
- `src/components/contribute/ContributeForm.test.tsx` — validation before
  posting, per-field errors and the summary that links to them, the contact rule,
  the failure that keeps what was typed, and the confirmation that appears only
  on `ok`.
- `tests/e2e/contribute.spec.ts` — both journeys end to end, the 404 for an
  unknown listing, the unavailable intake, and Help pointing at About.
- `tests/e2e/prose-integrity.spec.ts` — the JSX spacing guard.
- `tests/e2e/accessibility.spec.ts` — the three new routes.
- `tests/evidence/wp7-contribution-routes.spec.ts` — the review captures.

## Open items still needing founder input

- Which pen-specific fields exist for each of the ten catalogue shops (WP4).
- **A retention period for contributions**, if Privacy should state one in
  figures rather than in the terms WP7 wrote (kept while there is something to do
  about them; contact details cleared after). One line either way.
- Desktop feedback, before WP-D can be designed.
- Whether a permission request to the ten shops for storefront photography should
  be drafted, and by whom.
