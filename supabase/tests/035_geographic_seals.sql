begin;
select no_plan();
insert into auth.users(id) values ('e1000000-0000-4000-8000-000000000001'),('e1000000-0000-4000-8000-000000000002'),('e1000000-0000-4000-8000-000000000003');
select public.assign_profile_role('e1000000-0000-4000-8000-000000000001','admin');
create function pg_temp.login(n integer) returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub','e1000000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated')::text,true)$$;
create function pg_temp.document(scope text,eligible jsonb default '[]') returns jsonb language sql as $$
 select jsonb_build_object('scope',scope,'countryCode','SG','countryLabel','Singapore','ink','vermilion','localityId',case when scope='locality' then (select locality_id from public.shops where id='00000000-0000-4000-8000-000000000301') end,'eligibleShopIds',eligible)
$$;
create function pg_temp.write_seal(scope text,action text,d jsonb default null) returns jsonb language sql as $$
 select public.admin_geographic_seals(action,s.id,s.revision,d) from public.geographic_seals s where s.scope=write_seal.scope
$$;
-- Test helper must read private definition revisions as the database operator.
create function pg_temp.visit(shop integer, stamp integer, day integer, uid integer default 2) returns void language sql as $$
 insert into public.stamp_collections(user_id,stamp_id,shop_id,stamp_design_version,collected_at,shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
 select ('e1000000-0000-4000-8000-'||lpad(uid::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad(stamp::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad(shop::text,12,'0'))::uuid,1,
 '2026-09-01T00:00:00Z'::timestamptz+make_interval(days=>day),'Asia/Singapore','geofence',1,'Synthetic visit',
 '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
 jsonb_build_object('id','00000000-0000-4000-8000-'||lpad(stamp::text,12,'0'),'designVersion',1,'artworkKind','generated_template','ink',case when stamp=602 then 'indigo' else 'teal' end,'paletteVersion',1,'templateData',jsonb_build_object('tier','shop','motif',case when stamp=602 then 'counter' else 'storefront' end));
$$;
select ok(not has_table_privilege('authenticated','public.geographic_seal_awards','INSERT'),'browser cannot award');
select ok(not has_table_privilege('service_role','public.geographic_seals','SELECT'),'no service bypass');
select ok(not has_function_privilege('authenticated','public.award_geographic_seal(uuid,uuid)','EXECUTE'),'private award helper');
select ok(not has_function_privilege('anon','public.my_geographic_seals(uuid,uuid[])','EXECUTE'),'anonymous cannot read awards');
select pg_temp.login(2);
set local role authenticated;
select throws_ok($$select public.admin_geographic_seals('list')$$,'42501','Forbidden','ordinary user cannot administer');
reset role;
select pg_temp.login(1);
select lives_ok($$select public.admin_geographic_seals('save',p_document=>pg_temp.document('locality'))$$,'create private locality');
select lives_ok($$select public.admin_geographic_seals('save',p_document=>pg_temp.document('country','["00000000-0000-4000-8000-000000000301"]'))$$,'create private country');
select pg_temp.login(2);
select is(jsonb_array_length(public.my_geographic_seals()->'rows'),0,'private drafts never leak');
select pg_temp.visit(301,601,1);
select is((select count(*)::integer from public.geographic_seal_awards),0,'private definitions award nothing');
select pg_temp.login(1);
select lives_ok($$select pg_temp.write_seal('locality','publish')$$,'publish locality');
select lives_ok($$select pg_temp.write_seal('country','publish')$$,'publish small country set');
select pg_temp.login(2);
select is(jsonb_array_length(public.my_geographic_seals()->'rows'),2,'city-state exposes both scopes');
select is((select count(*)::integer from public.geographic_seal_awards),1,'past sole-set visit earns country but locality still needs two');
select is((select count(*)::integer from public.geographic_seal_awards a join public.geographic_seals d on a.seal_id=d.id where d.scope='locality'),0,'catalogue size never creates sole-shop exception');
select is((select count(*)::integer from public.geographic_seal_awards),1,'read retry is idempotent');
-- Any second distinct historical shop in locality counts, independently of country small-set membership.
select pg_temp.visit(302,602,2);
select is((select count(*)::integer from public.geographic_seal_awards),2,'second shop awards locality automatically');
select is((select (r->'award'->>'earnedOn') from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'->'snapshot'->>'scope'='locality'),'2026-09-03','earned date is qualifying visit local date');
select lives_ok($$select public.my_geographic_seals()$$,'reconciliation repeat');
select is((select count(*)::integer from public.geographic_seal_awards),2,'no duplicate award');
select pg_temp.login(3);
select is((select count(*)::integer from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'<>'null'),0,'another owner sees no awards');
select pg_temp.login(1);
select pg_temp.write_seal('locality','save',pg_temp.document('locality','["00000000-0000-4000-8000-000000000301"]')||'{"ink":"teal"}');
select pg_temp.write_seal('locality','publish');
select is((select count(*)::integer from public.geographic_seal_versions where snapshot->>'scope'='locality'),2,'new published artwork is new immutable version');
select pg_temp.login(2);
select is((select r->'award'->'snapshot'->>'ink' from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'->'snapshot'->>'scope'='locality'),'vermilion','collector keeps original artwork');
select pg_temp.login(3);
select pg_temp.visit(301,601,4,3);
select is((select r->'award'->'snapshot'->>'ink' from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'award'->'snapshot'->>'scope'='locality'),'teal','future collector receives new design under explicit sole-set rule');
select pg_temp.login(1);
select throws_ok($$select public.admin_geographic_seals('unpublish',(select id from public.geographic_seals limit 1),'00000000-0000-4000-8000-000000000099')$$,'40001','Reload changed seal','stale editor conflicts');
select pg_temp.write_seal('locality','unpublish');
select pg_temp.write_seal('country','unpublish');
select pg_temp.login(2);
select is(jsonb_array_length(public.my_geographic_seals()->'rows'),2,'unpublication preserves history');
select is((select count(*)::integer from jsonb_array_elements(public.my_geographic_seals()->'rows') r where r->'current'<>'null'),0,'unpublished settings not exposed');
select public.my_geographic_seals(p_ack=>array(select id from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000002'));
select is((select count(*)::integer from jsonb_array_elements(public.my_geographic_seals()->'rows') r where (r->'award'->>'unseen')::boolean),0,'durable grouped notification acknowledgement');
select throws_ok($$update public.geographic_seal_awards set version=1$$,'42501','Audit history is append-only','award cannot be rewritten');
select throws_ok($$update public.geographic_seal_versions set snapshot='{}'$$,'42501','Audit history is append-only','published artwork cannot be rewritten');
select ok(exists(select 1 from public.admin_audit_log where entity_type='geographic_seals' and entity_id is not null),'definition writes audited');
select ok(exists(select 1 from public.admin_audit_log where entity_type='geographic_seal_versions' and entity_id is not null),'publication versions audited');

-- Exact cookie role path and receipt ownership (not just operator impersonation).
select pg_temp.login(3);
set local role authenticated;
select lives_ok($$select public.my_geographic_seals()$$,'authenticated owner RPC works with forced RLS');
reset role;
select pg_temp.login(2);
select set_config('test.foreign_awards',(select array_agg(id)::text from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000003'),true);
set local role authenticated;
select public.my_geographic_seals(p_ack=>current_setting('test.foreign_awards')::uuid[]);
reset role;
select is((select count(*)::integer from public.geographic_seal_receipts r join public.geographic_seal_awards a on a.id=r.award_id where a.user_id='e1000000-0000-4000-8000-000000000003'),0,'foreign unacknowledged awards cannot be acknowledged');
-- Any five is independent of an incomplete explicit set; duplicate editions count once.
insert into public.shops select (jsonb_populate_record(null::public.shops,to_jsonb(s)||jsonb_build_object(
 'id','00000000-0000-4000-8000-'||lpad(n::text,12,'0'),'slug','synthetic-seal-'||n,'name','Synthetic seal shop '||n))).*
 from public.shops s cross join generate_series(311,315) n where s.id='00000000-0000-4000-8000-000000000301';
insert into public.stamps(id,shop_id,name) select ('00000000-0000-4000-8000-'||lpad((n+300)::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Synthetic seal stamp '||n from generate_series(311,315) n;
insert into public.stamp_artwork_versions select (jsonb_populate_record(null::public.stamp_artwork_versions,to_jsonb(v)||jsonb_build_object(
 'id','00000000-0000-4000-8000-'||lpad((n+400)::text,12,'0'),'stamp_id','00000000-0000-4000-8000-'||lpad((n+300)::text,12,'0')))).*
 from public.stamp_artwork_versions v cross join generate_series(311,315) n where v.id='00000000-0000-4000-8000-000000000701';
update public.stamps set status='active',current_design_version=1 where id in (select ('00000000-0000-4000-8000-'||lpad((n+300)::text,12,'0'))::uuid from generate_series(311,315) n);
select pg_temp.login(1);
select pg_temp.write_seal('country','save',pg_temp.document('country','["00000000-0000-4000-8000-000000000315"]'));
select pg_temp.write_seal('country','publish');
select pg_temp.visit(311,611,5,1);
select pg_temp.visit(312,612,6,1);
select pg_temp.visit(313,613,7,1);
select pg_temp.visit(314,614,8,1);
select is((select count(*)::integer from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000001'),0,'four visits outside the eligible set do not earn country');
insert into public.stamps(id,shop_id,name) values('00000000-0000-4000-8000-000000000616','00000000-0000-4000-8000-000000000311','Synthetic second edition');
insert into public.stamp_artwork_versions select (jsonb_populate_record(null::public.stamp_artwork_versions,to_jsonb(v)||'{"id":"00000000-0000-4000-8000-000000000716","stamp_id":"00000000-0000-4000-8000-000000000616"}')).* from public.stamp_artwork_versions v where v.id='00000000-0000-4000-8000-000000000701';
update public.stamps set status='retired' where id='00000000-0000-4000-8000-000000000611';
update public.stamps set status='active',current_design_version=1 where id='00000000-0000-4000-8000-000000000616';
select pg_temp.visit(311,616,8,1);
select is((select count(*)::integer from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000001'),0,'another edition of same shop does not count as a fifth shop');
select pg_temp.visit(302,602,9,1);
select is((select count(*)::integer from public.geographic_seal_awards where user_id='e1000000-0000-4000-8000-000000000001'),1,'five distinct shops earn country despite incomplete set');
select pg_temp.write_seal('country','publish');
select is((select count(*)::integer from public.geographic_seal_versions where snapshot->>'scope'='country'),2,'identical republish reuses version');
-- Uppercase UUIDs normalize before published membership comparisons.
insert into public.shops select (jsonb_populate_record(null::public.shops,to_jsonb(s)||'{"id":"aaaaaaaa-0000-4000-8000-000000000315","slug":"synthetic-uppercase-seal","name":"Synthetic uppercase seal shop"}')).* from public.shops s where s.id='00000000-0000-4000-8000-000000000301';
select pg_temp.write_seal('country','save',pg_temp.document('country','["AAAAAAAA-0000-4000-8000-000000000315"]'));
select is((select draft#>>'{eligibleShopIds,0}' from public.geographic_seals where scope='country'),'aaaaaaaa-0000-4000-8000-000000000315','membership UUID normalized');
select pg_temp.write_seal('country','publish');
select lives_ok($$select public.my_geographic_seals()$$,'normalized published membership remains readable');
select * from finish();
rollback;
