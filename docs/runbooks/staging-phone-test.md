# Real-phone staging collection test

Status: fixture and automated checks; physical phone results **pending**. Photos
are a later M6 acceptance test. This is a real supermarket used as a staging test
venue, not a pen shop, partner, endorsement, or real catalogue coverage.

## Public venue evidence (checked 12 September 2026)

- Name: FairPrice Compassvale Link, inside Aspella (founder also confirms indoors).
- Address: 277C Compassvale Link, #01-13, Singapore **543277**; Asia/Singapore.
- [Supplied Google Maps listing](https://maps.app.goo.gl/Yju14sxNkKPj64RQ7)
  resolves to place `0x31da163e2d478d6f:0xad92cb7f371272a`, `/g/1tmxc1wr`.
  Its place payload contains `!8m2!3d1.3824209!4d103.8938611`.
  The fixture uses these **place** coordinates, not the URL's `@` camera centre.
- [Waze listing](https://www.waze.com/live-map/directions/sg/singapore/fairprice-compassvale-link?to=place.ChIJb41HLT4W2jERKidx87cs2Qo)
  independently exposes the same navigation destination `1.3824209,103.8938611`
  in its Android navigation link. Its editor/map camera longitude differs and
  was deliberately not used.
- [FairPrice store locator](https://www.fairprice.com.sg/store-locator?latitude=1.3814388&longitude=103.89730759999999)
  search result lists 277C, #01-13, **543277**. These query parameters are search
  positioning, not venue coordinates.
- [Fish Soup Paradise outlet list](https://fishsoupparadise.com/pages/outlets)
  agrees on 277C, #01-13 Aspella and **543277**.
- [FairPrice service counters](https://www.fairprice.com.sg/events/in-store/service-counters/)
  instead lists **544277**. We retain this conflict, prefer the store locator
  corroborated by the two destination listings and outlet list, and do not claim
  postal-authority verification or that FairPrice corrected its conflicting page.

Precision is `street` under the existing model: an approximate sourced venue
point, not a survey. Neither listing distinguishes the public entrance from a
building/venue centroid. Unit, entrance and floor positions remain unverified.
Decimal precision is not an accuracy guarantee. Success here cannot establish
floor/unit detection or universal indoor/mall reliability.

## Fixture and deployment

- Route: `/shops/location-test-fairprice-compassvale-link` on the staging Worker.
- Reserved IDs end in `304` (venue), `504` (source), `604` (stamp), `704` (art).
- `source_quality=demo`, `demo_fixture` provenance, and `test_venue` type. The
  four public pen-shop filters remain unchanged. No pen services or brands.
- Generated navy ink-bottle test template, explicitly named as a test stamp; no
  commissioned art or reuse of the supermarket's branding.
- Separate `supabase/fixtures/staging-phone-location.sql`, excluded from default
  seed and migrations. Deployment verifies the project name `nibatlas-staging`
  before applying it atomically with an explicit staging-only opt-in, **after**
  the compatible Worker has deployed. A failed build never publishes the venue.
- Repeat deployment preserves approved artwork and immutable collections.
- Production uses its separate database, imports must exclude all demo records,
  and production API mode rejects demo detail. This fixture must never be part
  of a production seed/import. A test venue cannot be relabelled as sourced.
- No extra secrets, service, geofence override or accuracy-policy change.
- Rollbacks must retain the test-type decoder (PR #54 onward), or first archive
  this test venue through trusted SQL before restoring an older Worker. Keep all
  collected history; do not delete the venue or impressions.

After merge, run **Actions → Deploy staging → Run workflow → main**. Wait for
success, then open the route above using the URL in the deployment summary.

## Accounts and order — issue last

Use an account that has **never collected this test stamp**. One account can
perform all pre-issuance checks: on each successful verification, stop at
**I am at this shop**, cancel, and start a fresh check. Do not confirm yet.
Wait when the app asks you to retry later; do not bypass normal throttling.

If the account already collected, use a second legitimate staging account you
control. Email and Google SSO may link to the same identity, so switching sign-in
method or using incognito does not guarantee a new account. Never delete history,
rotate the stamp ID or weaken duplicate protection to repeat a field test.

1. Signed out, tap **Collect Stamp**, sign in and confirm return to this venue's
   collection preflight. Location must not start in the auth callback.
2. Tap **Check my location**, deny permission and record the message. Enable
   this site's location permission in your browser settings; start again.
3. Near the public entrance, request a fresh check. Record the outcome. If
   confirmation appears, **cancel without issuing**.
4. Farther inside the building, repeat with a fresh check and cancel again.
5. At a clearly distant public location, repeat. Expect refusal; record only
   the user-visible message, never coordinates or exact distance.
6. Before issuance, exercise cancel, switching apps/locking the screen, and a
   network interruption. Return and make a new explicit check. No background
   issuance or reused stale fix should occur. For an interrupted confirmation
   later, reload Passport first: a committed issuance may have lost its response.
7. Return to the venue, make a fresh eligible check, then press **I am at this
   shop** once. Expect ceremony and one impression. This ends pre-issuance GPS
   testing for this account/stamp.
8. Repeat collection: expect the original impression/date, not a second stamp.
   This duplicate path may return before GPS and is **not** another field test.
9. Reload Passport and the shop/map. The impression and visited state persist.
10. Sign out. Private Passport and account views clear; no previous account's
    history flashes on a subsequent account sign-in.

Record only this table; no account email/UUID, screenshots of private history,
request bodies, network traces, raw coordinates or GPS metadata in reports.

| Device/browser | Entrance / interior / distant | Permission state | Outcome | Latency | User-visible message |
| --- | --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Not tested | — | — |

## Photo acceptance — deferred until M6 R2 delivery

Ask Gin to upload their own entrance and interior photos when the upload path is
ready. Aim for one portrait and one landscape. Alternatively require explicit
reuse permission. Do not scrape/hotlink Maps images; attribution is not permission.
Avoid identifiable bystanders. Strip EXIF/GPS before persistent upload and verify
the delivered file is metadata-free. Keep source, credit, rights/permission and
useful alt text in the media record.

Through the planned Cloudflare R2 path, test orientation, responsive loading,
aspect ratio, missing-image fallback, and mobile/desktop display. Ordinary shop
photos may use documented photo variants. Commissioned stamps keep their entire
approved canvas, colours, maker mark and approved exports intact; photo cropping
rules must not be reused for stamp art. No temporary competing storage service.
