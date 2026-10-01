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
select ok(not has_table_privilege('authenticated','public.geographic_seal_awards','INSERT'),'browser cannot award');
select ok(not has_table_privilege('service_role','public.geographic_seals','SELECT'),'service has no table bypass');
select ok(not has_table_privilege('authenticated','public.geographic_seal_assets','SELECT'),'private file metadata not browser-readable');
select ok(not has_function_privilege('authenticated','public.geographic_seal_file(uuid,text,text,uuid,uuid,jsonb)','EXECUTE'),'file finalization is service-only');
select ok(not has_function_privilege('authenticated','public.admin_geographic_seals(text,uuid,uuid,jsonb,uuid)','EXECUTE'),'retired manual eligibility writer unavailable');
select ok(not has_function_privilege('authenticated','public.award_geographic_seal(uuid,uuid)','EXECUTE'),'award helper private');
select pg_temp.login(2);
set local role authenticated;
select throws_ok($$select public.admin_geographic_seals_v2('list')$$,'42501','Forbidden','ordinary account denied');
reset role;
select pg_temp.login(1);
select lives_ok($$select public.admin_geographic_seals_v2('save',p_document=>pg_temp.document('locality'))$$,'create locality');
select lives_ok($$select public.admin_geographic_seals_v2('save',p_document=>pg_temp.document('country'))$$,'create country');
select pg_temp.login(2);
select is(jsonb_array_length(public.my_geographic_seals()->'rows'),0,'private drafts do not leak');
select pg_temp.visit(301,601,1);
select is((select count(*)::integer from public.geographic_seal_awards),0,'save alone does not award');
select pg_temp.login(1);
select pg_temp.write_seal('locality','publish');
select pg_temp.write_seal('country','publish');
select pg_temp.login(2);
select is(jsonb_array_length(public.my_geographic_seals()->'rows'),2,'Singapore has both scopes');
select is((select count(*)::integer from public.geographic_seal_awards),0,'one of two shops is not enough');
select is((select (r->'progress'->>'required')::integer from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'current'->>'scope'='country'),2,'small country automatically requires both shops');
select pg_temp.visit(302,602,2);
select is((select count(*)::integer from public.geographic_seal_awards),2,'second shop earns both scopes automatically');
select is((select r->'award'->>'earnedOn' from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'current'->>'scope'='locality'),'2026-09-03','earned date comes from qualifying visit');
select public.my_geographic_seals();
select is((select count(*)::integer from public.geographic_seal_awards),2,'reconciliation idempotent');
select pg_temp.login(3);
select is((select count(*)::integer from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'<>'null'),0,'other account sees no awards');
select pg_temp.login(1);
select pg_temp.write_seal('country','save',pg_temp.document('country')||'{"ink":"teal","name":"Singapore Explorer"}');
select pg_temp.write_seal('country','publish');
select is((select count(*)::integer from public.geographic_seal_versions where snapshot->>'scope'='country'),2,'changed artwork gets version');
select pg_temp.write_seal('country','publish');
select is((select count(*)::integer from public.geographic_seal_versions where snapshot->>'scope'='country'),2,'identical publish reuses version');
select pg_temp.login(2);
select is((select r->'award'->'snapshot'->>'ink' from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'->'snapshot'->>'scope'='country'),'vermilion','old collector retains artwork');
select is((select r->'award'->'snapshot'->>'name' from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'->'snapshot'->>'scope'='country'),'Singapore country','old collector retains name');
-- Move a shop to another locality: all future eligibility follows current published geography.
insert into public.localities(id,country_code,name,slug,locality_type) values ('e1000000-0000-4000-8000-000000000010','SG','Synthetic second locality','synthetic-second-locality','city');
update public.shops set locality_id='e1000000-0000-4000-8000-000000000010' where id='00000000-0000-4000-8000-000000000302';
select pg_temp.login(1);
select public.admin_geographic_seals_v2('save',p_document=>pg_temp.document('locality')||'{"localityId":"e1000000-0000-4000-8000-000000000010","name":"Second locality"}');
select public.admin_geographic_seals_v2('publish',id,revision) from public.geographic_seals where locality_id='e1000000-0000-4000-8000-000000000010';
select pg_temp.login(3);
select pg_temp.visit(302,602,3,3);
select is((select count(*)::integer from public.geographic_seal_awards a join public.geographic_seals s on s.id=a.seal_id where a.user_id='e1000000-0000-4000-8000-000000000003' and s.locality_id='e1000000-0000-4000-8000-000000000010'),1,'moved shop earns its new one-shop locality');
select is((select count(*)::integer from public.geographic_seal_awards a join public.geographic_seals s on s.id=a.seal_id where a.user_id='e1000000-0000-4000-8000-000000000003' and s.locality_id=(select locality_id from public.shops where id='00000000-0000-4000-8000-000000000301')),0,'moved shop no longer earns old locality');
select is((select count(*)::integer from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000002'),2,'existing awards remain valid after shop move');
select pg_temp.visit(301,601,4,3);
select pg_temp.login(3);
select is((select r->'award'->'snapshot'->>'ink' from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'->'snapshot'->>'scope'='country'),'teal','future collector receives new artwork');
select pg_temp.login(1);
select throws_ok($$select public.admin_geographic_seals_v2('unpublish',(select id from public.geographic_seals limit 1),'00000000-0000-4000-8000-000000000099')$$,'40001','Reload changed seal','stale editor conflicts');
select throws_ok($$update public.geographic_seal_awards set version=1$$,'42501','Audit history is append-only','awards immutable');
select throws_ok($$update public.geographic_seal_versions set snapshot='{}'$$,'42501','Audit history is append-only','versions immutable');
select ok(exists(select 1 from public.admin_audit_log where entity_type='geographic_seal_versions' and entity_id is not null),'versions audited');
-- File registration does not publish, and only an exact ready asset on this seal can attach.
select set_config('test.seal',(select id::text from public.geographic_seals where scope='country' and country_code='SG'),true);
select set_config('test.asset',(public.geographic_seal_file('e1000000-0000-4000-8000-000000000001','staging','reserve',p_seal=>current_setting('test.seal')::uuid,p_payload=>jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'contentType','image/svg+xml'))->>'id'),true);
select throws_ok($$select public.geographic_seal_file('e1000000-0000-4000-8000-000000000002','staging','read',current_setting('test.asset')::uuid)$$,'P0002','Artwork not found','pending file private');
select throws_ok($$select pg_temp.write_seal('country','save',pg_temp.document('country')||jsonb_build_object('origin','commissioned','artworkId',current_setting('test.asset')))$$,'22023','Invalid artwork','cannot attach unvalidated upload');
select public.geographic_seal_file('e1000000-0000-4000-8000-000000000001','staging','finalize',current_setting('test.asset')::uuid);
select pg_temp.write_seal('country','save',pg_temp.document('country')||jsonb_build_object('origin','commissioned','artworkId',current_setting('test.asset'),'creatorName','Artist','creatorUrl','https://example.com'));
select throws_ok($$select public.geographic_seal_file('e1000000-0000-4000-8000-000000000002','staging','read',current_setting('test.asset')::uuid)$$,'P0002','Artwork not found','saved upload still private');
select pg_temp.write_seal('country','publish');
select lives_ok($$select public.geographic_seal_file('e1000000-0000-4000-8000-000000000002','staging','read',current_setting('test.asset')::uuid)$$,'published art readable');
select throws_ok($$select public.geographic_seal_file('e1000000-0000-4000-8000-000000000002','production','read',current_setting('test.asset')::uuid)$$,'P0002','Artwork not found','environment separation');
select pg_temp.visit(301,601,5,4);
select pg_temp.visit(302,602,6,4);
select is((select version from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000004' and seal_id=current_setting('test.seal')::uuid),3,'fresh collector earns uploaded artwork');
select pg_temp.write_seal('country','unpublish');
select lives_ok($$select public.geographic_seal_file('e1000000-0000-4000-8000-000000000004','staging','read',current_setting('test.asset')::uuid)$$,'historical owner retains uploaded artwork after unpublish');

select throws_ok($$select public.geographic_seal_file('e1000000-0000-4000-8000-000000000002','staging','read',current_setting('test.asset')::uuid)$$,'P0002','Artwork not found','unpublished unowned art private');
select pg_temp.login(2);
select ok(exists(select 1 from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'->'snapshot'->>'scope'='country'),'unpublish keeps earned country');
select public.my_geographic_seals(p_ack=>array(select id from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000002'));
select is((select count(*)::integer from jsonb_array_elements(public.my_geographic_seals()->'rows') r where (r->'award'->>'unseen')::boolean),0,'owner receipts persist');
-- More than five eligible shops caps country threshold at five distinct shops.
insert into public.shops select (jsonb_populate_record(null::public.shops,to_jsonb(s)||jsonb_build_object('id','00000000-0000-4000-8000-'||lpad(n::text,12,'0'),'slug','synthetic-seal-'||n,'name','Synthetic seal shop '||n))).* from public.shops s cross join generate_series(311,315) n where s.id='00000000-0000-4000-8000-000000000301';
insert into public.stamps(id,shop_id,name) select ('00000000-0000-4000-8000-'||lpad((n+300)::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Synthetic seal stamp '||n from generate_series(311,315) n;
insert into public.stamp_artwork_versions select (jsonb_populate_record(null::public.stamp_artwork_versions,to_jsonb(v)||jsonb_build_object('id','00000000-0000-4000-8000-'||lpad((n+400)::text,12,'0'),'stamp_id','00000000-0000-4000-8000-'||lpad((n+300)::text,12,'0')))).* from public.stamp_artwork_versions v cross join generate_series(311,315) n where v.id='00000000-0000-4000-8000-000000000701';
update public.stamps set status='active',current_design_version=1 where id in (select ('00000000-0000-4000-8000-'||lpad((n+300)::text,12,'0'))::uuid from generate_series(311,315) n);
select pg_temp.login(1);
select pg_temp.write_seal('country','publish');
select pg_temp.visit(311,611,7,5);
select pg_temp.visit(312,612,8,5);
select pg_temp.visit(313,613,9,5);
select pg_temp.visit(314,614,10,5);
select is((select count(*)::integer from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000005' and seal_id=current_setting('test.seal')::uuid),0,'four of seven eligible shops insufficient');
select pg_temp.visit(315,615,11,5);
select is((select count(*)::integer from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000005' and seal_id=current_setting('test.seal')::uuid),1,'five of seven earns country');
-- Hundreds of definitions: bounded list and filtering apply before pagination.
insert into public.geographic_seals(scope,country_code,draft) select 'country',chr(65+n/26)||chr(65+n%26),jsonb_build_object('name','Synthetic seal '||n,'scope','country','countryCode',chr(65+n/26)||chr(65+n%26),'countryLabel','Synthetic country','localityId',null,'ink','teal','eligibleShopIds','[]'::jsonb) from generate_series(0,219) n;
select pg_temp.login(1);
select is(jsonb_array_length(public.admin_geographic_seals_v2('list')),51,'dashboard bounded to page plus sentinel');
select is(jsonb_array_length(public.admin_geographic_seals_v2('list',p_scope=>'locality')),2,'scope filter before paging');
select is(jsonb_array_length(public.admin_geographic_seals_v2('list',p_query=>'Synthetic seal 219')),1,'search finds beyond first page');
select is(jsonb_array_length(public.admin_geographic_seals_v2('history',p_id=>current_setting('test.seal')::uuid)),3,'history includes all published designs');
select is((public.admin_geographic_seals_v2('history',p_id=>current_setting('test.seal')::uuid,p_before=>2)->0->>'version')::integer,1,'history pagination uses older version');
select * from finish();
rollback;
