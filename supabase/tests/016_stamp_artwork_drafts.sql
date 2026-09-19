begin;
select no_plan();

insert into auth.users(id) values
  ('74000000-0000-4000-8000-000000000001'),
  ('74000000-0000-4000-8000-000000000002');
select public.assign_profile_role('74000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('74000000-0000-4000-8000-000000000002','editor');

select ok(not has_function_privilege('authenticated',
  'public.stamp_artwork_draft_operation(uuid,text,uuid,text,jsonb)','EXECUTE'),
  'browser cannot attest stamp admin actor');
select ok(has_function_privilege('service_role',
  'public.stamp_artwork_draft_operation(uuid,text,uuid,text,jsonb)','EXECUTE'),
  'server can use bounded stamp draft operation');
select is((select artwork_origin from public.stamp_artwork_versions
  where id='00000000-0000-4000-8000-000000000701'),'generated_template',
  'existing generated artwork is backfilled truthfully');

create function pg_temp.stamp(actor uuid,action text,payload jsonb default '{}')
returns jsonb language sql as $$
  select public.stamp_artwork_draft_operation(
    actor,'staging','00000000-0000-4000-8000-000000000301',action,payload)
$$;
create function pg_temp.media(actor uuid,action text,id uuid,payload jsonb default '{}')
returns jsonb language sql as $$
  select public.media_upload_operation(actor,'staging',action,id,payload)
$$;

select throws_ok($$select pg_temp.stamp('74000000-0000-4000-8000-000000000002','create',
  '{"origin":"generated_template","creatorName":"Founder","ink":"teal"}')$$,
  '22023','Invalid stamp metadata','uploaded artwork cannot claim generated origin');
select throws_ok($$select pg_temp.stamp('74000000-0000-4000-8000-000000000002','create',
  '{"origin":"ai_assisted","creatorName":"Founder","creatorUrl":"javascript:alert(1)","ink":"teal"}')$$,
  '22023','Invalid stamp metadata','creator link must be safe http(s)');

create temp table created as
select (pg_temp.stamp('74000000-0000-4000-8000-000000000002','create',
  '{"origin":"ai_assisted","creatorName":"Founder + AI","creatorUrl":"https://example.test/creator","ink":"plum"}')->0->>'id')::uuid id;
select ok((select artwork_kind='uploaded' and artwork_origin='ai_assisted'
  and creator_name='Founder + AI' and creator_url='https://example.test/creator'
  and approval_status='draft' and upload_id is null
  and rights_basis is null and approval_evidence_ref is null and not maker_mark_confirmed
  from public.stamp_artwork_versions where id=(select id from created)),
  'draft records truthful origin/creator without fake commissioning paperwork');

select throws_ok($$select pg_temp.media('74000000-0000-4000-8000-000000000002','initiate',
  '74000000-0000-4000-8000-000000000010',
  jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301',
    'artworkVersionId',(select id from created),'purpose','artwork_png',
    'sha256',repeat('a',64),'byteSize',100,'contentType','image/png','sourceRef','not required'))$$,
  '22023','Artwork upload metadata belongs to the version',
  'artwork transport rejects paperwork fields rather than storing them');
select is(pg_temp.media('74000000-0000-4000-8000-000000000002','initiate',
  '74000000-0000-4000-8000-000000000010',
  jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301',
    'artworkVersionId',(select id from created),'purpose','artwork_png',
    'sha256',repeat('a',64),'byteSize',100,'contentType','image/png'))->>'status',
  'pending','minimal stamp PNG manifest is accepted');
select is(pg_temp.media('74000000-0000-4000-8000-000000000002','finalize',
  '74000000-0000-4000-8000-000000000010',
  jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',1200,'height',800))->>'status',
  'validated','validated PNG transport remains separate from attachment');

select throws_ok($$select pg_temp.stamp('74000000-0000-4000-8000-000000000001','attach',
  jsonb_build_object('versionId',(select id from created),'uploadId',
    '74000000-0000-4000-8000-000000000010'))$$,
  '22023','Invalid stamp target','another admin cannot take over the editor upload receipt');
select lives_ok($$select pg_temp.stamp('74000000-0000-4000-8000-000000000002','attach',
  jsonb_build_object('versionId',(select id from created),'uploadId',
    '74000000-0000-4000-8000-000000000010'))$$,'creator attaches own validated receipt');
select ok((select upload_id='74000000-0000-4000-8000-000000000010'
  and transparent_png_key like 'staging/media/%'
  and transparent_png_sha256=repeat('a',64)
  and approval_status='draft'
  from public.stamp_artwork_versions where id=(select id from created)),
  'attachment binds immutable validated PNG but does not approve it');
select ok(pg_temp.stamp('74000000-0000-4000-8000-000000000002','preview',
  jsonb_build_object('versionId',(select id from created))) ? 'storageKey',
  'authorized private preview resolves the attached key');

select lives_ok($$select pg_temp.stamp('74000000-0000-4000-8000-000000000002','create',
  '{"origin":"founder_created","creatorName":"Gin","ink":"teal"}')$$,
  'founder-created origin and plain creator name are valid');
select ok((select creator_url is null from public.stamp_artwork_versions
  where artwork_kind='uploaded' and artwork_origin='founder_created'
  order by design_version desc limit 1),'creator link is genuinely optional');

select is((select status::text from public.stamps
  where id='00000000-0000-4000-8000-000000000601'),'active',
  'draft work does not replace the generated default');
select is((select current_design_version from public.stamps
  where id='00000000-0000-4000-8000-000000000601'),1,
  'draft work does not change the active design version');
select ok((select count(*)>=3 from public.stamp_artwork_versions
  where stamp_id='00000000-0000-4000-8000-000000000601'),
  'new versions are additive');
select ok((select count(*)=0 from public.stamp_collections
  where stamp_design_version>1),'draft creation never rewrites impressions');
select ok((select count(*)>=3 from public.admin_audit_log
  where entity_type in ('stamp_artwork_versions','stamps')
    and actor_user_id='74000000-0000-4000-8000-000000000002'),
  'stamp draft changes are attributed to the verified editor');
select throws_ok('truncate public.stamp_artwork_versions cascade','42501',
  'Catalogue truncation is forbidden; use audited row operations',
  'stamp versions cannot be bulk-erased');

select * from finish();
rollback;
