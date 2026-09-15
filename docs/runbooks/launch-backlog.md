# Launch backlog review — 13 September 2026

Reviewed against main `0d5109eaba18ef45bcaee9df42194f1ec941e1b7` after PR #59,
with M6 WP2 shop operations delivered by PR #60.
This review sequences existing work; it does not expand the MVP or approve new
presentation, privacy, artwork, or geographic policy.

## Completed stabilization — PR #59

The following records the original findings, all resolved in PR #59. Issues #52,
#56 and #58 are closed. Do not restart this investigation. The stale Milestone 4
umbrella #34 is also closed; production authentication remains separate launch work.

| Item | Evidence and disposition |
| --- | --- |
| Post-merge mobile map test | CI #232 failed after raising the results sheet and dragging from a point it covered. Reproduced locally; drag the actual map before raising the sheet, and assert the drag starts on the map canvas. Keep all camera/filter assertions. |
| #52 — shop contrast | Reproduced on the collected action during hydration: interpolated foreground/background lose AA contrast. Change those colours together and retain border animation. Audit the transition rather than waiting it away. |
| #56 — results keyboard access | The sheet's scroll container has no independent focus target when its content has no controls. Add a named keyboard focus target; verify empty/populated results and callback feedback at short mobile sizes, with normal/reduced motion. |
| #58 — Passport recovery | Nonce/verification failures could suggest Passport before any collect request. Track uncertain issuance separately. Keep fresh verification, explicit confirmation, original duplicates and reconciliation after interrupted issuance. The founder's original phone failure code remains unknown. |
| Passport scroll restoration test | Reproduced CI #232's country-route flake. The fixed 300 px offset hides the link under the sticky toolbar; Playwright auto-scrolls before clicking and can overwrite the remembered offset. Choose a nonzero offset that leaves the link exposed, assert its hit target, then require restoration within 10 px. No application scroll behavior changes. |

## Milestone 6 delivery sequence

1. **WP2 shop operations — implemented in PR #60:** builds on PR #55's current-role authorization and restricted
   audit foundation. Give the founder create/edit/preview/publish, temporary and
   permanent closure, and archive operations without code deployment. Validate
   catalogue/provenance fields, enforce roles server-side, audit canonical writes,
   and keep existing collected impressions immutable. Keep the admin presentation
   limited to these operations.
2. **WP3 artwork and media delivery — next:** #32 is the coordinated implementation package,
   with #19 and #28 contributing credit/approved-art requirements. Use Cloudflare
   R2, versioned assets, rights and approval records, intact artwork and readable
   credit. Test the founder's own entrance/interior photos when the delivery path
   exists. Do not apply photo cropping rules to commissioned stamps.
3. **WP4 catalogue imports:** validated CSV/JSON, dry run, row errors, deduplication,
   import batches and audit. Preserve staging/production separation and exclude
   demo/test-venue records from production.

## Remaining open issues

| Issue | Priority and disposition |
| --- | --- |
| #17 — About | Before real-catalogue launch. The current page still counts `prototypeShopDetails`; wire coverage to the published catalogue or omit unsupported totals. Some original complaints are already superseded: no nationwide promise remains, and country codes have been generalized. Founder/funding copy still needs accurate content. |
| #30 — phone/postal/verification date | WP2 defines stored provenance semantics in ADR 0012 and allows private editing. Public presentation remains deferred and all three fields remain omitted publicly. Do not synthesize dates or append unsupported postal data. |
| #32 — commissioned approval pipeline | Required M6 artwork/media work, after shop operations. Collection snapshots and approved-art rendering already have M5 foundations; upload/approval/delivery is still pending. |
| #19 — illustrator credit | Coordinate with #32; do not treat as a separate competing implementation. |
| #28 — artwork layers/ink | Coordinate with #32 using current BRAND and illustration guide. Its old compact-proof/texture wording must not override the newer intact-art contract. |
| #27 — city-state seal labels | Revisit with geographic seal/art delivery. The old generated composition is not a reason to alter approved human artwork. Preserve geographic relationships outside the art. |
| #11 — private notes | After launch; requires its own data/lifecycle decisions. |
| #12 — Passport visibility | After launch; keep Passport private until its explicit privacy model ships. |
| #13 — sharing | After launch; requires placement/privacy decisions, especially for Passport and artwork. |
| #14 — trips | After launch; a substantial separate feature. |

The broader launch gates still include production setup, privacy/account
lifecycle, monitoring and catalogue quality. The founder reports the physical-phone
checklist worked; do not reopen it solely because earlier notes said pending.

M6 WP2 implements shop operations in `docs/runbooks/shop-administration.md`.
Issue #30 semantics are documented in ADR 0012; phone/postal/record-review fields
remain intentionally omitted publicly. The physical-phone checklist is founder-reported successful.
Next implementation is M6 WP3 artwork/media, then WP4 imports. New shops remain
private until their existing active-approved-stamp publication prerequisite is met.

WP3 private R2/PNG transport is merged (#62/#63). The founder reports separate
bucket setup/deployment worked and the original PNG now completes as `validated`.
The current verified baseline is `65e249f21815a94fa926b1cb936354e56404b35b`,
CI run 34838929027 and staging run 34838944866, both successful.
The draft-create fix (#65) is confirmed separately from broader admin acceptance.

The next bounded WP3 slice adds safe JPEG shop-photo intake, separate input/output
identity and private finalization. CI/review/merge and remote Images/R2 acceptance
remain pending for that draft. Photo attachment, public delivery and founder UI,
SVG/source validation and commissioned approval remain later WP3 work. #32/#19/#28
are not complete. Photo display acceptance has not happened. WP4 remains imports.
