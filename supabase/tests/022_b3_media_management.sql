begin;
select no_plan();
insert into auth.users(id) values('82000000-0000-4000-8000-000000000001'),('82000000-0000-4000-8000-000000000002');
select public.assign_profile_role('82000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('82000000-0000-4000-8000-000000000002','editor');
update public.shops set source_quality='sourced' where id='00000000-0000-4000-8000-000000000301';
create function pg_temp.op(action text,id uuid default null,revision text default null,actor uuid default '82000000-0000-4000-8000-000000000001')
returns jsonb language sql as $$ select public.shop_media_operation(actor,'staging','00000000-0000-4000-8000-000000000301',action,id,revision) $$;
create function pg_temp.make_image(n int,env text default 'staging',purpose text default 'shop_photo') returns uuid language plpgsql as $$
declare upload uuid:=('82000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; image uuid;
begin
  perform public.media_upload_operation('82000000-0000-4000-8000-000000000001',env,'initiate',upload,jsonb_build_object('shopId','00000000-0000-4000-8000-000000000301','purpose',purpose,'sha256',repeat('a',64),'byteSize',100,'contentType','image/png'));
  perform public.media_upload_operation('82000000-0000-4000-8000-000000000001',env,'finalize',upload,jsonb_build_object('sha256',repeat('a',64),'byteSize',100,'width',2,'height',2));
  perform public.shop_media_operation('82000000-0000-4000-8000-000000000001',env,'00000000-0000-4000-8000-000000000301','attach',upload);
  select id into image from public.shop_images where upload_id=upload;
  return image;
end; $$;
create temp table images(n int primary key,id uuid);
insert into images values (1,pg_temp.make_image(10)),(2,pg_temp.make_image(11)),(3,pg_temp.make_image(12,'production')),(4,pg_temp.make_image(13,'staging','shop_logo'));
create function pg_temp.id(n int) returns uuid language sql as $$ select id from images where images.n=$1 $$;
create function pg_temp.rev(n int) returns text language sql as $$ select md5(to_jsonb(i)::text) from public.shop_images i where id=pg_temp.id(n) $$;
create function pg_temp.arrangement() returns jsonb language sql as $$
  select jsonb_build_object('order',jsonb_agg(e->'id' order by ord desc),'captions','{}'::jsonb,'revisions',jsonb_object_agg(e->>'id',e->'revision'))
    from jsonb_array_elements(pg_temp.op('list')) with ordinality t(e,ord)
$$;
create function pg_temp.arrange(payload jsonb,actor uuid default '82000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
  select public.shop_media_arrange(actor,'staging','00000000-0000-4000-8000-000000000301',payload)
$$;
select pg_temp.op('publish',pg_temp.id(1),pg_temp.rev(1));
create temp table checked as select pg_temp.arrangement() payload;
select lives_ok($$select pg_temp.arrange((select payload||jsonb_build_object('captions',jsonb_build_object(pg_temp.id(1)::text,'墨水 <script>literal</script>',pg_temp.id(2)::text,'Private caption')) from checked))$$,'Unicode captions and reorder save');
select is(pg_temp.op('list')->0->>'id',pg_temp.id(4)::text,'complete explicit order round-trips');
select is(pg_temp.op('public_list')->0->>'caption','墨水 <script>literal</script>','public caption is plain text, not invented credit');
select is(jsonb_array_length(pg_temp.op('public_list')),1,'arrange never publishes private photos/logo');
select is((select caption from public.shop_images where id=pg_temp.id(3)),null,'other environment unchanged');
select throws_ok($$select pg_temp.arrange((select payload from checked))$$,'40001','Media changed; reload','stale gallery revision conflicts');
select throws_ok($$select pg_temp.arrange(jsonb_set(pg_temp.arrangement(),'{order}',jsonb_build_array(pg_temp.id(1))))$$,'22023','Invalid media target','partial order refused');
select throws_ok($$select pg_temp.arrange(jsonb_set(pg_temp.arrangement(),'{order}',jsonb_build_array(pg_temp.id(1),pg_temp.id(2),pg_temp.id(3))))$$,'22023','Invalid media target','foreign environment refused');
select throws_ok($$select pg_temp.arrange(pg_temp.arrangement()||jsonb_build_object('captions',jsonb_build_object(pg_temp.id(1)::text,repeat('x',301))))$$,'22023','Invalid media target','caption bounded in SQL');
select throws_ok($$select pg_temp.arrange(pg_temp.arrangement(),'82000000-0000-4000-8000-000000000002')$$,'42501','Admin access denied','editor cannot arrange');
select throws_ok($$select pg_temp.op('remove',pg_temp.id(1),pg_temp.rev(1),'82000000-0000-4000-8000-000000000002')$$,'42501','Admin access denied','editor cannot remove');
select throws_ok($$select pg_temp.op('remove',pg_temp.id(1),repeat('0',32))$$,'40001','Media changed; reload','stale removal cannot mutate');
select pg_temp.op('remove',pg_temp.id(2),pg_temp.rev(2));
select is(jsonb_array_length(pg_temp.op('public_list')),1,'private removal preserves live gallery');
select pg_temp.op('remove',pg_temp.id(1),pg_temp.rev(1));
select is(jsonb_array_length(pg_temp.op('public_list')),0,'published removal withdraws live delivery');
select is(jsonb_array_length(pg_temp.op('list')),1,'removed photos absent from private list');
select throws_ok($$select pg_temp.op('preview',pg_temp.id(1))$$,'P0002','Media not found','removed private bytes denied');
select throws_ok($$select pg_temp.op('public_file',pg_temp.id(1))$$,'P0002','Media not found','removed public bytes denied');
select throws_ok($$select pg_temp.op('attach','82000000-0000-4000-8000-000000000010')$$,'22023','Invalid media target','removed receipt cannot reattach');
select throws_ok($$update public.shop_images set moderation_status='draft' where id=pg_temp.id(1)$$,'42501','Attached media identity is immutable','rejected attachment cannot be revived directly');
select is((select count(*) from public.shop_images where id in (select id from images)),4::bigint,'identities retained including removed images');
select ok((select bool_and(actor_user_id='82000000-0000-4000-8000-000000000001' and actor_kind='account') from public.admin_audit_log where entity_type='shop_images'),'audit captures real admin');
select ok(not has_function_privilege('authenticated','public.shop_media_arrange(uuid,text,uuid,jsonb)','EXECUTE'),'browser cannot call service RPC');
update public.shops set publication_status='archived' where id='00000000-0000-4000-8000-000000000301';
select throws_ok($$select pg_temp.op('remove',pg_temp.id(4),pg_temp.rev(4))$$,'22023','Invalid media target','archived removal refused');
select throws_ok($$select pg_temp.arrange(pg_temp.arrangement())$$,'22023','Invalid media target','archived arrangement refused');
select * from finish();
rollback;
