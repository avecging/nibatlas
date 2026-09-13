begin;
select no_plan();
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.media_uploads'::regclass),'media manifests force RLS');
select ok(not has_table_privilege('anon','public.media_uploads','SELECT'),'anonymous cannot read pending metadata');
select ok(not has_table_privilege('authenticated','public.media_uploads','SELECT'),'browser cannot read pending metadata directly');
select ok(not has_table_privilege('service_role','public.media_uploads','INSERT'),'service cannot bypass checked manifest writes');
select ok(not has_function_privilege('authenticated','public.media_upload_operation(uuid,text,text,uuid,jsonb)','EXECUTE'),'browser cannot attest validated bytes');
select ok(not has_function_privilege('anon','public.media_upload_operation(uuid,text,text,uuid,jsonb)','EXECUTE'),'anonymous cannot initiate');
select ok(has_function_privilege('service_role','public.media_upload_operation(uuid,text,text,uuid,jsonb)','EXECUTE'),'isolated Worker can call media boundary');
insert into auth.users(id) values('62000000-0000-4000-8000-000000000001'),('62000000-0000-4000-8000-000000000002'),('62000000-0000-4000-8000-000000000003');
select public.assign_profile_role('62000000-0000-4000-8000-000000000002','editor');
select public.assign_profile_role('62000000-0000-4000-8000-000000000003','admin');
insert into public.stamp_artwork_versions(id,stamp_id,design_version,artwork_kind,ink,palette_version,rights_basis,illustrator_credit)
values('62000000-0000-4000-8000-000000000070','00000000-0000-4000-8000-000000000601',2,'commissioned','teal',1,'Test commission permission','Test illustrator');
insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('62000000-0000-4000-8000-000000000081','62000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',1,'Asia/Singapore','geofence',1,'Historical shop',
'{"countryCode":"SG","countryLabel":"Singapore","localityName":"Historical locality","localitySlug":"singapore"}',
'{"id":"00000000-0000-4000-8000-000000000601","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}');
create temp table media_checks(k text primary key,v jsonb);
insert into media_checks values
('art',(select jsonb_agg(to_jsonb(a) order by id) from public.stamp_artwork_versions a)),
('collections',(select jsonb_agg(to_jsonb(c) order by id) from public.stamp_collections c));
create function pg_temp.photo() returns jsonb language sql as $$select jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301','purpose','shop_photo','sha256',repeat('a',64),'byteSize',100,'contentType','image/png','sourceRef','Founder original','rightsBasis','Photographer permission','creditText','Photographer','altText','Test entrance')$$;
create function pg_temp.media(action text,id uuid,payload jsonb default '{}',actor uuid default '62000000-0000-4000-8000-000000000002',env text default 'staging')
returns jsonb language sql as $$select public.media_upload_operation(actor,env,action,id,payload)$$;
set local role authenticated;
select throws_ok($$select pg_temp.media('initiate','62000000-0000-4000-8000-000000000090',pg_temp.photo())$$,'42501','permission denied for function media_upload_operation','direct browser call cannot bypass validation');
set local role service_role;
select throws_ok($$select pg_temp.media('initiate','62000000-0000-4000-8000-000000000090',pg_temp.photo(),'62000000-0000-4000-8000-000000000001')$$,'42501','Admin access denied','ordinary actor rejected inside transaction');
select is(pg_temp.media('initiate','62000000-0000-4000-8000-000000000090',pg_temp.photo())->>'status','pending','editor initiates private photo transport');
select is(pg_temp.media('read','62000000-0000-4000-8000-000000000090')->>'storageKey','staging/media/62000000-0000-4000-8000-000000000090/v1/'||repeat('a',64)||'.png','stable versioned key generated server-side');
select ok(not (pg_temp.media('read','62000000-0000-4000-8000-000000000090') ? 'rightsBasis'),'service response excludes agreement text');
select throws_ok($$select pg_temp.media('read','62000000-0000-4000-8000-000000000090','{}','62000000-0000-4000-8000-000000000003')$$,'P0002','Upload not found','other admin does not acquire uploader session');
select throws_ok($$select pg_temp.media('read','62000000-0000-4000-8000-000000000090','{}','62000000-0000-4000-8000-000000000002','production')$$,'P0002','Upload not found','wrong environment denied');
select throws_ok($$select pg_temp.media('initiate','62000000-0000-4000-8000-000000000091',pg_temp.photo(),'62000000-0000-4000-8000-000000000002','production')$$,'22023','Invalid media target','production rejects demo targets');
select throws_ok($$select pg_temp.media('initiate','62000000-0000-4000-8000-000000000091',pg_temp.photo()||'{"byteSize":1.5}')$$,'22023','Invalid media size','fractional sizes rejected');
select throws_ok($$select pg_temp.media('initiate','62000000-0000-4000-8000-000000000091',pg_temp.photo()||'{"storageKey":"override"}')$$,'22023','Invalid catalogue data','object key cannot be supplied');
select throws_ok($$select pg_temp.media('finalize','62000000-0000-4000-8000-000000000090',jsonb_build_object('sha256',repeat('b',64),'byteSize',100,'width',2,'height',2))$$,'22023','Upload mismatch','checksum mismatch cannot finalize');
select is(pg_temp.media('read','62000000-0000-4000-8000-000000000090')->>'status','pending','failed finalization leaves pending state');
select is(pg_temp.media('finalize','62000000-0000-4000-8000-000000000090',jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',2,'height',2))->>'status','validated','server attestation finalizes transport only');
select is(pg_temp.media('finalize','62000000-0000-4000-8000-000000000090')->>'status','validated','finalization retry is idempotent');
select is(pg_temp.media('initiate','62000000-0000-4000-8000-000000000092',(pg_temp.photo()-array['rightsBasis','creditText'])||'{"purpose":"artwork_png","artworkVersionId":"62000000-0000-4000-8000-000000000070"}')->>'status','pending','commissioned draft reuses existing rights and credit');
select throws_ok($$select pg_temp.media('initiate','62000000-0000-4000-8000-000000000093',(pg_temp.photo()-array['rightsBasis','creditText'])||'{"purpose":"artwork_png","artworkVersionId":"00000000-0000-4000-8000-000000000701"}')$$,'22023','Invalid media target','approved version cannot be an upload target');
select is(pg_temp.media('finalize','62000000-0000-4000-8000-000000000092',jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',1200,'height',800))->>'status','validated','artwork transport completes without approval or attachment');
reset role;
select is((select count(*)::int from public.admin_audit_log where entity_type='media_uploads'),4,'only successful initiation/finalization audited; retries and failures add no events');
select ok((select bool_and(actor_user_id='62000000-0000-4000-8000-000000000002' and actor_kind='account' and before_summary-array['fingerprint']='{}'::jsonb and after_summary-array['fingerprint']='{}'::jsonb) from public.admin_audit_log where entity_type='media_uploads'),'audit attributes actor with fingerprints only');
select is((select jsonb_agg(to_jsonb(a) order by id) from public.stamp_artwork_versions a),(select v from media_checks where k='art'),'all artwork versions are unchanged');
select is((select jsonb_agg(to_jsonb(c) order by id) from public.stamp_collections c),(select v from media_checks where k='collections'),'historical impression bytes remain unchanged');
select is((select count(*)::int from public.shop_images),0,'transport validation does not create or publish shop imagery');
select throws_ok($$update public.media_uploads set width=3 where id='62000000-0000-4000-8000-000000000090'$$,'42501','Validated upload is immutable','validated metadata cannot be replaced');
select throws_ok($$delete from public.media_uploads where id='62000000-0000-4000-8000-000000000090'$$,'42501','Validated upload is immutable','validated identity cannot be deleted');
select throws_ok('truncate public.media_uploads','42501','Catalogue truncation is forbidden; use audited row operations','no unaudited truncate');
select public.assign_profile_role('62000000-0000-4000-8000-000000000002','user');
set local role service_role;
select throws_ok($$select pg_temp.media('read','62000000-0000-4000-8000-000000000090')$$,'42501','Admin access denied','revocation blocks metadata reads');
select throws_ok($$select pg_temp.media('finalize','62000000-0000-4000-8000-000000000090')$$,'42501','Admin access denied','revocation blocks even idempotent finalization');
reset role;
select public.assign_profile_role('62000000-0000-4000-8000-000000000002','editor');
select pg_temp.media('initiate','62000000-0000-4000-8000-000000000094',pg_temp.photo());
update public.media_uploads set expires_at=statement_timestamp()-interval '1 minute' where id='62000000-0000-4000-8000-000000000094';
set local role service_role;
select throws_ok($$select pg_temp.media('finalize','62000000-0000-4000-8000-000000000094',jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',2,'height',2))$$,'22023','Upload expired','expired upload cannot finalize');
reset role;
select * from finish();
rollback;
