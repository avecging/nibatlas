# Milestone 1.5 WP2 — the restructured Me

Screenshots of every state Me now has, at the three breakpoints
`IMPLEMENTATION-PLAN.md` names.

Regenerate with:

```sh
EVIDENCE=1 pnpm test:e2e --project=evidence
```

The spec is `tests/evidence/wp2-me.spec.ts`. Device state — reviewer choice,
signed-in preview, collection — is seeded before the first script runs, so each
page resolves straight into the intended state rather than being toggled after
paint. Reduced motion is emulated so the captures are deterministic.

## Naming

`<breakpoint>-<state>.png`

- `m` — 360 × 800
- `t` — 768 × 1024
- `d` — 1440 × 900

## States

| Capture | What it shows |
| --- | --- |
| `signed-out-clean` | What a tester who has just been handed the link sees. Account offers sign-in rather than requiring it; **Places visited** is absent, because there is nothing yet to point at; **On this device** carries the local-storage fact once, next to the two controls that act on it; **Contribute** and **About** carry only entries that work |
| `signed-out-collection` | The same reader once stamps exist. **Places visited** appears: three counts from the stamps, then one row per country linking into `/passport/[country]`, locality chips linking into `/passport/[country]/[locality]`, and seal state stated separately from the visit |
| `clear-confirm` | **Clear data on this device** asks first. An inline panel, not a native dialog: it can be styled, screenshotted, and read in context. Focus opens on **Cancel** — the destructive button is one Tab away, so two presses of Enter cannot destroy a collection |
| `signed-in` | The signed-in structure — account identity, optional display name, **Privacy and your data**, **Sign out**, and the separated **Danger** group. Reachable only as a reviewer preview until Milestone 4 builds authentication, and labelled as one where it renders |
| `delete-confirm` | **Delete account** asks first, in `--error`, focus on **Cancel**, with the standing note that the preview has no account to delete |
| `passport-country` | Where **Places visited** leads. `/passport/jp` reached by clicking Japan in Me |

## After the founder's staging review

Regenerated 27 August 2026. Four things left the page and nothing was added:
the **Preferences and accessibility** section (nothing there to set, so it is
not a personal setting), the unrouted **Report incorrect information** and
**Help and contact** rows (a visible control that cannot be used is scaffolding
— WP7 owns both routes), and the phrases that narrated interaction mechanics.
**Help and about** is renamed **About** with the help row, since a group
offering no help is the same inaccuracy one level up.

Every control now on the page works, except one honest *Not available yet* on
**Sign in** — which describes an account that will exist rather than a control
that cannot be pressed. Compare against `docs/evidence/milestone-1-5-wp1/` to
see how far Me has come down.

## What the pairs are for

The two signed-out captures are the same reader before and after collecting
anything, so the difference is what a collection adds rather than a difference in
copy. `signed-in` is deliberately captured in reviewer mode with the seeded
collection, because that is the only way the state exists — a normal-mode device
ignores the preview key outright, which `tests/e2e/me.spec.ts` asserts.

## Scope

**The 768 × 1024 and 1440 × 900 captures are evidence of the restructure only.**
`docs/milestone-1-5-product-refinement.md` records the responsive desktop
treatment as *not designed and not approved*; WP-D owns that audit and it is
gated on founder desktop feedback. Nothing here is desktop sign-off.

WP1's paired reviewer-mode evidence remains in
`docs/evidence/milestone-1-5-wp1/`, and Milestone 1's in
`docs/evidence/milestone-1/`. Both are records of the review they were captured
for and are deliberately **not** regenerated here — the WP1 `me` and `clean-me`
captures show Me as WP1 left it, which is the point of keeping them. This
directory is the current one.
