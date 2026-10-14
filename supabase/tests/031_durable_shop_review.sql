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
insert into fixtures values('before',jsonb_build_object('shop',(select to_jsonb(s) from public.shops s where id='00000000-0000-4000-8000-000000000301'),
 'images',(select jsonb_agg(to_jsonb(i) order by id) from public.shop_images i),
 'stamps',(select jsonb_agg(to_jsonb(i) order by id) from public.stamps i),
 'art',(select jsonb_agg(to_jsonb(i) order by id) from public.stamp_artwork_versions i),
 'collections',(select jsonb_agg(to_jsonb(i) order by id) from public.stamp_collections i)));
select is(pg_temp.review()->'review','null'::jsonb,'reading does not create a review');
insert into fixtures values('request',pg_temp.payload(1));
select is(pg_temp.review((select v from fixtures where k='request'))->'review'->>'current','true','save exact revision review');
select is(pg_temp.review()->'review'->'choices',pg_temp.choices(),'reload restores exact chosen IDs');
select is(pg_temp.review((select v from fixtures where k='request'))->'review'->>'current','true','lost response replay returns same review');
select is((select count(*) from public.shop_review_events),1::bigint,'replay has one audit event');
select is(pg_temp.review(null,'d4000000-0000-4000-8000-000000000002')->'review','null'::jsonb,'other editor cannot read owner choices');
select is(pg_temp.review(null,'d4000000-0000-4000-8000-000000000001','production')->'review','null'::jsonb,'environment review is separate');
select is((select v from fixtures where k='before'),jsonb_build_object('shop',(select to_jsonb(s) from public.shops s where id='00000000-0000-4000-8000-000000000301'),
 'images',(select jsonb_agg(to_jsonb(i) order by id) from public.shop_images i),
 'stamps',(select jsonb_agg(to_jsonb(i) order by id) from public.stamps i),
 'art',(select jsonb_agg(to_jsonb(i) order by id) from public.stamp_artwork_versions i),
 'collections',(select jsonb_agg(to_jsonb(i) order by id) from public.stamp_collections i)),'save/replay changes no catalogue, media, artwork or impressions');
select throws_ok($$select pg_temp.review(pg_temp.payload(2)||'{"actor":"spoof"}')$$,'22023','Invalid review','unknown fields refused');
select throws_ok($$select pg_temp.review(pg_temp.payload(2,jsonb_set(pg_temp.choices(),'{photos}',jsonb_build_array((select v from fixtures where k='foreign')))))$$,'22023','Invalid review','foreign-environment photo refused');
select throws_ok($$select pg_temp.review(pg_temp.payload(2,jsonb_set(pg_temp.choices(),'{photos}',jsonb_build_array((select v from fixtures where k='photo'),(select v from fixtures where k='photo')))))$$,'22023','Invalid review','duplicate choices refused');
select throws_ok($$select pg_temp.review(pg_temp.payload(2,jsonb_set(pg_temp.choices(),'{logo}',(select v from fixtures where k='photo'))))$$,'22023','Invalid review','photo cannot be logo');
select throws_ok($$select pg_temp.review(pg_temp.payload(2)||jsonb_build_object('previousId',null))$$,'PT409','Review conflict','stale tab cannot replace newer review');
-- Saved caption, publication status and membership all change the snapshot key.
update public.shop_images set caption='Synthetic changed caption' where id=((select v from fixtures where k='photo')#>>'{}')::uuid;
select is(pg_temp.review()->'review'->>'current','false','caption invalidates review even with unchanged shop revision');
select is(pg_temp.review((select v from fixtures where k='request'))->'review'->>'current','false','stale replay never revalidates old receipt');
select throws_ok($$select pg_temp.review((select v||jsonb_build_object('id','d4200000-0000-4000-8000-000000000002','previousId',pg_temp.review()->'review'->>'id') from fixtures where k='request'))$$,'PT409','Review conflict','stale snapshot cannot save a new review');
select is(pg_temp.review(pg_temp.payload(2))->'review'->>'current','true','deliberate fresh review works');
select throws_ok($$select pg_temp.review((select v from fixtures where k='request'))$$,'PT409','Review conflict','superseded request does not overwrite');
update public.shop_images set sort_order=42 where id=((select v from fixtures where k='photo')#>>'{}')::uuid;
select is(pg_temp.review()->'review'->>'current','false','gallery order invalidates review');
select pg_temp.review(pg_temp.payload(3));
select pg_temp.make_image(4);
select is(pg_temp.review()->'review'->>'current','false','new unselected photo invalidates reviewed gallery membership');
select pg_temp.review(pg_temp.payload(4));
update public.shop_images set moderation_status='approved' where id=((select v from fixtures where k='photo')#>>'{}')::uuid;
select is(pg_temp.review()->'review'->>'current','false','separate photo publication invalidates review');
select pg_temp.review(pg_temp.payload(5));
-- Private shop saves get a fresh revision, including a save that restores old text.
select set_config('request.jwt.claims','{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('save','00000000-0000-4000-8000-000000000301',pg_temp.review()->'record'->>'revision',jsonb_set(pg_temp.review()->'record'->'document','{shop,internal_notes}','"Synthetic private edit"'));
select is(pg_temp.review()->'review'->>'current','false','private saved change invalidates review');
select pg_temp.review(pg_temp.payload(6));
update public.shops set name='Synthetic canonical edit' where id='00000000-0000-4000-8000-000000000301';
select is(pg_temp.review()->>'conflict','true','canonical drift detected behind working copy');
select throws_ok($$select pg_temp.review(pg_temp.payload(7))$$,'PT409','Review conflict','unreconciled working copy cannot be re-reviewed');
select public.admin_shop_write('discard','00000000-0000-4000-8000-000000000301',pg_temp.review()->'record'->>'revision');
select pg_temp.review(pg_temp.payload(7));
-- Optional media/artwork: empty choices are valid; no confirmation is invented.
select is(pg_temp.review(pg_temp.payload(8,'{"photos":[],"logo":null,"stamp":null}'))->'review'->'choices','{"photos":[],"logo":null,"stamp":null}'::jsonb,'explicit no-logo/no-stamp review saved');
-- Uploaded stamp revisions/credits, availability and activation are bound too.
insert into fixtures values('draft',(public.stamp_artwork_draft_operation('d4000000-0000-4000-8000-000000000001','staging',
 '00000000-0000-4000-8000-000000000301','create','{"origin":"founder_created","ink":"teal"}')->0->'id'));
select is(pg_temp.review()->'review'->>'current','false','new artwork draft invalidates review');
select throws_ok($$select pg_temp.review(pg_temp.payload(9,jsonb_set(pg_temp.choices(),'{stamp}',(select v from fixtures where k='draft'))))$$,'22023','Invalid review','draft without PNG cannot be reviewed');
select public.media_upload_operation('d4000000-0000-4000-8000-000000000001','staging','initiate','d4100000-0000-4000-8000-000000000010',
 jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301','artworkVersionId',(select v from fixtures where k='draft'),
 'purpose','artwork_png','sha256',repeat('a',64),'byteSize',100,'contentType','image/png'));
select public.media_upload_operation('d4000000-0000-4000-8000-000000000001','staging','finalize','d4100000-0000-4000-8000-000000000010',
 jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',1200,'height',800));
select public.stamp_artwork_draft_operation('d4000000-0000-4000-8000-000000000001','staging','00000000-0000-4000-8000-000000000301','attach',
 jsonb_build_object('versionId',(select v from fixtures where k='draft'),'uploadId','d4100000-0000-4000-8000-000000000010'));
select is(pg_temp.review(pg_temp.payload(9,jsonb_set(pg_temp.choices(),'{stamp}',(select v from fixtures where k='draft'))))->'review'->>'current','true','validated uploaded draft can be reviewed');
select ok(not (pg_temp.review(null,'d4000000-0000-4000-8000-000000000001','production')->'availableStampIds') ? ((select v from fixtures where k='draft')#>>'{}'),'foreign-environment draft visibly unavailable');
select throws_ok($$select pg_temp.review(jsonb_build_object('id','d4200000-0000-4000-8000-000000000099','previousId',null,
 'reviewKey',pg_temp.review(null,'d4000000-0000-4000-8000-000000000001','production')->>'reviewKey',
 'choices',jsonb_build_object('photos','[]'::jsonb,'logo',null,'stamp',(select v from fixtures where k='draft'))),
 'd4000000-0000-4000-8000-000000000001','production')$$,'22023','Invalid review','foreign-environment uploaded stamp cannot be reviewed');
update public.stamp_artwork_versions set creator_name='Synthetic changed artist' where id=((select v from fixtures where k='draft')#>>'{}')::uuid;
select is(pg_temp.review()->'review'->>'current','false','changed draft creator credit invalidates review');
select pg_temp.review(pg_temp.payload(10,jsonb_set(pg_temp.choices(),'{stamp}',(select v from fixtures where k='draft'))));
select public.stamp_artwork_draft_operation('d4000000-0000-4000-8000-000000000001','staging','00000000-0000-4000-8000-000000000301','activate',
 jsonb_build_object('versionId',(select v from fixtures where k='draft'),'revision',(select md5(to_jsonb(av)::text) from public.stamp_artwork_versions av where id=((select v from fixtures where k='draft')#>>'{}')::uuid)));
select is(pg_temp.review()->'review'->>'current','false','active artwork change invalidates review');
select pg_temp.review(pg_temp.payload(11));
update public.shop_types set sort_order=sort_order+1 where id in (select shop_type_id from public.shop_shop_types where shop_id='00000000-0000-4000-8000-000000000301');
select is(pg_temp.review()->'review'->>'current','false','referenced vocabulary rendering order invalidates review');
select pg_temp.review(pg_temp.payload(12));
-- Audit insertion failure rolls the review mutation back atomically.
insert into fixtures values('before_audit_failure',pg_temp.review()->'review');
create function pg_temp.fail_review_event() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure' using errcode='23514'; end; $$;
create trigger synthetic_audit_failure before insert on public.shop_review_events for each row execute function pg_temp.fail_review_event();
select throws_ok($$select pg_temp.review(pg_temp.payload(13))$$,'23514','Synthetic audit failure','audit failure rolls back save');
drop trigger synthetic_audit_failure on public.shop_review_events;
select is(pg_temp.review()->'review',(select v from fixtures where k='before_audit_failure'),'failed audit leaves exact prior review');
select is(public.shop_review_operation('d4000000-0000-4000-8000-000000000002','staging','00000000-0000-4000-8000-000000000301',
 jsonb_build_object('id','d4200000-0000-4000-8000-000000000090','previousId',null,'reviewKey',pg_temp.review()->>'reviewKey',
 'choices','{"photos":[],"logo":null,"stamp":null}'::jsonb))->'review'->>'current','true','editor may save own review without gaining activation authority');
-- Current-role revocation, grants and append-only audit.
select throws_ok($$select pg_temp.review(null,'d4000000-0000-4000-8000-000000000003')$$,'42501','Admin access denied','ordinary user denied');
select throws_ok($$select pg_temp.review(null,null)$$,'42501','Admin access denied','missing actor denied');
select public.assign_profile_role('d4000000-0000-4000-8000-000000000001','user');
select throws_ok($$select pg_temp.review()$$,'42501','Admin access denied','revocation denies retained review read');
select ok(not has_function_privilege('authenticated','public.shop_review_operation(uuid,text,uuid,jsonb)','execute'),'browser cannot spoof actor/environment directly');
select ok(not has_function_privilege('anon','public.shop_review_operation(uuid,text,uuid,jsonb)','execute'),'anonymous RPC denied');
select ok(has_function_privilege('service_role','public.shop_review_operation(uuid,text,uuid,jsonb)','execute'),'server RPC granted');
select ok(not has_table_privilege(role,tab,priv),'no direct '||role||' '||tab||' '||priv)
 from unnest(array['anon','authenticated','service_role']) role cross join unnest(array['public.shop_reviews','public.shop_review_events']) tab cross join unnest(array['select','insert','update','delete','truncate']) priv;
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in ('public.shop_reviews'::regclass,'public.shop_review_events'::regclass)),'RLS forced');
select throws_ok($$update public.shop_review_events set choices_hash=repeat('f',64)$$,'42501','Audit history is append-only','audit mutation refused');
-- Include dependent D4d ledgers so this reaches the append-only trigger rather
-- than stopping at PostgreSQL's earlier foreign-key dependency check.
select throws_ok($$truncate public.shop_review_events cascade$$,'42501','Audit history is append-only','audit truncation refused');
select * from finish();
rollback;
