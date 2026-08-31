# Runbook — contribution intake

How a shop suggestion or a listing correction gets from a Nib Atlas form into a
spreadsheet a person reviews. Written for the founder; every step here is done
once, by hand, outside this repository.

**Shape of it:** the browser posts to `POST /api/contribute` on the Nib Atlas
Worker, the Worker verifies a Turnstile token and forwards to a Google Apps
Script Web App, and the script appends a row to the intake spreadsheet.

The browser never sees the script URL or the shared secret. That is the whole
reason the Worker is in the middle: an Apps Script Web App set to *Anyone* is a
public, unauthenticated write endpoint, and a page that posted to it directly
would publish both the address and the key to anyone who opened DevTools.

This is not the application database. Nothing here writes to Supabase, defines a
schema, or commits the project to a data model. When the real contribution
pipeline arrives in a later milestone, the spreadsheet becomes an import source.

## 1. The spreadsheet

Create one spreadsheet, owned by the account that should hold the data. Name it
something durable — it is referenced by the script binding, not by title, but
people will look for it.

Two tabs, `suggestions` and `corrections`. **You do not have to create them by
hand:** `scripts/apps-script/contribute.gs` creates either tab with its correct
header row on first use, and refuses to write to a tab whose headers disagree
with what it expects. Creating them manually is fine as long as the columns match
exactly, left to right:

**`suggestions`**

`timestamp` · `shop_name` · `local_name` · `city` · `country` ·
`address_or_map_link` · `website_or_social` · `why_worth_visiting` ·
`contributor_name` · `contributor_email` · `status` · `admin_notes`

**`corrections`**

`timestamp` · `shop_slug` · `shop_name` · `correction_type` · `what_is_wrong` ·
`source_or_link` · `contributor_name` · `contributor_email` · `status` ·
`admin_notes`

`status` and `admin_notes` belong to the reviewing team. The script always writes
them empty and never touches them again.

**Make `status` a dropdown.** Select the column, Data → Data validation, list of
items: `new`, `researching`, `applied`, `rejected`, `duplicate`. That single step
turns the sheet into a review queue, which is the reason this approach was chosen
over building one.

## 2. The Apps Script

From inside the spreadsheet: Extensions → Apps Script. Replace the contents of
`Code.gs` with `scripts/apps-script/contribute.gs` from this repository.

**That file is the source of truth.** If the script needs to change, change it
here, review it, and paste it across — not the other way round. A fix made only
in the Apps Script editor is a fix nobody can review and nobody will find again.

Then, in the same project:

1. **Project Settings → Script Properties → Add script property.** Name
   `CONTRIBUTE_SHARED_SECRET`, value a long random string you generate yourself:

   ```
   openssl rand -hex 32
   ```

   Keep that value. It goes into Cloudflare in step 4 and nowhere else. It is
   what stops someone who discovers the deployment URL from writing to the sheet.

2. **Deploy → New deployment → Web app.**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**

   *Anyone* is required — the Worker calls it without a Google identity. The
   shared secret is what makes that safe, so do not skip step 1.

3. Copy the deployment URL. It ends in `/exec`.

**Redeploying:** use Deploy → **Manage deployments** → edit the existing
deployment → *Version: New version*. Creating a *New deployment* instead mints a
new URL and silently orphans the one Cloudflare is holding.

## 3. Turnstile

Cloudflare dashboard → Turnstile → Add site. Add the staging and production
hostnames. You get two keys:

- **Site key** — public. It ships in the page. Add it as a repository variable
  named `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (GitHub → Settings → Secrets and
  variables → Actions → Variables) so builds pick it up, and put it in your local
  `.env` from `.env.example`.
- **Secret key** — never leaves Cloudflare. It goes in step 4.

## 4. Worker secrets

Three, for each environment. Run these yourself; none of these values needs to be
shared with anyone working on the frontend.

```
pnpm exec wrangler secret put CONTRIBUTE_SCRIPT_URL
pnpm exec wrangler secret put CONTRIBUTE_SHARED_SECRET
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY

pnpm exec wrangler secret put CONTRIBUTE_SCRIPT_URL --env production
pnpm exec wrangler secret put CONTRIBUTE_SHARED_SECRET --env production
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env production
```

`CONTRIBUTE_SHARED_SECRET` must be byte-identical to the Script Property from
step 2. `CONTRIBUTE_SCRIPT_URL` is the `/exec` URL.

**Never prefix any of these with `NEXT_PUBLIC_`.** That prefix is what puts a
value into the browser bundle, and `.env.example` keeps the browser-safe and
server-only groups separated for exactly this reason.

## 5. Notification

Optional, and either of:

- **From the sheet:** Tools → Notification settings → *Notify me when: any
  changes are made* / *Daily digest*. No code, and it survives everything.
- **From the script:** add a `MailApp.sendEmail` call after the append. Costs a
  daily quota and a deployment each time it changes.

The sheet's own notification is the recommended one.

## Verifying it works

From a machine that can reach the deployment, with the secret to hand:

```
curl -sS -L -X POST "$CONTRIBUTE_SCRIPT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"secret":"…","type":"correction","fields":{
        "shop_slug":"runbook-check","shop_name":"Runbook check",
        "correction_type":"other","what_is_wrong":"Verifying intake."}}'
```

`-L` matters: Apps Script answers a Web App POST with a redirect to
`script.googleusercontent.com`, and a client that does not follow it sees an
empty response and reads it as a failure. The Worker route follows redirects for
the same reason.

Expect `{"ok":true,"row":2,"status":200}` and a row in `corrections`. Delete the
row afterwards.

A wrong or missing secret returns `{"ok":false,"error":"forbidden"}` and writes
nothing — worth confirming once, because it is the control that matters most.

## If the script is unavailable

The form never reports a success it did not get. On any failure it keeps what the
person typed in the fields, says plainly that the submission could not be sent,
and offers the pre-addressed email as a route that has no dependency to fail.

Submissions are not queued or retried. A contribution that fails to send has not
been received, and the interface says so.

## What is stored, and where

Both flows collect a name and an email address **only if the person offers them**,
and the form asks for a name whenever an email is given so a reply can be
addressed to someone. Everything else is about a shop, not a person.

The data lives in Google Sheets, under the Google account that owns the
spreadsheet — which makes that account's owner the party responsible for it. The
privacy policy names Google as the recipient and states the retention period. If
that account changes, the privacy policy has to change with it.
