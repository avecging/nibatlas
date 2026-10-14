# Private collections v1 — Milestone 5 WP3

`GET /api/v1/collections[?after=<collection UUID>]` uses HTTP-only session cookies
and verified Supabase claims. The owner-scoped database function accepts only an
exclusive cursor, never a user ID. Anonymous clients cannot invoke it. Collection
insert/update/delete and approved-artwork grants are unchanged.

Response: `{ownerId, collections, nextCursor}`. `ownerId` is the verified response
identity, used to discard an in-flight read if the browser account changed. Each
collection has WP2's `CollectionV1` fields and `shopSlug: string | null`. The slug
is today's published navigation alias, not historical identity. Archived shops
keep their owner's complete impression but have no public shop link. Names,
place, timezone, date and artwork come exclusively from the immutable snapshots.

Pages contain at most 100 rows ordered by UUID ascending. The RPC reads 101 rows
to determine whether a next page exists. `nextCursor` is null at the end. UUID
keyset pagination does not promise a transaction-wide snapshot across concurrent
inserts: the client merges in-session issuance and refreshes from the beginning
on visibility/invalidation. Passport sorts independently by local collection date.
Responses are `private, no-store`, `Pragma: no-cache`, `Vary: Cookie`. No service-role
client, location data, diagnostic measurements or approval evidence is used here.

Failures use WP2's `{ok:false,error:{code}}`: `invalid_request` (400),
`authentication_required` (401), `service_unavailable` (503).

## Client integration

- API catalogue mode uses account collections in memory only. Local preview
  impressions are not imported, joined or displayed as verified visits. Fixture
  and reviewer demonstrations keep their existing local store.
- Sign-in returns a collect intent to `?collect=1` preflight. This is only an
  interface hint; it cannot request GPS or issue a stamp. The user must activate
  **Check my location**, then **I am at this shop** after server verification.
- The GPS adapter requests one fresh foreground sample (`maximumAge: 0`, high
  accuracy, 12-second timeout). Hidden pages, page exit, cancellation, account
  changes and shop changes discard in-flight location/confirmation state. No watch
  or stored fix. Once confirmation has sent issuance, Cancel/Escape closes the
  dialog and refreshes history, but lets that already-authorized response settle.
  Navigation/unmount and backgrounding likewise detach issuance for settlement.
  Its result updates only the original account store, even after navigation;
  it cannot reopen the dialog, replay a ceremony, or enter a different account.
  If that store has unmounted, a generic invalidation makes its replacement read
  its own authenticated history; no old impression or identity crosses stores.
- Outside-area refusal offers only **Try again** and **Cancel**. Retry obtains a
  new nonce and fresh foreground fix; eligible verification still requires
  explicit confirmation. Before any issuance request, failures stay at the shop
  with appropriate retry/cancel or permission/support recovery, without a Passport
  detour. **Check Passport** is offered only after a collection request may have
  committed. Keep that recovery across retries/cancellation while its outcome is
  unknown; following **Check Passport** requests fresh account history instead of
  relying on the earlier reconciliation read. Actual duplicates still open the
  original impression.
- Only confirmed `success` runs the existing 780ms ceremony. A duplicate opens
  the historical impression without another press. Reduced motion is retained.
- Issuance upserts by collection ID into the one shared provider; visited markers,
  cards, shop state, counts and Passport groups update together. A stale read
  cannot overwrite a newly issued stamp. Failed refreshes retain loaded history.
- Private response state is remounted on owner changes and sign-out. Cross-tab
  invalidation carries only a generic message, never coordinates, nonce, identity
  or collection history. Visibility refresh and server checks recover stale tabs.
- Browser storage retains existing reviewer fixtures and interface preferences;
  it never receives account collections, GPS or verification proofs.
  Account Passport place/page memory is kept in the mounted owner scope only;
  the device may remember List/Book choice and whether the cover was opened.
  The owner-scoped provider survives route unmounts, so returning from a shop
  restores the list scroll offset and book position without writing either to disk.

## Geographic seals (Package E)

`POST /api/v1/seals` uses the cookie-bound owner and exact same-origin JSON.
Body: `{after?: UUID|null, ack?: UUID[]}` (at most 50 receipt IDs, 8 KiB body).
It reconciles prior verified visits in pages of 50 published definitions or owned
historical awards, returning `{ownerId, rows, nextCursor}`. GET does not mutate.
Drafts, other owners, location diagnostics and provider-only fields are excluded.
An owner may acknowledge only their own award IDs. Receipt state is separate from
immutable awards. Client state stays in owner-scoped memory and aborts on owner
changes; a seal refresh failure does not erase or block shop impressions.

Founder revision, 1 October 2026: eligible shops are derived automatically from
published shops' current country and locality IDs. There is no manual shop picker.
Locality requires two distinct eligible shop visits, or all eligible shops if
there is only one. Country requires five, or all eligible shops if there are
1–4. Zero eligible shops cannot award. Moving a shop changes future eligibility;
past verified visits count against its current geography, while already awarded
seals and original shop impressions remain immutable. Singapore can earn both.
The API returns required/eligibleTotal with progress; it does not expose private
shop geography. Draft shop edits do not change eligibility until published.

Publishing stores an immutable design/name/origin/creator/ink/artwork snapshot.
A collection insert awards matching published seals transactionally; bounded
reconciliation backfills older visits. The unique owner/seal constraint makes
both paths idempotent. Unpublish stops new awards; owners retain the original
version, date, design and credit. Generated `cartouche-v1` remains frozen.

Founder artwork revision, 2 October 2026: `cartouche-v2` is the default for
new country and locality drafts. It uses the Nib Atlas mark, a curved scope
heading, condensed serif place name, `VERIFIED VISITS`, distressed ink and the
small logo with NIB ATLAS curved around its left side. Countries retain the
approved cut-glass bottle and botanical flourishes; localities
omit both and show the parent country beneath the locality name. Dates remain
outside this artwork. The template ID, scope, name, parent country and ink are
preserved in each published snapshot. Custom uploads retain their existing path.

The editor chooses a starting ink once per new draft from vermilion, teal, plum,
moss, navy and brick. The admin may override it with the existing eight-ink chooser;
save/reload, preview and collection never rerandomize the saved ink. Existing
generated designs can opt into **Use new default design**, then the same Save
privately / Publish saved seal workflow. Discard restores the saved version.
No definitions, versions or awards are rewritten by this migration.

`document.template` accepts `cartouche-v1` or `cartouche-v2`; omission preserves
legacy-client behavior (`cartouche-v1`). Deploy the additive template migration
before the new application. Once a v2 design has been saved/published, an app
rollback must retain its v2 decoder and renderer; older builds cannot decode it.

`/admin/seals` is a 50-row list dashboard (name, scope, country/locality, published
version, Edit), with Add new, server-side name/place search and country/scope
filters. `/admin/seals/new` and `/admin/seals/[id]` contain Design & details and
Version history tabs. History is paginated at 20 published snapshots and shows
design, name, scope, origin, creator name/link and ink. Save privately then Publish
saved seal remains the workflow, with no additional approval step.

`GET /api/v1/admin/seals?after=UUID&q=...&scope=country|locality&country=SG`
filters before keyset pagination. `?id=UUID` reads one seal; adding `history=1`
and optional `before=VERSION` reads history. POST accepts
`{action: "save"|"publish"|"unpublish", id, revision, document?}`. Document adds
name, origin, optional creatorName/creatorUrl/artworkId/template. The retired
eligibleShopIds field is cleared on save; the old RPC writer is revoked. New
RPC `admin_geographic_seals_v2` locks the current editor/admin role and exact
revision. Geographic identity is immutable; change designs through new versions.

`POST /api/v1/admin/seals/[id]/artwork` accepts PNG (up to 5 MiB, bounded 2048 px
RGB/RGBA) or static SVG (up to 512 KiB, bounded viewBox, paths/shapes/text).
XML declarations, comments and safe inline presentation styles are accepted.
Inline styles are converted to presentation attributes for image delivery.
Self-contained SVG excludes scripts, style sheets, entities, foreign
objects, embedded images, animation and external references. Unsupported exports
are rejected with a useful error rather than silently altered. PNG requests with
JPEG bytes return 422 `jpeg_artwork_not_supported`, so the editor can explain that
an actual PNG export is needed. Original accepted
bytes are kept in environment-separated immutable R2 keys. Metadata is registered
through a service-only role-checked RPC; browser tables/finalization are denied.
Conditional write, read-back hash verification and explicit ready state precede
attachment. At most 100 retained uploads per seal; identical content retries
reuse the asset. Save does not publish. Creator link requires a name. Ink is
applied to SVG designs with the versioned `artworkTreatment: "ink-v1"` rendering
mode. This maps painted RGB to the selected palette ink while preserving alpha.
PNG retains original colours. New editor saves record the treatment in the
immutable published snapshot; legacy snapshots without it retain original colours.
Original source bytes remain unchanged in R2.

`GET /api/v1/seals/artwork/[assetId]` delivers artwork only to a
current editor/admin, signed-in viewers of current published artwork, or an
owner of a historical award using that asset. Authorization is rechecked after
R2 read. Optional `?ink=PALETTE_NAME` renders SVG through the frozen ink-v1
treatment; arbitrary/duplicate query parameters are rejected. PNG ignores the
ink parameter. SVG is delivered as an image with sandbox CSP, no scripts/resources,
nosniff and private/no-store headers. No raw SVG is inserted into application HTML.

Errors remain fixed responses: 400 invalid request, 401 unauthenticated,
403 forbidden, 409 stale/duplicate, 422 invalid input, 503 unavailable.
All responses are private/no-store; definition/version writes remain audited.

Passport explains current automatic thresholds. New awards are grouped
under “New seals from your past visits”; acknowledgement is durable. During a new
shop collection, matching newly earned seals follow the shop press in the same
sheet, with one Passport destination and reduced-motion support.

## Explicitly deferred

Special/event/seasonal stamps (including the six-week launch signup stamp),
recollectible artwork editions remain deferred.
A new geographic design does not replace an earned impression or permit a second
award. Reviewer seals remain demonstrations, separate from account awards.

M6 preserves both legacy commissioned artwork and #73 neutral uploaded artwork.
Legacy commissioned snapshots keep their existing export checksums and illustrator
credit; they retain the previous artwork-unavailable state until those older
provider assets are deliberately migrated rather than being guessed into the new
environment-bound R2 path. New uploaded snapshots preserve truthful origin,
creator name/optional safe link and transparent-PNG checksum only; private storage
keys, rights evidence and approval paperwork are not copied into collection
history. Uploaded stamp rendering requests the exact approved version through the
guarded same-origin PNG route. The current active uploaded version is available
for a published shop; an owner can still resolve the exact historical uploaded
version already preserved in their private collection after a redesign. No custom
kind is replaced with generated substitute art. Duplicate protection remains one
collection per stamp; newer-design recollection is deferred to #70.

Account export is still M8. Signed-in account deletion is deliberately separate
from these collection APIs, and API mode does not present local-data controls as
deleting/exporting server records. Real-device indoor/mall acceptance requires
founder field checks after staging deployment. Automated geolocation fixtures do
not establish real GPS reliability.

B2a makes uploaded creator credit optional: absent/null name and URL are valid,
but a supplied URL requires a nonblank name. Exact approved-art snapshot
validation and immutability are unchanged. Decoders preserve previously accepted
HTTP(S)-prefix historical links; the credit renderer can omit an unusable link
without rewriting the original name, artwork or stored snapshot. No credit is
invented when the uploader supplies none.
