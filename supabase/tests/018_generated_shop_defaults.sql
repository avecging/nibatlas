begin;
select no_plan();
insert into auth.users(id) values
 ('78000000-0000-4000-8000-000000000001'),
 ('78000000-0000-4000-8000-000000000002');
select public.assign_profile_role('78000000-0000-4000-8000-000000000001','editor');
select public.assign_profile_role('78000000-0000-4000-8000-000000000002','admin');
select ok(not has_function_privilege('authenticated','public.ensure_shop_generated_default(uuid,uuid)','EXECUTE'),
 'browser cannot forge the helper actor');
select ok(not has_function_privilege('service_role','public.ensure_shop_generated_default(uuid,uuid)','EXECUTE'),
 'service role must use the environment-checked stamp operation');
select ok(not has_function_privilege('anon','public.ensure_shop_generated_default(uuid,uuid)','EXECUTE'),
 'anonymous cannot generate defaults');

create temp table snapshot(key text primary key,value jsonb);
grant all on snapshot to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"78000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is(public.admin_shop_write('create','78000000-0000-4000-8000-000000000010',null,
 '{"name":"Generated default synthetic demo","slug":"generated-default-synthetic-demo"}')->>'publicationStatus',
 'draft','name-only editor creation stays private');
select lives_ok($$select public.admin_shop_write('create','78000000-0000-4000-8000-000000000011',null,
 jsonb_build_object('name',repeat('A',119)||' B','slug','long-generated-default-synthetic-demo'))$$,
 'valid long shop name with space on stamp truncation boundary still creates');
insert into snapshot values('record',public.admin_shop_read('78000000-0000-4000-8000-000000000010'));
select is(public.shop_detail('generated-default-synthetic-demo'),null,'default does not expose draft detail');
select is(public.search_shops('Generated default synthetic demo')->'shops','[]'::jsonb,'default does not expose draft search');
select is((select value->'document'->'shop'->>'country_code' from snapshot where key='record'),null,'no geography invented');
select is((select value->'document'->'shop'->>'last_verified_at' from snapshot where key='record'),null,'art creation is not field verification');
select ok(not exists(select 1 from jsonb_array_elements_text((select value->'publicationErrors' from snapshot where key='record')) e
 where e like '%active Atlas Stamp%'),'stamp prerequisite is satisfied without an upload');
select is(public.admin_shop_write('publish','78000000-0000-4000-8000-000000000010',
 (select value->>'revision' from snapshot where key='record'))->>'code','publication_incomplete',
 'default never bypasses remaining catalogue publication gates');
select throws_ok($$select public.admin_shop_write('create','78000000-0000-4000-8000-000000000010',null,
 '{"name":"Generated default synthetic demo","slug":"generated-default-synthetic-demo"}')$$,
 '23505',null,'lost create response conflicts rather than creating a duplicate');
reset role;
insert into snapshot values('art',(select jsonb_agg(to_jsonb(av) order by av.id) from public.stamp_artwork_versions av
 join public.stamps st on st.id=av.stamp_id where st.shop_id='78000000-0000-4000-8000-000000000010'));
insert into snapshot values('audit',(select to_jsonb(count(*)) from public.admin_audit_log));
select is((select count(*)::int from public.stamps where shop_id='78000000-0000-4000-8000-000000000010'),1,'one stable identity');
select ok((select av.template_data ?& array['tier','motif'] and av.template_data->>'tier'='shop'
 and av.artwork_origin='generated_template' and av.approval_status='approved'
 and av.approval_evidence_ref='system-generated-default:v1' and av.approved_at is not null
 and av.creator_name is null and av.creator_url is null and av.upload_id is null and av.rights_basis is null
 from public.stamp_artwork_versions av join public.stamps st on st.id=av.stamp_id
 where st.shop_id='78000000-0000-4000-8000-000000000010'),'truthful system default has no fabricated creator/rights/upload');
-- These values are independently calculated using the frontend FNV-1a generator.
select is((select av.ink::text||':'||(av.template_data->>'motif') from public.stamp_artwork_versions av
 join public.stamps st on st.id=av.stamp_id where st.shop_id='78000000-0000-4000-8000-000000000010'),
 'moss:counter','SQL palette/motif matches established generator');
select lives_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000002',
 'staging','78000000-0000-4000-8000-000000000010','ensure_default')$$,'second operator can safely replay preparation');
select is((select to_jsonb(count(*)) from public.admin_audit_log),(select value from snapshot where key='audit'),'replay creates no audit effects');
select is((select jsonb_agg(to_jsonb(av) order by av.id) from public.stamp_artwork_versions av join public.stamps st on st.id=av.stamp_id
 where st.shop_id='78000000-0000-4000-8000-000000000010'),(select value from snapshot where key='art'),'replay preserves approved bytes and version');
select ok((select count(*)=3 and bool_and(actor_user_id='78000000-0000-4000-8000-000000000001' and actor_kind='account')
 from public.admin_audit_log where entity_id in
 (select id from public.stamps where shop_id='78000000-0000-4000-8000-000000000010'
 union all select av.id from public.stamp_artwork_versions av join public.stamps st on st.id=av.stamp_id where st.shop_id='78000000-0000-4000-8000-000000000010')),
 'all default lifecycle writes are attributed to the authenticated creator');
select is(public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','staging',
 '78000000-0000-4000-8000-000000000010','list')->0->'templateData',
 (select value->0->'template_data' from snapshot where key='art'),'private preview returns the actual stored template');

-- Existing draft backfill is explicit; it neither resets private work nor updates its revision.
insert into public.shops(id,name,slug) values('78000000-0000-4000-8000-000000000020','Legacy synthetic draft','legacy-synthetic-draft');
set local role authenticated;
insert into snapshot values('legacy',public.admin_shop_read('78000000-0000-4000-8000-000000000020'));
select lives_ok($$select public.admin_shop_write('save','78000000-0000-4000-8000-000000000020',
 (select value->>'revision' from snapshot where key='legacy'),
 jsonb_set((select value->'document' from snapshot where key='legacy'),'{shop,name}','"Private legacy edit"'))$$,'save legacy private edits');
update snapshot set value=public.admin_shop_read('78000000-0000-4000-8000-000000000020') where key='legacy';
reset role;
select lives_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','staging',
 '78000000-0000-4000-8000-000000000020','ensure_default')$$,'explicit preparation supports older drafts');
set local role authenticated;
select is(public.admin_shop_read('78000000-0000-4000-8000-000000000020')-'publicationErrors',
 (select value-'publicationErrors' from snapshot where key='legacy'),'preparation preserves private work and its concurrency token');
reset role;
select throws_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','staging',
 '78000000-0000-4000-8000-000000000020','ensure_default','{"ink":"teal"}')$$,'22023','Invalid stamp request','no caller-controlled replacement');
select throws_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','production',
 '00000000-0000-4000-8000-000000000301','ensure_default')$$,'22023','Invalid stamp target','production denies demo targets');

-- Later custom work reuses the identity; replay cannot overwrite or activate it.
select lives_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','staging',
 '78000000-0000-4000-8000-000000000010','create','{"origin":"ai_assisted","creatorName":"Synthetic test creator","ink":"plum"}')$$,
 'later custom draft is additive');
insert into snapshot values('custom',(select jsonb_agg(to_jsonb(av) order by av.id) from public.stamp_artwork_versions av
 join public.stamps st on st.id=av.stamp_id where st.shop_id='78000000-0000-4000-8000-000000000010'));
select lives_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','staging',
 '78000000-0000-4000-8000-000000000010','ensure_default')$$,'replay with custom art is a no-op');
select is((select jsonb_agg(to_jsonb(av) order by av.id) from public.stamp_artwork_versions av join public.stamps st on st.id=av.stamp_id
 where st.shop_id='78000000-0000-4000-8000-000000000010'),(select value from snapshot where key='custom'),'custom version and original default unchanged');
select is((select current_design_version from public.stamps where shop_id='78000000-0000-4000-8000-000000000010'),1,'custom draft is not silently activated');
select throws_ok($$update public.stamp_artwork_versions set ink='navy' where stamp_id in
 (select id from public.stamps where shop_id='78000000-0000-4000-8000-000000000010') and design_version=1$$,
 '55000',null,'default approval retains immutability');
update public.stamps set status='retired' where shop_id='78000000-0000-4000-8000-000000000020';
select lives_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','staging',
 '78000000-0000-4000-8000-000000000020','ensure_default')$$,'retired identity is retained');
select is((select status::text from public.stamps where shop_id='78000000-0000-4000-8000-000000000020'),'retired','retired artwork is never resurrected');
update public.shops set publication_status='archived' where id='78000000-0000-4000-8000-000000000020';
select throws_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','staging',
 '78000000-0000-4000-8000-000000000020','ensure_default')$$,'22023','Invalid stamp target','archived shop rejected');
select public.assign_profile_role('78000000-0000-4000-8000-000000000001','user');
select throws_ok($$select public.stamp_artwork_draft_operation('78000000-0000-4000-8000-000000000001','staging',
 '78000000-0000-4000-8000-000000000010','ensure_default')$$,'42501','Admin access denied','revocation blocks even a replay');

-- A focused capacity proof, not the Package C mixed-row import acceptance suite.
-- No raw-file retention, upload manifests or unbounded Worker request is added.
insert into snapshot values('uploads',(select to_jsonb(count(*)) from public.media_uploads));
do $$ declare n integer; id uuid; begin
 for n in 1..200 loop
  id:=('78000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid;
  insert into public.shops(id,name,slug) values(id,'Synthetic 200-row default '||n,'synthetic-default-'||n);
  perform public.ensure_shop_generated_default('78000000-0000-4000-8000-000000000002',id);
  perform public.ensure_shop_generated_default('78000000-0000-4000-8000-000000000002',id);
 end loop;
end $$;
select is((select count(*)::int from public.stamps where shop_id::text like '78000000-0000-4000-8001-%'),200,'200 rows plus retries produce exactly 200 identities');
select is((select count(*)::int from public.stamp_artwork_versions av join public.stamps st on st.id=av.stamp_id
 where st.shop_id::text like '78000000-0000-4000-8001-%'),200,'200 rows produce exactly 200 versions');
select is((select to_jsonb(count(*)) from public.media_uploads),(select value from snapshot where key='uploads'),'default preparation consumes no upload quota');
select is((select count(*)::int from public.shops where id::text like '78000000-0000-4000-8001-%' and publication_status='published'),0,'all capacity fixtures remain private');
set constraints all immediate;
select * from finish();
rollback;
