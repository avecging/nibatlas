begin;
select no_plan();
insert into auth.users(id) values('73000000-0000-4000-8000-000000000001'),('73000000-0000-4000-8000-000000000002');
select public.assign_profile_role('73000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('73000000-0000-4000-8000-000000000002','editor');
create temp table before_media as select
 (select jsonb_agg(to_jsonb(a) order by id) from public.stamp_artwork_versions a) art,
 (select jsonb_agg(to_jsonb(c) order by id) from public.stamp_collections c) collections;
-- Seeded shop is normally demo; this test-only change permits both environments.
update public.shops set source_quality='sourced' where id='00000000-0000-4000-8000-000000000301';
create function pg_temp.upload(n int,purpose text default 'shop_photo',env text default 'staging',actor uuid default '73000000-0000-4000-8000-000000000001')
returns uuid language plpgsql as $$ declare id uuid:=('73000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; begin
 perform public.media_upload_operation(actor,env,'initiate',id,jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301','purpose',purpose,'sha256',repeat('a',64),'byteSize',100,'contentType','image/png'));
 return id;
end; $$;
create function pg_temp.finalize(id uuid,env text default 'staging',actor uuid default '73000000-0000-4000-8000-000000000001')
returns jsonb language sql as $$ select public.media_upload_operation(actor,env,'finalize',id,jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',2,'height',2)) $$;
create function pg_temp.op(action text,id uuid default null,env text default 'staging',actor uuid default '73000000-0000-4000-8000-000000000001',revision text default null)
returns jsonb language sql as $$ select public.shop_media_operation(actor,env,'00000000-0000-4000-8000-000000000301',action,id,revision) $$;
create function pg_temp.image(n int) returns uuid language sql as $$ select id from public.shop_images where upload_id=('73000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.publish(n int,env text default 'staging') returns jsonb language sql as $$
 select pg_temp.op('publish',pg_temp.image(n),env,revision=>(select md5(to_jsonb(i)::text) from public.shop_images i where id=pg_temp.image(n))) $$;
select ok(not has_table_privilege('authenticated','public.shop_images','SELECT'),'no direct private image reads');
select ok(not has_table_privilege('service_role','public.shop_images','INSERT'),'service cannot bypass attachment RPC');
select ok(not has_function_privilege('authenticated','public.shop_media_operation(uuid,text,uuid,text,uuid,text)','EXECUTE'),'browser cannot attest actor');
select lives_ok($$select pg_temp.upload(10)$$,'photo upload requires no paperwork');
select ok((select source_ref is null and rights_basis is null and credit_text is null and alt_text is null from public.media_uploads where id='73000000-0000-4000-8000-000000000010'),'omitted metadata remains null, never fabricated');
select throws_ok($$select pg_temp.op('attach','73000000-0000-4000-8000-000000000010')$$,'22023','Invalid media target','pending receipt cannot attach');
select pg_temp.finalize('73000000-0000-4000-8000-000000000010');
select throws_ok($$select pg_temp.op('attach','73000000-0000-4000-8000-000000000010',actor=>'73000000-0000-4000-8000-000000000002')$$,'22023','Invalid media target','another editor cannot attach uploader receipt');
select throws_ok($$select public.shop_media_operation('73000000-0000-4000-8000-000000000001','staging','00000000-0000-4000-8000-000000000302','attach','73000000-0000-4000-8000-000000000010')$$,'22023','Invalid media target','cannot attach to a different shop');
select is(jsonb_array_length(pg_temp.op('attach','73000000-0000-4000-8000-000000000010')),1,'validated photo attaches privately');
select is(jsonb_array_length(pg_temp.op('attach','73000000-0000-4000-8000-000000000010')),1,'retry does not duplicate attachment');
select is((select count(*)::int from public.admin_audit_log where entity_type='shop_images'),1,'idempotent attachment adds one audit event');
select is(jsonb_array_length(pg_temp.op('public_list')),0,'unpublished image excluded');
select throws_ok($$select pg_temp.op('public_file',pg_temp.image(10))$$,'P0002','Media not found','draft bytes are private');
select ok(pg_temp.op('preview',pg_temp.image(10)) ? 'storageKey','authorized private preview resolves key only in service RPC');
select throws_ok($$select pg_temp.op('publish',pg_temp.image(10),actor=>'73000000-0000-4000-8000-000000000002',revision=>repeat('a',32))$$,'42501','Admin access denied','editor cannot publish');
select throws_ok($$select pg_temp.op('publish',pg_temp.image(10),revision=>repeat('a',32))$$,'40001','Media changed; reload','stale revision conflicts');
select lives_ok($$select pg_temp.publish(10)$$,'admin publishes without paperwork');
select is(jsonb_array_length(pg_temp.op('public_list')),1,'published image is public');
select ok((pg_temp.op('public_list')->0) - array['id','kind','width','height','altText','creditText','sortOrder','caption']='{}'::jsonb,'public list excludes key, source, rights, revision and private status');
select is(pg_temp.op('public_list')->0->>'altText',(select 'Photo of '||name from public.shops where id='00000000-0000-4000-8000-000000000301'),'truthful fallback derived from shop name');
select throws_ok($$select pg_temp.op('public_file',pg_temp.image(10),'production')$$,'P0002','Media not found','wrong environment cannot deliver bytes');
select throws_ok($$update public.shop_images set storage_key='replacement' where id=pg_temp.image(10)$$,'42501','Attached media identity is immutable','cannot overwrite attached bytes');
select throws_ok($$delete from public.shop_images where id=pg_temp.image(10)$$,'42501','Attached media identity is immutable','no attachment deletion');
select pg_temp.finalize(pg_temp.upload(11,'shop_logo'));
select pg_temp.op('attach','73000000-0000-4000-8000-000000000011');
select pg_temp.publish(11);
select pg_temp.finalize(pg_temp.upload(12,'shop_logo','production'),'production');
select pg_temp.op('attach','73000000-0000-4000-8000-000000000012','production');
select pg_temp.publish(12,'production');
select is((select moderation_status::text from public.shop_images where id=pg_temp.image(11)),'approved','production logo does not hide staging logo');
select pg_temp.finalize(pg_temp.upload(13,'shop_logo'));
select pg_temp.op('attach','73000000-0000-4000-8000-000000000013');
select pg_temp.publish(13);
select is((select moderation_status::text from public.shop_images where id=pg_temp.image(11)),'draft','new staging logo hides former staging logo');
select is((select moderation_status::text from public.shop_images where id=pg_temp.image(12)),'approved','staging replacement preserves production logo');
select ok((select count(*)=4 from public.shop_images),'replaced artwork stays attached');
select pg_temp.op('hide',pg_temp.image(10),revision=>(select md5(to_jsonb(i)::text) from public.shop_images i where id=pg_temp.image(10)));
select throws_ok($$select pg_temp.op('public_file',pg_temp.image(10))$$,'P0002','Media not found','hide removes public delivery');
update public.shops set publication_status='archived' where id='00000000-0000-4000-8000-000000000301';
select throws_ok($$select pg_temp.op('public_list')$$,'P0002','Media not found','archived shop hides even approved media');
select throws_ok($$select pg_temp.publish(13)$$,'22023','Invalid media target','archived target rejects new publication');
select public.assign_profile_role('73000000-0000-4000-8000-000000000001','user');
select throws_ok($$select pg_temp.op('preview',pg_temp.image(13))$$,'42501','Admin access denied','live revocation blocks private bytes');
select ok((select bool_and(actor_user_id='73000000-0000-4000-8000-000000000001' and actor_kind='account' and before_summary-array['fingerprint']='{}'::jsonb and after_summary-array['fingerprint']='{}'::jsonb) from public.admin_audit_log where entity_type='shop_images'),'media audit records verified actor and fingerprints only');
select is((select jsonb_agg(to_jsonb(a) order by id) from public.stamp_artwork_versions a),(select art from before_media),'stamp versions untouched');
select is((select jsonb_agg(to_jsonb(c) order by id) from public.stamp_collections c),(select collections from before_media),'impressions untouched');
select * from finish();
rollback;
