# Future Feature — Passport Library and Multiple Volumes

**Status:** Deferred concept; not part of the current MVP or Milestone 1 acceptance scope  
**Recorded:** 26 August 2026  
**Review trigger:** Evidence that active users are accumulating enough stamps for one Passport to become crowded, slow, difficult to browse, or visually implausible

## Concept

A mature collector may eventually outgrow one ever-expanding Passport. Instead of turning the Passport into one very thick digital book, Nib Atlas may present the user’s collection as a **Library of Places Visited**:

> My Atlas → Library → Volumes → Pages → Impressions

Each volume remains a durable record of part of the user’s travel history. The Library provides a cross-volume index so countries, localities, shops, and impressions can still be found without manually opening every book.

## Why this is deferred

The current product needs to prove that users:

- visit listed shops;
- collect multiple verified stamps;
- return to browse Passport;
- value the physical-book metaphor;
- encounter genuine density or navigation problems in one volume.

Building multiple volumes before those behaviours exist would add navigation, state, animation, storage, and information-architecture complexity without demonstrated value.

## Candidate volume models

These are options for later research, not approved behaviour.

| Model | Benefit | Risk |
| --- | --- | --- |
| Country volumes | Simple geographic browsing | Highly uneven volume sizes |
| Regional volumes | Strong visual themes | Arbitrary regions and uneven growth |
| Year-based volumes | Clear chronology | Sparse or overcrowded years |
| Fixed-capacity volumes | Resembles a real passport that eventually fills | Countries may continue across volumes |
| User-created volumes | Personal and flexible | Adds organisation work and resembles named trips |
| Hybrid fixed-capacity volumes | Stable physical artefacts plus global indexing | More system complexity |

The current leading concept is a **hybrid fixed-capacity system**:

- the user begins with Volume I;
- stamps are placed chronologically;
- country and locality seals organise the pages;
- a new volume begins only when the current one reaches a tested capacity;
- completed volumes remain stable rather than being reflowed;
- profile and Library indexes aggregate geography across all volumes.

No page or stamp capacity should be chosen until real Passport layouts and collection patterns are measured.

## Possible presentation modes

All modes remain future research:

- shelf or library overview;
- book-cover grid;
- chronological volume list;
- cross-volume geographic index;
- search across all impressions;
- country/locality entry points that reveal every relevant volume.

## Design constraints

- Multiple volumes must preserve the feeling of a personal memory archive, not become inventory management.
- Users should not need to manually sort every stamp.
- Old volumes should not rearrange when new shops are added to the catalogue.
- The system must not imply geographic completion unless the coverage set is explicitly defined and versioned.
- A cross-volume index must prevent the physical-book metaphor from harming findability.
- Accessible list navigation remains available independently of book animation.
- Reduced-motion behaviour must not require opening or animating every volume.

## Research questions for later

- At what stamp count does one volume become difficult to browse?
- Do users prefer chronological, geographic, or self-organised memories?
- Should a volume fill by pages, impressions, time, or a combination?
- Do users want to name or customise covers?
- Should locality and country seals repeat in later volumes?
- How should redesigned or special-edition impressions behave in closed volumes?
- Does a Library overview create delight or unnecessary management?

## Explicit current decision

Do not implement multiple Passport volumes now. Revisit only during beta/post-launch if real collection behaviour demonstrates the need, or if a meaningful group of users accumulates enough impressions to make the single-volume Passport materially worse.
