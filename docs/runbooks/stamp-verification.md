# Stamp verification deployment and operations

The backend and account presentation are connected. The 4 October beta follow-up
requires forward migration `20261004063050_tighter_shop_check_in.sql` together with
the application update. It tightens the default to 45 m; existing explicit shop
policies and historical collections remain intact. A fixture ceremony is still
not evidence of live issuance; use the account contract and phone-test runbook.

## Staging activation

1. Run the existing **Deploy staging** workflow from the merged main commit.
   It applies migration `20260912000200_m5_verification_service.sql`; local/CI
   reset also applies it. Do not reset the remote staging database.
2. In Supabase, open the **nibatlas-staging** project → Settings → API Keys.
   Copy its server-side legacy `service_role` key privately.
3. In Cloudflare, open Workers & Pages → **nibatlas-staging** → Settings →
   Variables and Secrets. Add a **Secret** named `SUPABASE_SERVICE_ROLE_KEY`,
   paste the staging key and save/deploy. Never use a `NEXT_PUBLIC_` name or
   put the key in GitHub source/chat. The variable already exists in `.env.example`.
4. In Supabase SQL Editor run the read-only checks below. Confirm the cron row
   is active. Cron uses the existing database; no separate scheduler subscription.
5. For a new runtime regression, follow `staging-phone-test.md`. Preserve its
   founder-reported acceptance; do not repeat checks solely because old notes
   said presentation was pending.

Do not put a production key on staging. Missing secrets/services fail closed with
`service_unavailable`. Normal auth and saved-shop paths continue using publishable
credentials and owner RLS.

```sql
select jobname, schedule, active from cron.job
where jobname = 'nibatlas-verification-retention';
select status, start_time, end_time from cron.job_run_details
where jobid in (select jobid from cron.job where jobname='nibatlas-verification-retention')
order by start_time desc limit 5;
select count(*) as overdue_attempts from public.verification_attempts
where attempted_at < now() - interval '30 days 10 minutes';
```

The scheduled task is `public.purge_stamp_verification_data()`. A database owner
can invoke it after a pause or failure. Review cron health during founder staging
checks; external incident alerting belongs to Milestone 8. Do not export row-level
attempt histories into logs or another analytics store.

## Controlled shop adaptation

Open the shop editor → Location → Check-in radius. Save shop edits first and
verify/confirm the shop entrance pin. Leave **Use the default 45 metres** selected
unless a documented location issue needs a custom 25–300 m radius. Enter a reason
(10–500 characters) and click **Save check-in radius**. This changes verification
immediately, independently of catalogue publication. To restore the default,
select it and supply a reason. Reload saved radius after a competing-tab conflict
or uncertain response. Ordinary users cannot read or write these settings.

`set_shop_verification_policy(actor UUID, shop UUID, radius integer, reason text)`
remains service-only, rechecks/locks the actor's protected editor/admin role and
records a succinct audit. A null radius restores the default. Cookie-bound UI
uses `admin_shop_verification_policy`, deriving its actor solely from `auth.uid()`.
The private row records the latest override actor/reason/time. Never grant direct
browser table access or use an account-metadata role as authorization.

## Logging and rollback

Do not enable request-body logging, fetch-body tracing or location-bearing
Playwright traces against real phones. Application code does not log bodies,
provider errors, ciphertext, nonce secrets, or raw GPS. Database RPC arguments
carry only authenticated encrypted position envelopes. Synthetic integration
fixtures may contain coordinates because they represent no actual user location.

`SUPABASE_SERVICE_ROLE_KEY` is now shared by collection verification and media
uploads. Removing it disables both; it is not a collection-only switch. Use
removal only when stopping both features is intended. There is no documented
collection-only feature switch. For application rollback choose a known compatible
Worker and consult `media-uploads.md` for pending JPEG/session compatibility;
keep forward migrations, audit, private objects and immutable collections.
Keep the retention cron active. Do not drop tables, restore over collections, or
re-enable authenticated/service-role direct insertion as a rollback shortcut.

## Validation

CI resets the database, runs all pgTAP/RLS tests, then runs
`python3 scripts/verification/concurrency.py` against its disposable Docker
Supabase database, and the existing 50k-shop performance gate. The concurrency
script must never target hosted environments. The seed remains deterministic and
contains no verification sessions or collections.


## Beta device acceptance after a separately approved deployment

- On an iPhone in Safari, tap Collect Stamp → Check my location. With undecided
  site permission, confirm the browser prompt appears; allow it, then explicitly
  confirm the visit. If already blocked, check the settings/retry guidance.
- On Android, try a slow fix indoors. The dialog should explain the wait and offer
  retry after about 12 seconds; cancellation and hiding must discard late fixes.
- Test at a verified shop entrance, inside the shop and across the street. The
  tighter radius must not substitute for correcting an inaccurate shop pin.
  GPS cannot prove which shop/floor someone entered within the same building.
- On desktop, save a justified shop exception, refresh, then restore default.
  A stale second tab must require reloading. Policy changes must not alter
  existing Passport impressions.
