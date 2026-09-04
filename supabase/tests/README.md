# Database tests

SQL policy, migration, and geographic-query tests begin with the production-shaped schema in Milestone 2.

- `001_catalogue_foundation.sql` covers the canonical catalogue boundary.
- `002_read_rpcs.sql` covers public reads, query validation, and geographic behavior.
- `003_api_provenance.sql` covers the versioned evidence projection.
- `004_account_data.sql` covers profile provisioning, column grants, owner-only
  RLS for profiles and saved shops, and account-deletion cascades.
