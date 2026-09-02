# Migrations

Migrations are the canonical database history and must reset successfully from an
empty local Supabase project.

## Milestone 2 packages

- `20260902000100_m2_catalogue_foundation.sql` establishes PostGIS/pg_trgm,
  canonical catalogue tables, controlled vocabularies, provenance, indexes,
  explicit RLS, and narrow published projections.
- Viewport, detail, alias-search, and Near Me RPCs follow in a separate package so
  their API and performance evidence can be reviewed independently.

The local `seed.sql` contains only deterministic records marked `demo`. It is not
a production import mechanism.
