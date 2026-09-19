# Private media uploads v1 — M6 WP3

This is the media and stamp-artwork boundary within WP3, not a new package number.
Issue #73 supersedes older MVP paperwork gates. Photo/logo attachment plus the
simplified founder/admin stamp draft → PNG → preview → activation workflow are
specified below. Related issues: #32, #19 and #28. The current illustration guide
supersedes #28's old compact-proof/texture wording.

## HTTP contract

All routes require verified cookie identity and current editor/admin authority.
Every operation also checks/locks the current role in its database transaction.
Only the isolated Worker service client can invoke `media_upload_operation`;
a browser cannot assert a successful validation through PostgREST. The existing
service secret is reused; shop administration continues to use its ordinary
cookie client. Audit reads remain admin-only. Upload sessions belong to their
initiating account; even another editor/admin cannot take over that session.

| Route | Method | Input | Result |
| --- | --- | --- | --- |
| `/api/v1/admin/media/uploads` | POST | JSON manifest below | 201: id, pending status, expiry, null dimensions |
| `/api/v1/admin/media/uploads/[id]` | PUT | `image/png`, or `image/jpeg` for shop photos | Uploaded; must still finalize |
| Same | POST | Empty body | Reads R2 bytes, validates, records validated manifest |
| Same | GET | No query | Private status/expiry/dimensions only; no file bytes |

Mutations require the matching Origin. No query parameters or arbitrary keys,
URLs, approval claims or actor IDs. No public GET, signed URL, anonymous upload,
CORS grant or cache entry. Every response is private/no-store. Raw provider
errors are redacted. UUID knowledge grants no access.

Initiation JSON (max 8 KiB): `shopId`, `purpose` (`shop_photo`, `shop_logo` or `artwork_png`),
`sha256` (64 lowercase hex), `byteSize` (integer, 1–5 MiB), `contentType`
(`image/png`, or `image/jpeg` for shop photos only). Photos/logos may omit all
metadata. If supplied, `sourceRef` (1–2000), `rightsBasis` (1–2000), `creditText`
(1–300), `altText` (1–1000) must be nonblank text. Omission stays null; no fake
permission, ownership, licence, credit or description is inserted. Existing
metadata is preserved. A source reference is private text and never fetched.

Artwork additionally requires an uploaded draft `artworkVersionId`. Its manifest
contains only the byte identity/target fields above: `sourceRef`, `rightsBasis`,
`creditText` and `altText` are rejected for `artwork_png` rather than fabricated.
Origin and creator attribution live on the immutable artwork version. Approved
artwork versions cannot be upload targets. Production rejects demo shops; archived
shops cannot receive/finalize new uploads.

## File validation and identity

The supported first-slice PNG subset is 8-bit RGB or RGBA, non-interlaced,
1–2048 px on each axis, at most 5 MiB. IHDR, consecutive nonempty IDAT and IEND
are required, with at most 1024 chunks total. Three optional display chunks are
accepted once each, after IHDR and before the first IDAT, in any relative order:

| Chunk | Required payload |
| --- | --- |
| `sRGB` | Exactly 1 byte: rendering intent 0–3 |
| `gAMA` | Exactly 4 bytes: gamma × 100000, integer 1–2147483647; must be 45455 when `sRGB` is also present |
| `pHYs` | Exactly 9 bytes: two integer pixel densities 0–2147483647 and unit 0 (unspecified) or 1 (metre) |

These fixed numeric fields describe colour and pixel density, not location,
timestamps, authorship or arbitrary text. Density never overrides IHDR dimensions
or drives allocations. Rules follow the [PNG specification](https://www.w3.org/TR/png-3/)
sections 5.6, 7.1, 11.3.2.2, 11.3.2.5 and 11.3.4.3; the nonzero gamma requirement
rejects a meaningless declaration rather than silently repairing it.

Validate signature, chunk ordering/bounds, every CRC, deflate completion and
bounded decompression, exact scanline length, all five PNG filter modes, actual
size and SHA-256 over the entire original PNG file, including display chunks. Reject
trailing bytes and every other chunk, including EXIF (`eXIf`), text (`tEXt`,
`zTXt`, `iTXt`), embedded ICC profiles (`iCCP`), timestamps (`tIME`), unknown
ancillary chunks, palette PNG and animation (`acTL`, `fcTL`, `fdAT`). Sensitive or
unsupported metadata is rejected **before R2 persistence**, not stripped after
storing GPS. Fixed display declarations are not a general metadata allowlist or
a guarantee against sensitive content encoded in pixels. Artwork requires RGBA,
1200 × 800 and transparent pixels. PNG uploads are never rewritten or converted.

This intentionally narrow subset can reject otherwise valid illustrator PNGs.
Ask for a suitable export, never silently modify approved artwork. Transport validation is not evidence of external illustrator approval. Under #73,
MVP activation deliberately does not require maker-mark confirmation, source/SVG
bundles, rights evidence or external sign-off; those commissioning requirements
are deferred to #71. WebP/AVIF, SVG and editable sources are not accepted by this
upload path. JPEG shop-photo intake is described below.

A generated upload UUID identifies one immutable file version, separate from the
existing artwork/design identity. Keys are server generated:
`<environment>/media/<upload UUID>/v1/<sha256>.png`. Future replacement bytes get a
new upload UUID/key; later attachment points at the existing artwork version or
shop-image model. No slug, filename or user key becomes storage identity. No
existing artwork key, approval record, stamp or collected snapshot is changed.

The Worker validates before writing through the private binding and rechecks the
role after transfer/validation. R2 uses conditional creation (`If-None-Match: *`)
so a retry cannot overwrite an object. Finalization retrieves and independently
validates actual object bytes; no client-reported ETag/checksum is trusted as proof.
It then commits the manifest with its audit event and live role locked through
commit. Like any external write, an already-authorized R2 write may finish while
revocation races; it remains private and finalization checks the current role
again. There is no long-lived upload bearer URL after revocation.

## JPEG shop photos: transformed input and output identity

JPEG is permitted only for `shop_photo`. Input manifest `sha256`, `byteSize` and
`contentType` describe the exact original bytes. Input remains at most 5 MiB.
Preflight checks JPEG markers/segment and entropy boundaries, exact EOI (no
trailing bytes), one 8-bit baseline/progressive three-component frame, at most
8192 px per axis / 24 million decoded pixels, 4096 markers and 128 scans.
The Cloudflare Images binding performs actual decoding, not signature-only
acceptance. No native Node decoder runs in the Worker.

EXIF IFD0 orientation is bounded and read in memory; GPS/thumbnail/other IFDs are
not followed. All APP/COM metadata is removed before decoding except bounded
ICC segments used for colour conversion and a canonical Adobe APP14 colour hint.
Adobe transform 0 (RGB) and 1 (YCbCr) are supported for three-component frames;
original version/flags are discarded. Duplicate, malformed, unsupported or
post-scan Adobe declarations are rejected. The decoder needs this hint before
the first scan; it never enters the stored PNG.
Multiple-picture/MPO, CMYK/YCCK,
grayscale, lossless/arithmetic/12-bit exports, malformed orientation/ICC sequences
and non-JPEG formats are unsupported. Ordinary baseline/progressive RGB JPEG
exports are supported. See the runbook for plain-language export guidance.

The binding decodes/resizes using only the longest-axis constraint, to a maximum
1024 px longest edge, with no upscaling/cropping. The Worker checks that long edge
exactly and accepts floor/ceiling whole-pixel rounding of the proportional short
edge, then uses the validated decoded dimensions for pixel buffers and orientation.
The Worker independently
validates/decompresses the returned PNG, applies all eight EXIF orientations to
pixels, and emits an RGBA PNG with **only IHDR, IDAT, IEND**. It validates this
output before any persistence. Sensitive/arbitrary metadata is therefore neither
persisted as an original nor copied into the final PNG. Input decoded resource
budget is 24 MP at the Images service; Worker output pixel buffers are bounded by
1024 × 1024 × 4 bytes each and all byte streams by 5 MiB. PNG paths keep their
original 2048-axis and PR #63 validation rules.

JPEG receipts initially have no storage key. A service-only `prepare` operation
reserves `output_sha256`, `output_byte_size`, `output_width`, `output_height`,
`output_content_type=image/png` and the key based on the **output** checksum.
It rechecks/locks current role, uploader, environment, expiry and target, and adds
an audit fingerprint. Input identity and a reserved output cannot be replaced.
Repeated prepare of the exact same output is a no-op; different output conflicts.
Only after this reservation does the Worker write the processed PNG conditionally.
The original JPEG is never written to R2, even temporarily. No public URL or cache
is used for processing. Browser-supplied output fields are rejected.

Finalization reads/decompresses actual R2 bytes without trusting the processor,
client or R2 ETag. It checks PNG MIME, output checksum/size and dimensions against
the reservation before the live-role transactional/audited finalization. Original
`sha256` is never compared as the checksum of transformed PNG bytes. Existing PNG
sessions retain their original storage keys/checksums and need no backfill.

Production API reference: [Images Workers binding](https://developers.cloudflare.com/images/optimization/binding/).
Local emulation has lower fidelity and does not prove remote decoding behavior;
actual staging verification remains a release gate. See
[processing/retry/setup details](../runbooks/media-uploads.md#jpeg-photo-intake--same-wp3-separate-from-artwork).

## Failure and recovery

- 400 malformed contract; 401 signed out; 403 role/origin denied; 404 unknown,
  other-account or wrong-environment upload; 409 missing object/already finalized
  PUT; 410 expired pending upload; 422 invalid bytes/target/metadata; 429 initiation
  limit; 503 storage/database/Images unavailable or decoder failure. Database-detected expiry during a
  finalization race is 422. Finalization bodies with data are rejected.
- Initiation limit: 100 manifests per account per rolling 24 hours, serialized
  through the actor row. Maximum newly accepted bytes is therefore 500 MiB/day.
- Pending uploads expire after 24 hours. GET still reports their expiry; they
  cannot finalize. Initiate again for a new attempt. No multipart upload exists.
- Missing, invalid or interrupted uploads never become validated or public.
  Retry the same exact PUT, then POST finalize. For JPEG, try finalization first
  after a lost successful PUT response; a changed processed checksum requires a
  new upload rather than replacing the reserved output. If a response is lost, GET the
  UUID first. A completed finalization POST is idempotent and adds no new audit.
- R2 and Postgres cannot share one transaction. If R2 succeeds but finalization
  fails, the file stays private and the manifest stays pending. Retry within the
  expiry. See the runbook for selective cleanup; do not use a blanket lifecycle
  deletion rule over keys that may later be attached to approved artwork.
- Validated manifests cannot be edited/deleted. Canonical initiation, JPEG output reservation and final
  metadata transitions append fingerprints and the verified actor to the existing
  audit in the same transaction. No filenames, rights text, evidence or bytes in
  audit summaries. Direct table writes and truncate are denied to API roles.

## Photo/logo attachment and deliberate delivery (#73)

| Route | Method | Input / output |
| --- | --- | --- |
| `/api/v1/admin/shops/[shopId]/media` | GET | At most 50 attached images, safe metadata/status/revision |
| Same | POST | `{action:"attach",id:<validated upload UUID>}` saves privately and is idempotent |
| Same | POST | `{action:"publish" or "hide",id:<image UUID>,revision:<32 hex>}`; admin only |
| Same plus `/[imageId]` | GET | Private attached PNG preview; editor/admin |
| `/api/v1/shops/[shopId]/media` | GET | Approved image metadata for a published shop |
| Same plus `/[imageId]` | GET | Approved PNG bytes for a published shop |

`shopId` is a UUID, including on the public media subroute (the surrounding
shop detail route uses a slug). The Worker alone invokes `shop_media_operation`;
no browser/anonymous role may invoke it or read/write `shop_images` directly.
Mutations require same-origin JSON, at most 2 KiB, strict fields/UUIDs and no
queries. Publish/hide require both HTTP and locked live database admin role.
Attachment checks initiating uploader, exact shop/environment, validated receipt
and current non-archived target. It copies only actual stored dimensions/key and
existing optional alt/credit/rights fields. Private sourceRef stays on the receipt;
it is not silently reclassified as a source URL. No expiry applies after validation.

Each shop holds at most 50 receipt attachments in this bounded MVP slice,
including retained private/replaced items. There is no deletion or reordering UI.
Publishing a logo hides the previous approved logo **in the same environment**;
its attachment, bytes and metadata remain intact. Photo publication is independent.
Saving never publishes. Media status is separate from catalogue working-copy
publication: approved media becomes publicly reachable when the shop is published.
Changes append verified-actor/fingerprint audit records. Receipt/attachment
identities are immutable and no existing artwork or collection is changed.

Public projection returns only id/kind/dimensions/altText/optional creditText.
Missing alt text becomes `Photo of <shop name>` or `<shop name> logo`; it does not
invent pictured details or authorship. Existing metadata is preserved. Old image
rows without validated receipt links stay stored but are not delivered here.
Every byte request resolves current shop publication/image approval/environment,
reads private R2, then rechecks access before response. PNG responses use nosniff,
CSP and private/no-store headers; no raw bucket URL, provider key, redirect, public
image proxy or persistent cache is exposed. Already downloaded pixels cannot be
retracted by hiding; new requests are denied. Private preview is attached media
only and permits current editors/admins, not just the original uploader.

Errors: 400 malformed; 401 identity; 403 role/origin; 404 absent/nonpublic/wrong
environment; 409 stale revision; 422 wrong/unvalidated target; 429 50-image limit;
503 unavailable. Reload after a lost publication response. Upload retry first
attempts finalization, then resends only if incomplete. Expired/conflicting upload
IDs are cleared so the next Save creates a new session for the selected file.

## Stamp artwork workflow — issue #73

`/api/v1/admin/shops/[shop]/stamp` lists versions and creates uploaded drafts
with explicit `founder_created`, `ai_assisted` or `commissioned` origin,
optional creator name, optional HTTP(S) creator link and ink. A supplied link requires a name. The normal file picker sends
a 1200 × 800 transparent PNG through the private upload transport, then attaches
the validated receipt. The admin surface previews the exact PNG at list,
Passport and detail sizes before activation.

Activation is admin-only, revision-checked and explicit. It approves the attached
version and advances `stamps.current_design_version` on the same stamp identity.
Old approved versions and collection snapshots are never overwritten. Current
approved custom art is publication-checked for public byte delivery; an owner can
still resolve the exact historical version in an existing private collection.
New uploaded impressions render their exact PNG and public credit as
`created by: name`, with the name linked only when a safe link exists. Legacy
commissioned snapshots and credits remain intact; their provider keys have not
been migrated to this delivery path, so they show an artwork-unavailable message
rather than substituted artwork. Public detail now uses the exact active stored template/ink for generated defaults;
non-generated pre-collection discovery retains its existing identity motif until
the uploaded public preview work (D); the exact collected artwork appears in ceremony and
Passport list/book/detail.

This MVP keeps at most 50 versions per shop, including retained defaults and
history. Further draft creation returns `429 stamp_limit` before committing;
existing versions remain readable and activatable. There is no deletion UI.

Generated defaults remain valid. B1 adds `POST` to the existing stamp route with
exactly `{action:"ensure_default"}`. Editors/admins may prepare a default for an
older shop with no stamp. Same-origin/body/role/environment checks apply, and the
SQL operation locks the live role then shop before checking existing identities.
Any existing stamp makes this a no-op, including retired/custom/draft identities;
it cannot replace or reactivate art. No-op retries create no audit rows. Reads
remain read-only. Missing/archived/wrong-environment targets are rejected.

New catalogue creation initializes the default in its own transaction without
calling R2 or this HTTP route. The private helper records the actual account on
all stamp/artwork audit writes. Stored `templateData` (shop tier + supported motif)
is included only for generated rows in the private list; storage keys/evidence
are not exposed. The UI reuses `StampArt`, reading the stored motif and ink, with
only saved known locality/country labels. Unknown geography stays blank; actual
collection geography is snapshotted on issuance. Ordinary renames do not generate
artwork versions. Existing older API responses without template data remain
readable and do not receive an invented preview.

The generated design uses the established FNV-1a motif/palette selectors over
`stamp-<shop UUID>` (and `motif:` namespace), pinned as template/palette v1. The
approval reference `system-generated-default:v1` describes system initialization,
not an external artist sign-off or catalogue field verification. Existing approval
immutability remains enforced. Later uploaded drafts reuse that stamp identity;
only explicit admin activation changes its current version. This checkpoint does
not complete the
rich public preview/Review integration (D). Unique `(user_id, stamp_id)` duplicate
protection is unchanged, so collecting a later design again is still deferred to
#70. Commissioning/source/SVG/sign-off requirements are #71 and photo metadata is
#72. Imports remain WP4. Remote JPEG, photo/logo display, and the new stamp flow
still need post-merge staging acceptance; passing local/CI checks does not claim
that device/runtime acceptance.

### B2a optional credit and compatibility

New uploaded drafts may omit creatorName/creatorUrl. Blank optional UI credit is
normalized to absence before the service operation. Supplying a link requires a
nonblank name (at most 300 characters); new links must parse as HTTP(S) URLs and
fit 2000 characters. SQL independently enforces the conditional name/link shape.
Approval still requires an attached validated receipt and immutable PNG identity,
admin authority and a current revision. No commissioning paperwork is added.

Uploaded collection snapshots may omit both credit fields or hold JSON nulls.
The authoritative-art trigger still compares their exact values against the
approved version. Existing artwork, original credits, collection snapshots,
duplicate protection, locks and audit remain unchanged; migrations do not rewrite
any history. Older previously accepted HTTP(S)-prefix links remain readable;
rendering omits an unusable link while retaining its original name and snapshot.
No name means no invented credit or claim that uploaded work was generated.
