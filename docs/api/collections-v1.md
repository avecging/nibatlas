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
  accuracy, 20-second timeout). Hidden pages, page exit, cancellation, account
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

## Explicitly deferred

WP2's geographic seal persistence/versioned coverage sets remain a separate
backend package. API mode shows stamp/place counts without deriving awards or
completion denominators from the prototype catalogue. Reviewer seals remain demos.

M6 preserves both legacy commissioned artwork and #73 neutral uploaded artwork.
Legacy commissioned snapshots keep their existing export checksums and illustrator
credit. New uploaded snapshots preserve truthful origin, creator name/optional
safe link and transparent-PNG checksum only; private storage keys, rights evidence
and approval paperwork are not copied into collection history. Shared stamp
rendering requests the exact approved version through the guarded same-origin PNG
route. The current active version is available for a published shop; an owner can
still resolve the exact historical version already preserved in their private
collection after a redesign. Neither kind is replaced with generated substitute
art. Duplicate protection remains one collection per stamp; newer-design
recollection is deferred to #70.

Account export/deletion is still M8. API mode does not present local-data controls
as deleting/exporting server records. Real-device indoor/mall acceptance requires
founder field checks after staging deployment. Automated geolocation fixtures do
not establish real GPS reliability.
