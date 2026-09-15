# M6 WP3 JPEG intake — draft review handoff

Base inspected: `65e249f21815a94fa926b1cb936354e56404b35b`. No open PRs at the
start. Main CI 34838929027 and staging 34838944866 were successful. Issues #32,
#19 and #28 were read together; the current illustration guide takes precedence
over old compact-proof/texture wording. WP4 remains catalogue imports.

## Implemented

- Shop-photo-only JPEG initiation and bounded actual-content preflight.
- Cloudflare Images decoding/resizing via a narrow server binding; no native
  image dependency in the Worker and no persistent original upload.
- All eight EXIF orientations applied explicitly to decoded pixels. Metadata-free
  RGBA PNG output, longest edge 1024 px, aspect ratio retained without cropping.
- Original JPEG identity separate from processed PNG identity. An additive
  migration reserves output identity transactionally before conditional R2 write;
  live role/uploader/environment/target checks and audited finalization remain.
- Independent stored-byte PNG decompression/hash/dimension/MIME verification.
- PNG unchanged-byte intake and existing PR #63 checks retained. No artwork,
  shop-image attachment, approvals, public delivery or impressions rewritten.
- Updated developer chooser and acceptance notes. Founder-reported PNG and phone
  success are carried forward; broad shop-admin and photo display are separate.

## Local evidence

- Full Vitest suite: 87 files / 1,129 tests passed before final focused additions.
- Final HTTP tests: 38 passed, including metadata-bearing processor-output
  rejection. Final JPEG tests: 16 passed, including real local Images decoding,
  baseline/progressive/ICC exports, metadata removal, orientation and resize.
- TypeScript and ESLint passed. Next.js production build passed. OpenNext
  Cloudflare bundle passed using its standalone Next build mode.
- This workspace reused the unchanged lockfile's installed dependencies. Initial
  package-manager auto-install and external dependency symlink failed locally;
  direct installed binaries and an in-root dependency tree resolved those issues.
- Database regression tests added to the existing reset/test discovery. They
  have **not run locally**: no Postgres, Docker or Supabase CLI is available here.
- Full local `wrangler dev` processor smoke could not start because the host
  rejects network-interface enumeration (`uv_interface_addresses`). Local Images
  binding tests run successfully via Wrangler's platform proxy. No permission
  bypass or alternate production service was introduced.

Do not confuse local Images emulation with Cloudflare's remote decoder fidelity.
An arbitrary mutation of entropy bytes may still decode to pixels; do not claim
JPEG checksums can detect pre-existing pixel corruption. Structural truncation,
invalid markers/tables, metadata/resource limits and invalid output are tested;
remote decoder behavior remains an explicit staging verification item.

## Next session

1. Inspect this draft PR's latest head, CI, review comments and main; continue it.
   Review the new SQL migration/test and existing PNG regression/reset gates.
2. Fix actionable findings without restarting resolved admin investigations or
   adding competing workflows. Re-run only affected/failed checks.
3. Check all established gates, including Worker authentication, pass on the
   final head; mark ready and squash-merge only when review/merge gates pass.
4. Confirm Images account enablement, then use the existing staging deployment
   (additive migration first). Keep R2 private. No new secret is required.
5. Verify remote JPEG → private processed PNG → independent finalization, using
   synthetic metadata/orientation fixtures and a rights-cleared founder photo.
   Verify exact output bytes contain only IHDR/IDAT/IEND, correct orientation and
   bounded size. Treat any failure as a blocker for calling JPEG runtime accepted.
6. Record what actually passed. Do not repeat the accepted PNG or phone checklist
   without new evidence. Photo display waits for attachment/delivery/UI.

Keep #17 before real-catalogue launch and #27 with geographic seal delivery.
Preserve every impression and duplicate protection. Source/SVG/commissioned
approval, imports, public delivery and complete photo interface remain outside
this PR. October 2026 launch remains the priority.
