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

## SQL suite discovery

`supabase test db` discovers the numbered SQL suites in this directory. Select
relevant suites by feature filename and their assertions; there is no manual
suite inventory to update. Coverage includes catalogue/provenance, accounts/saves,
collection/verification, guarded phone fixtures, authorization/shop operations
and PNG/JPEG media integrity.

The existing CI `Database reset` job discovers all SQL suites, then runs
`python3 scripts/verification/concurrency.py` and
`supabase/performance/viewport_50k.sql` against disposable local data. The latter
rolls back its 50k-shop dataset and measures the median of three p95 rounds.
Use `.github/workflows/ci.yml` for the exact complete sequence.

`Worker authentication` separately verifies real Auth/PostgREST transaction
completion through the compiled Worker. Mocked HTTP tests do not replace it.
Report skipped/unavailable checks explicitly; do not call local-only evidence a
hosted acceptance test.
