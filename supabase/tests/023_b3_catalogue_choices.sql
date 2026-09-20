begin;
select no_plan();
insert into auth.users(id) values('83000000-0000-4000-8000-000000000001'),('83000000-0000-4000-8000-000000000002');
select public.assign_profile_role('83000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('83000000-0000-4000-8000-000000000002','editor');
create temp table choices(kind text primary key,id uuid);
grant all on choices to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.admin_catalogue_choice('localities','Synthetic city','SG')$$,'42501','Admin access denied','editor cannot create locality');
select throws_ok($$select public.admin_catalogue_choice('types','Synthetic type')$$,'42501','Admin access denied','editor cannot create shop type');
select lives_ok($$select public.admin_catalogue_choice('brands','Synthetic brand')$$,'editor existing brand power preserved');
select set_config('request.jwt.claims','{"sub":"83000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into choices select 'SG',(public.admin_catalogue_choice('localities','  Synthetic   city ','SG')->>'id')::uuid;
insert into choices select 'JP',(public.admin_catalogue_choice('localities','Synthetic city','JP')->>'id')::uuid;
insert into choices select 'SG-area',(public.admin_catalogue_choice('localities','Synthetic city','SG','SG-A')->>'id')::uuid;
insert into choices select 'type',(public.admin_catalogue_choice('types','Synthetic type')->>'id')::uuid;
select is((public.admin_catalogue_choice('localities','SYNTHETIC CITY','SG')->>'id')::uuid,(select id from choices where kind='SG'),'same country/name retries reuse');
select is((public.admin_catalogue_choice('localities','Synthetic city','SG','sg-a')->>'id')::uuid,(select id from choices where kind='SG-area'),'area code normalized for reuse');
select isnt((select id from choices where kind='SG'),(select id from choices where kind='JP'),'same name distinct across countries');
select isnt((select id from choices where kind='SG'),(select id from choices where kind='SG-area'),'same name distinct across administrative areas');
select is((public.admin_catalogue_choice('types',' SYNTHETIC  TYPE ')->>'id')::uuid,(select id from choices where kind='type'),'shop type reused');
select ok(public.admin_shop_options()->'localities' @> jsonb_build_array(jsonb_build_object('id',(select id from choices where kind='SG'),'countryCode','SG')),'new locality selectable with correct country');
select ok(public.admin_shop_options()->'types' @> jsonb_build_array(jsonb_build_object('id',(select id from choices where kind='type'),'label','Synthetic type')),'new type selectable');
select throws_ok($$select public.admin_catalogue_choice('localities','X',null)$$,'22023','Invalid choice','country required');
select throws_ok($$select public.admin_catalogue_choice('localities','X','sg')$$,'22023','Invalid choice','canonical country required');
select throws_ok($$select public.admin_catalogue_choice('types','X','SG')$$,'22023','Invalid choice','extra geography refused');
select throws_ok($$insert into public.localities(country_code,name,locality_type,slug) values('SG','Bypass','other','bypass')$$,'42501',null,'direct locality write stays denied');
-- Save, attest and publish using the actual private-working-copy lifecycle.
create temp table publication as select public.admin_shop_read('00000000-0000-4000-8000-000000000301') r;
update publication set r=public.admin_shop_write('save','00000000-0000-4000-8000-000000000301',r->>'revision',
  jsonb_set(jsonb_set(r->'document','{shop,locality_id}',to_jsonb((select id from choices where kind='SG'))),'{types}',
    jsonb_build_array(jsonb_build_object('shop_type_id',(select id from choices where kind='type'),'is_primary',true))));
update publication set r=public.admin_shop_write('confirm_position','00000000-0000-4000-8000-000000000301',r->>'revision');
select is(jsonb_array_length(r->'publicationErrors'),0,'new locality/type satisfy publication') from publication;
update publication set r=public.admin_shop_write('publish','00000000-0000-4000-8000-000000000301',r->>'revision');
set constraints all immediate;
select is(public.shop_detail('m2-singapore-demo-fixture')->>'primaryTypeLabel','Synthetic type','published detail carries new primary label');
select ok(public.shop_detail('m2-singapore-demo-fixture')->'shopTypeLabels' @> jsonb_build_object('type_'||replace((select id::text from choices where kind='type'),'-','_'),'Synthetic type'),'secondary type labels included');
reset role;
select is(public.saved_shop_summary('00000000-0000-4000-8000-000000000301',now())->>'primaryTypeLabel','Synthetic type','saved projection carries new label');
select ok(exists(select 1 from jsonb_array_elements(public.viewport_shops(103,1,104,2,10)->'shops') e where e->>'primaryTypeLabel'='Synthetic type'),'viewport carries new label');
select ok(exists(select 1 from jsonb_array_elements(public.nearby_shops(1.29027,103.851959)->'shops') e where e->>'primaryTypeLabel'='Synthetic type'),'nearby carries new label');
select is((select count(*) from public.admin_audit_log where entity_id in(select id from choices)),4::bigint,'exactly one audit per new choice');
select ok((select bool_and(actor_user_id='83000000-0000-4000-8000-000000000001') from public.admin_audit_log where entity_id in(select id from choices)),'actual admin audited');

select ok((select bool_and(centroid is null and locality_type='other') from public.localities where id in(select id from choices)),'no invented geography or city classification');
select * from finish();
rollback;
