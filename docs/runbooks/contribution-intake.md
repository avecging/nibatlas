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

Cloudflare dashboard → **Turnstile** in the left sidebar → **Add widget**.

**Widget name.** Anything; it is only a label. `Nib Atlas contributions`.

**Hostnames.** The domains the widget may run on. A listed domain covers its
subdomains, and the widget refuses to render anywhere unlisted — which is the
step that usually goes wrong, because the staging Worker's hostname is not
obvious. Add:

- the production domain, once there is one;
- the staging Worker's hostname — the `*.workers.dev` address the deploy job
  prints, or the custom domain in front of it;
- `localhost`, if you want the widget locally. Not needed: with no site key the
  form renders without a widget, and outside production the route skips the
  check.

**Widget mode.** **Managed.** The form renders the widget explicitly and expects
a token from a `callback`, which Managed provides. Invisible would also return a
token, but Managed is the mode the copy and the layout were built against.

**Pre-clearance.** Leave off. It is for gating whole routes at the edge, which is
not what this does.

Create it, and Cloudflare shows two keys:

- **Site key** — public, and it ships in the page. It is read at **build time**,
  not at runtime, so it has to exist wherever the app is built:
  - GitHub → Settings → Secrets and variables → Actions → **Secrets** →
    `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. A repository *secret*, not a variable, to
    sit alongside `NEXT_PUBLIC_MAPTILER_KEY`, which is public in exactly the same
    way. The staging deploy fails fast if it is missing rather than shipping a
    form that cannot send.
  - Your local `.env`, copied from `.env.example`.
- **Secret key** — never leaves Cloudflare. It goes in step 4.

### Testing without creating a widget

Cloudflare publishes dummy keys that work on any domain, including `localhost`,
and let the whole path be verified before a real widget exists. Use them in pairs
— a production secret rejects a dummy token, and the reverse.

| Site key | Secret key | Result |
| --- | --- | --- |
| `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` | Always passes |
| `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` | Always fails |
| `3x00000000000000000000FF` | `1x0000000000000000000000000000000AA` | Forces the interactive challenge |

The always-fails pair is the one worth running once: it proves the route refuses
a submission whose challenge did not verify, which is the control that matters.

### If the widget does not appear

The site key is inlined into the client bundle at build time by matching the
literal expression `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`. It fails
silently when it is absent — no widget, and every production submission refused —
so check in this order:

1. **Was the key set when the app was built**, not just when it was started? The
   staging job fails fast if the secret is missing, and a later step asserts the
   value actually reached the bundle.
2. **Is the hostname listed on the widget?** An unlisted host renders nothing.
3. **Can the browser reach `challenges.cloudflare.com`?** Behind a restrictive
   network it cannot, and the form says the spam check could not load.

## 4. Worker secrets

Three, on `nibatlas-staging`. Run these yourself; none of these values needs to
be shared with anyone working on the frontend.

```
pnpm exec wrangler secret put CONTRIBUTE_SCRIPT_URL
pnpm exec wrangler secret put CONTRIBUTE_SHARED_SECRET
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

`CONTRIBUTE_SHARED_SECRET` must be byte-identical to the Script Property from
step 2. `CONTRIBUTE_SCRIPT_URL` is the `/exec` URL.

**Staging is the only Worker that exists.** `nibatlas-production` has not been
created, so there is nothing to configure with `--env production` and no
production run of this setup to do. See *Later, when production exists* at the
foot of this runbook.

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

Two checks, in order. The first needs nothing but the URL.

**Is it deployed?** A `GET` should come back as a refusal from the script itself:

```
curl -sS -L "$CONTRIBUTE_SCRIPT_URL"
```

Expect `{"ok":false,"error":"method_not_allowed","status":405}`. Anything else —
an HTML page, a login redirect — means the deployment or its access setting is
wrong, and nothing further will work.

**Does it accept a submission?** With the shared secret to hand:

```
curl -sS -L "$CONTRIBUTE_SCRIPT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"secret":"…","type":"correction","fields":{
        "shop_slug":"runbook-check","shop_name":"Runbook check",
        "correction_type":"other","what_is_wrong":"Verifying intake."}}'
```

**Do not add `-X POST`.** `-d` already makes it a POST, and `-X` *forces* the
method to be reused on the redirect — which is the one way to make a correctly
deployed script look broken. Apps Script answers a Web App POST with a `302` to
`script.googleusercontent.com`, which must then be fetched with `GET`; curl does
that switch by itself, and `-X POST` overrides it. Re-POSTing to that address
returns a Google Drive error page reading *"Sorry, unable to open the file at
this time"*, which looks like a permissions problem and is not one.

`-L` matters for the same reason: a client that does not follow the redirect sees
an empty response and reads it as a failure. The Worker route uses
`redirect: "follow"`, and the Fetch standard makes the same `POST` → `GET` switch
on a 302, so it is unaffected by the curl trap above.

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

## Later, when production exists

Nothing in this runbook creates or assumes a production Worker. When
`nibatlas-production` is actually created, this becomes a deployment step rather
than a setup step:

1. Add the production hostname to the Turnstile widget's hostname list. A widget
   renders on listed hosts only, so this has to happen before the first
   production build, not after it.
2. Decide whether production shares this spreadsheet and Apps Script deployment
   or gets its own. Sharing is simpler and keeps one review queue; separating
   keeps test submissions out of the real one. Either way the shared secret
   should differ between environments, so a leak from one does not write to the
   other.
3. Set the same three secrets with `--env production`, plus
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` wherever the production build runs — it is
   read at build time, so a runtime secret alone leaves the widget absent and
   every submission refused.
4. Confirm the production privacy copy still names the right Google account as
   the recipient, if the spreadsheet's owner changed.
