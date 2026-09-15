# Database checks

Use Supabase CLI 2.117.0 and Docker against the disposable local `nibatlas` stack.
Never run these reset, synthetic-data or concurrency checks against hosted data.

```sh
supabase start -x realtime,imgproxy,edge-runtime,logflare,vector,supavisor
supabase db reset
mkdir -p supabase/tests/fixtures
cp supabase/fixtures/staging-phone-location.sql supabase/tests/fixtures/staging-phone-location.inc
supabase test db
```

The `.inc` copy is needed because pg_prove mounts only the tests directory; it is
untracked and not a standalone SQL test. CI additionally verifies that the source
fixture fails without its staging opt-in and repeats the deterministic seed.

## Discovered SQL suites

- `001_catalogue_foundation.sql`
- `002_read_rpcs.sql`
- `003_api_provenance.sql`
- `004_account_data.sql`
- `005_saved_shop_service.sql`
- `006_stamp_collection_foundation.sql`
- `007_stamp_verification.sql`
- `008_collection_reads.sql`
- `009_staging_phone_location.sql`
- `010_admin_authorization.sql`
- `011_shop_operations.sql`
- `012_media_upload_foundation.sql`
- `013_admin_catalogue_access.sql`
- `014_jpeg_photo_intake.sql`

The existing CI `Database reset` job discovers all SQL suites, then runs
`python3 scripts/verification/concurrency.py` and
`supabase/performance/viewport_50k.sql` against disposable local data. The latter
rolls back its 50k-shop dataset and measures the median of three p95 rounds.
Use `.github/workflows/ci.yml` for the exact complete sequence.

`Worker authentication` separately verifies real Auth/PostgREST transaction
completion through the compiled Worker. Mocked HTTP tests do not replace it.
Report skipped/unavailable checks explicitly; do not call local-only evidence a
hosted acceptance test.
