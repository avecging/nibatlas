begin;
select no_plan();
insert into auth.users(id) values('d4000000-0000-4000-8000-000000000001'),('d4000000-0000-4000-8000-000000000002'),('d4000000-0000-4000-8000-000000000003');
select public.assign_profile_role('d4000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('d4000000-0000-4000-8000-000000000002','editor');
-- Isolated synthetic fixture must permit both environment paths and remain a
-- valid full document when later exercised through the real catalogue writer.
update public.shops set source_quality='sourced' where id='00000000-0000-4000-8000-000000000301';
update public.shop_sources set source_type='official',label='Synthetic source for review tests only'
 where shop_id='00000000-0000-4000-8000-000000000301';
create function pg_temp.review(payload jsonb default null,actor uuid default 'd4000000-0000-4000-8000-000000000001',env text default 'staging') returns jsonb language sql as $$
 select public.shop_review_operation(actor,env,'00000000-0000-4000-8000-000000000301',payload)
$$;
create function pg_temp.make_image(n int,purpose text default 'shop_photo',env text default 'staging') returns uuid language plpgsql as $$
declare upload uuid:=('d4100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; image uuid;
begin
 perform public.media_upload_operation('d4000000-0000-4000-8000-000000000001',env,'initiate',upload,jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301','purpose',purpose,'sha256',repeat('a',64),'byteSize',100,'contentType','image/png'));
 perform public.media_upload_operation('d4000000-0000-4000-8000-000000000001',env,'finalize',upload,jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',2,'height',2));
 perform public.shop_media_operation('d4000000-0000-4000-8000-000000000001',env,'00000000-0000-4000-8000-000000000301','attach',upload);
 select id into image from public.shop_images where upload_id=upload; return image;
end; $$;
create temp table fixtures(k text primary key,v jsonb);
insert into fixtures values('photo',to_jsonb(pg_temp.make_image(1))),('logo',to_jsonb(pg_temp.make_image(2,'shop_logo'))),('foreign',to_jsonb(pg_temp.make_image(3,'shop_photo','production')));
create function pg_temp.choices() returns jsonb language sql as $$
 select jsonb_build_object('photos',jsonb_build_array((select v from fixtures where k='photo')),'logo',(select v from fixtures where k='logo'),
 'stamp',(select v->'id' from jsonb_array_elements(pg_temp.review()->'stamps') v where (v->>'active')::boolean limit 1))
$$;
create function pg_temp.payload(n int,choices jsonb default pg_temp.choices()) returns jsonb language sql as $$
 select jsonb_build_object('id',('d4200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'previousId',pg_temp.review()->'review'->>'id','reviewKey',pg_temp.review()->>'reviewKey','choices',choices)
$$;

create function pg_temp.publish(action text default 'publish',review uuid default null,actor uuid default 'd4000000-0000-4000-8000-000000000001',env text default 'staging') returns jsonb language sql as $$
 select public.shop_publication_operation(actor,env,'00000000-0000-4000-8000-000000000301',action,
  case when action='read' then null else coalesce(review,(pg_temp.review()->'review'->>'id')::uuid) end)
$$;
select is(pg_temp.publish('read')->'publication','null'::jsonb,'outcome read does not write');
select set_config('request.jwt.claims','{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('save','00000000-0000-4000-8000-000000000301',pg_temp.review()->'record'->>'revision',
 jsonb_set(pg_temp.review()->'record'->'document','{shop,address_line_1}','"Synthetic publication test address"'));
select pg_temp.review(pg_temp.payload(1));
select throws_ok($$select pg_temp.publish()$$,'22023','Confirm position before review','position is never inferred');
select public.admin_shop_write('confirm_position','00000000-0000-4000-8000-000000000301',pg_temp.review()->'record'->>'revision');
select throws_ok($$select pg_temp.publish()$$,'40001','Review conflict','position confirmation itself requires fresh review');
select pg_temp.review(pg_temp.payload(2));
-- Inject a recoverable photo failure while shop and logo can commit.
create function pg_temp.fail_photo() returns trigger language plpgsql as $$
 begin if new.kind='photo' and new.moderation_status='approved' then raise exception 'Synthetic media outage' using errcode='XX000'; end if; return new; end; $$;
create trigger synthetic_photo_failure before update on public.shop_images for each row execute function pg_temp.fail_photo();
-- Real service-role invocation, including pre-existing service claims, not actor JWT.
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
select is(public.shop_publication_operation('d4000000-0000-4000-8000-000000000001','staging','00000000-0000-4000-8000-000000000301','publish','d4200000-0000-4000-8000-000000000002')->'publication'->>'status','partial','service invocation commits recoverable partial result');
reset role;
select is(current_setting('request.jwt.claims'),'{"role":"service_role"}','service claims restored');
select is(current_setting('request.jwt.claim.sub'),'','legacy sub claim restored');
select is((select reviewed_by::text from public.shops where id='00000000-0000-4000-8000-000000000301'),'d4000000-0000-4000-8000-000000000001','catalogue review actor is verified admin');
select is((select moderation_status::text from public.shop_images where id=((select v from fixtures where k='photo')#>>'{}')::uuid),'draft','failed photo stays private');
select is((select moderation_status::text from public.shop_images where id=((select v from fixtures where k='logo')#>>'{}')::uuid),'approved','logo succeeds independently');
select is(pg_temp.publish('read')->'publication'->>'canRetry','true','own successful writes do not invalidate retry');
select is(pg_temp.publish()->'publication'->>'status','partial','lost-response replay reads outcome without retry');
select is((select count(*) from public.shop_publication_events),1::bigint,'replay emits no duplicate audit');
drop trigger synthetic_photo_failure on public.shop_images;
select is(pg_temp.publish('retry')->'publication'->>'status','complete','retry completes only unfinished parts');
select is((select count(*) from public.shop_publication_events),2::bigint,'explicit retry audited');
select pg_temp.publish('retry');
select is((select count(*) from public.shop_publication_events),2::bigint,'completed replay cannot repeat successful steps');
-- D4c null semantics: no removal or activation instruction.
select pg_temp.review(pg_temp.payload(3,'{"photos":[],"logo":null,"stamp":null}'));
select is(pg_temp.publish()->'publication'->>'status','complete','empty optional choices publish without removal');
select is((select moderation_status::text from public.shop_images where id=((select v from fixtures where k='logo')#>>'{}')::uuid),'approved','null logo never hides approved content');
-- New private photo, partial failure, then external saved change makes retry unsafe.
insert into fixtures values('photo2',to_jsonb(pg_temp.make_image(6)));
select pg_temp.review(pg_temp.payload(4,jsonb_set(pg_temp.choices(),'{photos}',jsonb_build_array((select v from fixtures where k='photo2')))));
create trigger synthetic_photo_failure before update on public.shop_images for each row execute function pg_temp.fail_photo();
select is(pg_temp.publish()->'publication'->>'status','partial','new photo failure recorded');
drop trigger synthetic_photo_failure on public.shop_images;
update public.shop_images set caption='Synthetic concurrent edit' where id=((select v from fixtures where k='photo2')#>>'{}')::uuid;
select is(pg_temp.publish('read')->'publication'->>'canRetry','false','external caption change requires re-review');
select throws_ok($$select pg_temp.publish('retry')$$,'40001','Review conflict','stale retry refused before writes');
select pg_temp.review(pg_temp.payload(5,jsonb_set(pg_temp.choices(),'{photos}',jsonb_build_array((select v from fixtures where k='photo2')))));
select throws_ok($$select pg_temp.publish('retry','d4200000-0000-4000-8000-000000000004')$$,'40001','Review conflict','superseded attempt cannot retry');
select is(pg_temp.publish()->'publication'->>'status','complete','fresh deliberate review recovers remaining selected work');
-- Uploaded artwork and shop commit together, preserving previous approved history.
insert into fixtures values('draft',(public.stamp_artwork_draft_operation('d4000000-0000-4000-8000-000000000001','staging',
 '00000000-0000-4000-8000-000000000301','create','{"origin":"founder_created","ink":"teal"}')->0->'id'));
select public.media_upload_operation('d4000000-0000-4000-8000-000000000001','staging','initiate','d4100000-0000-4000-8000-000000000010',
 jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301','artworkVersionId',(select v from fixtures where k='draft'),
 'purpose','artwork_png','sha256',repeat('a',64),'byteSize',100,'contentType','image/png'));
select public.media_upload_operation('d4000000-0000-4000-8000-000000000001','staging','finalize','d4100000-0000-4000-8000-000000000010',
 jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',1200,'height',800));
select public.stamp_artwork_draft_operation('d4000000-0000-4000-8000-000000000001','staging','00000000-0000-4000-8000-000000000301','attach',
 jsonb_build_object('versionId',(select v from fixtures where k='draft'),'uploadId','d4100000-0000-4000-8000-000000000010'));
select set_config('request.jwt.claims','{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('save','00000000-0000-4000-8000-000000000301',pg_temp.review()->'record'->>'revision',
 jsonb_set(pg_temp.review()->'record'->'document','{shop,name}','"Synthetic combined publication"'));
select pg_temp.review(pg_temp.payload(6,jsonb_set(pg_temp.choices(),'{stamp}',(select v from fixtures where k='draft'))));
insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,
 shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('d4300000-0000-4000-8000-000000000080','d4000000-0000-4000-8000-000000000003',
 '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',1,
 'Asia/Singapore','geofence',1,'Synthetic historical shop',
 '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
 '{"id":"00000000-0000-4000-8000-000000000601","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}');
select is((select count(*) from public.stamp_collections),1::bigint,'nonempty historical impression exists before redesign');
insert into fixtures values('history',jsonb_build_object('art',(select jsonb_agg(to_jsonb(v) order by id) from public.stamp_artwork_versions v where approval_status='approved'),
 'collections',(select jsonb_agg(to_jsonb(c) order by id) from public.stamp_collections c)));
create function pg_temp.fail_shop() returns trigger language plpgsql as $$ begin raise exception 'Synthetic shop outage' using errcode='XX000'; end; $$;
create trigger synthetic_shop_failure before update on public.shops for each row execute function pg_temp.fail_shop();
select is(pg_temp.publish()->'publication'->>'status','failed','shop failure rolls back newly activated artwork');
select is((select approval_status::text from public.stamp_artwork_versions where id=((select v from fixtures where k='draft')#>>'{}')::uuid),'draft','failed core retains private artwork draft');
select is(pg_temp.publish('read')->'publication'->'outcomes'->2->>'status','pending','media not attempted after core failure');
drop trigger synthetic_shop_failure on public.shops;
-- Final receipt audit failure must roll back even successful core/media mutations.
create function pg_temp.fail_event() returns trigger language plpgsql as $$ begin raise exception 'Synthetic ledger audit failure' using errcode='23514'; end; $$;
create trigger synthetic_event_failure before insert on public.shop_publication_events for each row execute function pg_temp.fail_event();
select throws_ok($$select pg_temp.publish('retry')$$,'23514','Synthetic ledger audit failure','ledger audit failure rolls entire attempt back');
select is((select approval_status::text from public.stamp_artwork_versions where id=((select v from fixtures where k='draft')#>>'{}')::uuid),'draft','audit rollback preserves private artwork');
select is(pg_temp.publish('read')->'publication'->>'status','failed','prior durable failed receipt intact');
drop trigger synthetic_event_failure on public.shop_publication_events;
select is(pg_temp.publish('retry')->'publication'->>'status','complete','core and all choices can safely recover');
select is((select approval_status::text from public.stamp_artwork_versions where id=((select v from fixtures where k='draft')#>>'{}')::uuid),'approved','reviewed artwork activated');
select is((select jsonb_agg(to_jsonb(v) order by id) from public.stamp_artwork_versions v where approval_status='approved' and id<>((select v from fixtures where k='draft')#>>'{}')::uuid),(select v->'art' from fixtures where k='history'),'all previously approved artwork unchanged');
select is((select jsonb_agg(to_jsonb(c) order by id) from public.stamp_collections c),(select v->'collections' from fixtures where k='history'),'historical collections unchanged');
-- Read isolation, role revocation, direct RPC denial and immutable audit.
select public.assign_profile_role('d4000000-0000-4000-8000-000000000002','admin');
select is(pg_temp.publish('read',null,'d4000000-0000-4000-8000-000000000002')->'publication','null'::jsonb,'other admin cannot see owner receipts');
select throws_ok($$select pg_temp.publish('publish','d4200000-0000-4000-8000-000000000006','d4000000-0000-4000-8000-000000000002')$$,'40001','Review conflict','other admin cannot replay owner attempt');
select throws_ok($$select pg_temp.publish('publish','d4200000-0000-4000-8000-000000000006','d4000000-0000-4000-8000-000000000001','production')$$,'40001','Review conflict','cross-environment replay refused');
select public.assign_profile_role('d4000000-0000-4000-8000-000000000001','editor');
select throws_ok($$select pg_temp.publish('read')$$,'42501','Admin access denied','editor cannot read or retry admin publication');
select ok(not has_function_privilege('authenticated','public.shop_publication_operation(uuid,text,uuid,text,uuid)','execute'),'browser cannot spoof actor/environment');
select ok(not has_function_privilege('anon','public.shop_publication_operation(uuid,text,uuid,text,uuid)','execute'),'anonymous RPC denied');
select ok(has_function_privilege('service_role','public.shop_publication_operation(uuid,text,uuid,text,uuid)','execute'),'server RPC granted');
select ok(not has_table_privilege(role,tab,priv),'no direct '||role||' '||tab||' '||priv)
 from unnest(array['anon','authenticated','service_role']) role cross join unnest(array['public.shop_publications','public.shop_publication_events']) tab cross join unnest(array['select','insert','update','delete','truncate']) priv;
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in ('public.shop_publications'::regclass,'public.shop_publication_events'::regclass)),'RLS forced');
select throws_ok($$update public.shop_publication_events set outcomes='[]'$$,'42501','Audit history is append-only','audit mutation refused');
select throws_ok($$truncate public.shop_publication_events$$,'42501','Audit history is append-only','audit truncation refused');
select * from finish();
rollback;
