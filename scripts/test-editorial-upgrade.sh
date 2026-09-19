#!/usr/bin/env bash
# Disposable local Supabase only: preserve saved documents and conflict state.
set -euo pipefail
supabase db reset --local --version 20260920000300
b2_upgrade_tmp=$(mktemp -d)
trap 'rm -rf "$b2_upgrade_tmp"' EXIT
b2_psql() { docker exec -i supabase_db_nibatlas psql -U postgres -d postgres "$@"; }
b2_psql -X -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values ('81000000-0000-4000-8000-000000000001');
select public.assign_profile_role('81000000-0000-4000-8000-000000000001','editor');
set role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
do $$ declare d jsonb; notes jsonb:='[]'; extra integer; reduction integer; shop uuid; begin
  for i in 1..32 loop
    notes:=notes||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','Synthetic migration source',
      'source_type','official','checked_at','2026-09-01','reliability','unknown','status','active','claims','[]'::jsonb,
      'evidence_note',repeat('x',4000)));
  end loop;
  for i in 1..2 loop
    shop:=('81000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    perform public.admin_shop_write('create',shop,null,jsonb_build_object('name','Synthetic upgrade draft','slug','synthetic-upgrade-'||i));
    d:=public.admin_shop_read(shop)->'document';
    if i=1 then
      d:=jsonb_set(d,'{sources}',notes);
      extra:=octet_length(d::text)-131000;
      if extra<0 then raise exception 'Upgrade fixture must start above target'; end if;
      for n in reverse 31..0 loop
        reduction:=least(extra,3999);
        d:=jsonb_set(d,array['sources',n::text,'evidence_note'],to_jsonb(repeat('x',4000-reduction)));
        extra:=extra-reduction;
        exit when extra=0;
      end loop;
      if octet_length(d::text)<>131000 then raise exception 'Upgrade fixture must be near limit'; end if;
    else d:=jsonb_set(d,'{shop,name}','"Private stale name"'); end if;
    perform public.admin_shop_write('save',shop,public.admin_shop_read(shop)->>'revision',d);
  end loop;
end $$;
reset role;
update public.shops set name='Concurrent operator change' where slug='synthetic-upgrade-2';
SQL
b2_snapshot="select jsonb_agg(jsonb_build_object('id',shop_id,'document',document,'revision',revision) order by shop_id) from public.shop_working_copies where shop_id::text like '81000000-%'"
b2_psql -XAt -v ON_ERROR_STOP=1 -c "$b2_snapshot" > "$b2_upgrade_tmp/before.json"
supabase migration up --local
b2_psql -XAt -v ON_ERROR_STOP=1 -c "$b2_snapshot" > "$b2_upgrade_tmp/after.json"
diff -u "$b2_upgrade_tmp/before.json" "$b2_upgrade_tmp/after.json"
b2_psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists(select 1 from public.shop_working_copies w where shop_id='81000000-0000-4000-8000-000000000001'
    and base_fingerprint=md5(public.shop_edit_document(shop_id)::text) and octet_length(document::text)=131000) then
    raise exception 'Current large working copy must preserve bytes and remain current'; end if;
  if not exists(select 1 from public.shop_working_copies w where shop_id='81000000-0000-4000-8000-000000000002'
    and base_fingerprint<>md5(public.shop_edit_document(shop_id)::text)) then
    raise exception 'Stale working copy must remain stale'; end if;
  if exists(select 1 from public.shops where reviewed_at is not null or position_confirmation is not null) then
    raise exception 'Migration must not invent editorial review or position confirmation'; end if;
end $$;
SQL
