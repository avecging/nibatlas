# About page editor

Founder-approved scope, 2 October 2026; issue #17. This is exclusively `/about`.

## Founder workflow

Open **About page** from the existing shop administration landing page, or go to
`/admin/about`. Only the current `admin` role may load, edit or publish content.
Delegated catalogue editors do not gain access. Team/thanks entries are content,
not accounts or permission assignments.

One editor contains title, introduction, rich-text body, Our team, With thanks
and Support. Body formatting is limited to paragraphs, two heading levels, bold,
bulleted/numbered lists, line breaks and links. The locally bundled Tiptap editor
has no cloud service, arbitrary HTML, images, tables, embeds or layout controls.

- **Save draft** saves privately. An incomplete entry may be saved for later.
- **Preview** displays current unsaved edits with the public renderer. Nothing is
  saved or published by preview; use Back to editing to continue.
- **Publish** publishes the exact saved revision, with no approval/confirmation
  stage. Unsaved changes must be saved first. A nonblank title, complete listed
  people, headings for populated groups, and complete enabled support are needed.
- Entries can be added, edited, removed, moved up/down within their group and
  moved to the end of the other group. Empty groups are hidden publicly.
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
warns about unsaved browser navigation; there is no extra publication gate.

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

## Content limits

Stored body is a restricted JSON tree, rendered with escaped React text and
explicit elements, never `dangerouslySetInnerHTML`. No user-controlled styles,
event handlers or element names are rendered. Direct RPC writers undergo SQL
validation too; unsafe/malformed links cannot poison a public/admin read.

- Title 160 characters; introduction 2,000; group/support headings 120.
- Up to 100 people total; name 120, description 500, external URL 2,000.
- Support description 600, button label 80, external URL 2,000.
- Body up to 60,000 text characters, 2,000 nodes and eight nesting levels.
- Document up to 100,000 UTF-8 bytes; SQL's canonical JSON spacing can make its
  bound slightly stricter near that maximum. Character limits count code points.
- Body links allow root-relative paths or HTTP(S). People/support require HTTP(S).
  Links use ASCII/punycode domain names or IPv4 and valid decimal ports; credentials,
  protocol-relative URLs, backslashes, whitespace and active schemes are rejected.

## Verification and release boundary

Unit/HTTP tests cover formatting, escaped text, link validation, admin-only access,
revocation, provider-error redaction, stale revisions and published-only reads.
`supabase/tests/036_about_page.sql` covers direct RPC roles/grants, draft privacy,
preservation, atomic audit, idempotence and invalid content recovery boundaries.
Browser journeys exercise the actual editor, links/bold, group moves/order,
preview, save/reopen/publish, conflict retention and loading locks on phone/desktop.

Apply migration `20261002042843_about_page_editor.sql` before deploying this reader
only after founder approval. No hosted reset, catalogue import, role change,
migration, merge or deployment is authorized by implementation or tests. Workers
Free and all shop/seal contracts remain unchanged. Issue #17 implementation does
not claim final founder copy, staging acceptance or launch readiness.
