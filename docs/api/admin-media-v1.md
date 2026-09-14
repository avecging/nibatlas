# Private media uploads v1 — M6 WP3 first slice

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
| `/api/v1/admin/media/uploads/[id]` | PUT | Exact `image/png` bytes | Uploaded; must still finalize |
| Same | POST | Empty body | Reads R2 bytes, validates, records validated manifest |
| Same | GET | No query | Private status/expiry/dimensions only; no file bytes |

Mutations require the matching Origin. No query parameters or arbitrary keys,
URLs, approval claims or actor IDs. No public GET, signed URL, anonymous upload,
CORS grant or cache entry. Every response is private/no-store. Raw provider
errors are redacted. UUID knowledge grants no access.

Initiation JSON (max 8 KiB): `shopId`, `purpose` (`shop_photo` or `artwork_png`),
`sha256` (64 lowercase hex), `byteSize` (integer, 1–5 MiB), `contentType`
(`image/png`), `sourceRef` (1–2000 chars), `altText` (1–1000 chars).
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
size and SHA-256 over the entire original file, including display chunks. Reject
trailing bytes and every other chunk, including EXIF (`eXIf`), text (`tEXt`,
`zTXt`, `iTXt`), embedded ICC profiles (`iCCP`), timestamps (`tIME`), unknown
ancillary chunks, palette PNG and animation (`acTL`, `fcTL`, `fdAT`). Sensitive or
unsupported metadata is rejected **before R2 persistence**, not stripped after
storing GPS. Fixed display declarations are not a general metadata allowlist or
a guarantee against sensitive content encoded in pixels. Artwork requires RGBA,
1200 × 800 and transparent pixels. Files are never rewritten or converted.

This intentionally narrow subset can reject otherwise valid illustrator PNGs.
Ask for a suitable export, never silently modify approved artwork. Full one-ink,
maker-mark, visual and cross-export approval checks are later WP3 work; a transport
validation is not evidence of illustrator approval or production readiness.
JPEG/WebP/AVIF, SVG and editable sources are not accepted in this slice.

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

## Failure and recovery

- 400 malformed contract; 401 signed out; 403 role/origin denied; 404 unknown,
  other-account or wrong-environment upload; 409 missing object/already finalized
  PUT; 410 expired pending upload; 422 invalid bytes/target/metadata; 429 initiation
  limit; 503 storage/database unavailable. Database-detected expiry during a
  finalization race is 422. Finalization bodies with data are rejected.
- Initiation limit: 100 manifests per account per rolling 24 hours, serialized
  through the actor row. Maximum newly accepted bytes is therefore 500 MiB/day.
- Pending uploads expire after 24 hours. GET still reports their expiry; they
  cannot finalize. Initiate again for a new attempt. No multipart upload exists.
- Missing, invalid or interrupted uploads never become validated or public.
  Retry the same exact PUT, then POST finalize. If a response is lost, GET the
  UUID first. A completed finalization POST is idempotent and adds no new audit.
- R2 and Postgres cannot share one transaction. If R2 succeeds but finalization
  fails, the file stays private and the manifest stays pending. Retry within the
  expiry. See the runbook for selective cleanup; do not use a blanket lifecycle
  deletion rule over keys that may later be attached to approved artwork.
- Validated manifests cannot be edited/deleted. Canonical initiation and final
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
full approval, public delivery, credits, photo processing/EXIF stripping and
founder-friendly interfaces separately. WP4 imports follows artwork/media.
