begin;
select no_plan();
insert into auth.users(id) values ('e1000000-0000-4000-8000-000000000001'),('e1000000-0000-4000-8000-000000000002'),('e1000000-0000-4000-8000-000000000003'),('e1000000-0000-4000-8000-000000000004'),('e1000000-0000-4000-8000-000000000005');
select public.assign_profile_role('e1000000-0000-4000-8000-000000000001','admin');
create function pg_temp.login(n integer) returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub','e1000000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated')::text,true)$$;
create function pg_temp.document(scope text) returns jsonb language sql as $$
 select jsonb_build_object('scope',scope,'countryCode','SG','countryLabel','Singapore','name','Singapore '||scope,'origin','generated','ink','vermilion','localityId',case when scope='locality' then (select locality_id from public.shops where id='00000000-0000-4000-8000-000000000301') end,'eligibleShopIds','[]'::jsonb)
$$;
create function pg_temp.write_seal(scope text,action text,d jsonb default null) returns jsonb language sql as $$
 select public.admin_geographic_seals_v2(action,s.id,s.revision,d) from public.geographic_seals s where s.scope=write_seal.scope and s.country_code='SG' order by s.id limit 1
$$;
-- Isolated synthetic catalogue: two eligible shops in Singapore.
update public.shops set country_code='SG',locality_id=(select locality_id from public.shops where id='00000000-0000-4000-8000-000000000301') where id='00000000-0000-4000-8000-000000000302';
create function pg_temp.visit(shop integer,stamp integer,day integer,uid integer default 2) returns void language sql as $$
 insert into public.stamp_collections(user_id,stamp_id,shop_id,stamp_design_version,collected_at,shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
 select ('e1000000-0000-4000-8000-'||lpad(uid::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(stamp::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(shop::text,12,'0'))::uuid,1,
 '2026-09-01T00:00:00Z'::timestamptz+make_interval(days=>day),'Asia/Singapore','geofence',1,'Synthetic visit',
 '{"countryCode":"SG","countryLabel":"Singapore","localitySlug":"singapore","localityName":"Singapore"}',
 jsonb_build_object('id','00000000-0000-4000-8000-'||lpad(stamp::text,12,'0'),'designVersion',1,'artworkKind','generated_template','ink',case when stamp=602 then 'indigo' else 'teal' end,'paletteVersion',1,'templateData',jsonb_build_object('tier','shop','motif',case when stamp=602 then 'counter' else 'storefront' end));
$$;

select pg_temp.login(1);
select public.admin_geographic_seals_v2('save',p_document=>pg_temp.document('country'));
select pg_temp.write_seal('country','publish');
select is((select draft->>'template' from public.geographic_seals where scope='country' and country_code='SG'),'cartouche-v1','legacy client omission stays v1');
select pg_temp.visit(301,601,1);
select pg_temp.visit(302,602,2);
select is((select count(*)::integer from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000002'),1,'original country awarded before redesign');
select pg_temp.write_seal('country','save',pg_temp.document('country')||'{"template":"cartouche-v2","ink":"plum"}');
select is((select draft->>'template' from public.geographic_seals where scope='country' and country_code='SG'),'cartouche-v2','v2 is retained in private draft');
select is((select published_version from public.geographic_seals where scope='country' and country_code='SG'),1,'save does not publish');
select pg_temp.write_seal('country','publish');
select is((select published_version from public.geographic_seals where scope='country' and country_code='SG'),2,'redesign publishes a new version');
select is((select snapshot->>'template' from public.geographic_seal_versions where snapshot->>'scope'='country' and version=1),'cartouche-v1','old artwork snapshot remains unchanged');
select is((select version from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000002'),1,'old award retains v1');
select pg_temp.visit(301,601,3,3);
select pg_temp.visit(302,602,4,3);
select is((select version from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000003'),2,'new collector receives v2');
select pg_temp.write_seal('country','publish');
select is((select count(*)::integer from public.geographic_seal_versions where snapshot->>'scope'='country'),2,'identical publication remains idempotent');
select public.admin_geographic_seals_v2('save',p_document=>pg_temp.document('locality')||'{"template":"cartouche-v2","ink":"moss"}');
select pg_temp.write_seal('locality','publish');
select is((select snapshot->>'template' from public.geographic_seal_versions where snapshot->>'scope'='locality'),'cartouche-v2','locality supports the simpler v2 layout');
select throws_ok($$select pg_temp.write_seal('country','save',pg_temp.document('country')||'{"template":"unrecognized"}')$$,'22023','Invalid seal','unknown templates rejected');
select throws_ok($$select pg_temp.write_seal('country','save',pg_temp.document('country')||'{"template":null}')$$,'22023','Invalid seal','null templates rejected');
select pg_temp.login(2);
set local role authenticated;
select throws_ok($$select public.admin_geographic_seals_v2('save',p_document=>'{"template":"cartouche-v2"}')$$,'42501','Forbidden','template field does not bypass admin authorization');
reset role;
select * from finish();
rollback;
