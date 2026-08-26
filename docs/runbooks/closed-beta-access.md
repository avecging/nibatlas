# Closed Beta Access Runbook

**Status:** Planned; execute immediately before closed beta  
**Target:** Nib Atlas staging/beta deployment  
**Owner:** Codex for configuration/code handoff; founder owns tester allowlist  
**Last updated:** 26 August 2026

## Decision

Closed beta must not be publicly reachable. Protect the beta Worker with Cloudflare Access using:

- one-time PIN email authentication;
- an exact allowlist of tester email addresses;
- short, intentional session duration;
- a separate Access service token for automated smoke tests.

Do not use a shared password. Individual email access is revocable, produces clearer audit trails, and avoids one leaked password opening the beta to everyone.

Do not implement this during Milestone 1 prototype work. Activate it when a stable closed-beta deployment exists.

## Architecture

Preferred topology:

- public production Worker: `nibatlas-production` when launch-ready;
- gated beta/staging Worker: `nibatlas-staging`;
- human beta hostname: `beta.<domain>`;
- Cloudflare Access protects the entire beta Worker, including alternate Worker routes and preview/Workers.dev access where supported;
- CI smoke checks authenticate with a service token.

Protecting only the custom hostname while leaving a Workers.dev URL reachable creates a bypass. Before inviting testers, verify every route that can reach the beta build.

If whole-Worker protection is not available for the chosen deployment topology, disable unneeded public routes or protect each reachable hostname explicitly before invitations go out.

## Prerequisites

- Domain/zone active in the same Cloudflare account.
- `nibatlas-staging` deploys successfully.
- Cloudflare Zero Trust organization initialized.
- Founder has the final tester email list.
- GitHub staging Environment exists and can hold secrets.
- A rollback owner and an ungated technical recovery path through Cloudflare dashboard access are known.

## Implementation sequence

### 1. Establish the beta hostname

1. Add `beta.<domain>` as the custom domain for the beta Worker.
2. Confirm TLS is active.
3. Confirm the hostname serves only the beta Worker.
4. Inventory every alternate route: Workers.dev, preview URLs, route patterns, and additional custom domains.

Reference: [Cloudflare Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

### 2. Enable one-time PIN login

1. Open Cloudflare Zero Trust.
2. Enable **One-time PIN** as an authentication method.
3. Keep the login page limited to the methods intended for testers.
4. Test receipt of a code with a founder-controlled email before adding the application.

One-time PIN codes are single-use. Authentication method alone is not authorization; the Access policy must still restrict email identities.

Reference: [Cloudflare Access one-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/).

### 3. Create the Access application

Prefer Worker-level protection when supported for the beta Worker. Otherwise create a self-hosted application covering the beta hostname and eliminate alternate public routes.

1. Create/select the Access application for Nib Atlas beta.
2. Set the protected resource to the entire `nibatlas-staging` Worker or exact beta hostname.
3. Set an intentionally short session duration for closed beta; start with 24 hours and adjust only after tester feedback.
4. Add an **Allow** policy whose Include rule is the exact set of tester emails.
5. Keep founder/recovery administrators on an explicit allow rule.
6. Do not use **Include: Everyone**.
7. Do not treat **Login method: One-time PIN** as sufficient authorization; that would allow any user who can authenticate by OTP unless another rule restricts identity.

References: [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) and [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/).

### 4. Preserve automated smoke tests

Access will block the existing unauthenticated Playwright staging smoke test. Before enabling the gate:

1. Create a Cloudflare Access service token dedicated to GitHub staging smoke tests.
2. Add a Service Auth policy permitting that token for the beta application.
3. Store its client ID and secret in the GitHub `staging` Environment, for example:
   - `CF_ACCESS_CLIENT_ID`
   - `CF_ACCESS_CLIENT_SECRET`
4. Update the smoke-test job to send:
   - `CF-Access-Client-Id`
   - `CF-Access-Client-Secret`
5. Mask values and never print headers or secrets in logs.
6. Rotate the token after the beta or immediately on suspected exposure.
7. Keep production unable to consume staging credentials.

Codex should prepare and review this workflow change in a separate infrastructure PR. It is not part of Claude Code's Milestone 1 frontend PR.

### 5. Verify before invitations

Test in a private/incognito browser and from a second device:

- allowlisted tester receives OTP and can enter;
- non-allowlisted email cannot enter;
- expired/incorrect OTP fails;
- removing an email prevents the next session;
- direct beta hostname is gated;
- Workers.dev URL is gated or disabled;
- preview URL is gated or disabled;
- direct deep links return to the intended page after login;
- installed PWA behavior is acceptable;
- CI smoke passes with the service token;
- CI smoke fails without the service token;
- production remains unaffected.

Record test date, browser/device, Access application name, protected hostnames, policy names, and responsible owner.

## Tester operations

- Keep the allowlist as the source of truth; do not share access between people.
- Add or remove one tester at a time.
- Tell testers that access uses an emailed one-time code and that beta data may be reset.
- Provide a private feedback channel and a short privacy notice before collecting location-related feedback.
- Review Access logs only for security and troubleshooting, with limited retention and access.
- Remove all tester access at beta end unless the next phase explicitly continues it.

## Rollback and recovery

If legitimate testers are locked out:

1. verify application and policy order;
2. verify the email is exact and the OTP method is active;
3. use the founder/admin allow rule for recovery;
4. temporarily disable the affected policy only if a Cloudflare account administrator is actively supervising;
5. never make the beta public as a convenience workaround.

If the gate is accidentally bypassable, stop beta invitations and remove the exposed route or extend Access protection before continuing.

## Exit criteria

Closed-beta access is ready when:

- all human entry points require Access;
- only exact approved emails succeed;
- CI passes only with its service token;
- no shared password exists;
- production is unchanged;
- the founder can add/remove a tester without a code deployment;
- rollback and ownership are documented.
