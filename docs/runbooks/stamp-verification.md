# Stamp verification deployment and operations

The backend and account presentation are connected. A fixture ceremony is still
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

`set_shop_verification_policy(actor UUID, shop UUID, radius integer, reason text)`
is server-only and checks the actor's protected editor/admin profile role. Use it
only after validating the shop entrance/coordinates; record the reason. The
private row records the latest actor and timestamp. Milestone 6 supplies the
founder UI and general audit log. Never edit policy using a browser Supabase key.

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
