# Database migrations

The SQL files are the canonical ordered database history. Apply them forward
through the existing deployment workflow. Test reset only against a disposable
local database; never reset hosted staging/production to deploy or roll back.
Do not edit applied migrations, delete audit/history, or overwrite impressions.

## Current inventory

- `20260902000100_m2_catalogue_foundation.sql`
- `20260902000200_m2_read_rpcs.sql`
- `20260902000300_m2_api_provenance.sql`
- `20260903000100_m3_wp2_contract_completeness.sql`
- `20260904000100_m4_account_data_foundation.sql`
- `20260904000200_m4_saved_shop_service.sql`
- `20260912000100_m5_stamp_collection_foundation.sql`
- `20260912000200_m5_verification_service.sql`
- `20260912000300_m5_collection_reads.sql`
- `20260912000400_staging_test_venue_type.sql`
- `20260912000500_m6_admin_authorization.sql`
- `20260913000100_m6_shop_operations.sql`
- `20260913000200_m6_media_upload_foundation.sql`
- `20260914000100_m6_deferred_catalogue_constraint.sql`
- `20260914000200_m6_jpeg_photo_intake.sql`

`seed.sql` is deterministic demo data, not a production import. The separately
guarded staging phone fixture is not part of migrations/default seed.

See `supabase/tests/README.md` for reset/regression execution. For feature-specific
rollbacks use the shop, verification and media runbooks; additive migrations and
immutable history stay in place. Verification retention cron stays active.
