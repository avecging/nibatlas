# Authentication: local and staging setup

Milestone 4 uses Supabase Auth with two entry points:

- passwordless email **magic links**;
- Google OAuth, and no other social provider.

Application code uses the publishable project pair and cookie-backed RLS
sessions. Google client secrets and SMTP2GO credentials belong in their provider
dashboards, not in this repository, Cloudflare build variables, logs, URLs, or
browser code. Production setup is explicitly out of scope.

## Application routes

| Purpose | Route |
| --- | --- |
| Request a magic link | `POST /api/v1/auth/magic-link` |
| Begin Google OAuth | `POST /api/v1/auth/google`; navigate the top-level window to its validated JSON `redirectTo` |
| Exchange a Google PKCE code | `GET /auth/callback` |
| Verify a magic-link token hash | `GET /auth/confirm` |
| Read the verified application session | `GET /api/v1/auth/session` |
| End this device's session | `POST /api/v1/auth/sign-out` |

All responses are private and non-cacheable. Mutating application routes require
a same-origin `Origin` header. Callback parameters, tokens, provider errors, and
credentials must not be logged.

## Local development

1. Start the local Supabase stack and reset the database.
2. Copy the local API URL and publishable key into
   `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Run the Next.js application at `http://127.0.0.1:3000`. Use this hostname
   consistently; `localhost` and `127.0.0.1` are different cookie origins.
4. Magic-link mail is captured by the local Supabase mail viewer. The template
   at `supabase/templates/magic-link.html` sends the token hash to the
   server-side confirmation route.

Google is optional locally. If it is enabled, create a development Web OAuth
client, use the local Supabase provider callback shown by the Supabase CLI, and
place its secret only in an ignored local environment file referenced by
`supabase/config.toml`. Never reuse the staging Google secret locally.

## Hosted staging checklist

These are dashboard actions for the existing **nibatlas-staging** project. They
are deliberately deferred to WP6 so WP2 cannot alter hosted infrastructure.

### URL configuration

- Set Site URL to `https://nibatlas-staging.avecgin.workers.dev`.
- Add these exact allowed redirects:
  - `https://nibatlas-staging.avecgin.workers.dev`
  - `https://nibatlas-staging.avecgin.workers.dev/auth/callback`
- Do not add a wildcard workers.dev redirect.

The first URL is passed to magic-link delivery; the email template appends
`/auth/confirm`. The second is the Google PKCE callback.

### Magic-link email and SMTP2GO

In Supabase Authentication email templates, set the Magic Link template to the
same token-hash shape as the repository template:

```html
<a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
  Sign in to Nib Atlas
</a>
```

Configure custom SMTP with the SMTP2GO host, port, username, and password stored
in the Supabase project. Use:

- sender name: `Nib Atlas`;
- sender address: `login@nibatlas.com`;
- reply-to: leave unset, or `login@nibatlas.com` if the dashboard requires one.

`login@nibatlas.com` supersedes the `hello@nibatlas.com` this runbook first
named, by founder decision on #37. Sign-in mail is send-only, and the two
reasons are the reader's and support's: the address a link arrives from should
say plainly that it is a login message, and support's own mailbox should not
fill up with replies to one. So **do not** set reply-to to `hello@nibatlas.com`
— that is the mailbox this decision exists to keep clear. Treat `login@` as
unmonitored: nobody reads what arrives there.

Until WP6 has configured and verified that sender, the interface deliberately
says only to look for a Nib Atlas sign-in message. Do not name `login@` in the
sent state before hosted delivery proves that it is the address recipients
actually see.

Confirm that the sender domain passes SMTP2GO's SPF/DKIM checks before testing
delivery. Keep Supabase's magic
link request cooldown and one-hour expiry unless staging evidence demonstrates
a reason to change them.

### Google OAuth

1. Create a Google Auth Platform **Web application** client for staging.
2. Add the Nib Atlas staging origin as an authorized JavaScript origin.
3. Add the exact Supabase Google-provider callback URL shown by the
   nibatlas-staging dashboard as an authorized redirect URI. This is a Supabase
   URL, not the application `/auth/callback` route.
4. Configure only the `openid`, email, and profile scopes.
5. Store the client ID and secret in the Supabase Google provider page and
   enable only Google.

Supabase automatically links a verified Google identity to an existing Auth user
with the same email. Because `profiles.id` follows `auth.users.id`, the linked
identity keeps one Nib Atlas profile instead of creating a duplicate.

## Continuation contract

The initiating request may supply only an allowlisted same-origin `returnTo`
and one validated pending intent:

- `save-shop` with a canonical shop UUID;
- `collect-shop` with a canonical shop slug.

The flow is held in a short-lived, HttpOnly, SameSite=Lax cookie. A successful
callback converts only the intent into a ten-minute pending cookie and clears the
flow cookie. Failed and expired callbacks clear both. WP5 will consume a
deferred Save once; Collect returns to its shop preflight and does not request
location during the callback.

## Rollback

Disable Google and custom SMTP in **nibatlas-staging**, remove its callback
allowlist entries, and revert the application deployment. No database rollback
is required for WP2. Do not delete Auth users or the WP1 profile/saved tables.
