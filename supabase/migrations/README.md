# Database migrations

The SQL files are the canonical ordered database history. Apply them forward
through the existing deployment workflow. Test reset only against a disposable
local database; never reset hosted staging/production to deploy or roll back.
Do not edit applied migrations, delete audit/history, or overwrite impressions.

## Finding the relevant migration

Use the timestamped SQL files for exact order, fields and constraints; filenames
and their opening comments identify each change. There is no separate inventory
to keep synchronized.

| Package | Purpose |
| --- | --- |
| M2/M3 catalogue | Geographic catalogue, bounded read RPCs and public provenance/contracts |
| M4 accounts | Private profiles, owner-scoped saves and saved-shop service |
| M5 collection | Versioned artwork, immutable collections, verification and owner reads |
| M6 administration | Current-role authorization, append-only audit and private shop working copies |
| M6 media | Private upload manifests, deferred catalogue constraint repair and separate JPEG input/output identity |

`seed.sql` is deterministic demo data, not a production import. The separately
guarded staging phone fixture is not part of migrations/default seed.

See `supabase/tests/README.md` for reset/regression execution. For feature-specific
rollbacks use the shop, verification and media runbooks; additive migrations and
immutable history stay in place. Verification retention cron stays active.
