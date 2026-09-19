# R2 upload foundation — M6 WP3

Read [the API and limitations](../api/admin-media-v1.md). This is private PNG/JPEG
transport, photo/logo delivery and the simplified #73 stamp-artwork workflow
within WP3. JPEG shop photos are processed before storage. Stamp PNGs remain exact
validated bytes; activation advances the same stamp identity without rewriting
older versions or impressions.

## Cloudflare setup (once, before deploying this PR)

1. In Cloudflare → R2, create or confirm `nibatlas-staging-images` and
   `nibatlas-production-images`. Keep the two buckets separate.
2. In **each bucket → Settings**, leave public `r2.dev` access disabled and do
   not connect a public custom domain. Do not enable public access just to preview
   a pending file. Do not configure browser CORS or share S3 credentials.
3. No new upload secret is needed. `wrangler.jsonc` binds `MEDIA_BUCKET` to the
   correct bucket and `MEDIA_ENV` to staging/production. The existing
   `SUPABASE_SERVICE_ROLE_KEY` is used only in the server; never paste it in chat.
   Keep the existing staging/production Supabase configuration separate too.
4. After review and merge, use GitHub → Actions → Deploy staging → Run workflow
   → main. The existing workflow applies migrations before deploying the Worker.
   Creating these buckets first avoids a deployment failure for a missing binding.

This branch does not deploy production or create an alternate CI gate. `next dev`
without a Cloudflare binding fails closed for uploads. Use the existing Cloudflare
preview with local R2 binding for development; never connect local tests to
production. No remote production binding is enabled in the repository.

[Cloudflare's binding and conditional-write reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
and [Workers zlib support](https://developers.cloudflare.com/workers/runtime-apis/nodejs/zlib/)
document the platform APIs used by the adapter/validator.

## Developer verification harness

After deployment, sign in as the existing staging editor/admin. On that same
staging origin, use browser DevTools to run the snippet below after reviewing it.
It opens a file chooser and prompts for an existing shop UUID without a metadata questionnaire. Use your own supported PNG or ordinary JPEG photo and a
labelled test shop. It does not read authentication cookies or print secrets.
This is temporary developer verification, not the later founder photo interface (use the normal controls below).
Do not upload identifiable people without permission.

Normal 8-bit RGB/RGBA, non-interlaced PNG exports may include `sRGB`, `gAMA`
and `pHYs` display information. These do not need to be removed. Each may appear
only once before image data; exact lengths, numeric values and colour consistency
are checked as specified in the API contract. All other ancillary chunks, including
EXIF, text, timestamps, unknown chunks and ICC profiles, remain unsupported.
PNG uploads preserve the file byte-for-byte. JPEG shop photos follow the processing rules below.

```js
const picker = document.createElement('input');
picker.type = 'file'; picker.accept = 'image/png,image/jpeg';
picker.onchange = async () => {
  const file = picker.files[0];
  if (!file) return;
  const bytes = await file.arrayBuffer();
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    b => b.toString(16).padStart(2, '0')).join('');
  const manifest = {
    shopId: prompt('Existing staging shop UUID'), purpose: 'shop_photo',
    sha256, byteSize: file.size, contentType: file.type,
  };
  const base = '/api/v1/admin/media/uploads';
  const call = async (url, options) => {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.code || 'Upload failed');
    return result;
  };
  const upload = await call(base, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(manifest)});
  console.info('Private upload ID:', upload.id); // Keep for recovery.
  await call(`${base}/${upload.id}`, {method:'PUT', headers:{'Content-Type':file.type}, body:bytes});
  console.info(await call(`${base}/${upload.id}`, {method:'POST'}));
};
picker.click();
```

Expected: `validated`, dimensions, UUID and expiry, with no public URL. GET the
same UUID for recovery. Missing PUT then finalization produces `upload_incomplete`.
A wrong file/hash or unsupported PNG produces `invalid_upload`. Signed-out reads
must fail; another account must not see this session. An admin can inspect the
existing audit endpoint; editor cannot read audit. Never paste private evidence
or account history into a public issue.

Artwork verification uses the same API with `purpose=artwork_png` and an existing
uploaded draft `artworkVersionId`. Do not send source, rights, credit or alt-text
paperwork in that file manifest; origin and creator credit live on the draft
version created in Admin → Shops → Atlas Stamp artwork. Never change an approved
version.

### Retesting the founder PNG rejection

The founder reported a 420 × 595 RGBA export with
`IHDR → pHYs → sRGB → gAMA → IDAT → IEND`. The original validator rejected it at
`pHYs` before R2 write; it independently rejected `sRGB` and `gAMA` too. Initiation
only checks the manifest, so a private ID followed by PUT `422 invalid_upload`
was consistent with that overly restrictive subset. The revised validator accepts
this structure when the display values and remaining file checks pass. A synthetic
regression fixture reproduces the reported structure; the private original was
not supplied to automated tests.

Founder-reported acceptance (14 September 2026): separate staging/production
bucket setup and deployment worked, and the original PNG now finishes as
`validated`. No repeat is required just because earlier notes said pending.
No additional device details, dimensions returned by the live run, timings or
individual observations were supplied. Keep failed manifests and audit intact.

## JPEG photo intake — same WP3, separate from artwork

Choose an ordinary `.jpg`/`.jpeg` photo in the same harness, up to **5 MiB**,
**8192 px per axis** and **24 million pixels**. Supported: 8-bit, three-component
baseline and progressive JPEG, EXIF orientations 1–8, and bounded ICC profiles.
Adobe-tagged RGB and YCbCr exports are supported; their colour interpretation is
retained only for decoding, not in the stored PNG.
EXIF/GPS, XMP, IPTC, comments and other APP metadata do not reach R2.
Unsupported: HEIC/HEIF, JPEG XL, CMYK/YCCK, grayscale JPEG, lossless/arithmetic/
12-bit JPEG, multiple-picture/MPO files, malformed EXIF orientation/ICC chunk
sequences, truncated files and appended bytes. Export those as ordinary RGB JPEG;
no manual PNG conversion is needed for supported photos.

The server decodes through `PHOTO_IMAGES`, resizes to **at most 1024 px on the
longest edge**, preserves aspect ratio (decoder rounding to a whole pixel, minimum 1 px), does
not enlarge/crop, applies orientation to decoded pixels and encodes a clean RGBA
PNG. This bounded private working photo fits the existing 5 MiB storage and
validator budget even at square dimensions. It is not a high-resolution original
archive or a public delivery variant. Keep your own original if you need it later.

The original checksum/size/MIME remain the **input** identity. A separate output
checksum/size/MIME/dimensions and immutable key describe the exact processed PNG.
Only those output bytes are stored. PNG and stamp-artwork uploads never
enter this photo transformation path.

### Cloudflare setup for this slice (after review, before staging deployment)

1. In Cloudflare, confirm Images is enabled for the Nib Atlas account. This uses
   its Workers binding, not Images-hosted storage or a public transformation URL.
2. After merge, use the existing **Actions → Deploy staging → Run workflow → main**.
   The repository declares `PHOTO_IMAGES` for staging and production and applies
   the additive migration before deploying. Keep R2 buckets private as above.
3. Run the harness once with a supported JPEG you own. Expect `validated`, no
   public URL. Check orientation/metadata with synthetic runtime verification
   before release; photo/logo attachment and display are implemented by #74 but require separate remote acceptance.

No new secret is needed. Missing Images configuration fails JPEG closed; PNG
intake does not depend on the Images binding. Do not paste credentials in chat.

### Retry and rollback details

Output identity is reserved in an audited transaction **before** the conditional
R2 write. A storage failure leaves a private pending receipt; retry the same exact
JPEG and finalize within 24 hours. If processing now yields different bytes,
`409 upload_conflict` requires a new session; never replace the reserved output.
If PUT succeeded but its response was lost, try POST finalization first. Missing
output returns `409 upload_incomplete`; then retry PUT. GET alone reports status,
not whether the object exists. Every finalization reads/decompresses stored PNG
bytes independently and checks the reserved output identity. A completed POST is
idempotent. Rejected/missing output never becomes validated or public.

Cloudflare decoding/availability errors are redacted as `503 service_unavailable`;
preflight, output validation and byte/MIME mismatches return `422 invalid_upload`.
For a repeatable decoder failure, use a fresh ordinary RGB JPEG export and a new
session; do not weaken validation. No claim is made to detect every pixel-level
corruption that still decodes as a JPEG; transformed output must be a fully valid
bounded PNG. Decoder behavior is additionally a staging runtime gate.

Worker rollback keeps the additive columns, private objects and all audit/history.
The older Worker supports existing PNG sessions; JPEG sessions require redeploying
this Worker or a new compatible version. Do not run JPEG traffic on the older
Worker or delete receipts to roll back.

## Recovery and operating limits

- No automatic file deletion is configured. For occasional expired pending files,
  a database operator selects `media_uploads` with `status='pending'` and an expiry
  at least 24 hours in the past, checks the exact environment and confirms the
  object key is unreferenced by all four artwork key columns and
  `shop_images.storage_key`. Delete only those exact R2 objects; retain manifests
  and audit. Expired sessions cannot finalize. Repeat the reference/status check
  immediately before deleting; pause media operations during manual cleanup.
- Do not delete validated objects or configure blanket prefix expiry. Later
  attachment/publication uses these stable keys, including historical versions.
- A failed finalization does not mean a file was lost. Retry while pending and
  unexpired; an expired session needs a new initiation. Never amend a checksum
  or weaken validation to force acceptance.
- Rollback: restore the previous Worker; retain the additive table, audit and
  objects. No existing shop/image/artwork/collection data was rewritten. Do not
  reset staging or drop audit/history to roll back.
- Before public media launch, confirm backup/export and spend alerts with M8.
  This intake limit is not a complete infrastructure budget alarm.

## Acceptance and remaining verification

Verified baseline: main `65e249f21815a94fa926b1cb936354e56404b35b`,
[CI](https://github.com/avecging/nibatlas/actions/runs/34838929027) and
[staging deployment](https://github.com/avecging/nibatlas/actions/runs/34838944866)
succeeded. Founder reports bucket setup/deployment, original PNG `validated`, and
the physical-phone checklist worked. These results are carried forward; no
invented device details, timings or per-check observations are recorded.
The draft-create fix is confirmed separately from broader shop-admin acceptance.

JPEG is a new slice. Local Images emulation is not remote production fidelity;
staging still needs actual Images processing, R2 write/read, RPC finalization and
private-output inspection. PR #66 was deployed to staging; see the JPEG handoff
for the recorded deployment. Deployment does not establish runtime or photo
**display** acceptance. Photo/logo and stamp UI/delivery were merged in #74 and deployed, but remain
unaccepted remotely until the staging checks below.

Keep #17 About accuracy before real catalogue launch and #27 with geographic seal
delivery. Preserve existing impressions and duplicate protection. No social,
notification, QR/NFC or merchant work is included.

## Founder photo/logo workflow — issue #73 checkpoint

1. Admin → Shops → choose the intended shop → **Photos and logo**.
2. Choose a photo (PNG/JPEG) or logo (PNG). Check the local preview and named shop.
   No source/rights/credit/description form is required. PNG keeps transparency;
   unsupported exports receive an error rather than being silently rewritten.
3. **Save photo/logo privately** validates, finalizes and attaches it to this shop.
   Check the saved preview. It is not public yet. Retry Save after an interrupted
   request; terminal expiry/conflict starts a fresh session on the next Save.
4. **Publish** → **Confirm publish** is an admin action. Only published shops
   expose approved media. A new public logo replaces the old public logo; all
   uploaded versions stay saved. **Hide** → confirm stops new public delivery.
5. Check the shop page signed out, including orientation, full image, transparent
   logo, fallback alt text and any preserved credit. After hide/archive, fresh
   image requests must fail. Use **Reload media** after ambiguous publication.

Limits: 50 retained attachments per shop; hidden/replaced images count. No media
removal/reordering UI yet. Catalogue saved changes and media publication are
separate. Private previews require a current editor/admin session. Admin is needed
for publish/hide. Keep buckets private; no new environment variables are needed.

### Founder stamp artwork workflow — issue #73 checkpoint

1. Admin → Shops → choose the intended shop → **Atlas Stamp artwork**.
2. **Create uploaded stamp version**. Choose the truthful origin:
   **Founder-created**, **AI-assisted**, or **Commissioned**. Enter creator name,
   optional HTTP(S) creator link, and the approved ink. This does not require an
   editable source, SVG bundle, rights evidence, maker-mark confirmation or
   external sign-off for MVP; those commissioning questions are #71.
3. Choose a **1200 × 800 transparent PNG** with the normal file picker and
   **Save PNG privately**. The exact bytes are validated and attached to this
   draft only. Unsupported exports fail instead of being silently cropped,
   recoloured or rewritten.
4. Compare the private **List / Passport / Detail** previews. The same complete
   artwork is scaled with `object-fit: contain`; no crop is introduced.
5. **Activate this design (admin)** → confirm. Activation is revision-checked and
   changes only the current design pointer on the same stamp. Existing approved
   versions and collected impressions remain unchanged.
6. Collect with a fresh test account and confirm the ceremony/Passport/detail
   render the exact PNG plus `created by: name`; when a creator link exists only
   the name is clickable. A collector of an older uploaded version must still be
   able to view that historical artwork after a newer design is activated.
7. Confirm an account that already owns the stamp still receives duplicate
   behavior rather than a second collection. Re-collecting later designs is #70,
   not part of this MVP flow.

Do not claim staging acceptance from CI alone. After authorized merge/deploy,
test one founder-created or AI-assisted PNG through create → attach → previews →
activate → new collection → historical view. Keep R2 private. If activation is
ambiguous, reload versions before retrying; never edit an approved row.

### Verification status and exact next slice — 20 September 2026

PR #74 is merged at `3732018a0ca023a2dc7e8ae0eef7a26061e8470a`.
[Main CI 35446023895](https://github.com/avecging/nibatlas/actions/runs/35446023895)
and [staging 35446031047](https://github.com/avecging/nibatlas/actions/runs/35446031047)
passed. Do not recreate its photo/logo or stamp implementation. Q4 2026 is the
public launch commitment; use the implementation plan's A–F sequence.

| Check | Evidence / next action |
| --- | --- |
| Original PNG, physical-phone flow, private draft creation | Founder-confirmed previously; preserve these results and all history. |
| JPEG remote processing → R2 → independent finalization | Still unverified. Use existing legitimate test shop, supported authorized asset and authenticated editor; inspect metadata-free output/orientation/size as in JPEG handoff. Local decoding and CI are separate evidence. |
| Photo/logo attachment, private preview, public delivery and hide | Implemented/deployed, remote acceptance pending. Verify authorized test content only; do not republish real shop content for a test. |
| Uploaded stamp → previews → activation → eligible new collection → historical view | Implemented/deployed, remote acceptance pending. Need authorized test art, test account and legitimate eligible device/location. Never reset history, fabricate coordinates, duplicate businesses or bypass duplicate protection. |
| Package A session access | Existing staging browser reached the signed-out admin screen on reload; no authenticated editor session, supplied test media or eligible device test was available. No uploads, activations, publication or collections were performed. |

Package A deployed successfully in run 35458739061 at `7074656bdc3e7aa945ad208a0fbdd036410fac82`. Its public smoke passed; authenticated/media acceptance above remains pending. Test infrastructure-response
recovery separately from the above feature checks. A JSON-parser fix is not a
1102 resource fix. See `staging-deployment.md` for missing telemetry and read-only
reproduction steps. Reload saved versions/media/stamps after ambiguous mutations
before retrying; keep resumable upload IDs and exact selected bytes intact.

#70/#71/#72 remain deferred. WP4 imports are mandatory after shared contracts and
before final rich-editor polish; #17 precedes real catalogue launch and #27 stays
with geographic seal delivery. Keep R2 private and preserve versions/credits.
