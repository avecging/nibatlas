# Nib Atlas UX Foundation

**Status:** Implementation-ready
**Version:** 1.1
**Last updated:** 26 August 2026

## Experience model

Nib Atlas has two complementary collection surfaces:

- **Map = where I have explored.** Visited geography changes visibly over time.
- **Passport = what I have collected.** Stamps preserve individual place memories.

The map is the primary discovery surface. Passport is the durable personal archive. Me contains conventional profile, account, settings, privacy, help, export/deletion, and sign-out functions. Editorial discovery prompts may complement the map later but do not consume a primary navigation destination. Saved supports trip planning as a global Map-owned mode without becoming a full itinerary tool.

## Information architecture

### Primary navigation

| Destination | Purpose | Authentication |
| --- | --- | --- |
| **Map** | Geographic discovery, results, and global Saved mode | Public; persistent saves require authentication |
| **Passport** | Personal record of shop impressions and derived geographic seals, read as a list or as a book | Required |
| **Me** | Profile, account, settings, privacy, help, export/delete, and sign out | Public shell; personal data requires authentication |

This three-destination structure deliberately keeps Map central and Passport directly accessible. Saved places remain available through a complete cross-location Map mode rather than being duplicated inside Me. Countries and localities visited appear as concise profile geography in Me and as collection structure in Passport. Recent Impressions is deferred unless beta or post-launch evidence shows users want it.

### Route map

| Route | Screen | Access |
| --- | --- | --- |
| `/` | Map, search, filters, results | Public |
| `/shops/[slug]` | Stable shop detail | Public; actions gated |
| `/login` | Email OTP/magic link and Google sign-in | Public |
| `/auth/callback` | Authentication return | Public |
| `/saved` | Global Saved map/list mode with map return | Required |
| `/passport` | Passport overview | Required |
| `/passport/[country]` | Country collection | Required |
| `/passport/[country]/[locality]` | Locality stamps | Required |
| `/me` | Profile, account, settings, privacy controls, help, export/delete, sign out | Public shell; personal data required |
| `/privacy` | Plain-language Privacy Policy | Public |
| `/account` | Compatibility route redirecting to the relevant Me section | Required |
| `/admin` | Founder/editor dashboard | Admin |
| `/admin/shops` | Shop list/import | Admin |
| `/admin/shops/[id]` | Shop and stamp editor | Admin |

## Major user journeys

### First visit: explore without commitment

1. User opens Nib Atlas.
2. A brief dismissible explanation says: “Find fountain pen shops. Visit them. Collect stamps.”
3. The map appears without account or location prompts.
4. User pans to a destination or uses destination search.
5. Shops load for the committed viewport.
6. User selects a cluster, marker, then card.
7. User opens a shop page and decides whether it is worth visiting.

Acceptance intent: a first-time user can reach a credible shop page without creating an account or granting location access.

### Near Me

1. User activates **Near Me**.
2. A short pre-permission explanation states why location is needed.
3. On approval, map centres once and searches the area.
4. Manual panning is respected; the map does not recenter automatically.
5. If denied, destination search remains fully functional.

### Explore anywhere

1. User pans and zooms freely worldwide.
2. Existing results do not continuously refetch while the map moves.
3. After meaningful movement settles, **Search this area** appears.
4. User commits the new viewport.
5. Map and result list update together.

### Search destination or shop

1. User opens search.
2. Search accepts city, neighbourhood, locality, or shop name.
3. Destination results and known shop results are visually distinct.
4. Selecting a destination moves the map, then commits that viewport.
5. Selecting a shop moves/selects the marker and exposes the corresponding card.

### Save a shop

1. User taps Save on a marker card or shop page.
2. If anonymous, a lightweight sign-in sheet opens.
3. After sign-in, the user returns to the same place and the original save intent completes.
4. Saved state updates on marker, card, shop page, and Saved screen.

### Collect an Atlas Stamp

1. At the shop, authenticated user taps **Collect Stamp**.
2. The app explains the one-time location use.
3. Browser supplies a fresh foreground position and reported accuracy.
4. Server validates signed-in identity, nonce, freshness, accuracy, distance, rate limit, and duplicate state.
5. If eligible, user confirms **I am at this shop**.
6. Server commits the immutable collection record.
7. A short stamp-press ceremony appears.
8. The new impression shows shop, locality/country, and local collection date.
9. Marker becomes Visited and Passport updates immediately.

Failure paths:

- Permission denied: explain how to enable it; no stamp issued.
- Accuracy too poor: offer one immediate retry and practical movement advice.
- Outside geofence: show distance-neutral wording; do not expose anti-abuse thresholds.
- Duplicate: show the existing collected date and Passport link.
- Persistent legitimate GPS failure: direct to logged support/manual review; do not silently widen the radius.

### Browse Passport

1. User opens Passport, in the mode they last chose.
2. Overview shows total stamps, countries, and localities visited.
3. User opens a country and then a locality — from the list, from the book's
   country/locality index, or from a direct URL.
4. Stamps appear in collection-date order by default.
5. Selecting a stamp enlarges the impression; from there the shop page opens with
   Passport return context preserved, including the page the stamp was on.

## Mobile behaviour

### Application shell

- Mobile-first baseline at 360 px width.
- Persistent bottom navigation: Map, Passport, Me.
- Map occupies the full working canvas above navigation.
- Search sits near the top safe area; key actions remain reachable one-handed where feasible.
- Location, zoom, and filter controls do not compete with the results sheet handle.

### Results bottom sheet

Three stable states:

| State | Purpose |
| --- | --- |
| Peek | Shows result count and selected/first card summary while preserving map |
| Half | Browsable cards plus meaningful map context |
| Full | Scrollable list and filters; map remains behind but is not primary |

Rules:

- Tapping a marker raises the sheet to at least Peek and scrolls to its card.
- Swiping/selecting a card highlights and recentres the marker only enough to reveal it; never reset the user's broader viewport.
- Sheet drag must not accidentally pan the map.
- Browser Back closes detail/sheet layers in a predictable order before leaving the map route.
- Map viewport and filter state survive shop-detail navigation.

## Desktop behaviour

- At 1024 px and above, use a map/list split, initially about 65/35.
- Search and filters sit above the coordinated map/list workspace.
- List scroll and map pan are independent.
- Selecting a marker scrolls/highlights its row; selecting a row highlights its marker.
- Shop detail may use a route-level side panel on wide screens, but the stable shop URL remains canonical.
- Passport and Me use centred content layouts rather than forcing map split everywhere.

## Map interactions

### Viewport state

Maintain two bounds:

- `cameraBounds`: what the user currently sees.
- `committedBounds`: bounds used for the displayed result query.

Show **Search this area** when movement exceeds the defined pixel/distance/zoom threshold. Do not query every frame or every `moveend` event.

### Search this area

- Visible only after meaningful movement.
- Fixed above the bottom sheet or list edge.
- Commits current bounds and active filters.
- Shows loading without blanking the old result set.
- On failure, retains old results and offers Retry.

### Clusters

- Cluster dense points at broad zoom.
- Cluster tap zooms to expansion bounds.
- Cluster count remains readable against the basemap.
- At low zoom, communicate capped/truncated results and ask users to zoom if necessary.

### Marker/list synchronization

One selected shop ID is shared across map and list. Selection is not navigation by itself. Opening detail is a separate explicit action.

Persisted marker priority:

1. Visited
2. Saved
3. Unvisited

Selected adds a temporary halo to whichever persisted state applies.

### Filters

Status:

- All
- Unvisited
- Visited
- Saved

Shop type:

- Fountain Pen Specialist
- Stationery Store
- Vintage / Used
- Nib / Repair Services

Filters update both map and list only when the viewport query is committed. Active-filter count is visible. Clearing filters is one action.

## Shop discovery

### Shop card hierarchy

1. Shop name.
2. Locality/neighbourhood and primary type.
3. One useful specialty/service line.
4. Open/closed/unknown operational cue where reliable.
5. Saved/Visited state.
6. Primary image where rights are known.

### Shop page hierarchy

1. Identity and visit state.
2. Why it may be worth visiting: specialties, services, notable focus.
3. Practical visit information: address, hours, appointment needs, accessibility, official links.
4. Brands carried as supporting information, with freshness caveat where needed.
5. Save, external directions/official site, and Collect Stamp actions.
6. Data freshness and report-information link.

Do not centre ratings, user-generated review prose, stock claims, or e-commerce actions.

## Secondary discovery prompts

Editorial or rule-based prompts may later complement Map, including Near You, Cities and Localities to Explore, Recently Added, Worth a Detour, Independent Shops, and Nib & Repair Specialists. They are not a primary navigation destination in the current prototype.

Do not show “Popular” until there is a defensible signal. Do not use infinite scrolling or engagement ranking.

## Saved

- Saved is a Map-owned status and global mode, not a primary destination or a duplicate section inside Me.
- The global Saved mode must retrieve all saved shops across countries, not only saved shops inside the current viewport.
- Default list may be grouped by country/locality or recent save date.
- Each entry can open shop detail or return to the map with the shop selected.
- No named trips, schedule, route ordering, or itinerary optimization in MVP.

## Passport experience

Passport should feel browseable years later, not like a checklist.

### Two modes over one collection

List and Book are peer presentations of the same collection, not a screen and a
decoration on it. The overview is whichever one the reader last chose, and both
reach the same countries, localities and stamps.

- **List** is the browsing and accessible baseline: counts, then country and
  locality groups, then collected stamp rows. It must stay usable when motion or
  3D transforms are unavailable.
- **Book** is the tactile Passport object, with the page and leaf behaviour in
  `docs/passport-interaction-spec.md`.

Production-like mode defaults to List; reviewer mode may default to Book. Remember
the reader's own choice per device and honour it over either default.

### Hierarchy

The same hierarchy holds in both modes.

- Overview: total collected shop stamps, countries visited, localities visited, and
  earned locality/country seals.
- Country: earned country seal, localities visited, and shop-stamp count.
- Locality: locality seal and collected shop stamps.
- Stamp: the impression at a readable size, shop identity, location, local date,
  and a route on to the shop that preserves Passport return context.

### Empty states

- Explain how stamps are collected.
- Link to the map or a relevant locality.
- Do not show loot silhouettes, rarity tiers, or artificial locked rewards.

### Completion

Only show `x / y` where `y` is a clearly versioned curated coverage set. Otherwise show counts without implying completeness.

- Derive a locality seal from the first verified shop stamp in that locality.
- Derive a country seal after five verified shop stamps, or the complete eligible curated set when it contains fewer than five shops.
- Record the applicable coverage-set version and never revoke an earned country seal because the catalogue later changes.
- Treat a future check-in as an interface over the same verified-visit event; do not create a second unlock source.

## Authentication and interruption

- Authentication is an overlay/route interruption, not the beginning of the product.
- Preserve `returnTo`, selected shop, viewport, filters, and intended action.
- If the action was Save, finish it after successful auth.
- If the action was Collect, return to the collection preflight; never auto-request location in the auth callback.

## Accessibility requirements

- Every map result has an equivalent list representation.
- Status uses text/icon/shape as well as colour.
- Controls have visible focus and minimum 44 × 44 px targets.
- Bottom sheet is keyboard and screen-reader navigable.
- Modal/sheet focus is trapped appropriately and restored on close.
- Motion respects `prefers-reduced-motion`.
- Test at 200% zoom and with long English, Japanese, and Traditional Chinese names.
- Location permission explanations are plain language and never coercive.

## UX acceptance scenarios

The implementation is not coherent until users can complete these without coaching:

1. Singapore user pans to Tokyo, searches that area, and finds a specialist shop.
2. User selects a marker and sees the same shop highlighted in the sheet/list.
3. Anonymous user saves a shop through auth without losing context.
4. User with poor GPS understands why collection failed and how to retry.
5. Successful collection updates shop, map, and Passport exactly once.
6. User can browse Passport and return to the originating map/shop context.
