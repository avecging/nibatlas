begin;
select no_plan();
insert into auth.users(id) values ('e5000000-0000-4000-8000-000000000001'),('e5000000-0000-4000-8000-000000000002'),('e5000000-0000-4000-8000-000000000003');
select public.assign_profile_role('e5000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('e5000000-0000-4000-8000-000000000002','editor');
create function pg_temp.op(action text,payload jsonb default '{}',actor uuid default 'e5000000-0000-4000-8000-000000000001',env text default 'staging') returns jsonb language sql as $$
 select public.stamp_artwork_draft_operation(actor,env,'00000000-0000-4000-8000-000000000301',action,payload)
$$;
create function pg_temp.review(payload jsonb default null) returns jsonb language sql as $$
 select public.shop_review_operation('e5000000-0000-4000-8000-000000000001','staging','00000000-0000-4000-8000-000000000301',payload)
$$;
create temp table state(k text primary key,v jsonb);
insert into state values('legacy',to_jsonb((select a from public.stamp_artwork_versions a where id='00000000-0000-4000-8000-000000000701')));
insert into state select 'base',v from jsonb_array_elements(pg_temp.op('list')) v where (v->>'active')::boolean;
insert into state values('payload',jsonb_build_object('shape','oval','ink','plum','baseVersionId',(select v->'id' from state where k='base'),'baseRevision',(select v->'revision' from state where k='base')));
select throws_ok($$select pg_temp.op('create_generated',(select v from state where k='payload'),'e5000000-0000-4000-8000-000000000003')$$,'42501',null,'regular users cannot write seals');
select throws_ok($$select pg_temp.op('create_generated',(select v from state where k='payload')||'{"shape":"circle"}')$$,'22023',null,'reject unsupported shape');
select throws_ok($$select pg_temp.op('create_generated',(select v from state where k='payload')||'{"ink":"red"}')$$,'22023',null,'reject unsupported ink');
select throws_ok($$select pg_temp.op('create_generated',(select v from state where k='payload')||'{"baseRevision":"00000000000000000000000000000000"}')$$,'40001',null,'reject stale active revision');
select throws_ok($$select pg_temp.op('create_generated',(select v from state where k='payload'),'e5000000-0000-4000-8000-000000000001','production')$$,'22023',null,'production cannot operate on demo staging target');
select lives_ok($$select pg_temp.op('create_generated',(select v from state where k='payload'),'e5000000-0000-4000-8000-000000000002')$$,'editor may save a private generated version');
insert into state values('draft',pg_temp.op('list')->0);
select is((select v->>'status' from state where k='draft'),'draft','new version stays private');
select is((select v->>'active' from state where k='draft'),'false','saving never activates');
select is((select v->'templateData' from state where k='draft'),'{"tier":"shop","motif":"nib","template":"shop-seal-v1","shape":"oval"}'::jsonb,'exact shape/template persisted');
select is((select count(*)::int from public.stamp_artwork_versions where stamp_id='00000000-0000-4000-8000-000000000601'),2,'one additive version');
insert into state values('audit',to_jsonb((select count(*) from public.admin_audit_log)));
select pg_temp.op('create_generated',(select v from state where k='payload'));
select is((select count(*)::int from public.stamp_artwork_versions where stamp_id='00000000-0000-4000-8000-000000000601'),2,'lost-response replay reuses identical draft');
select is(to_jsonb((select count(*) from public.admin_audit_log)),(select v from state where k='audit'),'replay adds no audit');
select ok(pg_temp.review()->'availableStampIds' ? (select v->>'id' from state where k='draft'),'generated draft is available in combined review without PNG');
select throws_ok($$select pg_temp.op('activate',jsonb_build_object('versionId',(select v->'id' from state where k='draft'),'revision',(select v->'revision' from state where k='draft')),'e5000000-0000-4000-8000-000000000002')$$,'42501',null,'editor cannot activate');
select throws_ok($$select pg_temp.op('activate',jsonb_build_object('versionId',(select v->'id' from state where k='draft'),'revision',repeat('0',32)))$$,'40001',null,'activation requires current draft revision');
-- Preserve a real legacy impression before activating a new generated version.
insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('e5000000-0000-4000-8000-000000000010','e5000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',1,
 'Asia/Singapore','geofence',1,'Synthetic historical shop','{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
 '{"id":"00000000-0000-4000-8000-000000000601","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}');
insert into state values('collection',(select to_jsonb(c) from public.stamp_collections c where id='e5000000-0000-4000-8000-000000000010'));
-- Complete the synthetic fixture's required address before exercising publication.
update public.shops set address_line_1='Synthetic seal test address' where id='00000000-0000-4000-8000-000000000301';
-- Real combined publication path, including deliberate position confirmation.
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('confirm_position','00000000-0000-4000-8000-000000000301',pg_temp.review()->'record'->>'revision');
select is(pg_temp.review()->'record'->'publicationErrors','[]'::jsonb,'synthetic fixture meets existing publication requirements');
select pg_temp.review(jsonb_build_object('id','e5000000-0000-4000-8000-000000000020','previousId',null,'reviewKey',pg_temp.review()->>'reviewKey',
 'choices',jsonb_build_object('photos','[]'::jsonb,'logo',null,'stamp',(select v->'id' from state where k='draft'))));
select is(public.shop_publication_operation('e5000000-0000-4000-8000-000000000001','staging','00000000-0000-4000-8000-000000000301','publish','e5000000-0000-4000-8000-000000000020')->'publication'->>'status','complete','combined publication activates generated draft');
select is((select current_design_version from public.stamps where id='00000000-0000-4000-8000-000000000601'),2,'future collectors get new version');
select is((select to_jsonb(a) from public.stamp_artwork_versions a where id='00000000-0000-4000-8000-000000000701'),(select v from state where k='legacy'),'legacy artwork remains byte-for-byte intact');
select is((select to_jsonb(c) from public.stamp_collections c where id='e5000000-0000-4000-8000-000000000010'),(select v from state where k='collection'),'old impression remains byte-for-byte intact');
select throws_ok($$update public.stamp_artwork_versions set ink='navy' where id=((select v->>'id' from state where k='draft'))::uuid$$,'55000',null,'new approved seals are immutable');
select throws_ok($$select pg_temp.op('create_generated',(select v from state where k='payload'))$$,'40001',null,'stale session cannot save against superseded active art');
select is(public.shop_detail('m2-singapore-demo-fixture')->'generatedStamp'->'templateData'->>'shape','oval','public projection carries saved shape');
select ok(not has_function_privilege('authenticated','public.stamp_artwork_draft_operation(uuid,text,uuid,text,jsonb)','EXECUTE'),'actor RPC stays service-only');
select ok(not has_function_privilege('anon','public.stamp_artwork_draft_operation(uuid,text,uuid,text,jsonb)','EXECUTE'),'anonymous cannot call actor RPC');
-- A matching old draft is not a retry once another version has become active.
update state set v=(select entry from jsonb_array_elements(pg_temp.op('list')) entry where (entry->>'active')::boolean) where k='base';
update state set v=jsonb_build_object('shape','rectangle','ink','ochre','baseVersionId',(select v->'id' from state where k='base'),'baseRevision',(select v->'revision' from state where k='base')) where k='payload';
select pg_temp.op('create_generated',(select v from state where k='payload'));
insert into state values('olderDraft',pg_temp.op('list')->0);
select pg_temp.op('create_generated',(select v from state where k='payload')||'{"shape":"shield","ink":"moss"}');
insert into state values('newerDraft',pg_temp.op('list')->0);
select pg_temp.op('activate',jsonb_build_object('versionId',(select v->'id' from state where k='newerDraft'),'revision',(select v->'revision' from state where k='newerDraft')));
update state set v=(select entry from jsonb_array_elements(pg_temp.op('list')) entry where (entry->>'active')::boolean) where k='base';
update state set v=v||jsonb_build_object('baseVersionId',(select v->'id' from state where k='base'),'baseRevision',(select v->'revision' from state where k='base')) where k='payload';
update state set v=to_jsonb((select count(*) from public.admin_audit_log)) where k='audit';
select pg_temp.op('create_generated',(select v from state where k='payload'));
insert into state values('replacement',pg_temp.op('list')->0);
select is((select (v->>'designVersion')::int from state where k='replacement'),5,'changed base creates v5 instead of reusing matching v3');
select isnt((select v->>'id' from state where k='replacement'),(select v->>'id' from state where k='olderDraft'),'fresh save has new identity');
select is((select entry from jsonb_array_elements(pg_temp.op('list')) entry where entry->>'id'=(select v->>'id' from state where k='olderDraft')),(select v from state where k='olderDraft'),'old private draft is unchanged');
select is((select count(*) from public.admin_audit_log),(select (v::text)::bigint+1 from state where k='audit'),'changed-base save adds one audit event');
select pg_temp.op('create_generated',(select v from state where k='payload'));
select is(pg_temp.op('list')->0,(select v from state where k='replacement'),'exact new-base replay returns the same v5');
select is((select count(*) from public.admin_audit_log),(select (v::text)::bigint+1 from state where k='audit'),'exact new-base replay adds no audit event');
-- New identities get a pinned shape, and preparing twice never replaces it.
insert into public.shops(id,name,slug) values('78000000-0000-4000-8000-000000000010','Synthetic new seal','synthetic-new-seal');
select public.ensure_shop_generated_default('e5000000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000010');
select is((select av.template_data->>'template' from public.stamp_artwork_versions av join public.stamps s on s.id=av.stamp_id where s.shop_id='78000000-0000-4000-8000-000000000010'),'shop-seal-v1','new identities receive new template');
select * from finish();
rollback;
