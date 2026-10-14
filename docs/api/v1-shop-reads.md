# API v1 public shop reads

**Status:** Milestone 2 application contract  
**Version:** 1  
**Last updated:** 3 September 2026

The browser and Milestone 3 frontend adapter read catalogue data through these
same-origin Next.js endpoints. They do not call PostgREST directly. The server
adapter uses the browser-safe Supabase publishable key against fixed,
security-definer RPC names; it never uses the service role for public reads.

All error responses are non-cacheable and use:

```json
{ "ok": false, "error": { "code": "stable_machine_code" } }
```

PostgREST messages and database identifiers are never relayed.

## `GET /api/v1/shops/viewport`

Required query parameters: `west`, `south`, `east`, `north`, `zoom`.

Longitude inputs stay within `-180..180`; `west > east` means a date-line
crossing. The browser client wraps renderer bounds from adjacent world copies
before requesting this endpoint. Views spanning at least 360 degrees use
`west=-180, east=180` so a whole-world search cannot collapse or omit meridians.
The camera itself is unchanged. Fractional renderer zoom is rounded and bounded
to the API's `0..24` buckets, including negative zoom at the widest world view.
The map requests settled visible bounds after a short debounce, using the
existing 500-record cap. Cancelled and superseded requests cannot replace newer
results. A truncated response is displayed explicitly; zooming into a dense area
reveals more shops. Nearby search remains separate.

Optional:

- `operationalStatus`: comma-separated `open`, `temporarily_closed`,
  `permanently_closed`, `unknown`;
- `shopType`: comma-separated approved shop-type codes;
- `limit`: `1..500`, default `500`.

The response is the shared `ShopMapSummary` projection plus `truncated` and
`committedBounds`. The database-only `zoom` echo is intentionally removed.
User-owned Saved/Visited state is not accepted here; public results always begin
as `unvisited` and Milestone 3 merges user state separately.

Cache: `no-store` so catalogue publication/status changes reach the next request.

## `GET /api/v1/shops/search`

Required `q` is trimmed and limited to 1–120 characters. Optional `limit` is
`1..50`, default `20`. Results are canonical shops, not destination-geocoder
results, and may identify the matched alias.

Cache: `no-store` so catalogue publication/status changes reach the next request.

## `GET /api/v1/shops/[slug]`

Returns the published database-backed detail or `404`. Unknown, draft, and
malformed slugs do not reveal publication state.

This wire projection is deliberately one adapter step before frontend
`ShopDetail`: Milestone 3 adds the deterministic frontend-owned stamp design and
maps any remaining presentation-only fields. It must not bypass the evidence
rules below.

Cache: `no-store` so archival and closure cannot be served from a stale CDN response.

### Legacy evidence and editorial review

- Every public source has stable `id`, public `label`, controlled `kind`,
  optional public URL, `retrievedOn`, and explicit `confirms` tokens.
- `confirmedBy` is always a source UUID, never display prose.
- Legacy sourced services require same-shop source support. After explicit B2b
  editorial publication, services use `reviewedEditorially: true`, without a
  fabricated source UUID or claim token.
- After editorial publication, appointment/accessibility are optional fields in
  the public `editorial` object. Existing internal values remain private until
  that explicit publication; null is omitted and false remains No.
- The source UUID must belong to the same shop, enforced by composite foreign
  keys.
- Canonical claim rows and admin evidence notes remain inaccessible to anonymous
  and ordinary authenticated roles.
- `demo_fixture` is a staging/test-only source kind paired with
  `sourceQuality: "demo"`; production imports must reject it.

Milestone 3 must update the frontend evidence reference from label to source ID.
It must also handle the staging-only `demo_fixture` kind explicitly: extend the
fixture-facing frontend type or reject it outside staging/test, never cast it
silently into one of the four real provenance kinds. It may retain `confirms`
for reviewer validation or derive equivalent checks from the same source/claim
projection, but it may not treat one source as supporting claims absent from that
source's token list.

Shop detail's Nearby suggestions use street-precision pairs only, normally
within 800 m. If fewer than three eligible suggestions remain after removing
public Branch/Related links, it may fill to five from within 1.7 km. With no
eligible shop the section is absent. This shop-page rule does not change the
separate map Near Me action or the nearby API's general radius contract.

## `POST /api/v1/shops/nearby`

The JSON body requires numeric `latitude` and `longitude`. Optional numeric
`radiusMeters` is an integer from `1..100000` (default 10000), and `limit` is
an integer from `1..100` (default 50). Unknown body fields and non-JSON requests
are rejected.

The response is always `private, no-store`. Caller coordinates are sent only to
the statement-local RPC in a request body, never placed in a URL, returned,
persisted, or placed in public cache metadata. Keeping coordinates out of the URL
prevents normal edge request logging from recording them. Returned `position`
values are shop coordinates. Each candidate also carries `positionPrecision`,
`primaryType`, and `operationalStatus`: the frontend shows a distance only when
both endpoints have street precision, and never recommends a permanently closed
shop.

## Payload budget

The viewport endpoint has a 500-record hard cap and a 250 KB compressed response
budget for a representative dense-city result. The automated budget test sends
500 long, distinct records through the real HTTP route and v1 decoder, then
measures the resulting JSON with gzip. This catches growth in public fields or
encoding overhead; the SQL performance suite separately protects query time.

## Runtime validation

The application boundary decodes each RPC response into a versioned allowlisted
shape. Unknown keys are dropped; missing/invalid required fields fail closed as
`502 invalid_upstream_contract`. For viewport reads, failing the complete
response rather than dropping malformed rows is deliberate: catalogue contract
violations stay loud and observable instead of silently removing markers. SQL
projections exclude known unrepresentable states, such as published shops with no
assigned type. This prevents a later database/provider change from silently
becoming a browser API change.

## B2a active generated artwork

`shop_detail` additively returns `generatedStamp` only when the published shop's
active Atlas Stamp has an approved current generated-template version. The exact
allowlist is `id`, `designVersion`, `ink`, `paletteVersion` and
`templateData:{tier,motif}`. It exposes no storage keys, approval evidence or
private draft data. The public decoder validates the known palette/template and
the detail adapter renders those stored values instead of hashing the slug.
This resolves PR #76's preview/public/collected-default mismatch without rewriting
B1 defaults, older art, identities or historical impressions. Place/name labels
use today's public catalogue; an issued impression keeps its original labels.

Older responses without this additive field retain the previous identity motif.
Current uploaded/legacy commissioned pre-collection discovery still uses that
existing presentation; exact uploaded public preview remains D. This checkpoint
does not claim to finish that lifecycle integration or change legacy provenance.

## B2b editorial detail

`review:{kind:"editorial",reviewedAt:<actual timestamp>}` is present only after
an actual catalogue review/publication. Public copy attributes it to Nib Atlas;
the actual actor UUID is stored privately. This is not field-by-field verification.
Legacy sources and dates remain in the response and are labelled retained source
history alongside the review line. No synthetic source entries are added.

The optional `editorial` object allowlists public story, experience and practical
fields listed in the admin contract. It excludes private notes/references and
actor/position confirmation metadata. It is absent on legacy unreviewed records.
The public decoder reconstructs the allowlist, bounds text/repeats and requires a
valid parent editorial review before accepting editorial service attribution.
Old source-backed service decoding remains strict. Phone/postcode are rendered
separately, preserving their exact text; approximate-area positioning is labelled
publicly and existing precision-aware distance behavior remains.

Public detail and private saved preview share the new editorial renderer. Full
page/gallery/selected-art preview parity remains Package D; this slice does not
claim that lifecycle integration or change historical impressions.

## B3 additive custom-type labels

Viewport, detail, nearby and Saved projections may include `primaryTypeLabel`.
Detail may also include `shopTypeLabels`, a map of its own attached codes to labels.
Readers continue accepting legacy canonical codes without these optional fields.
An administrator-created `type_<UUID with underscores>` code requires a nonblank
label of at most 300 characters (and a matching detail-map label for each custom
attached type). Unknown codes outside that namespace remain invalid. These labels
are plain text and contain no account or private working-copy data. Current public filter codes are `fountain_pen_specialist`, `stationery_store`,
`bookshop`, `art_supply_store`, `brand_boutique`, `luxury_shop`, `maker_workshop`,
`department_store` and `distributor`. Retired `vintage_used` and
`nib_repair_services` codes remain readable in historical records but are not
accepted as public filter requests. Saved map context drops those retired filters
while preserving viewport, label, visit status and availability. Administrator-created
custom types remain visible in All and are not silently categorized.

## Social and messaging presentation (#110)

Public `links[]` now retain the platform `type` through the domain adapter and
may carry `accountValue` instead of `url` for messaging contacts. Existing URL
rows remain compatible. Only canonical published official links are projected;
private drafts and non-official rows remain excluded. Copy-only IDs do not pass
through URL-label inference. Saved admin previews use this same projection and
renderer, with messaging actions disabled.

The phone stays in Plan your visit; large messaging icons immediately follow it
(or occupy that position when there is no phone). Website & social follows Plan
your visit in the desktop right panel and in stacked mobile order. Website rows
precede social rows, with platform icons and full clickable URLs. Empty messaging
and website/social sections render nothing. Legacy reference/directions links are
preserved in the link card.

Desktop icons copy the number/ID, or the original link if no usable identifier
can safely be extracted. Confirmation is Number copied / ID copied / Link copied.
A denied/unavailable clipboard shows selectable text and does not claim success.
Mobile uses the supplied supported HTTP(S) destination or a documented derived
link; unsupported bare IDs copy. Device detection is a user-agent/touch hint, not
app-installation detection. No chooser, timer-based launch probe, guaranteed
launch promise or automatic failure detection is implemented.

### Link verification and fallback rules (30 September 2026)

| Platform | Supported derivation / extraction | Conservative fallback |
| --- | --- | --- |
| WhatsApp | Explicit international `+` phone → `https://wa.me/<digits>`; extract digits from wa.me phone and /send?phone= links | Local number stays as entered; wa.me/message tokens copy the whole link |
| Telegram | Username → t.me/username; explicit international phone → t.me/+phone; extract only complete username/phone paths | Reserved endpoints, invite and temporary-contact tokens copy the original URL |
| LINE | Explicit `@` official ID → line.me/R/ti/p/%40ID; extract only @ IDs from recognized profile/message paths | Personal IDs copy; lin.ee and opaque /ti/p tokens copy the original URL |
| WeChat | Supplied weixin.qq.com/u.wechat.com links remain destinations | Bare IDs copy; bare-ID app launching is unverified; QR/share tokens are not IDs |
| Messenger | Username or page ID → m.me/value; extract from m.me/value or messenger.com/t/value | Join/share links copy as links |
| KakaoTalk | Supplied pf.kakao.com and open.kakao.com destinations remain intact | Bare IDs copy; channel/open-chat tokens are not presented as searchable account IDs |

Primary references checked: [WhatsApp universal links](https://faq.whatsapp.com/425247423114725/),
[Telegram deep links](https://core.telegram.org/api/links),
[LINE URL schemes](https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/),
[Kakao channel documentation](https://developers.kakao.com/docs/en/kakaotalk-channel/js).
Facebook’s [username documentation](https://www.facebook.com/help/162586890471598)
confirms facebook.com/username and m.me/username. Messenger links are HTTP
destinations without a custom app scheme or app-launch claim.
No bare WeChat or Kakao custom scheme is assumed. Source documentation is not
proof of launch behaviour on every device; founder mobile acceptance is separate.

Social canonical paths also follow the platforms’ username/handle formats:
[YouTube handles](https://support.google.com/youtube/answer/11585688),
[TikTok username/profile links](https://support.tiktok.com/en/getting-started/setting-up-your-profile/changing-your-username).
Supplied profile/share URLs are preserved, including query tokens needed by the
platform. Link support does not assert that a submitted account actually exists.
