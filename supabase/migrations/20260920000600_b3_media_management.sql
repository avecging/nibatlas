-- B3: preserve attachment identity/receipts while permitting removal and arrangement.
-- sort_order and its index already exist in the catalogue foundation.
alter table public.shop_images add column caption text check (length(caption)<=300);
create or replace function public.protect_shop_media_identity()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.upload_id is not null and (tg_op='DELETE' or
    (to_jsonb(new)-array['moderation_status','sort_order','caption','updated_at']) is distinct from
    (to_jsonb(old)-array['moderation_status','sort_order','caption','updated_at']) or
    (old.moderation_status='rejected' and new.moderation_status<>'rejected')) then
    raise exception 'Attached media identity is immutable' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;

create or replace function public.shop_media_operation(p_actor uuid,p_environment text,p_shop uuid,p_action text,
  p_id uuid default null,p_revision text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; u public.media_uploads; i public.shop_images; old_actor text; result jsonb; actor_role text;
begin
  if p_environment is null or p_environment not in ('staging','production') or p_shop is null
    or p_action is null or p_action not in ('list','attach','publish','hide','remove','preview','public_list','public_file') then
    raise exception 'Invalid media request' using errcode='22023'; end if;
  if p_action not in ('public_list','public_file') then
    select role into actor_role from public.profiles where id=p_actor and role in ('editor','admin') for update;
    if not found or (p_action in ('publish','hide','remove') and actor_role<>'admin') then
      raise exception 'Admin access denied' using errcode='42501'; end if;
  end if;
  -- Serialize per-shop attachments and logo replacement; blocks concurrent archive.
  select * into s from public.shops where id=p_shop for update;
  if not found or (p_environment='production' and s.source_quality='demo')
    or (p_action in ('public_list','public_file') and s.publication_status<>'published') then
    raise exception 'Media not found' using errcode='P0002'; end if;
  if p_action in ('attach','publish','hide','remove') and s.publication_status='archived' then
    raise exception 'Invalid media target' using errcode='22023'; end if;
  if p_action='attach' then
    select * into u from public.media_uploads where id=p_id and created_by=p_actor
      and environment=p_environment and shop_id=p_shop and purpose in ('shop_photo','shop_logo') and status='validated' for share;
    if not found then raise exception 'Invalid media target' using errcode='22023'; end if;
    select * into i from public.shop_images where upload_id=u.id;
    if found and i.moderation_status='rejected' then
      raise exception 'Invalid media target' using errcode='22023';
    end if;
    if not found then
      if (select count(*) from public.shop_images where shop_id=p_shop and upload_id is not null)>=50 then
        raise exception 'Shop media limit' using errcode='54000'; end if;
      old_actor:=current_setting('nibatlas.media_actor',true);
      perform set_config('nibatlas.media_actor',p_actor::text,true);
      insert into public.shop_images(shop_id,upload_id,kind,storage_key,width,height,content_type,alt_text,credit_text,rights_basis,sort_order)
      values(p_shop,u.id,case when u.purpose='shop_logo' then 'logo' else 'photo' end,u.storage_key,u.width,u.height,'image/png',u.alt_text,u.credit_text,u.rights_basis,
        (select coalesce(max(im.sort_order)+1,0) from public.shop_images im join public.media_uploads m on m.id=im.upload_id
          where im.shop_id=p_shop and m.environment=p_environment));
      perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
    end if;
  elsif p_action in ('publish','hide','remove','preview','public_file') then
    select im.* into i from public.shop_images im join public.media_uploads m on m.id=im.upload_id
      where im.id=p_id and im.shop_id=p_shop and m.environment=p_environment and m.status='validated'
      and im.moderation_status<>'rejected'
      and (p_action<>'public_file' or im.moderation_status='approved') for update of im;
    if not found then raise exception 'Media not found' using errcode='P0002'; end if;
    if p_action in ('preview','public_file') then
      return jsonb_build_object('storageKey',i.storage_key);
    end if;
    if p_revision is null or p_revision<>md5(to_jsonb(i)::text) then
      raise exception 'Media changed; reload' using errcode='40001'; end if;
    old_actor:=current_setting('nibatlas.media_actor',true);
    perform set_config('nibatlas.media_actor',p_actor::text,true);
    if p_action='publish' and i.kind='logo' then
      update public.shop_images set moderation_status='draft' where shop_id=p_shop and kind='logo'
        and moderation_status='approved' and id<>i.id
        and upload_id in (select id from public.media_uploads where environment=p_environment);
    end if;
    if i.moderation_status is distinct from (case when p_action='publish' then 'approved' when p_action='remove' then 'rejected' else 'draft' end)::public.image_moderation_status then
      update public.shop_images set moderation_status=(case when p_action='publish' then 'approved' when p_action='remove' then 'rejected' else 'draft' end)::public.image_moderation_status where id=i.id;
    end if;
    perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',im.id,'kind',im.kind,'width',im.width,'height',im.height,
    'altText',coalesce(nullif(btrim(im.alt_text),''),case when im.kind='logo' then s.name||' logo' else 'Photo of '||s.name end),
    'creditText',im.credit_text,'sortOrder',im.sort_order,'caption',im.caption) || case when p_action='public_list' then '{}'::jsonb else
    jsonb_build_object('status',im.moderation_status,'revision',md5(to_jsonb(im)::text)) end order by im.sort_order,im.created_at,im.id),'[]'::jsonb)
    into result from public.shop_images im join public.media_uploads m on m.id=im.upload_id
    where im.shop_id=p_shop and m.environment=p_environment and m.status='validated'
      and im.moderation_status<>'rejected'
      and (p_action<>'public_list' or im.moderation_status='approved');
  return result;
end; $$;
revoke all on function public.shop_media_operation(uuid,text,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.shop_media_operation(uuid,text,uuid,text,uuid,text) to service_role;

-- Per-image revisions bind the whole displayed gallery, including private images.
create function public.shop_media_arrange(p_actor uuid,p_environment text,p_shop uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; ids jsonb; entry jsonb; old_actor text; n integer; i public.shop_images;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for update;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_environment is null or p_environment not in ('staging','production') or p_shop is null then
    raise exception 'Invalid media target' using errcode='22023'; end if;
  select * into s from public.shops where id=p_shop for update;
  if not found or (p_environment='production' and s.source_quality='demo') then
    raise exception 'Media not found' using errcode='P0002'; end if;
  if s.publication_status='archived' then raise exception 'Invalid media target' using errcode='22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or
    p_payload-array['order','captions','revisions']<>'{}'::jsonb or
    jsonb_typeof(p_payload->'order') is distinct from 'array' or
    jsonb_typeof(p_payload->'captions') is distinct from 'object' or
    jsonb_typeof(p_payload->'revisions') is distinct from 'object' then
    raise exception 'Invalid media target' using errcode='22023'; end if;
  ids:=p_payload->'order'; n:=jsonb_array_length(ids);
  if n>50 or exists(select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') or
    (select count(distinct value) from jsonb_array_elements_text(ids))<>n or
    (select count(*) from jsonb_object_keys(p_payload->'revisions'))<>n or
    exists(select 1 from jsonb_object_keys(p_payload->'captions') k where not ids ? k) then
    raise exception 'Invalid media target' using errcode='22023'; end if;
  if (select count(*) from public.shop_images im join public.media_uploads m on m.id=im.upload_id
      where im.shop_id=p_shop and m.environment=p_environment and m.status='validated' and im.moderation_status<>'rejected')<>n then
    raise exception 'Invalid media target' using errcode='22023'; end if;
  -- Validate every entry before writing anything. Unknown/foreign/removed IDs cannot be smuggled in.
  for entry in select value from jsonb_array_elements(ids) loop
    select im.* into i from public.shop_images im join public.media_uploads m on m.id=im.upload_id
      where im.id=(entry#>>'{}')::uuid and im.shop_id=p_shop and m.environment=p_environment
        and m.status='validated' and im.moderation_status<>'rejected' for update of im;
    if not found then raise exception 'Invalid media target' using errcode='22023'; end if;
    if p_payload->'revisions'->>i.id::text is distinct from md5(to_jsonb(i)::text) then
      raise exception 'Media changed; reload' using errcode='40001'; end if;
    if p_payload->'captions' ? i.id::text and
      (jsonb_typeof(p_payload->'captions'->i.id::text) not in ('string','null') or length(p_payload->'captions'->>i.id::text)>300) then
      raise exception 'Invalid media target' using errcode='22023'; end if;
  end loop;
  old_actor:=current_setting('nibatlas.media_actor',true);
  perform set_config('nibatlas.media_actor',p_actor::text,true);
  update public.shop_images im set sort_order=o.ordinality-1,
    caption=case when p_payload->'captions' ? im.id::text then nullif(btrim(p_payload->'captions'->>im.id::text),'') else im.caption end
    from jsonb_array_elements_text(ids) with ordinality o(id,ordinality)
    where im.id=o.id::uuid;
  perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
  return public.shop_media_operation(p_actor,p_environment,p_shop,'list');
end; $$;
revoke all on function public.shop_media_arrange(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.shop_media_arrange(uuid,text,uuid,jsonb) to service_role;
