begin;
select no_plan();
insert into auth.users(id) values ('91000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000002'),('91000000-0000-4000-8000-000000000003');
select public.assign_profile_role('91000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('91000000-0000-4000-8000-000000000002','editor');
create temp table import_checks(k text primary key,v jsonb);
grant all on import_checks to authenticated;
create function pg_temp.catalogue_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare t text; result jsonb:='{}'; fingerprint text;
begin
  foreach t in array array['shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links','shop_shop_types','shop_services','shop_specialties','shop_brands','localities','shop_types','brands','specialties','shop_images','media_uploads','stamps','stamp_artwork_versions','stamp_collections','admin_audit_log'] loop
    execute format('select md5(coalesce(string_agg(row_to_json(r)::text,''|'' order by row_to_json(r)::text),'''')) from public.%I r',t) into fingerprint;
    result:=result||jsonb_build_object(t,fingerprint);
  end loop;
  return result;
end; $$;
create function pg_temp.preview_context(id uuid default null, name text default null, slug text default null) returns jsonb language sql as $$
  select public.admin_import_preview('context',jsonb_build_array(jsonb_build_object('rowId','row-1','id',id,'name',name,'slug',slug))) -> 0;
$$;
create function pg_temp.preview_check(d jsonb, rev text default null, id uuid default '91000000-0000-4000-8000-000000000010') returns jsonb language sql as $$
  select public.admin_import_preview('validate',jsonb_build_array(jsonb_build_object('rowId','row-1','id',id,'revision',rev,'document',d))) -> 0;
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('create','91000000-0000-4000-8000-000000000010',null,'{"name":"Synthetic Import Existing","slug":"synthetic-import-existing"}');
insert into import_checks values('record',public.admin_shop_read('91000000-0000-4000-8000-000000000010'));
select public.admin_shop_write('save','91000000-0000-4000-8000-000000000010',
 (select v->>'revision' from import_checks where k='record'),
 jsonb_set((select v->'document' from import_checks where k='record'),'{shop,internal_notes}','"PRIVATE synthetic import note"'));
update import_checks set v=public.admin_shop_read('91000000-0000-4000-8000-000000000010') where k='record';
insert into import_checks values('before',pg_temp.catalogue_snapshot());
select is(pg_temp.preview_context('91000000-0000-4000-8000-000000000010')->'record',(select v from import_checks where k='record'),'context reads exact private working copy');
select is(jsonb_array_length(pg_temp.preview_context(null,'Synthetic Import Existing')->'candidates'),1,'same name is a candidate, never a selected update');
select is(pg_temp.preview_context(null,null,'synthetic-import-existing')->'record', 'null'::jsonb,'same slug never grants overwrite authority');
select is(pg_temp.preview_context(null,null,'synthetic-import-existing')->'candidates'->0->>'reason','same URL name','exact slug candidate explained');
select is(pg_temp.preview_check((select v->'document' from import_checks where k='record'),(select v->>'revision' from import_checks where k='record'))->'issues','[]'::jsonb,'shared SQL validator accepts unchanged private document');
select ok(jsonb_array_length(pg_temp.preview_check((select v->'document' from import_checks where k='record'),(select v->>'revision' from import_checks where k='record'))->'publicationErrors')>0,'publication prerequisites remain separate and authoritative');
select is(pg_temp.preview_check((select v->'document' from import_checks where k='record'),'stale')->'issues'->0->>'path','shop_id','stale revision fails safely');
select is(pg_temp.preview_check(jsonb_set((select v->'document' from import_checks where k='record'),'{shop,slug}','"replacement-url"'),(select v->>'revision' from import_checks where k='record'))->'issues'->0->>'path','slug','stable URL protected at SQL boundary');
select is(pg_temp.preview_check(jsonb_set((select v->'document' from import_checks where k='record'),'{shop,position_confirmation}','{}'),(select v->>'revision' from import_checks where k='record'))->'issues'->0->>'path','document','cannot import an attestation');
select is(pg_temp.preview_check(jsonb_set((select v->'document' from import_checks where k='record'),'{shop,website_url}','"javascript:alert(1)"'),(select v->>'revision' from import_checks where k='record'))->'issues'->0->>'path','document','existing SQL URL rule enforced');
-- 200 mixed isolated rows: no records created by these eight 25-row previews.
insert into import_checks
select 'batch-'||batch, public.admin_import_preview('validate',(
 select jsonb_agg(jsonb_build_object('rowId','synthetic-'||i,'id',('92000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'document',jsonb_set((select v->'document' from import_checks where k='record'),'{shop}',
   ((select v->'document'->'shop' from import_checks where k='record')||jsonb_build_object('name','Synthetic row '||i,'slug',case when i%4=2 then 'synthetic-import-existing' else 'synthetic-import-'||i end,
   'country_code','SG','latitude',case when i%4=1 then 999 else 0 end,'longitude',0,'locality_id',case when i%4=3 then '99999999-0000-4000-8000-000000000099' else null end)))) order by i)
 from generate_series(batch*25+1,batch*25+25) i))
from generate_series(0,7) batch;
select is((select count(*)::integer from import_checks c cross join lateral jsonb_array_elements(c.v) r where k like 'batch-%'),200,'all 200 rows returned');
select is((select count(*)::integer from import_checks c cross join lateral jsonb_array_elements(c.v) r where k like 'batch-%' and r->'issues'='[]'::jsonb),50,'50 valid draft candidates');
select is((select count(*)::integer from import_checks c cross join lateral jsonb_array_elements(c.v) r where k like 'batch-%' and r->'issues'<>'[]'::jsonb),150,'150 invalid coordinates, duplicate slugs or unknown localities');
select is(pg_temp.catalogue_snapshot(),(select v from import_checks where k='before'),'preview leaves catalogue, private copies, vocabularies, media, stamps, impressions and audit byte-identical');
select throws_ok($$select public.admin_import_preview('write','[]')$$,'22023','Invalid import preview','no write mode');
select throws_ok($$select public.admin_import_preview('context',(select jsonb_agg(jsonb_build_object('rowId','r-'||i)) from generate_series(1,26) i))$$,'22023','Invalid import preview','SQL row cap enforced');
-- Current role is rechecked in SQL, independent of the HTTP guard.
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select pg_temp.preview_context()$$,'42501','Admin access denied','editor cannot preview imports');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select pg_temp.preview_context()$$,'42501','Admin access denied','ordinary account cannot preview imports');
reset role;
select public.assign_profile_role('91000000-0000-4000-8000-000000000001','user');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select pg_temp.preview_context()$$,'42501','Admin access denied','revoked admin cannot preview imports');
reset role;
select ok(not has_function_privilege('anon','public.admin_import_preview(text,jsonb)','EXECUTE'),'anonymous RPC access denied');
select ok(not has_function_privilege('authenticated','public.validate_shop_document(uuid,jsonb)','EXECUTE'),'private validation helper remains private');
select is((select provolatile::text from pg_proc where oid='public.admin_import_preview(text,jsonb)'::regprocedure),'s','preview RPC is STABLE and cannot write');
select * from finish();
rollback;
