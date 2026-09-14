# R2 upload foundation — M6 WP3

Read [the API and limitations](../api/admin-media-v1.md). This is a private PNG
transport foundation. It cannot publish artwork/photos or make a new shop's
stamp publication prerequisite disappear.

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
It opens a file chooser and prompts for an existing shop UUID and the required
source/rights/credit/alt metadata. Use your own supported PNG without EXIF/text/ICC metadata and a
labelled test shop. It does not read authentication cookies or print secrets.
This is temporary developer verification, not the later founder photo interface.
Do not upload identifiable people without permission.

Normal 8-bit RGB/RGBA, non-interlaced PNG exports may include `sRGB`, `gAMA`
and `pHYs` display information. These do not need to be removed. Each may appear
only once before image data; exact lengths, numeric values and colour consistency
are checked as specified in the API contract. All other ancillary chunks, including
EXIF, text, timestamps, unknown chunks and ICC profiles, remain unsupported.
The upload preserves the file byte-for-byte; it does not strip or convert anything.

```js
const picker = document.createElement('input');
picker.type = 'file'; picker.accept = 'image/png';
picker.onchange = async () => {
  const file = picker.files[0];
  if (!file) return;
  const bytes = await file.arrayBuffer();
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    b => b.toString(16).padStart(2, '0')).join('');
  const manifest = {
    shopId: prompt('Existing staging shop UUID'), purpose: 'shop_photo',
    sha256, byteSize: file.size, contentType: 'image/png',
    sourceRef: prompt('Source/original file reference'),
    rightsBasis: prompt('Ownership or explicit reuse permission'),
    creditText: prompt('Photographer credit'), altText: prompt('Describe the image')
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
  await call(`${base}/${upload.id}`, {method:'PUT', headers:{'Content-Type':'image/png'}, body:bytes});
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
commissioned draft `artworkVersionId`, omitting `rightsBasis` and `creditText` from
the request. Prepare the draft through the later artwork management flow or
explicit operator test SQL, never by changing an approved version. No artwork
creation endpoint or approval UI is included here.

### Retesting the founder PNG rejection

The founder reported a 420 × 595 RGBA export with
`IHDR → pHYs → sRGB → gAMA → IDAT → IEND`. The original validator rejected it at
`pHYs` before R2 write; it independently rejected `sRGB` and `gAMA` too. Initiation
only checks the manifest, so a private ID followed by PUT `422 invalid_upload`
was consistent with that overly restrictive subset. The revised validator accepts
this structure when the display values and remaining file checks pass. A synthetic
regression fixture reproduces the reported structure; the private original was
not supplied to automated tests.

After deploying the fix from main, repeat the snippet with the same original PNG
and a labelled staging shop, using `purpose: 'shop_photo'`. Expect PUT success and
finalization `validated` with width 420 and height 595, without a public URL. This
size remains invalid for `artwork_png`, which still requires 1200 × 800 RGBA with
transparent pixels. No photo or approved artwork is attached or replaced.

The snippet creates a new session. Alternatively, retry the exact bytes on the old
ID if it is still pending and unexpired, then finalize. Leave the failed manifest
and audit intact; do not delete records or change its checksum. An expired session
requires a new initiation. Report only success/error code and dimensions, not
private IDs, credentials, image content or permission evidence.

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

## Acceptance still pending

Latest verified staging deployment before the display-chunk fix: PR #62 merge
`f375e5fd16f1e31f97aad7d72a120e1b07a6ea98`,
[run 34795716499](https://github.com/avecging/nibatlas/actions/runs/34795716499).
All five [post-merge CI jobs](https://github.com/avecging/nibatlas/actions/runs/34778910781)
passed. The founder confirmed bucket setup and deployment worked. Live initiation
succeeded, but the original PNG PUT failed as described above; successful live
upload/finalization after this fix remains pending. The connector still exposes
no workflow-dispatch operation; use the existing manual Deploy staging workflow.

Founder shop-admin acceptance in `shop-administration.md` remains pending.
Follow `staging-phone-test.md` for the remaining physical-phone acceptance;
previous indoor success is confirmed but does not complete permission recovery,
interruption/backgrounding, duplicate/reload or sign-out isolation. Never erase
impressions, rotate stamp IDs or weaken duplicate protection. Entrance/interior
photo **display** acceptance waits for the later delivery/UI slice.

Keep #17 About accuracy before real catalogue launch and #27 with geographic seal
delivery. No social, notification, QR/NFC or merchant work is included.
