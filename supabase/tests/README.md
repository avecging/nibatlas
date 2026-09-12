# Database tests

SQL policy, migration, and geographic-query tests begin with the production-shaped schema in Milestone 2.

- `001_catalogue_foundation.sql` covers the canonical catalogue boundary.
- `002_read_rpcs.sql` covers public reads, query validation, and geographic behavior.
- `003_api_provenance.sql` covers the versioned evidence projection.
- `004_account_data.sql` covers profile provisioning, column grants, owner-only
  RLS for profiles and saved shops, and account-deletion cascades.
- `005_saved_shop_service.sql` covers the owner-scoped, idempotent saved-shop
  application RPCs.
- `006_stamp_collection_foundation.sql` covers Atlas Stamp artwork approval,
  immutable versioning, collection snapshot integrity, idempotency, privacy and
  owner-only reads.

- `007_stamp_verification.sql` covers nonce binding/replay, freshness, accuracy,
  geofence edges, retention, controlled adaptation, snapshots and private grants.
- `scripts/verification/concurrency.py` runs eight separate database sessions
  against independent verified nonces and asserts one collection. CI runs it
  after pgTAP and before the existing database performance gate.
