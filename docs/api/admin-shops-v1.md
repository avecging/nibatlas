# Admin shop operations v1

All reads and mutations use verified cookie identity and the live database
`editor`/`admin` role. Audit reads retain their existing admin-only boundary.
No service-role credential, email allowlist or JWT metadata authorizes access.
Private data is never embedded in the HTML shell or persisted in browser storage.
`admin` includes every catalogue operation; `editor` is delegated catalogue
access. Founder is a responsibility fulfilled by an admin, not another stored
role or membership. Identity, role and shop calls use one request-scoped Supabase
client so token refresh cannot split the guard from the operation. Each database
RPC still checks the live role independently; publication rules are unchanged.

| Route | Method | Body / query | Result |
| --- | --- | --- | --- |
| `/api/v1/admin/shops` | GET | Optional `q` (≤120 chars), UUID `after` | ≤50 summaries and nullable nextCursor |
| `/api/v1/admin/shops/options` | GET | None | Existing localities/types/services/specialties/brands |
| `/api/v1/admin/shops/[id]` | GET | None | Private saved document, revision, publicationStatus, hasChanges, publicationErrors |
| `/api/v1/admin/shops` | POST | action=create, new UUID id, document={name,slug} | Created private draft plus generated default in one transaction, 201 |
| `/api/v1/admin/shops/[id]` | POST | action=save, revision, full document | Saved private working copy |
| `/api/v1/admin/shops/[id]` | POST | action=publish/discard/archive/open/unknown/temporarily_closed/permanently_closed, revision | Updated record |

POST requires same-origin `Origin`, JSON content type and at most 131,072 body
bytes. Unexpected fields, queries and actions are rejected; no delete or restore
verb exists. Contract fields and controlled form metadata are in
`src/features/admin/shop-contract.ts`. SQL revalidates direct RPC requests.

401 means missing identity. 403 covers denied role/origin or a database permission
error; use the safe diagnostic stage to distinguish them. 400 means malformed request, 404 missing shop,
409 stale revision or duplicate identity, 422 invalid data/reference/transition
or publication requirements, and 503 unavailable service. Raw provider errors
are never forwarded. A publication-incomplete response includes a bounded list
of actionable requirements. All responses are private/no-store; preview has no
public token or bypass. Role revocation is checked even after the HTTP guard.

Revisions are opaque. Pass the revision returned with the exact version edited.
After a lost mutation response, reload before deciding whether to retry. A
successful create whose response was lost will appear in the shop list; reusing
its UUID/slug produces a conflict, not a second record.

Save never changes public canonical fields. Publish applies the complete saved
revision atomically, preserving related source IDs and historical collections.
The SQL helper projection is not granted to any API role. The existing public
read RPCs continue to select published canonical tables only. See ADR 0012 and
the shop administration runbook for publication prerequisites and lifecycle rules.

## Request diagnostics

Responses include `X-Admin-Request-Id`; a failed request also includes
`X-Admin-Failure-Stage` (`identity`, `access`, `origin`, `validation`,
`catalogue_rpc`, or `response`). The browser console and server logs use the same
reference. These diagnostics contain no tokens, cookies, account identifiers,
request documents or provider messages. Server logs may include a SQLSTATE and
boolean origin comparisons. `X-Admin-Database-Reason`, when present, classifies
a permission failure as role denial, a table/function/schema privilege, row
security, or another permission error; it never includes provider error text. The audit transaction retains its own existing
request ID and authenticated actor attribution.

`X-Nib-Atlas-Release` and the page's `nibatlas-release` HTML metadata identify the
build commit. GitHub builds embed `GITHUB_SHA`; local builds say `development`.
This lets an investigation distinguish a stale page from the deployed route.

## Package B1 default initialization

Successful creation also calls the private `ensure_shop_generated_default` SQL
helper under the same current-role/shop locks and transaction. One approved
system-template version on one active stamp identity is prepared without media
manifests. This does not publish the shop or assert location/review/source facts.
Failure rolls back the entire create; reusing the create UUID still returns 409.
After a lost response, inspect the existing draft before retrying. Existing
working copies, publication gates and public projections are unchanged in B1;
trusted-admin publication is the next B2 contract slice, not already delivered.

Future import creation must reuse this initializer, with batch/row operation
idempotency outside it. It never replaces an existing stamp identity (including
retired or unfinished custom work), and consumes no upload quota. The helper
is not granted to any API role. See the media contract for explicit preparation
of older drafts and the plan for the mandatory 200-row import workflow.
