begin;
select no_plan();
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.shop_working_copies'::regclass),'working copies force RLS');
select ok(not has_table_privilege('anon','public.shop_working_copies','SELECT'),'anonymous cannot read drafts');
select ok(not has_table_privilege('authenticated','public.shop_working_copies','SELECT'),'accounts cannot directly read drafts');
select ok(not has_table_privilege('service_role','public.shop_working_copies','SELECT'),'no service bypass for draft reads');
select ok(not has_function_privilege('anon','public.admin_shop_write(text,uuid,text,jsonb)','EXECUTE'),'anonymous cannot invoke writes');
select ok(not has_function_privilege('service_role','public.admin_shop_write(text,uuid,text,jsonb)','EXECUTE'),'service role cannot invoke writes');
select ok(not has_function_privilege('authenticated','public.apply_shop_document(uuid,jsonb)','EXECUTE'),'apply helper cannot bypass role guard');
select ok(not has_function_privilege('authenticated','public.shop_edit_document(uuid)','EXECUTE'),'projection helper is not public');
select ok(not has_function_privilege('authenticated','public.shop_claim_supported(jsonb,text,text)','EXECUTE'),'claim helper has no direct account grant');
select is((select count(*)::int from pg_trigger where tgname='catalogue_no_truncate' and not tgisinternal),10,'every audited catalogue table rejects truncation');
select throws_ok('truncate public.shop_links','42501','Catalogue truncation is forbidden; use audited row operations','database operator cannot silently truncate catalogue links');
insert into auth.users(id) values('61000000-0000-4000-8000-000000000001'),('61000000-0000-4000-8000-000000000002'),('61000000-0000-4000-8000-000000000003');
select public.assign_profile_role('61000000-0000-4000-8000-000000000002','editor');
select public.assign_profile_role('61000000-0000-4000-8000-000000000003','admin');
-- Snapshot setup is database-owner test work, never a browser capability.
insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('61000000-0000-4000-8000-000000000081','61000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',1,'Asia/Singapore','geofence',1,'Historical shop name',
'{"countryCode":"SG","countryLabel":"Singapore","localityName":"Historical locality","localitySlug":"singapore"}',
'{"id":"00000000-0000-4000-8000-000000000601","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}');
create temp table checks(key text primary key,value jsonb);
grant all on checks to authenticated;
insert into checks values('history',(select to_jsonb(c) from public.stamp_collections c where id='61000000-0000-4000-8000-000000000081'));
create function pg_temp.change(action text, shop uuid, document jsonb default null) returns jsonb language sql as $$
 select public.admin_shop_write(action,shop,public.admin_shop_read(shop)->>'revision',document);
$$;
create function pg_temp.publication_code(d jsonb) returns text language plpgsql as $$
begin
  perform pg_temp.change('save','00000000-0000-4000-8000-000000000301',d);
  return pg_temp.change('publish','00000000-0000-4000-8000-000000000301')->>'code';
end; $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"admin"}}',true);
select throws_ok('select public.admin_shop_list()','42501','Admin access denied','ordinary user cannot list drafts');
select throws_ok('select public.admin_shop_options()','42501','Admin access denied','ordinary user cannot read private options');
select throws_ok($$select public.admin_shop_read('00000000-0000-4000-8000-000000000303')$$,'42501','Admin access denied','ordinary user cannot preview a known draft ID');
select throws_ok($$select public.admin_shop_write('create','61000000-0000-4000-8000-000000000090',null,'{"name":"Demo","slug":"private-demo"}')$$,'42501','Admin access denied','ordinary user cannot create with spoofed role');
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is(public.admin_shop_write('create','61000000-0000-4000-8000-000000000090',null,'{"name":"Explicit test draft","slug":"private-demo"}')->>'publicationStatus','draft','editor creates a private draft');
select is(public.admin_shop_read('61000000-0000-4000-8000-000000000090')->'document'->'shop'->>'latitude',null,'unknown coordinate is not invented');
select is(public.admin_shop_read('61000000-0000-4000-8000-000000000090')->'document'->'shop'->>'last_verified_at',null,'unknown review date is not invented');
select is(public.shop_detail('private-demo'),null,'draft detail is hidden');
select is(public.search_shops('Explicit test draft')->'shops','[]'::jsonb,'draft search is hidden');
select is(pg_temp.change('publish','61000000-0000-4000-8000-000000000090')->>'code','publication_incomplete','incomplete draft cannot publish');
insert into checks values('new_doc',public.admin_shop_read('61000000-0000-4000-8000-000000000090')->'document');
select throws_ok($$select pg_temp.change('save','61000000-0000-4000-8000-000000000090',jsonb_set((select value from checks where key='new_doc'),'{shop,latitude}','91'))$$,'22023','Invalid catalogue data','invalid coordinates rejected');
select throws_ok($$select pg_temp.change('save','61000000-0000-4000-8000-000000000090',jsonb_set((select value from checks where key='new_doc'),'{shop,last_verified_at}','"2999-01-01"'))$$,'22023','Invalid catalogue date','future verification dates rejected');
select throws_ok($$select pg_temp.change('save','61000000-0000-4000-8000-000000000090',jsonb_set((select value from checks where key='new_doc'),'{shop,website_url}','"javascript:alert(1)"'))$$,'22023','Invalid catalogue URL','unsafe links rejected');
select throws_ok($$select pg_temp.change('save','61000000-0000-4000-8000-000000000090',jsonb_set((select value from checks where key='new_doc'),'{shop,publication_status}','"published"'))$$,'22023','Invalid catalogue data','publication field cannot bypass transition');
select throws_ok($$select pg_temp.change('temporarily_closed','61000000-0000-4000-8000-000000000090')$$,'22023','Invalid status transition','lifecycle status operation requires publication');
-- Published edits are a separate private working copy.
insert into checks values('original',public.admin_shop_read('00000000-0000-4000-8000-000000000301'));
select is(pg_temp.publication_code(jsonb_set((select value->'document' from checks where key='original'),'{shop,address_line_1}','"Unsupported address"')),'publication_incomplete','an unrelated source cannot publish an address');
select is(pg_temp.publication_code(jsonb_set((select value->'document' from checks where key='original'),'{shop,opening_hours}','{"entries":[{"day":"monday","opens":"09:00","closes":"17:00"}]}')),'publication_incomplete','a source for another fact cannot publish opening hours');
select is(pg_temp.publication_code(jsonb_set((select value->'document' from checks where key='original'),'{sources,0,claims}','[]')),'publication_incomplete','an empty claims list cannot publish public facts');
select is(pg_temp.publication_code(jsonb_set((select value->'document' from checks where key='original'),'{sources,0,status}','"stale"')),'publication_incomplete','stale evidence cannot satisfy publication');
select is(public.shop_detail('m2-singapore-demo-fixture')->>'addressLines',null,'failed publication leaves unsupported address private');
select is(pg_temp.publication_code(jsonb_set(jsonb_set(jsonb_set(
(select value->'document' from checks where key='original'),'{shop,address_line_1}','"Explicit demo address"'),
'{shop,opening_hours}','{"entries":[{"day":"monday","opens":"09:00","closes":"17:00"}]}'),
'{sources,0,claims}',(select value->'document'->'sources'->0->'claims' from checks where key='original') || '["  ADDRESS  "," opening   HOURS "]')),
null,'matching active source tokens allow publication with case and whitespace normalization');

update checks set value=public.admin_shop_read('00000000-0000-4000-8000-000000000301') where key='original';
select lives_ok($$select pg_temp.change('save','00000000-0000-4000-8000-000000000301',jsonb_set((select value->'document' from checks where key='original'),'{shop,name}','"Private revised demo name"'))$$,'save unpublished changes');
select is(public.shop_detail('m2-singapore-demo-fixture')->>'name','M2 Singapore Demo Fixture','public detail keeps old name before publication');
select is(public.admin_shop_read('00000000-0000-4000-8000-000000000301')->'document'->'shop'->>'name','Private revised demo name','authorized preview sees saved name');
select throws_ok($$select public.admin_shop_write('save','00000000-0000-4000-8000-000000000301',(select value->>'revision' from checks where key='original'),(select value->'document' from checks where key='original'))$$,'40001','Revision conflict','stale save cannot overwrite another session');
select throws_ok($$select pg_temp.change('archive','00000000-0000-4000-8000-000000000301')$$,'22023','Publish or discard saved changes first','archive never silently discards changes');
select throws_ok($$select pg_temp.change('save','00000000-0000-4000-8000-000000000301',jsonb_set((select value->'document' from checks where key='original'),'{shop,source_quality}','"verified"'))$$,'22023','Demo identity is permanent','demo cannot be relabelled as verified');
select lives_ok($$select pg_temp.change('publish','00000000-0000-4000-8000-000000000301')$$,'publish valid saved changes');
select is(public.shop_detail('m2-singapore-demo-fixture')->>'name','Private revised demo name','publication makes new name public');
select is(public.admin_shop_read('00000000-0000-4000-8000-000000000301')->>'hasChanges','false','published working copy is cleared');
select lives_ok($$select pg_temp.change('temporarily_closed','00000000-0000-4000-8000-000000000301')$$,'temporary closure works');
select is(public.shop_detail('m2-singapore-demo-fixture')->>'operationalStatus','temporarily_closed','temporary closure remains visible and honest');
select lives_ok($$select pg_temp.change('open','00000000-0000-4000-8000-000000000301')$$,'confirmed reopening works');
select lives_ok($$select pg_temp.change('permanently_closed','00000000-0000-4000-8000-000000000301')$$,'permanent closure works');
select is(public.shop_detail('m2-singapore-demo-fixture')->>'operationalStatus','permanently_closed','permanent closure retains public detail');
select lives_ok($$select pg_temp.change('archive','00000000-0000-4000-8000-000000000301')$$,'archive works');
select is(public.shop_detail('m2-singapore-demo-fixture'),null,'archived public detail is hidden');
select is(public.search_shops('Private revised demo name')->'shops','[]'::jsonb,'archived shop is absent from search');
select is(public.list_stamp_collections()->0->>'shopName','Historical shop name','collected historical name unchanged');
select is(public.list_stamp_collections()->0->>'shopSlug',null,'archived collection no longer links to public shop');
select throws_ok($$select pg_temp.change('publish','00000000-0000-4000-8000-000000000301')$$,'22023','Archived shop is read-only','archive is terminal in this interface');
select throws_ok('select public.list_admin_audit()','42501','Admin access denied','editor still cannot read account audit history');
reset role;
select is((select to_jsonb(c) from public.stamp_collections c where id='61000000-0000-4000-8000-000000000081'),(select value from checks where key='history'),'all impression fields and snapshots are byte-for-byte unchanged');
select ok(exists(select 1 from public.admin_audit_log where entity_type='shops' and entity_id='00000000-0000-4000-8000-000000000301' and before_summary->>'publicationStatus'='published' and after_summary->>'publicationStatus'='archived' and actor_user_id='61000000-0000-4000-8000-000000000002'),'archive records current account, before and after atomically');
select ok(not exists(select 1 from public.admin_audit_log where entity_type<>'profile' and (before_summary::text||after_summary::text) like '%Private revised%'),'audit summaries contain no freeform facts');
select ok(exists(select 1 from public.admin_audit_log where entity_type='shop_working_copies'),'private saved changes audited');
-- Creation now supplies the approved system default without operator artwork setup.
select is((select count(*)::int from public.stamps where shop_id='61000000-0000-4000-8000-000000000090' and status='active'),1,
  'new draft has exactly one active generated default before publication');
set local role authenticated;
select lives_ok($new$select pg_temp.change('save','61000000-0000-4000-8000-000000000090',
jsonb_set(jsonb_set(jsonb_set((select value from checks where key='new_doc'),'{shop}',
(select value->'shop' from checks where key='new_doc') || '{"country_code":"SG","locality_id":"00000000-0000-4000-8000-000000000201","timezone":"Asia/Singapore","latitude":1.3,"longitude":103.8,"source_quality":"demo"}'),
'{sources}','[{"id":"61000000-0000-4000-8000-000000000092","label":"Explicit demo fixture","source_type":"demo_fixture","checked_at":"2026-09-01","reliability":"unknown","status":"active","claims":["Name","Location","Shop type: Fountain Pen Specialist","Shop type: Stationery Store"]}]'),
'{types}','[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":true}]'))$new$,'save valid new draft');
select lives_ok($$select pg_temp.change('publish','61000000-0000-4000-8000-000000000090')$$,'publish new shop once approved stamp exists');
select is(public.shop_detail('private-demo')->>'name','Explicit test draft','new valid shop becomes public');
select lives_ok($$select pg_temp.change('save','61000000-0000-4000-8000-000000000090',jsonb_set(public.admin_shop_read('61000000-0000-4000-8000-000000000090')->'document','{types}',
'[{"shop_type_id":"00000000-0000-4000-8000-000000000102","is_primary":true},{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":false}]'))$$,'save primary type change with successor first');
select lives_ok($$select pg_temp.change('publish','61000000-0000-4000-8000-000000000090')$$,'primary type replacement is independent of array order');
select is(public.shop_detail('private-demo')->>'primaryType','stationery_store','new primary type is projected');
select lives_ok($$select pg_temp.change('save','61000000-0000-4000-8000-000000000090',jsonb_set(public.admin_shop_read('61000000-0000-4000-8000-000000000090')->'document','{shop,name}','"Discard this edit"'))$$,'save another edit');
select lives_ok($$select pg_temp.change('discard','61000000-0000-4000-8000-000000000090')$$,'discard private changes');
select is(public.shop_detail('private-demo')->>'name','Explicit test draft','discard preserves published data');
reset role;
-- Revocation works without refreshing the same cookie/JWT.
select public.assign_profile_role('61000000-0000-4000-8000-000000000002','user');
set local role authenticated;
select throws_ok($$select pg_temp.change('archive','61000000-0000-4000-8000-000000000090')$$,'42501','Admin access denied','revoked editor cannot mutate');
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select pg_temp.change('archive','61000000-0000-4000-8000-000000000090')$$,'admin can archive a published shop');
select ok(jsonb_array_length(public.list_admin_audit())>0,'admin can read both audit event families');
reset role;
set constraints all immediate;
select * from finish();
rollback;
