# Atlas Stamp verification v1 — Milestone 5 WP2

Backend contract, updated 4 October 2026. WP1 remains the immutable data foundation;
WP2 adds the sole service-role issuance path. Presentation integration is WP3.

## Request flow

All calls are same-origin `POST`, JSON, cookie authenticated, with `credentials:
"same-origin"`. Every response is `private, no-store`. Never put a position, nonce
or token in a URL, analytics event, exception, console log, storage or trace.

1. User taps Collect and accepts the one-time location explanation.
2. Start the fresh foreground location request synchronously from the consent
   button tap, before any server await. In parallel, `POST /api/v1/stamps/nonce` with `{ "shopId": "canonical UUID" }`.
   Returns `{ok:true,status:"nonce_issued",requestId,nonce}` or an existing collection.
3. Acquire a new foreground fix with `getCurrentPosition`, `maximumAge: 0`,
   `enableHighAccuracy: true`, `timeout: 12000`. Require `document.visibilityState
   === "visible"` at acquisition and submission. Discard the fix when hidden,
   navigating, switching shop/account, or retrying. Do not reuse Near Me samples.
   The browser watchdog reports a distinct timeout after 12 seconds, even if
   permission UI never resolves. Nonce plus verification has a 20-second overall
   client deadline. A sample waiting over 12 seconds for the nonce is discarded;
   every retry starts a new fix and nonce. Authorized collection is never aborted
   by the preflight deadline. Browser denial explains device/site settings and
   opening an embedded page in Safari/Chrome; actual iPhone permission behavior
   still needs device acceptance.
4. `POST /api/v1/stamps/verify` with `{shopId,requestId,nonce,position:
   {latitude,longitude,accuracy}}`. For denied permission send
   `{shopId,requestId,nonce,permission:"denied"}` without a position.
   A successful verification returns `{ok:true,status:"confirmation_required"}`.
5. Show **I am at this shop**. Only its explicit activation sends
   `POST /api/v1/stamps/collect` with `{shopId,requestId,nonce,confirmedAtShop:true}`.
   No coordinates are sent to collect. This commits the historical collection.
6. Run the ceremony only on `success`. `duplicate` opens the existing impression.

The nonce/request pair is opaque and kept in component memory only. One immediate
poor-accuracy retry creates a new pair and takes a new fix. Persistent poor accuracy
links to Help/support; never silently increase the radius or offer self-attestation.

Founder-approved phone-test UX decision, 12 September 2026: an outside-area
refusal offers only **Try again** and **Cancel**, removing Help and Check Passport
from that state. This replaces the previous outside-area support requirement.
Retry still creates a new nonce and fix and requires explicit confirmation after
eligibility. Other failures retain support; the verification policy and
distance-neutral responses are unchanged.

Founder-authorized recovery follow-up, 13 September 2026 (#58): failures before
any collection request stay at the shop, with no Check Passport action or message.
Nonce creation and verification cannot issue a stamp. Once an explicit collection
request may have committed, retain Passport reconciliation across interruption,
retry and cancellation until the outcome is known. Actual duplicate responses
still open the original impression. Outside-area refusal retains its two actions.

## Response contract

Failure shape: `{ok:false,error:{code}}`. No distances, accuracy measurements,
configured radii, anomaly flags, provider errors or throttle thresholds are returned.

| Code / status | HTTP | Frontend recovery |
| --- | --- | --- |
| `nonce_issued` | 200 | Acquire a fresh foreground fix |
| `confirmation_required` | 200 | Show explicit confirmation |
| `success` | 200 | Ceremony, apply collection and invalidate user state |
| `duplicate` | 200 | Display original impression/date; reconcile user state |
| `authentication_required` | 401 | Sign in, then restart collection preflight |
| `permission_denied` | 403 | Explain browser location settings |
| `untrusted_origin` | 403 | Refuse the request |
| `poor_accuracy` | 422 | One immediate new-fix retry, then support |
| `stale_position` | 422 | Restart with a new nonce and fix |
| `outside_radius` | 422 | Distance-neutral message; only Try again (new nonce/fix) and Cancel |
| `invalid_nonce` | 409 | Restart; includes wrong user/shop/request |
| `expired_nonce` | 409 | Restart; server deadline elapsed |
| `reused_nonce` | 409 | Restart check; reconcile first only if issuance may have committed |
| `throttled` | 429 | Pause attempts; offer retry later |
| `shop_unavailable` | 404 | Refresh shop; collection currently unavailable |
| `service_unavailable` | 503 | Keep shop context and retry; reconcile only if issuance may have committed |
| `invalid_request` | 400 | Do not automatically replay malformed data |

Success/duplicate shape: `{ok:true,status,collection,invalidate}`. `collection`
contains `id`, `shopId`, `stampId`, `collectedAt` (server UTC), `shopTimezone`,
`shopName`, `place`, and `stamp`. Place and artwork are historical snapshots,
including the generated descriptor or the approved commissioned export keys,
checksums and illustrator credit. Approval evidence, licence records and editable
source are admin data and are not part of the public collection response.

`invalidate` is exactly `["collections","visited-shops","passport"]`. The WP3
provider should upsert by collection ID, reconcile visited IDs, and refresh
Passport groups/counts once. It must update the shop and every map/card using
that shared provider. Public catalogue caches stay unchanged. Clear all private
state on account switch/sign-out. WP2 does not introduce a second visited boolean
or silently connect fixture Passport records to authenticated collections.

## Settled verification policy

- Server-generated 256-bit nonce, SHA-256 at rest; bound to verified claims
  identity, intended shop and server-generated request UUID.
- Initial nonce expires in 90 seconds, but verification must arrive within
  30 seconds of its server creation. Successful verification permits 60 seconds
  for explicit confirmation. At the expiry instant the proof is invalid.
- Client timestamps are rejected. These clocks bound request/sample acquisition;
  they cannot cryptographically attest GPS freshness or truth. A browser can
  fabricate a location or foreground status. Hardware attestation is outside MVP.
  The honest client must use the foreground/no-cache flow above.
- PostGIS geography uses `ST_DWithin` with an inclusive 45 m default and reported
  accuracy at most `min(shop radius, 45 m)`. Accuracy is never subtracted from distance or used to
  expand the radius. Eligibility is evaluated before diagnostic bucketing. A one-micrometre
  numerical tolerance absorbs floating-point roundoff at the inclusive boundary.
- Adaptation is a controlled per-shop policy (25–300 m) requiring an editor/admin
  actor and a meaningful reason. It is intentionally not an automatic widening
  algorithm. The private Location section provides a separate, immediate setting
  save and a reset to the 45 m default. Both require a reason of 10–500 characters.
  Cookie-bound administration rechecks/locks the live editor/admin role, locks
  the shop, rejects stale policy revisions and records a succinct fingerprint
  audit. Archived shops cannot change policy. The service-only adapter retains
  its protected actor check. Existing overrides and collected impressions are
  preserved; the new default applies only where no override exists.
  The public response never exposes the selected policy.
- Only published, non-closed shops with a canonical locality, active/in-window
  Atlas Stamp, and approved artwork can issue. An unknown operational status is
  not a recorded closure; opening hours are not inferred. Missing locality is
  unavailable until the founder supplies the grouping needed by Passport.
- Canonical shop, locality, active design and radius are rechecked at confirmation.
  A changed proof binding requires restarting. Identity and collection timestamps
  always come from the server. Country labels use server `Intl.DisplayNames`.
- Durable per-user minute/day budgets charge every authenticated endpoint request
  before body parsing. No IP address, user agent, fingerprint, or device ID is
  retained. Broader bot/anonymous edge controls are deployment hardening work.
- A successful verification or terminal failure burns the acquisition nonce;
  confirmation consumes the verified proof atomically with issuance. Concurrent
  requests serialize per owner; the `(user_id,stamp_id)` constraint remains the
  final guard. Retrying a consumed nonce returns `reused_nonce`; requesting a new
  nonce returns `duplicate` and the original collection after a lost response.

## Privacy boundary

The Worker encrypts the validated position using a per-nonce 64-byte secret
available only through the service-role RPC. AES-256-CBC plus HMAC-SHA256 uses
independent keys and a random IV. The database authenticates the envelope before
in-memory decryption. This prevents raw coordinates appearing even in SQL bind
parameter logs. Neither ciphertext nor a reversible coordinate hash is stored.
The secret is cleared as soon as verification finishes; stale nonce rows are
purged. TLS remains required between deployed services.

Attempts contain only owner/shop/request IDs, server time, coarse diagnostic
buckets, result and allowlisted flags (`repeated_failure`, `rapid_collection`,
`policy_override`). They are not browser-readable. Permanent collection records
leave the optional distance/accuracy columns null and anomaly array empty.

The database schedules purge every ten minutes: attempts older than 30 days,
nonces expired over an hour ago, and stale rate buckets. Normal purge lag is at
most ten minutes. A paused database cannot run cron; the job resumes on wake.
Never extend retention to compensate for downtime. Restrict provider logs and
any future observability integration from capturing request/response bodies.
The application catches errors without logging their potentially sensitive payloads.

See [deployment and operations](../runbooks/stamp-verification.md).


## Private radius administration

`GET /api/v1/admin/shops/:id/verification-policy` returns only the saved
`{radiusMeters, custom, reason, revision}` to a cookie-authenticated editor/admin.
`POST` on the same path requires same-origin JSON with exactly
`{revision, radiusMeters, reason}`; `radiusMeters: null` restores the default.
The radius is an integer 25–300, reason is 10–500 characters, and revision is the
last loaded 32-character policy fingerprint. Stale writes return 409;
unauthorized accounts return 401/403. The database rechecks authority and
serializes against shop verification even after the HTTP guard passes.
Policy state is private/no-store and excluded from public shop responses.
