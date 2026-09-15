# Private media uploads v1 — M6 WP3

This is the upload transport foundation within WP3, not a new package number or
an approval workflow. Related issues: #32, #19 and #28. The current illustration
guide supersedes #28's old compact-proof/texture wording.

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

Initiation JSON (max 8 KiB): `shopId`, `purpose` (`shop_photo` or `artwork_png`),
`sha256` (64 lowercase hex), `byteSize` (integer, 1–5 MiB), `contentType`
(`image/png`, or `image/jpeg` for shop photos), `sourceRef` (1–2000 chars), `altText` (1–1000 chars).
Photo manifests additionally require `rightsBasis` (1–2000) and `creditText`
(1–300). A source reference can identify the founder's original file/permission
record; it is private text and is never fetched as a URL.

Artwork additionally requires `artworkVersionId`: an existing commissioned draft
belonging to this shop. Rights and credit are copied from that version's existing
`rights_basis` and `illustrator_credit`; the caller must omit those two fields.
Both must already be populated. This does not copy approval evidence. Finalization
checks that the draft and its credit/rights have not changed. Already approved
versions and generated fixtures cannot be upload targets. Production rejects demo
shops. Archived shops cannot receive new uploads or finalize pending ones.

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
Ask for a suitable export, never silently modify approved artwork. Full one-ink,
maker-mark, visual and cross-export approval checks are later WP3 work; a transport
validation is not evidence of illustrator approval or production readiness.
WebP/AVIF, SVG and editable sources are not accepted. JPEG shop-photo intake is described below.

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
ICC segments used for colour conversion. Multiple-picture/MPO, CMYK/YCCK,
grayscale, lossless/arithmetic/12-bit exports, malformed orientation/ICC sequences
and non-JPEG formats are unsupported. Ordinary baseline/progressive RGB JPEG
exports are supported. See the runbook for plain-language export guidance.

The binding decodes/resizes to a maximum 1024 px longest edge, with aspect ratio
rounded to whole pixels and no upscaling/cropping. The Worker independently
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

## Remaining WP3 slices

Validated manifests are private transport receipts. This slice does **not** attach
them to `shop_images` or artwork key columns, approve or activate a stamp, fetch
private evidence, publish files, render commissioned art or provide a photo UI.
Later slices must consume validated receipts and recheck current target/version,
rights, required formats/checksums and admin-only approval evidence. Keep the
existing immutable artwork and collection models. Build source/SVG validation,
full approval, public delivery, credits, attachment and
founder-friendly interfaces separately. WP4 imports follows artwork/media.
