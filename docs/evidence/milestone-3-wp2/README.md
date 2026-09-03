# Milestone 3 WP2 — API-mode map, presentation states, accessibility

Screenshots and axe audits of the API-backed map and the presentation states WP2
adds, at the three breakpoints `IMPLEMENTATION-PLAN.md` names.

Recorded 3 September 2026 against issue #25 WP2.

Regenerate with:

```sh
NEXT_PUBLIC_CATALOGUE_MODE=api EVIDENCE=1 \
  pnpm test:e2e --project=evidence tests/evidence/wp2-catalogue-modes.spec.ts
```

Name the spec. The `evidence` project holds every work package's suite, so
running it unfiltered also rewrites the Milestone 1.5 captures — records of
reviews that already happened.

Two things about the run are deliberate:

- **The build is in API mode**, so every capture is of the API path. A
  fixture-mode build never calls `/api/v1/shops/*`, and the spec skips rather
  than capture fixture screens under an API-mode name.
- **The browser's catalogue reads are fulfilled by Playwright**, not by a staging
  database. The payloads are v1-shaped and pass the same runtime decoder the
  application uses, so the states are deterministic and no precise coordinate or
  credential is involved. The staging smoke against a real projection is WP3.

Each capture is paired with an axe audit (`wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa`) of the same state, asserted to be free of violations in the same
test — so the screenshot and the audit are always of the same render.

## Naming

`<breakpoint>-<order>-<state>.png`

- `m` — 360 × 800
- `t` — 768 × 1024
- `d` — 1440 × 900

| State | What it shows |
| --- | --- |
| `01-api-results` | API-backed results in the sheet and list, with the truncated-result notice the payload asks for |
| `02-api-search-groups` | The search panel: canonical catalogue shops and destination places as separately labelled groups, with the matched alias on the canonical hit |
| `03-api-failed-refresh` | A refresh that failed after results were already loaded, with **Retry** in the map overlay |
| `03b-api-failed-refresh-list` | The list side of the same state, where the sheet had hidden it: the previous results still usable, and the note saying which search they are from. Not captured at 1440 × 900, where the list is already beside the map |
| `04-detail-unavailable` | A shop page whose detail read failed: the URL still resolves, nothing about the shop is claimed, and it is not a 404 |
| `05-saved-scope` | The global Saved scope in API mode, saying plainly that listing every saved shop needs the account Milestone 4 introduces |

## What these are not

The 768 × 1024 and 1440 × 900 captures show responsive integrity only. The
desktop treatment remains not designed and not approved
(`docs/milestone-1-5-product-refinement.md`); nothing here is desktop sign-off.

`04-detail-unavailable` is the unavailable-detail state, not a rendered API
record. That API mode withholds the simulated stamp collection is asserted
directly in `src/components/shops/ShopActions.test.tsx`; it cannot be
photographed here, because the page carrying that control is the one that could
not be read. The shop page renders on the server, which reads the catalogue directly,
so a browser-fulfilled route cannot serve it — a rendered API-backed shop page is
part of the WP3 staging proof.
