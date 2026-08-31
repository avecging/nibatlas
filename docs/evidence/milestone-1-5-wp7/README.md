# Milestone 1.5 WP7 — contribution and help routes

Screenshots of the two contribution forms, the failure that offers the email
route, the confirmation, and the help page, at the three breakpoints
`IMPLEMENTATION-PLAN.md` names.

Recorded 31 August 2026, against the WP7 implementation record in
`docs/milestone-1-5-product-refinement.md`.

Regenerate with:

```sh
EVIDENCE=1 pnpm test:e2e --project=evidence tests/evidence/wp7-contribution-routes.spec.ts
```

Name the spec. The `evidence` project holds every work package's suite, so
running it unfiltered also rewrites WP1–WP6's captures — and those are records of
reviews that already happened.

The intake is a Google Apps Script behind a Cloudflare Worker secret, so the two
states that depend on it — the failure and the confirmation — are captured
against a stubbed `POST /api/contribute`. The stub decides only whether the
request succeeded; everything above it is the real page. Captures are full-page,
because a form is read by scrolling it.

The mobile navigation bar appears partway down the mobile captures. That is what
a full-page screenshot does with a fixed bottom bar, not a layout defect: in the
browser it stays at the foot of the viewport and the form scrolls under it.

## Naming

`<breakpoint>-<state>.png`, where the breakpoint is `m` (360 × 800), `t`
(768 × 1024) or `d` (1440 × 900).

| State | What it shows |
| --- | --- |
| `suggest-shop` | The suggestion form. What the catalogue does with a lead is stated before the fields, not after them, and *optional* is marked rather than *required* — six of the nine fields are optional, so asterisks would decorate the page and still leave the reader counting |
| `report-listing` | The correction form for TY Lee Pen Shop. The listing is the page's heading, not a field: the reader arrived from it, so nothing here asks which shop they mean |
| `submission-failed` | An intake that could not be reached. It says so, keeps every character that was typed, and offers the pre-addressed email — which has no service behind it to be unavailable |
| `submission-sent` | The confirmation, which replaces the form only after the route answered `ok` |
| `help` | The walkthrough and the questions. Coverage is not restated here: *Where does Nib Atlas cover* links to About, which derives its list from the catalogue |

The 768 × 1024 and 1440 × 900 captures show responsive integrity only.
`docs/milestone-1-5-product-refinement.md` records the desktop treatment as not
designed and not approved; WP-D owns that, and nothing here is sign-off.
