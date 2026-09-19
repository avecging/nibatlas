#!/usr/bin/env bash
# Disposable local Supabase only. Verify existing approved history survives WP3.
set -euo pipefail
supabase db reset --local --version 20260914000200
upgrade_tmp=$(mktemp -d)
trap 'rm -rf "$upgrade_tmp"' EXIT
upgrade_psql() { docker exec -i supabase_db_nibatlas psql -U postgres -d postgres "$@"; }
upgrade_snapshot="select jsonb_agg(to_jsonb(a)-array['artwork_origin','creator_name','creator_url','upload_id'] order by id) from public.stamp_artwork_versions a"
upgrade_psql -XAt -v ON_ERROR_STOP=1 -c "$upgrade_snapshot" > "$upgrade_tmp/before.json"
supabase migration up --local
upgrade_psql -XAt -v ON_ERROR_STOP=1 -c "$upgrade_snapshot" > "$upgrade_tmp/after.json"
diff -u "$upgrade_tmp/before.json" "$upgrade_tmp/after.json"
upgrade_psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if not exists(select 1 from public.stamp_artwork_versions where approval_status='approved') then
  raise exception 'Upgrade fixture must contain approved artwork';
 end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.stamp_artwork_versions'::regclass
  and tgname='stamp_artwork_versions_protect_approved' and tgenabled='O') then
  raise exception 'Approved artwork protection must remain enabled';
 end if;
 begin
  update public.stamp_artwork_versions set ink=ink where approval_status='approved';
  raise exception 'Upgrade left approved artwork writable';
 exception when sqlstate '55000' then null;
 end;
end $$;
SQL
