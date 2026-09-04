# Milestone 4 WP3 — authentication interruption, account states, accessibility

Screenshots of the sign-in interruption and of Me in every account state it now
has, at the three breakpoints `IMPLEMENTATION-PLAN.md` names.

Recorded 4 September 2026 against issue #34 WP3.

Regenerate with:

```sh
EVIDENCE=1 pnpm test:e2e --project=evidence \
  tests/evidence/m4-wp3-auth-interruption.spec.ts
```

Name the spec. The `evidence` project holds every work package's suite, so
running it unfiltered also rewrites the Milestone 1.5 captures — records of
reviews that already happened.

## What the captures are of

Prefixes are the breakpoints: `m` = 360 × 800, `t` = 768 × 1024,
`d` = 1440 × 900.

| Capture | State |
| --- | --- |
| `*-me-signed-out` | Me with a session that says signed out. The account is offered as a control, not as a promise about a later milestone. |
| `*-interruption` | The interruption over Me: two ways in, one line on what an account is for, and a named way out. |
| `*-link-sent` | What a reader is told once the link is on its way, including the sender and that nothing on the device is lost. |
| `*-interruption-error` | A refused address, reported on the field that caused it. |
| `*-google-unavailable` | A provider that could not be started. The reader stays where they were. |
| `*-login-route` | `/login`, carrying a pending Save intent, which is what an emailed link that failed or a shared address lands on. |
| `*-callback-success` | Coming back to the map with the sign-in completed: the result is announced and the selected shop is still selected. |
| `*-callback-expired` | Coming back with an expired link, on a shop page, with the way to try again. |
| `*-me-signed-in` | Me against a real session: identity, the rows that exist against it, sign out, and the Danger group. |
| `*-me-unconfigured` | Me in a build with no accounts behind it — what the current fixture and staging deployments actually are. |
| `*-me-session-unreachable` | Me when the session could not be read. A retry, not a claim about the reader. |

The overlay and banner captures are viewport screenshots rather than full-page
ones: both are fixed to the viewport, and a full-page screenshot of a fixed
element composites it above a tall image of the page behind it, which is not
what anyone sees.

## How the states were arranged

Every state comes from one HTTP response on a first-party route —
`GET /api/v1/auth/session`, `POST /api/v1/auth/magic-link`,
`POST /api/v1/auth/google` — fulfilled by Playwright. No Supabase client is
mocked, no token is invented, and no auth cookie is written: the interface only
ever knows what those routes tell it, which is exactly the seam WP2 built.

Two of the states need no arranging at all. `*-me-unconfigured` is what this
build does on its own, because no Supabase project is wired to it. And anonymous
discovery is unarranged everywhere: the map, saving a shop and the Saved mode are
the same as they were before this work.

The hosted proof — real magic-link delivery, real Google sign-in, session
refresh and logout against `nibatlas-staging` — is WP6.

## Accessibility

Audited with axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) in
`tests/e2e/accessibility.spec.ts`, asserted to be free of violations:

- `/login` as a route, added to the audited route list;
- Me in its signed-in form;
- the interruption in each state a reader can be left in — the two ways in, a
  refused address, and the confirmation that replaces the form;
- the callback's result banner over the map, which is the busiest surface it can
  land on.

One violation was found and fixed while doing this: the "or" between the two
sign-in routes was set in `--text-muted`, which measures 4.35:1 on the panel
surface at 14 px. It is `--text-secondary` now.

Beyond the audit, and asserted in `tests/e2e/auth-interruption.spec.ts`:

- the interruption is a modal dialog labelled by its own heading, takes focus,
  keeps Tab inside itself, closes on Escape and on **Not now**, and returns
  focus to the control that opened it;
- every live region is named — the sign-in result, the sign-in error, the
  sign-in link confirmation, the account status — because a page can carry
  several, the router's own announcer among them, and two unnamed ones cannot be
  told apart by anyone navigating by region;
- tone is never carried by colour alone: the result banner differs in icon shape
  and leading rule as well as hue, and the invalid field carries a message;
- every control clears the 44 px tap target through `--tap-target`.

## Responsive

The three breakpoints above, plus the 360 × 568 project for the short-screen
cases. The interruption is a single column at every size — an interruption has
one job, and a two-column sign-in at 1440 would read as a destination — and the
dialog scrolls inside itself rather than pushing the page when a failure message
lengthens it.

## Commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
EVIDENCE=1 pnpm test:e2e --project=evidence \
  tests/evidence/m4-wp3-auth-interruption.spec.ts
```

Visual baselines under `tests/visual/breakpoints.spec.ts-snapshots/` were not
regenerated, except for the three the new `sign-in` screen had none of — those
were captured in this container, so they differ in provenance from the rest.

The existing ones were left alone deliberately. They were captured in a
different container from this one and are already stale for screens this work
does not touch — `privacy` at 1440 differs by 600 px of height on an untouched
page — so refreshing the Me baselines here would have meant refreshing the
unrelated screens too, replacing evidence of reviews that already happened with
this container's rendering. The spec's own note covers what to do instead: a
different image needs one `VISUAL=1 pnpm test:e2e --update-snapshots` run before
that project passes there, and Me's two baselines are stale until it does.
