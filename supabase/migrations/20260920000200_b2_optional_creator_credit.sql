-- B2a: optional truthful creator credit, including issued uploaded snapshots.
-- No artwork/collection backfill or guard suspension. Historical credits stay intact.
alter table public.stamp_artwork_versions drop constraint stamp_artwork_creator_shape;
alter table public.stamp_artwork_versions add constraint stamp_artwork_creator_shape check (
  artwork_kind<>'uploaded' or (
    (creator_name is null or (creator_name=btrim(creator_name) and char_length(creator_name) between 1 and 300))
    and (creator_url is null or (creator_name is not null and char_length(creator_url) between 1 and 2000 and creator_url ~* '^https?://'))
  )
);
alter table public.stamp_artwork_versions drop constraint uploaded_stamp_artwork_complete;
alter table public.stamp_artwork_versions add constraint uploaded_stamp_artwork_complete check (
  artwork_kind<>'uploaded' or approval_status<>'approved' or (
    upload_id is not null
    and transparent_png_key is not null and length(btrim(transparent_png_key))>0
    and transparent_png_sha256 ~ '^[0-9a-f]{64}$'
  )
);
alter table public.stamp_collections drop constraint stamp_collections_stamp_snapshot_valid;
alter table public.stamp_collections add constraint stamp_collections_stamp_snapshot_valid check (
  jsonb_typeof(stamp_snapshot)='object'
  and stamp_snapshot ?& array['id','designVersion','artworkKind','ink','paletteVersion']
  and coalesce(stamp_snapshot->>'id','')=stamp_id::text
  and coalesce(stamp_snapshot->>'designVersion','')=stamp_design_version::text
  and coalesce(stamp_snapshot->>'artworkKind','') in ('generated_template','commissioned','uploaded')
  and coalesce(stamp_snapshot->>'ink','') in ('vermilion','navy','teal','indigo','plum','moss','ochre','brick')
  and coalesce(stamp_snapshot->>'paletteVersion','') ~ '^[1-9][0-9]*$'
  and (stamp_snapshot->>'artworkKind'<>'generated_template'
    or jsonb_typeof(stamp_snapshot->'templateData')='object')
  and (stamp_snapshot->>'artworkKind'<>'commissioned'
    or length(btrim(coalesce(stamp_snapshot->>'illustratorCredit','')))>0)
  and (stamp_snapshot->>'artworkKind'<>'uploaded'
    or (stamp_snapshot->>'artworkOrigin' in ('founder_created','ai_assisted','commissioned')
      and (stamp_snapshot->>'creatorName' is null or (
        jsonb_typeof(stamp_snapshot->'creatorName')='string'
        and length(btrim(stamp_snapshot->>'creatorName')) between 1 and 300))
      and (stamp_snapshot->>'creatorUrl' is null or (
        stamp_snapshot->>'creatorName' is not null
        and jsonb_typeof(stamp_snapshot->'creatorUrl')='string'
        and length(stamp_snapshot->>'creatorUrl') between 1 and 2000
        and stamp_snapshot->>'creatorUrl' ~* '^https?://'))
      and coalesce(stamp_snapshot->>'transparentPngSha256','') ~ '^[0-9a-f]{64}$'))
);

create or replace function public.stamp_artwork_draft_operation(
  p_actor uuid,p_environment text,p_shop uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; st public.stamps; a public.stamp_artwork_versions;
  u public.media_uploads; v integer; old_actor text; result jsonb; actor_role text;
begin
  select role into actor_role from public.profiles where id=p_actor and role in ('editor','admin') for update;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_environment is null or p_environment not in ('staging','production') or p_shop is null
    or p_action is null or p_action not in ('list','create','attach','activate','preview','ensure_default') then
    raise exception 'Invalid stamp request' using errcode='22023'; end if;
  select * into s from public.shops where id=p_shop for update;
  if not found or s.publication_status='archived'
    or (p_environment='production' and s.source_quality='demo') then
    raise exception 'Invalid stamp target' using errcode='22023'; end if;

  if p_action='ensure_default' then
    if p_payload is distinct from '{}'::jsonb then
      raise exception 'Invalid stamp request' using errcode='22023'; end if;
    perform public.ensure_shop_generated_default(p_actor,p_shop);
  elsif p_action='create' then
    if (select count(*) from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
      where x.shop_id=p_shop and x.stamp_type='atlas')>=50 then
      raise exception 'Stamp version limit reached' using errcode='54000'; end if;
    perform public.check_edit_object(p_payload,
      '{"origin":"text","creatorName":"text","creatorUrl":"text","ink":"text"}',
      array['origin','ink']);
    if p_payload->>'origin' not in ('founder_created','ai_assisted','commissioned')
      or char_length(p_payload->>'creatorName')>300
      or (p_payload->>'creatorUrl' is not null and
        (nullif(btrim(p_payload->>'creatorName'),'') is null
         or nullif(btrim(p_payload->>'creatorUrl'),'') is null
         or char_length(p_payload->>'creatorUrl')>2000
         or p_payload->>'creatorUrl' !~* '^https?://')) then
      raise exception 'Invalid stamp metadata' using errcode='22023'; end if;
    select * into st from public.stamps where shop_id=p_shop and stamp_type='atlas'
      order by (status='active') desc,created_at,id limit 1 for update;
    old_actor:=current_setting('nibatlas.media_actor',true);
    perform set_config('nibatlas.media_actor',p_actor::text,true);
    if st.id is null then
      insert into public.stamps(shop_id,name) values(p_shop,left(s.name||' Atlas Stamp',120))
        returning * into st;
    end if;
    select coalesce(max(design_version),0)+1 into v from public.stamp_artwork_versions
      where stamp_id=st.id;
    insert into public.stamp_artwork_versions(stamp_id,design_version,artwork_kind,artwork_origin,
      creator_name,creator_url,ink,palette_version)
    values(st.id,v,'uploaded',p_payload->>'origin',nullif(btrim(p_payload->>'creatorName'),''),
      nullif(btrim(p_payload->>'creatorUrl'),''),(p_payload->>'ink')::public.stamp_ink,1)
      returning * into a;
    perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
  elsif p_action='attach' then
    perform public.check_edit_object(p_payload,'{"versionId":"uuid","uploadId":"uuid"}',
      array['versionId','uploadId']);
    select av.* into a from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
      where av.id=(p_payload->>'versionId')::uuid and x.shop_id=p_shop
        and av.artwork_kind='uploaded' and av.approval_status='draft' for update of av;
    if not found then raise exception 'Invalid stamp target' using errcode='22023'; end if;
    select * into u from public.media_uploads where id=(p_payload->>'uploadId')::uuid
      and created_by=p_actor and environment=p_environment and shop_id=p_shop
      and artwork_version_id=a.id and purpose='artwork_png' and status='validated'
      and content_type='image/png' and width=1200 and height=800 for share;
    if not found then raise exception 'Invalid stamp target' using errcode='22023'; end if;
    if a.upload_id is not null and a.upload_id<>u.id then
      raise exception 'Artwork already attached' using errcode='23505'; end if;
    if a.upload_id is null then
      old_actor:=current_setting('nibatlas.media_actor',true);
      perform set_config('nibatlas.media_actor',p_actor::text,true);
      update public.stamp_artwork_versions set upload_id=u.id,transparent_png_key=u.storage_key,
        transparent_png_sha256=u.sha256 where id=a.id returning * into a;
      perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
    end if;
  elsif p_action='activate' then
    if actor_role<>'admin' then raise exception 'Admin access denied' using errcode='42501'; end if;
    perform public.check_edit_object(p_payload,'{"versionId":"uuid","revision":"text"}',
      array['versionId','revision']);
    if p_payload->>'revision' !~ '^[a-f0-9]{32}$' then
      raise exception 'Invalid stamp request' using errcode='22023'; end if;
    select av.* into a from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
      where av.id=(p_payload->>'versionId')::uuid and x.shop_id=p_shop
        and av.artwork_kind='uploaded' and av.approval_status='draft' for update of av;
    if not found or a.upload_id is null or a.transparent_png_key is null
      or a.transparent_png_sha256 is null then
      raise exception 'Invalid stamp target' using errcode='22023'; end if;
    if md5(to_jsonb(a)::text)<>p_payload->>'revision' then
      raise exception 'Stamp artwork changed; reload' using errcode='40001'; end if;
    if not exists(select 1 from public.media_uploads receipt where receipt.id=a.upload_id
      and receipt.environment=p_environment and receipt.status='validated' and receipt.artwork_version_id=a.id) then
      raise exception 'Invalid stamp target' using errcode='22023'; end if;
    select * into st from public.stamps where id=a.stamp_id for update;
    old_actor:=current_setting('nibatlas.media_actor',true);
    perform set_config('nibatlas.media_actor',p_actor::text,true);
    update public.stamp_artwork_versions set approval_status='approved',
      approved_at=statement_timestamp() where id=a.id returning * into a;
    update public.stamps set current_design_version=a.design_version,status='active'
      where id=st.id returning * into st;
    perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
  elsif p_action='preview' then
    perform public.check_edit_object(p_payload,'{"versionId":"uuid"}',array['versionId']);
    select av.* into a from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
      where av.id=(p_payload->>'versionId')::uuid and x.shop_id=p_shop and av.upload_id is not null
        and exists(select 1 from public.media_uploads receipt where receipt.id=av.upload_id
          and receipt.environment=p_environment and receipt.status='validated');
    if not found then raise exception 'Stamp artwork not found' using errcode='P0002'; end if;
    return jsonb_build_object('storageKey',a.transparent_png_key);
  elsif p_payload<>'{}'::jsonb then
    raise exception 'Invalid stamp request' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',av.id,'stampId',st2.id,'designVersion',av.design_version,
      'kind',av.artwork_kind,'origin',av.artwork_origin,'status',av.approval_status,
      'templateData',case when av.artwork_kind='generated_template' then av.template_data else null end,
      'ink',av.ink,'creatorName',av.creator_name,'creatorUrl',av.creator_url,
      'hasArtwork',av.upload_id is not null,
      'active',st2.status='active' and st2.current_design_version=av.design_version,
      'revision',md5(to_jsonb(av)::text))
    order by av.design_version desc),'[]'::jsonb) into result
  from public.stamps st2 join public.stamp_artwork_versions av on av.stamp_id=st2.id
  where st2.shop_id=p_shop and st2.stamp_type='atlas';
  return result;
end; $$;
revoke all on function public.stamp_artwork_draft_operation(uuid,text,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.stamp_artwork_draft_operation(uuid,text,uuid,text,jsonb)
  to service_role;
