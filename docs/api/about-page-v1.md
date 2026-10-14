# About page editor

Founder-approved scope and follow-up, 2 October 2026; issue #17. This is exclusively `/about`.

## Founder workflow

Open **About page** from the existing shop administration landing page, or go to
`/admin/about`. Only the current `admin` role may load, edit or publish content.
Delegated catalogue editors do not gain access. Team/thanks entries are content,
not accounts or permission assignments.

One editor contains title, introduction, rich-text body, Our team, With thanks
and Support. Body formatting is limited to paragraphs, two heading levels, bold,
bulleted/numbered lists, line breaks and links. The locally bundled Tiptap editor
has no cloud service, arbitrary HTML, tables, embeds or layout controls. Body images
are uploaded through the existing PNG/JPEG processing and private R2 storage.

- **Save draft** saves privately. An incomplete entry may be saved for later.
- Validation feedback names the person/field, gives a practical correction, and
  focuses/highlights the relevant input. Technical storage paths stay out of messages.
- **Preview** displays current unsaved edits with the public renderer. Nothing is
  saved or published by preview; use Back to editing to continue.
- **Publish** publishes the exact saved revision, with no approval/confirmation
  stage. Unsaved changes must be saved first. A nonblank title, complete listed
  people, headings for populated groups, and complete enabled support are needed.
- Entries can be added, edited, removed, moved up/down within their group and
  moved to the end of the other group. Empty groups are hidden publicly.
- Team/thanks display in an unboxed three-column desktop grid, two columns on
  tablets, one on phones. Larger serif names occupy at most two visual lines
  (full name stays accessible and available on hover). Optional Website, LinkedIn
  and Instagram icons sit left-aligned below the name, above the contribution, in
  that order. Missing links leave no icon; entries without links omit the icon row.
  Website accepts HTTP(S); social fields require full URLs on the matching platform.
- **Image** in the body toolbar opens upload/alt-text/caption controls. Insert adds
  the image after the current paragraph or list. Select an existing image and
  click **Image** to edit its text, replace its file, or remove it. Body editing
  pauses while this panel is open to keep the selected target stable. No portraits.
- PNG/JPEG source files are limited to 5 MiB. PNGs use existing browser resizing
  to 1,024 px; JPEGs use the existing hosted image processor and its dimension,
  orientation and metadata controls. Stored output is validated PNG. No originals
  or EXIF/GPS metadata are delivered publicly. The existing PHOTO_IMAGES binding
  is required for JPEG, as for shop images; no new service/plan is added.
- Support starts hidden. “Support Nib Atlas” is suggested heading/button text;
  description and destination are blank. Agree wording and destination with the
  founder before enabling it. No funding, charitable or affiliation claims are
  supplied. The button is an external link only.
- An older tab cannot overwrite/publish a newer draft. Its edits remain on screen;
  copy anything needed, then use **Load latest saved content (replaces edits)**.
  That explicit reload disables editing while it is pending. Failed/uncertain
  writes preserve current edits; inspect saved state before retrying.

The previously published content stays public during draft editing and failed
publication. There is one shared admin draft, not per-user working copies or a
revision-history interface. Refresh/sign-out clears unsaved browser state; no
private content is stored in localStorage. The existing before-unload convention
warns about unsaved document navigation. Site-link clicks also guard dirty edits,
and the dashboard enters About through native navigation for a document boundary.
There is no extra publication gate.

## HTTP and persistence

`GET /api/v1/admin/about` returns `{revision, publishedRevision, publishedAt,
draft}`. With no saved row it returns the existing corrected About copy as an
initial draft. `POST` accepts `{action:"save",revision,document}` or
`{action:"publish",revision}`. First save uses `revision:null`; other writes carry
the last observed revision UUID. Draft responses are private/no-store and noindex.
Unknown keys/parameters, wrong methods, cross-origin mutations and bodies over
128 KiB are rejected. Fields and responses are validated and allowlisted.

`public.about_page` holds exactly one possible row, a private structured draft
and the last published snapshot. No row or content is seeded by the migration.
RLS is enabled/forced, with no direct table grants to anon/authenticated/service
roles. `admin_about_page` is executable only by authenticated callers and checks
and locks the current profile's **admin** role inside its transaction. An advisory
lock serializes even competing first saves. Saves change revision only on content
changes; publication copies the saved draft atomically and is idempotent for the
same revision. Both writes use the existing append-only fingerprint audit, with
`about_page` added to its allowed entity types. Text/URLs are not copied to audit.

`read_published_about()` is a public, parameterless projection of **published**
content only. It excludes hidden support wording/destination. It cannot select
private drafts or metadata. The server-rendered `/about` uses a publishable-key
read with no user cookies, no-store and an 8-second timeout. Its metadata title
comes from that same published content. The rich editor is confined to admin.

A null published result retains the corrected original page: prototype-derived
statistics are removed, the map is the coverage reference, and outdated location
wording is corrected. Subsequent edits require Publish. A configured database
failure shows an unavailable/retry state, never resurrects older default content
or exposes the draft. Standalone unconfigured local previews use the baseline.

## Body image storage and privacy

`POST /api/v1/admin/about/images` accepts PNG or JPEG bytes, authorizes the current
admin before reading/processing, then privately reserves/stores/finalizes one image.
`GET /api/v1/admin/about/images/:id` is admin-only. Public
`GET /api/v1/about/images/:id` serves only ready images referenced by the current
published About body. Both paths recheck authority/publication after storage I/O
and use no-store. Removing or replacing an image in a draft keeps the old published
image accessible until Publish. Publication itself needs no separate image approval.

`about_images` has forced RLS and no browser/service direct table grants. Only the
server service role can call the reservation/finalization RPC, which rechecks and
locks the actor's current admin role. Browser RPC calls cannot attest image bytes.
Document save/publish validates each immutable image ID and exact stored dimensions.
Image reserve/finalize uses the existing fingerprint audit with an explicit actor.
Unreferenced uploads remain private and retained: 50 per actor/day, 500 total per
About environment. There is no media library or deletion/cleanup interface in MVP.

## Content limits

Stored body is a restricted JSON tree, rendered with escaped React text and
explicit elements, never `dangerouslySetInnerHTML`. No user-controlled styles,
event handlers or element names are rendered. Direct RPC writers undergo SQL
validation too; unsafe/malformed links cannot poison a public/admin read.

- Title 160 characters; introduction 2,000; group/support headings 120.
- Up to 100 people total; name 120, description 500, external URL 2,000.
- Support description 600, button label 80, external URL 2,000.
- Body up to 60,000 text characters, 2,000 nodes and eight nesting levels.
- Up to 20 body images; nonblank alt text up to 500 characters, optional caption 1,000.
- Document up to 100,000 UTF-8 bytes; SQL's canonical JSON spacing can make its
  bound slightly stricter near that maximum. Character limits count code points.
- Body links allow root-relative paths or HTTP(S). People/support require HTTP(S).
  Links use ASCII/punycode domain names or IPv4 and valid decimal ports; credentials,
  protocol-relative URLs, backslashes, whitespace and active schemes are rejected.

## Verification and release boundary

Unit/HTTP tests cover formatting, escaped text, link validation, admin-only access,
revocation, provider-error redaction, stale revisions and published-only reads.
`supabase/tests/036_about_page.sql` and `037_about_images.sql` cover direct RPC roles/grants, draft privacy,
preservation, atomic audit, idempotence and invalid content recovery boundaries.
Browser journeys exercise the actual editor, links/bold, group moves/order,
preview, save/reopen/publish, conflict retention, loading locks, image insertion from
lists/replacement/removal, social icons and grid layout on phone/tablet/desktop.

Apply migrations `20261002042843_about_page_editor.sql` and
`20261002071030_about_body_images_and_people_links.sql` before deploying their
corresponding readers, only after founder approval. The second is additive and
leaves existing saved/published About content unchanged. No hosted reset, catalogue import, role change,
migration, merge or deployment is authorized by implementation or tests. Workers
Free and all shop/seal contracts remain unchanged. Issue #17 implementation does
not claim final founder copy, staging acceptance or launch readiness.
