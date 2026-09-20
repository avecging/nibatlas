# Package B3 — admin editor contract handoff (frontend → backend)

**Status:** open handoff. **Branch:** `claude/nib-atlas-admin-rebuild-20rvho`.
**Baseline inspected:** `main` at `d9f63638c8371ea7c2821e6708fc49f3c19992ae`
(PR #78 merged; CI run 35486925356 and staging deployment 35486983423 both
succeeded at that commit; no open pull requests at inspection).

## Purpose and ownership boundary

The approved seven-section admin design (`nib-atlas-admin-rework-handoff.md`,
`nib-atlas-admin-prototype.html`) is being rebuilt inside the application. This
session owns **admin interface, interaction design and frontend implementation
only**. Backend handlers, SQL migrations and shared database contracts are owned
by GPT/Codex.

**Files this session edits**

- `src/features/admin/*.tsx`, `src/features/admin/*.module.css`
- `src/features/admin/timezones.ts`, `countries.ts`, `editor-sections.ts`,
  `use-dialog.ts`, `media-contract.ts` (decoder tolerance only — see "Decoder
  tolerance" below)
- `app/admin/**` page wiring
- `tests/e2e/shop-admin.spec.ts`, admin unit tests, this document and the
  affected sections of `IMPLEMENTATION-PLAN.md` / `docs/runbooks/shop-administration.md`

**Files this session does NOT edit** (Codex owns them for the changes below)

- `supabase/migrations/**`
- `src/server/media/shop-http.ts`, `src/server/media/shop-route.ts`
- `src/server/admin/shop-http.ts`, `src/server/admin/shop-route.ts`
- `src/features/admin/shop-contract.ts` `SHOP_FIELDS`/`GROUPS` field definitions
  and `src/features/admin/shop-normalization.ts` validation rules, which are the
  shared manual/import contract

If Codex needs to change a file in the first list, say so before starting and
this session will rebase around it.

## Founder acceptance failures being addressed

| # | Founder report | Classification | Owner |
| --- | --- | --- | --- |
| 1 | Added pictures did not appear on the public frontend | Interface + publication-path defect. An attached image is private until an **admin** runs the separate `publish` media action, which lives in a section far from the Review step and is never surfaced as a publication requirement. | Frontend (this session) — surface media state in Review with a reviewed path to publication. No backend change needed. |
| 2 | Action confirmations appear at the bottom of sections | Interface defect. | Frontend |
| 3 | No discoverable way to remove photos | **API defect.** `shop_media_operation` has no removal action, and `protect_shop_media_identity` makes an attached `shop_images` row immutable and undeletable. `hide` only withdraws it from the public page. | **Backend — request A** |
| 4 | Timezone should be a searchable dropdown of IANA zones | Interface defect. Storage already holds an IANA identifier and the `shops_validate_timezone` trigger already validates it. | Frontend |
| 5 | Validation points at fields, but a correction still does not allow the action to succeed | **Mixed.** Field-level save errors are correctable. Two **publication** requirements are not: `shop_publication_errors` requires `locality_id` and a primary shop type, and the admin API can only create `brands`/`specialties` catalogue choices. With an empty or non-matching locality/type vocabulary the editor is a dead end no correction can clear. | Frontend (error lifecycle, Fix links) + **Backend — request D** |
| 6 | Dated, fragmented, unfriendly | Interface. | Frontend |

## Backend requests

Each request lists the user action, the current endpoint and response, the
change needed, the persistence semantics and the integration acceptance cases.

### A — Remove a photo or logo

- **User action:** in *Photos & logo*, choose **Remove** on a saved image, confirm
  in a dialog, and the image disappears from the admin gallery and from the
  public page.
- **Existing endpoint:** `POST /api/v1/admin/shops/{id}/media`,
  `{action:'publish'|'hide'|'attach', id, revision}` →
  `{entries:[{id,kind,width,height,altText,creditText,status,revision}]}`.
  RPC `public.shop_media_operation(p_actor,p_environment,p_shop,p_action,p_id,p_revision)`.
- **Required change:** accept `action:'remove'` with `id` and `revision`.
  Suggested implementation: a soft removal that sets
  `moderation_status='rejected'` and excludes rejected rows from both the admin
  `list` projection and `public_list`/`public_file`. That keeps the immutable
  attachment identity, the upload receipt and the audit trail intact, so no
  existing invariant has to be relaxed. A hard `delete` would require weakening
  `protect_shop_media_identity` and is not requested.
- **Authorization:** admin, matching `publish`/`hide`. Revision-checked
  (`40001` on mismatch), audited through the existing `shop_media_audit` trigger,
  refused on an archived shop.
- **Persistence/publication semantics the interface will state:**
  - Removing an image whose `status` is `approved` removes it from the **live
    public listing immediately as well as from the draft**.
  - Removing a private (`draft`) image affects the **draft only**; nothing public
    changes.
  - Removal is not reversible from this interface; the uploaded receipt is
    retained for audit but is not re-attachable.
  - Please confirm whether a removed image still counts toward the 50-attachment
    per-shop cap. The interface will say whichever is true; the current default
    assumption in the UI copy is **yes, it still counts**.
- **Migration dependency:** one additive migration changing
  `public.shop_media_operation` only. No table change is required if the
  `rejected` moderation status is reused.
- **Integration acceptance:**
  1. Remove a private photo → gone from admin list; public list unchanged.
  2. Remove a published photo → gone from admin list and from
     `GET /api/v1/shops/{id}/media`; the public page stops showing it.
  3. Remove with a stale `revision` → `409 revision_conflict`, nothing changes.
  4. Editor (non-admin) removal → `403 forbidden`.
  5. Removal on an archived shop → `422 invalid_media_target`.
  6. `GET /api/v1/admin/shops/{id}/media/{removedId}` no longer serves bytes.
  7. The audit log records the moderation change with the acting account.

### B — Gallery cover, order and captions

- **User action:** in *Photos & logo*, set one photo as the cover, reorder the
  rest, and optionally give a photo a public caption; the public shop page shows
  the same cover and order.
- **Existing endpoint:** as above. `shop_images` has no ordering column;
  `credit_text` is a credit, not a caption; the admin and public projections
  order by `created_at, id`.
- **Required change:**
  - Additive columns on `public.shop_images`: `sort_order integer not null default 0`
    and `caption text null` (≤ 300 characters, nullable, never invented).
  - New action `arrange` with `{action:'arrange', order:[imageId,…], captions:{imageId:string|null}, revision}`
    where `revision` is a whole-gallery fingerprint, or per-image revisions if
    that is simpler to keep concurrency-safe. Only ids already attached to this
    shop are accepted; a missing or unknown id is `422 invalid_media_target`.
  - `list` and `public_list` return `sortOrder` and `caption` and order by
    `sort_order, created_at, id`. The cover is the first `photo` in that order —
    no separate boolean is needed.
  - `protect_shop_media_identity` must keep treating everything except
    `moderation_status`, `sort_order`, `caption` and `updated_at` as immutable.
- **Persistence semantics:** order and captions are **draft state**. They change
  the public page only for images that are already `approved`; changing the order
  never publishes a private image.
- **Migration dependency:** one additive migration; affects
  `src/features/admin/media-contract.ts` (already tolerant, see below) and
  `src/components/shops/ShopMediaGallery.tsx` (frontend will follow up).
- **Integration acceptance:** reorder persists across reload; captions round-trip
  including Unicode and are escaped in public HTML; arrange with a stale revision
  conflicts; arrange never changes any `moderation_status`; a partial `order`
  list is rejected rather than silently dropping images.

### C — Capability advertisement

- **User action:** none directly. This keeps the interface honest while A and B
  are outstanding.
- **Required change:** the admin media `list` response becomes
  `{entries:[…], capabilities:["remove","arrange"]}` once each action exists.
- **Frontend behaviour today:** `capabilities` is absent → the removal and
  reorder controls are **not rendered**, and the Photos section says permanent
  deletion is not available yet and offers **Remove from the public page**
  (`hide`), which does work today. When the field appears, the controls appear
  with no further frontend change. Nothing is mocked.
- **This capability is about the deployment, not the actor.** Showing, hiding
  and deleting an image are admin-only in `handleShopMedia`, while `list` needs
  only `editor`, so an editor could otherwise see three buttons that all return
  403. The interface reads the signed-in role from `GET /api/v1/admin/access`
  and hides those actions for an editor, with a line saying an admin has to
  review the upload. Both gates together are what makes every image
  control in that section one that can succeed; neither is sufficient alone.
  Stamp activation is not gated this way — its button names the admin
  requirement in its label instead.

### D — Bounded locality and shop-type vocabulary

- **User action:** publish a shop in a city or of a type that is not yet in the
  catalogue, without a database operator.
- **Existing endpoint:** `POST /api/v1/admin/shops/options`,
  `{kind:'brands'|'specialties', label}` → `{id, options}`; RPC
  `public.admin_catalogue_choice(p_kind,p_label)`.
  `public.shop_publication_errors` requires `locality_id` and one primary type.
- **Required change:** accept `kind:'localities'` with
  `{countryCode, label}` (and optional `adminAreaCode`), and `kind:'types'` with
  `{label}`. Reuse an existing row case-insensitively within the same country
  rather than creating a near-duplicate; return the reused id. Preserve the
  country↔locality relationship and never fuzzy-merge distinct localities.
- **Persistence semantics:** creating a vocabulary row is a catalogue write and
  is audited; the shop's *selection* of it stays in the private working copy
  until the shop is saved, exactly like brands today.
- **Migration dependency:** `admin_catalogue_choice` plus whatever uniqueness
  constraint localities need. This is the B3 "bounded locality/brand creation"
  item already in `IMPLEMENTATION-PLAN.md`.
- **Integration acceptance:** creating a locality twice returns the same id;
  creating the same label under two countries yields two rows; a non-admin is
  refused; the new locality is immediately selectable and publishable; existing
  locality IDs and country relationships are unchanged.

### E — Confirmed as needing no backend change

- **Timezone** (feedback 4): `shops.timezone` already stores an IANA identifier
  and `public.validate_iana_timezone()` already validates it. The searchable
  picker is frontend-only. Existing valid values are preserved untouched.
- **Photo visibility** (feedback 1): `publish`/`hide` already exist. The missing
  piece is that the Review step never mentioned them; that is frontend.
- **Stamp activation** (`ensure_default`, `create`, `attach`, `activate`) is
  unchanged. Saving shop details must continue never to activate artwork; the
  rebuilt editor keeps catalogue save and stamp activation as separate calls.

## Decoder tolerance already in place

`decodeShopMedia` will accept and pass through optional `sortOrder`, `caption`
and a top-level `capabilities` array, and ignores them when absent. The shared
shape stays valid for both the current and the extended response, so request A,
B and C can land without a coordinated frontend release. This is the only change
this session makes to `media-contract.ts`; no validation is relaxed.

## What stays out of scope here

- The mandatory ~200-shop CSV/JSON onboarding workflow (Package C) is **not**
  started and is **not** replaced by manual forms. The seven-section editor reuses
  the same normalization contract so Package C can merge patches into a reviewed
  private revision.
- Deferrals #68 (animation), #70 (recollection), #71 (commissioning),
  #72 (photo paperwork) stay deferred. No mandatory photo paperwork,
  source/claim tokens or commissioned-art requirement is reintroduced.
- Package A acceptance gaps, M5–M8 obligations and the WP-D desktop feedback
  remain open and are unaffected by this work.
