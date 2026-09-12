# Migrations

Migrations are the canonical database history and must reset successfully from an
empty local Supabase project.

## Milestone 2 packages

- `20260902000100_m2_catalogue_foundation.sql` establishes PostGIS/pg_trgm,
  canonical catalogue tables, controlled vocabularies, provenance, indexes,
  explicit RLS, and narrow published projections.
- `20260902000200_m2_read_rpcs.sql` repairs the WP1 review's three integrity
  findings, then adds bounded viewport, detail, canonical/alias search, and Near
  Me reads. It also installs the approved shop-type vocabulary required by clean
  deployments; demo rows remain seed-only. The functions expose published
  projections only; Near Me coordinates are statement-local and never persisted.
- `20260902000300_m2_api_provenance.sql` adds stable public source labels,
  controlled source kinds, claim-level evidence tokens, and source-UUID claim
  references for the versioned application API. Canonical evidence rows remain
  closed to browser roles.

## Milestone 4 packages

- `20260904000100_m4_account_data_foundation.sql` adds private profiles and
  owner-scoped saved shops. An idempotent, pinned-search-path trigger provisions
  one minimal profile for every Supabase Auth identity. Column grants keep
  account roles server-controlled; forced RLS limits profile and saved-shop
  access to the authenticated owner.

`supabase/performance/viewport_50k.sql` enforces the approved sub-250 ms p95
database budget against dense viewport and selective alias-search paths in a
rolled-back 50,000-shop fixture. It gates on the median of three 20-sample p95
rounds to reduce shared-runner noise.

The local `seed.sql` contains only deterministic records marked `demo`. It is not
a production import mechanism.

WP2 migration `20260912000200_m5_verification_service.sql` installs the private
verification service and pg_cron retention task. Apply it forward; keep the task
active during application rollback. See `docs/runbooks/stamp-verification.md`.
# Milestone 5 WP3 collection reads

`20260912000300_m5_collection_reads.sql` adds the authenticated owner-only,
101-row-bounded history projection used by `/api/v1/collections`. It adds no
write path. Apply before deploying the WP3 frontend. Rollback the application
if needed; the additive read function can remain in place.
