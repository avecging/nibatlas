begin;
select no_plan();

insert into auth.users(id) values
 ('75000000-0000-4000-8000-000000000001'),
 ('75000000-0000-4000-8000-000000000002'),
 ('75000000-0000-4000-8000-000000000003');
select public.assign_profile_role('75000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('75000000-0000-4000-8000-000000000002','editor');

create function pg_temp.op(actor uuid,action text,payload jsonb default '{}')
returns jsonb language sql as $$
 select public.stamp_artwork_draft_operation(actor,'staging',
  '00000000-0000-4000-8000-000000000301',action,payload)
$$;
create function pg_temp.upload(actor uuid,n int,version_id uuid)
returns uuid language plpgsql as $$
declare uid uuid:=('75000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
begin
 perform public.media_upload_operation(actor,'staging','initiate',uid,
  jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301',
   'artworkVersionId',version_id,'purpose','artwork_png','sha256',repeat(n::text,64),
   'byteSize',100,'contentType','image/png'));
 perform public.media_upload_operation(actor,'staging','finalize',uid,
  jsonb_build_object('sha256',repeat(n::text,64),'byteSize',100,'width',1200,'height',800));
 perform pg_temp.op(actor,'attach',jsonb_build_object('versionId',version_id,'uploadId',uid));
 return uid;
end $$;

-- Existing collector keeps generated v1 before any redesign.
insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,
 shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('75000000-0000-4000-8000-000000000080','75000000-0000-4000-8000-000000000003',
 '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',1,
 'Asia/Singapore','geofence',1,'Historical shop',
 '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
 '{"id":"00000000-0000-4000-8000-000000000601","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}');

create temp table v2 as
select (pg_temp.op('75000000-0000-4000-8000-000000000002','create',
 '{"origin":"ai_assisted","creatorName":"Gin + AI","ink":"plum"}')->0->>'id')::uuid id;
select pg_temp.upload('75000000-0000-4000-8000-000000000002',2,(select id from v2));

select throws_ok($$select pg_temp.op('75000000-0000-4000-8000-000000000002','activate',
 jsonb_build_object('versionId',(select id from v2),'revision',
  (select md5(to_jsonb(a)::text) from public.stamp_artwork_versions a where id=(select id from v2))))$$,
 '42501','Admin access denied','editor cannot activate');
select throws_ok($$select pg_temp.op('75000000-0000-4000-8000-000000000001','activate',
 jsonb_build_object('versionId',(select id from v2),'revision',repeat('a',32)))$$,
 '40001','Stamp artwork changed; reload','stale activation revision conflicts');

-- A production operation must not activate an artwork receipt from staging.
update public.shops set source_quality='community_unverified' where id='00000000-0000-4000-8000-000000000301';
select throws_ok($$select public.stamp_artwork_draft_operation(
 '75000000-0000-4000-8000-000000000001','production','00000000-0000-4000-8000-000000000301','activate',
 jsonb_build_object('versionId',(select id from v2),'revision',
  (select md5(to_jsonb(a)::text) from public.stamp_artwork_versions a where id=(select id from v2))))$$,
 '22023','Invalid stamp target','activation rejects receipts from another environment');
update public.shops set source_quality='demo' where id='00000000-0000-4000-8000-000000000301';

select lives_ok($$select pg_temp.op('75000000-0000-4000-8000-000000000001','activate',
 jsonb_build_object('versionId',(select id from v2),'revision',
  (select md5(to_jsonb(a)::text) from public.stamp_artwork_versions a where id=(select id from v2))))$$,
 'admin activates attached uploaded artwork');
select is((select current_design_version from public.stamps where id='00000000-0000-4000-8000-000000000601'),2,
 'same stamp identity advances to v2');
select is((select approval_status::text from public.stamp_artwork_versions
 where id='00000000-0000-4000-8000-000000000701'),'approved',
 'generated default remains approved history');
select is((select approval_status::text from public.stamp_artwork_versions where id=(select id from v2)),'approved',
 'uploaded version is approved by activation');
select throws_ok($$update public.stamp_artwork_versions set creator_name='rewrite' where id=(select id from v2)$$,
 '55000','Approved stamp artwork versions are immutable','activated creator/artwork history is immutable');

-- New collector receives the exact active uploaded snapshot.
insert into auth.users(id) values('75000000-0000-4000-8000-000000000004');
insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,
 shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('75000000-0000-4000-8000-000000000081','75000000-0000-4000-8000-000000000004',
 '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',2,
 'Asia/Singapore','geofence',1,'Current shop',
 '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
 jsonb_build_object('id','00000000-0000-4000-8000-000000000601','designVersion',2,
  'artworkKind','uploaded','artworkOrigin','ai_assisted','creatorName','Gin + AI',
  'transparentPngSha256',repeat('2',64),'ink','plum','paletteVersion',1));
select ok(public.stamp_artwork_file_operation(null,'staging',
 '00000000-0000-4000-8000-000000000601',2) ? 'storageKey',
 'current approved uploaded artwork resolves publicly for published shop');

-- Activate v3 without deleting v2; v2 becomes historical but remains visible to its owner.
create temp table v3 as
select (pg_temp.op('75000000-0000-4000-8000-000000000002','create',
 '{"origin":"founder_created","creatorName":"Gin","creatorUrl":"https://example.test/gin","ink":"teal"}')->0->>'id')::uuid id;
select pg_temp.upload('75000000-0000-4000-8000-000000000002',3,(select id from v3));
select pg_temp.op('75000000-0000-4000-8000-000000000001','activate',
 jsonb_build_object('versionId',(select id from v3),'revision',
  (select md5(to_jsonb(a)::text) from public.stamp_artwork_versions a where id=(select id from v3))));

select throws_ok($$select public.stamp_artwork_file_operation(null,'staging',
 '00000000-0000-4000-8000-000000000601',2)$$,'P0002','Stamp artwork not found',
 'retired v2 bytes are no longer public discovery');
select ok(public.stamp_artwork_file_operation('75000000-0000-4000-8000-000000000004','staging',
 '00000000-0000-4000-8000-000000000601',2) ? 'storageKey',
 'v2 collector can still render their historical impression');
select throws_ok($$insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,
 shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('75000000-0000-4000-8000-000000000082','75000000-0000-4000-8000-000000000004',
 '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',3,
 'Asia/Singapore','geofence',1,'Current shop',
 '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
 jsonb_build_object('id','00000000-0000-4000-8000-000000000601','designVersion',3,
  'artworkKind','uploaded','artworkOrigin','founder_created','creatorName','Gin',
  'creatorUrl','https://example.test/gin','transparentPngSha256',repeat('3',64),
  'ink','teal','paletteVersion',1))$$,
 '23505',null,'duplicate protection remains one collection per stamp; #70 recollection is deferred');
select ok(exists(select 1 from public.stamp_collections where id='75000000-0000-4000-8000-000000000081'
 and stamp_design_version=2 and stamp_snapshot->>'creatorName'='Gin + AI'),
 'historical impression and creator credit remain unchanged after v3 activation');

-- Exercise real server issuance for uploaded art, using a synthetic fixture fix.
insert into auth.users(id) values('75000000-0000-4000-8000-000000000005');
create function pg_temp.issue_action(action text,payload jsonb default '{}') returns jsonb language sql as $$
 select public.stamp_verification_action(action,'75000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000301','75000000-0000-4000-8000-000000000099',repeat('a',64),payload)
$$;
select is(pg_temp.issue_action('nonce')->>'code','nonce_issued','uploaded stamp can start verification');
create function pg_temp.synthetic_fix() returns jsonb language plpgsql as $$
declare key bytea; iv bytea:=extensions.gen_random_bytes(16); ct bytea; point extensions.geometry;
begin
 select encryption_key into key from stamp_private.verification_nonces where request_id='75000000-0000-4000-8000-000000000099';
 select location into point from public.shops where id='00000000-0000-4000-8000-000000000301';
 ct:=extensions.encrypt_iv(convert_to(jsonb_build_object('latitude',extensions.st_y(point),'longitude',extensions.st_x(point),'accuracy',10)::text,'UTF8'),substring(key from 1 for 32),iv,'aes-cbc/pad:pkcs');
 return jsonb_build_object('iv',encode(iv,'hex'),'ciphertext',encode(ct,'hex'),
  'mac',encode(extensions.hmac(iv||ct,substring(key from 33 for 32),'sha256'),'hex'));
end $$;
select is(pg_temp.issue_action('verify',pg_temp.synthetic_fix())->>'code','confirmation_required',
 'uploaded stamp verifies synthetic position');
select is(pg_temp.issue_action('collect','{"confirmedAtShop":true,"countryLabel":"Singapore"}')->>'code','success',
 'server issues the active uploaded stamp');
select ok((select stamp_snapshot->>'artworkOrigin'='founder_created'
 and stamp_snapshot->>'creatorName'='Gin' and stamp_snapshot->>'creatorUrl'='https://example.test/gin'
 and stamp_snapshot->>'transparentPngSha256'=repeat('3',64)
 and not stamp_snapshot ? 'transparentPngKey'
 from public.stamp_collections where user_id='75000000-0000-4000-8000-000000000005'),
 'server snapshot pins exact origin credit and bytes without private storage keys');
select throws_ok($$select public.stamp_artwork_file_operation('75000000-0000-4000-8000-000000000005','staging',
 '00000000-0000-4000-8000-000000000601',2)$$,'P0002','Stamp artwork not found',
 'new collector cannot read another collector historical artwork');

select * from finish();
rollback;
