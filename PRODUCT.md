# Nib Atlas Product Foundation

**Status:** Approved implementation foundation
**Version:** 1.2
**Last updated:** 4 September 2026

## Product vision

Nib Atlas is a map-first, mobile-first web application for discovering physical fountain pen shops and preserving verified visits as collectible virtual stamps.

It answers:

> **Where can I go to experience the fountain pen hobby?**

The product is the physical-world discovery and visit-collection layer of the hobby. It is intentionally separate from any fountain pen catalogue, database, trading platform, or marketplace.

The long-term emotional promise is twofold:

- Before a trip: **“Let’s see what pen shops are around here.”**
- Years later: **“Look at all the places I’ve been.”**

## Catalogue geography

The current prototype catalogue contains a small, sourced set of entries in
Singapore, Japan, and Taiwan. Those countries describe the data currently
present; they are not a launch promise, a national-coverage claim, or a published
rollout order.

Future shops may be added in any country when their records meet the sourcing
standard. Nib Atlas publishes no future geographic rollout. Public coverage is
always derived from the catalogue itself and
favours accurate, sourced listings and transparent freshness over superficial
completeness.

## Target users

| User | Primary need | Successful outcome |
| --- | --- | --- |
| Fountain pen traveller | Find worthwhile pen shops in an unfamiliar place | Opens a useful shop page, saves it, or visits it |
| Local hobbyist | Discover overlooked shops nearby | Explores beyond already-known stores |
| New hobbyist | Find a suitable physical entry point into the hobby | Understands why a shop may be worth visiting |
| Collector | Build a meaningful geographic record of visits | Collects verified stamps and revisits Passport |

## Core loop

> **Explore map → Discover shop → Visit physically → Collect Atlas Stamp → Browse Passport → Explore again**

The loop must remain useful before merchant partnerships exist. Standard Atlas Stamps are issued by Nib Atlas through lightweight location verification. Future official shop stamps are additive, not a prerequisite.

## Product principles

1. **Map before feed.** Geography is the primary discovery model.
2. **User-controlled exploration.** The map never fights the user; moved viewports refresh only through explicit **Search this area**.
3. **Anonymous discovery.** Browsing never requires an account. Authentication is required only for persistent personal actions.
4. **Physical world first.** The product should help people leave the app and visit places.
5. **Meaning over gamification.** Stamps are travel memories, not loot, points, or financial assets.
6. **Credibility over nominal scale.** Reliable data beats an impressive but stale pin count.
7. **Founder-operable.** MVP operations must be manageable by one founder or a very small team.
8. **Lasting value over engagement tricks.** Time spent and infinite scrolling are not success metrics.

## MVP features

### Public exploration

- Responsive world map with unrestricted pan and zoom.
- Destination and shop-name search.
- **Near Me** after an explicit location request.
- Viewport-based shop results with explicit **Search this area**.
- Marker clustering in dense areas.
- Status filters: All, Unvisited, Visited, Saved.
- Shop-type filters: Fountain Pen Specialist, Stationery Store, Vintage / Used, Nib / Repair Services.
- Synchronized marker and card/list selection.
- Mobile draggable results sheet and desktop map/list split.

### Shop discovery

- Stable, shareable shop page.
- Name, images, address, map location, opening hours, official links, short description, brands, specialties, services, appointment requirements, accessibility notes, and provenance/freshness where available.
- The page answers **“Should I visit this shop?”**, not **“How highly is it rated?”**
- Operational status including open, temporarily closed, permanently closed, or unknown.

### Accounts and saving

- Supabase Auth using email OTP/magic link first; Google sign-in enabled before public beta.
- Authentication returns the user to the interrupted shop/action.
- Save and unsave shops.
- Saved state appears consistently on markers, cards, shop pages, and the Saved screen.

### Atlas Stamp collection

- One active standard Atlas Stamp for each published shop.
- Account-gated **Collect Stamp** action.
- Foreground location requested only at collection time.
- Server-side adaptive geofence check; default 150 metres, configurable per shop.
- Accept location only when reported accuracy is 100 metres or better, with one immediate retry.
- Explicit user confirmation that they are at the shop.
- Idempotent issuance: one collection per user and stamp.
- Short, tasteful stamp-press ceremony with reduced-motion alternative.
- Visited state updates immediately on map, shop page, and Passport.
- Commissioned stamp artwork is displayed intact, with readable illustrator
  credit available from its detail view.
- Raw user coordinates are used transiently and are not stored.

### Passport

- Private by default.
- Overview with total stamps and geographic groupings.
- Country → locality hierarchy that accommodates wards, municipalities, districts, city-states, and other local structures without forcing a rigid Western city model.
- Browsable stamp impressions showing shop, place, and local collection date.
- Direct transition from newly collected stamp into the relevant Passport section.
- A locality seal is derived when the first verified shop stamp in that locality is acquired. If a separate check-in concept is introduced later, it must use the same canonical verified-visit event rather than create a second source of truth.
- A country seal is derived after five verified shop stamps, or after the complete eligible curated set when that set contains fewer than five shops. The applicable coverage-set version is recorded, and an earned seal is never revoked when the catalogue changes.
- No other completion denominator is shown unless the underlying curated coverage set is explicitly defined and versioned.

### Founder administration and data operations

- Protected founder/editor interface.
- Create, edit, preview, publish, temporarily close, permanently close, and archive shops.
- Manage coordinates, attributes, official links, provenance, images, and Atlas Stamp configuration.
- Validated CSV/JSON import with dry run and error report.
- Audit log for administrative changes.
- Basic verification anomaly review.

### Product quality

- English interface initially, with local-script shop names and aliases supported from the start.
- WCAG AA contrast, keyboard operation, 44 × 44 px minimum touch targets, and reduced-motion support.
- Privacy-safe analytics and operational monitoring.
- Clear fixture/demo labels; invented business details must never appear as verified facts.

## MVP success measures

Primary metric:

- **Verified shop visits per monthly active explorer.**

Supporting measures:

- map explorer → shop-page open rate;
- shop page → save or external-directions rate;
- registered user → first stamp rate;
- repeat Passport view after collection;
- destination search → useful result rate;
- stale/incorrect reports per 100 listings;
- median viewport-query latency and map error rate.

Time spent, feed depth, and daily streaks are not north-star measures.

## Explicit non-goals for MVP

- Pen, ink, paper, or nib product catalogue/database.
- Marketplace, trading, stock availability, ordering, or e-commerce.
- Star ratings, conventional reviews, or engagement-ranked social feeds.
- Public social profiles, follows, comments, or leaderboards.
- User submissions that directly overwrite canonical shop data.
- Merchant claims, merchant dashboards, or merchant analytics.
- Official/custom merchant stamps, QR, rotating QR, or NFC verification.
- Limited stamps, campaigns, achievements, or competitive rewards.
- Named trips, route optimization, turn-by-turn navigation, or itinerary scheduling.
- Offline map packs or native iOS/Android applications.
- Historic self-attested visits mixed with verified Atlas Stamps.
- Listings added merely to imply worldwide scale, satisfy a country count, or fulfil a public rollout promise.
- Monetary or redeemable value attached to stamps.

## Phase 2 candidates

Phase 2 begins only after evidence shows that the core discovery-and-collection loop is useful.

- Moderated missing-shop and correction submissions.
- Contribution review queue.
- Named saved-shop trips.
- Community tips and authorized photo contributions.
- Accessibility detail and richer structured services.
- Explicit city/locality coverage statistics.
- Richer Passport layouts and restrained achievements.
- Stronger anomaly detection and support tooling.

## Later features

- Merchant listing claims and merchant tooling.
- Official shop-created stamp artwork.
- QR, rotating QR, NFC, or shop-generated verification.
- Limited/event stamps and organized campaigns.
- City trails and community-curated trails.
- Merchant visitor analytics.
- Advanced trip planning.

## Product invariants

Changes require an explicit product decision if they alter any of these:

- Nib Atlas remains separate from the fountain pen database/marketplace product.
- Map-first, mobile-first discovery remains central.
- Users can explore anywhere without account or location permission.
- Map movement is user-controlled and uses **Search this area**.
- Physical visits—not passive app engagement—create the collection.
- Atlas Stamps remain meaningful, private-by-default memories.
- Approved commissioned artwork remains intact and attributable to its
  illustrator.
- Public geography describes only the sourced catalogue currently present; it never promises national completeness or a future rollout order.
