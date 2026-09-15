# M6 WP3 JPEG intake — staging verification handoff

## Current status — 15 September 2026

PR #66 is merged as `4d4949ab211734a109ec011a4f4988f5d3c52b13`.
Main CI [34923140046](https://github.com/avecging/nibatlas/actions/runs/34923140046)
and staging deployment [34950217860](https://github.com/avecging/nibatlas/actions/runs/34950217860)
succeeded. Review/merge/deployment are complete; they do not prove that a JPEG
has passed through the remote Images → private R2 → finalization path. That
runtime check remains outstanding. Photo attachment/delivery/UI are later work;
photo display has not been accepted. WP4 remains catalogue imports.

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

## Historical local evidence — pre-merge

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

1. Inspect current main and staging deployment state; do not repeat PR #66's
   completed review/merge steps. Check for newer runtime evidence before testing.
2. Confirm Images account enablement and the deployed additive migration/binding.
   Keep R2 private. The existing setup requires no new secret.
3. Verify remote JPEG → private processed PNG → independent finalization, using
   synthetic metadata/orientation fixtures and a rights-cleared founder photo.
   Verify exact output bytes contain only IHDR/IDAT/IEND, correct orientation and
   bounded size. Treat failure as a blocker for JPEG runtime acceptance.
4. Record the tested deployment and actual results. Fix concrete failures through
   normal review/CI gates. Do not repeat accepted PNG/phone tests without a reason.
   Photo display still waits for attachment/delivery/UI and separate acceptance.

Keep #17 before real-catalogue launch and #27 with geographic seal delivery.
Preserve every impression and duplicate protection. Source/SVG/commissioned
approval, imports, public delivery and complete photo interface remain outside
this PR. October 2026 launch remains the priority.
