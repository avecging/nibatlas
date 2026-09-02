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

`supabase/performance/viewport_50k.sql` enforces the approved sub-250 ms p95
database budget against dense viewport and selective alias-search paths in a
rolled-back 50,000-shop fixture. It gates on the median of three 20-sample p95
rounds to reduce shared-runner noise.

The local `seed.sql` contains only deterministic records marked `demo`. It is not
a production import mechanism.
