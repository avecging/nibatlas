begin;
select no_plan();
insert into auth.users(id) values
 ('79000000-0000-4000-8000-000000000001'),
 ('79000000-0000-4000-8000-000000000002');
select public.assign_profile_role('79000000-0000-4000-8000-000000000001','admin');
create temp table before_art as select to_jsonb(a) value from public.stamp_artwork_versions a
 where stamp_id='00000000-0000-4000-8000-000000000601';

create function pg_temp.op(action text,payload jsonb default '{}') returns jsonb language sql as $$
 select public.stamp_artwork_draft_operation('79000000-0000-4000-8000-000000000001','staging',
  '00000000-0000-4000-8000-000000000301',action,payload)
$$;
select throws_ok($$select pg_temp.op('create','{"origin":"founder_created","creatorUrl":"https://example.test/creator","ink":"teal"}')$$,
 '22023','Invalid stamp metadata','a creator link requires a name in the direct SQL boundary');
create temp table version as select (pg_temp.op('create','{"origin":"founder_created","ink":"teal"}')->0->>'id')::uuid id;
select is((select creator_name from public.stamp_artwork_versions where id=(select id from version)),null,'optional credit stays absent');
select is((select creator_url from public.stamp_artwork_versions where id=(select id from version)),null,'no invented link');
select lives_ok($$select public.media_upload_operation('79000000-0000-4000-8000-000000000001','staging','initiate',
 '79000000-0000-4000-8000-000000000010',jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301',
 'artworkVersionId',(select id from version),'purpose','artwork_png','sha256',repeat('a',64),'byteSize',100,'contentType','image/png'))$$,
 'uncredited artwork can use the existing private transport');
select public.media_upload_operation('79000000-0000-4000-8000-000000000001','staging','finalize',
 '79000000-0000-4000-8000-000000000010',jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',1200,'height',800));
select pg_temp.op('attach',jsonb_build_object('versionId',(select id from version),'uploadId','79000000-0000-4000-8000-000000000010'));
select lives_ok($$select pg_temp.op('activate',jsonb_build_object('versionId',(select id from version),'revision',
 (select md5(to_jsonb(a)::text) from public.stamp_artwork_versions a where id=(select id from version))))$$,
 'admin deliberately activates uncredited artwork with a current revision');
select is((select to_jsonb(a) from public.stamp_artwork_versions a where id='00000000-0000-4000-8000-000000000701'),
 (select value from before_art where value->>'id'='00000000-0000-4000-8000-000000000701'),'original approved art and credits remain byte-for-byte unchanged');
select throws_ok($$update public.stamp_artwork_versions set creator_name='Later invention' where id=(select id from version)$$,
 '55000',null,'optional credit does not weaken approved-art immutability');

-- Exercise the same snapshot constraints/authoritative-art trigger used by issuance.
select lives_ok($$insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,
 shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('79000000-0000-4000-8000-000000000020','79000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',2,
 'Asia/Singapore','geofence',1,'Synthetic credit test',
 '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
 jsonb_build_object('id','00000000-0000-4000-8000-000000000601','designVersion',2,'artworkKind','uploaded',
 'artworkOrigin','founder_created','creatorName',null,'creatorUrl',null,'transparentPngSha256',repeat('a',64),'ink','teal','paletteVersion',1))$$,
 'an issued snapshot can truthfully omit creator credit');
set local role authenticated;
select throws_ok($$update public.stamp_collections set stamp_snapshot=stamp_snapshot||'{"creatorName":"Changed"}'
 where id='79000000-0000-4000-8000-000000000020'$$,'42501',null,'historical impressions remain unwritable by accounts');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"79000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is(jsonb_array_length(public.list_stamp_collections()),1,'owner reads the new collection');
select is(public.list_stamp_collections()->0->'stamp'->>'creatorName',null,'owner read keeps credit absent');
reset role;
select ok(not has_function_privilege('authenticated','public.stamp_artwork_draft_operation(uuid,text,uuid,text,jsonb)','EXECUTE'),
 'optional credit never exposes the service actor RPC to browsers');

-- New B1 defaults: no rehashing from a different public slug, no private leakage.
insert into public.shops(id,name,slug,country_code,timezone,location,source_quality)
 values('79000000-0000-4000-8000-000000000030','Synthetic generated default','synthetic-public-generated',
 'SG','Asia/Singapore',extensions.st_setsrid(extensions.st_makepoint(103.8,1.3),4326),'demo');
select public.ensure_shop_generated_default('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000030');
select is(public.shop_detail('synthetic-public-generated'),null,'new default does not publish its private shop');
insert into public.shop_shop_types(shop_id,shop_type_id,is_primary)
 select '79000000-0000-4000-8000-000000000030',shop_type_id,true from public.shop_shop_types
 where shop_id='00000000-0000-4000-8000-000000000301' and is_primary;
-- Operator fixture setup only; catalogue publication lifecycle has its own suite.
update public.shops set publication_status='published' where id='79000000-0000-4000-8000-000000000030';
create temp table stored as select jsonb_build_object('id',st.id,'designVersion',av.design_version,'ink',av.ink,
 'paletteVersion',av.palette_version,'templateData',av.template_data) value
 from public.stamps st join public.stamp_artwork_versions av on av.stamp_id=st.id and av.design_version=st.current_design_version
 where st.shop_id='79000000-0000-4000-8000-000000000030';
grant select on stored to anon;
set local role anon;
select is(public.shop_detail('synthetic-public-generated')->'generatedStamp',(select value from stored),
 'anonymous projection uses only the active approved stored template/ink/identity');
reset role;
update public.shops set name='Renamed synthetic shop',slug='renamed-synthetic-public-generated' where id='79000000-0000-4000-8000-000000000030';
select is(public.shop_detail('renamed-synthetic-public-generated')->'generatedStamp',(select value from stored),
 'even an explicit URL change cannot change stored art');
select ok(not ((public.shop_detail('renamed-synthetic-public-generated')->'generatedStamp') ?| array['approved_at','approval_evidence_ref','creator_name','transparent_png_key']),
 'public artwork allowlist omits private lifecycle/storage fields');
select ok(not (public.shop_detail((select slug from public.shops where id='00000000-0000-4000-8000-000000000301')) ? 'generatedStamp'),
 'active uploaded artwork is not misrepresented as the older generated default');
update public.shops set publication_status='archived' where id='79000000-0000-4000-8000-000000000030';
select is(public.shop_detail('renamed-synthetic-public-generated'),null,'archiving withdraws the entire public projection');
select * from finish();
rollback;
