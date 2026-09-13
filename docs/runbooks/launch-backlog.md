# Launch backlog review — 13 September 2026

Reviewed against main `e5cdd11f9f8de175c00906ecbbe56e24479137dc` after PR #57.
This review sequences existing work; it does not expand the MVP or approve new
presentation, privacy, artwork, or geographic policy.

## Immediate stabilization

| Item | Evidence and disposition |
| --- | --- |
| Post-merge mobile map test | CI #232 failed after raising the results sheet and dragging from a point it covered. Reproduced locally; drag the actual map before raising the sheet, and assert the drag starts on the map canvas. Keep all camera/filter assertions. |
| #52 — shop contrast | Reproduced on the collected action during hydration: interpolated foreground/background lose AA contrast. Change those colours together and retain border animation. Audit the transition rather than waiting it away. |
| #56 — results keyboard access | The sheet's scroll container has no independent focus target when its content has no controls. Add a named keyboard focus target; verify empty/populated results and callback feedback at short mobile sizes, with normal/reduced motion. |
| #58 — Passport recovery | Nonce/verification failures could suggest Passport before any collect request. Track uncertain issuance separately. Keep fresh verification, explicit confirmation, original duplicates and reconciliation after interrupted issuance. The founder's original phone failure code remains unknown. |
| Passport scroll restoration test | Reproduced CI #232's country-route flake. The fixed 300 px offset hides the link under the sticky toolbar; Playwright auto-scrolls before clicking and can overwrite the remembered offset. Choose a nonzero offset that leaves the link exposed, assert its hit target, then require restoration within 10 px. No application scroll behavior changes. |

## Next Milestone 6 packages

1. **Shop operations:** build on PR #55's current-role authorization and restricted
   audit foundation. Give the founder create/edit/preview/publish, temporary and
   permanent closure, and archive operations without code deployment. Validate
   catalogue/provenance fields, enforce roles server-side, audit canonical writes,
   and keep existing collected impressions immutable. Keep the admin presentation
   limited to these operations.
2. **Artwork and media delivery:** #32 is the coordinated implementation package,
   with #19 and #28 contributing credit/approved-art requirements. Use Cloudflare
   R2, versioned assets, rights and approval records, intact artwork and readable
   credit. Test the founder's own entrance/interior photos when the delivery path
   exists. Do not apply photo cropping rules to commissioned stamps.
3. **Catalogue imports:** validated CSV/JSON, dry run, row errors, deduplication,
   import batches and audit. Preserve staging/production separation and exclude
   demo/test-venue records from production.

## Remaining open issues

| Issue | Priority and disposition |
| --- | --- |
| #17 — About | Before real-catalogue launch. The current page still counts `prototypeShopDetails`; wire coverage to the published catalogue or omit unsupported totals. Some original complaints are already superseded: no nationwide promise remains, and country codes have been generalized. Founder/funding copy still needs accurate content. |
| #30 — phone/postal/verification date | Before exposing these fields in the shop UI. Resolve their presentation and provenance semantics alongside shop operations. Current omission is not a runtime blocker; do not synthesize dates or append unsupported postal data. |
| #32 — commissioned approval pipeline | Required M6 artwork/media work, after shop operations. Collection snapshots and approved-art rendering already have M5 foundations; upload/approval/delivery is still pending. |
| #19 — illustrator credit | Coordinate with #32; do not treat as a separate competing implementation. |
| #28 — artwork layers/ink | Coordinate with #32 using current BRAND and illustration guide. Its old compact-proof/texture wording must not override the newer intact-art contract. |
| #27 — city-state seal labels | Revisit with geographic seal/art delivery. The old generated composition is not a reason to alter approved human artwork. Preserve geographic relationships outside the art. |
| #34 — Milestone 4 | Stale umbrella issue: foundations/integration are merged in #35–#45, staging compatibility in #47, and sign-in refinement in #48. Founder confirmed magic link and Google sign-in in staging. Close as completed; production auth remains separate launch work. The old sender proposal is not the current login sender. |
| #11 — private notes | After launch; requires its own data/lifecycle decisions. |
| #12 — Passport visibility | After launch; keep Passport private until its explicit privacy model ships. |
| #13 — sharing | After launch; requires placement/privacy decisions, especially for Passport and artwork. |
| #14 — trips | After launch; a substantial separate feature. |

The broader launch gates still include real-phone checks, production setup,
privacy/account lifecycle, monitoring and catalogue quality. One successful
indoor staging collection does not complete the remaining phone checklist.
