-- Reuse the bounded JPEG transformation for logos; stamp PNGs remain exact.
alter table public.media_uploads drop constraint media_uploads_content_type_check;
alter table public.media_uploads add constraint media_uploads_content_type_check
  check (content_type='image/png' or (content_type='image/jpeg' and purpose in ('shop_photo','shop_logo')));

create or replace function public.media_upload_operation(p_actor uuid, p_environment text, p_action text,
  p_id uuid, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.media_uploads; a public.stamp_artwork_versions; s public.shops; old_actor text;
begin
  perform 1 from public.profiles where id=p_actor and role in ('editor','admin') for update;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_environment is null or p_environment not in ('staging','production') or p_id is null
    or p_action is null or p_action not in ('initiate','read','prepare','finalize') then
    raise exception 'Invalid media request' using errcode='22023'; end if;
  if p_action='initiate' then
    perform public.check_edit_object(p_payload,
      '{"shopId":"uuid","artworkVersionId":"uuid","purpose":"text","sha256":"text","byteSize":"number","contentType":"text","sourceRef":"text","rightsBasis":"text","creditText":"text","altText":"text"}',
      array['shopId','purpose','sha256','byteSize','contentType']);
    if (p_payload->>'byteSize')::numeric <> trunc((p_payload->>'byteSize')::numeric) then
      raise exception 'Invalid media size' using errcode='22023'; end if;
    if (select count(*) from public.media_uploads where created_by=p_actor
      and created_at>statement_timestamp()-interval '24 hours')>=100 then
      raise exception 'Upload limit reached' using errcode='54000'; end if;
    select * into s from public.shops where id=(p_payload->>'shopId')::uuid for share;
    if not found or s.publication_status='archived'
      or (p_environment='production' and s.source_quality='demo') then
      raise exception 'Invalid media target' using errcode='22023'; end if;
    if p_payload->>'purpose'='artwork_png' then
      select av.* into a from public.stamp_artwork_versions av
        join public.stamps st on st.id=av.stamp_id
        where av.id=(p_payload->>'artworkVersionId')::uuid and st.shop_id=s.id for share of av;
      if not found or a.approval_status<>'draft' or a.artwork_kind<>'uploaded' or a.upload_id is not null then
        raise exception 'Invalid media target' using errcode='22023'; end if;
      if p_payload ?| array['sourceRef','rightsBasis','creditText','altText'] then
        raise exception 'Artwork upload metadata belongs to the version' using errcode='22023'; end if;
    end if;
    old_actor:=current_setting('nibatlas.media_actor',true);
    perform set_config('nibatlas.media_actor',p_actor::text,true);
    insert into public.media_uploads(id,created_by,environment,shop_id,artwork_version_id,purpose,storage_key,
      sha256,byte_size,content_type,source_ref,rights_basis,credit_text,alt_text)
    values(p_id,p_actor,p_environment,s.id,(p_payload->>'artworkVersionId')::uuid,p_payload->>'purpose',
      case when p_payload->>'contentType'='image/png'
        then p_environment||'/media/'||p_id::text||'/v1/'||(p_payload->>'sha256')||'.png' else null end,
      p_payload->>'sha256',(p_payload->>'byteSize')::integer,p_payload->>'contentType',
      p_payload->>'sourceRef',p_payload->>'rightsBasis',p_payload->>'creditText',p_payload->>'altText')
      returning * into u;
    perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
  else
    select * into u from public.media_uploads where id=p_id and created_by=p_actor
      and environment=p_environment for update;
    if not found then raise exception 'Upload not found' using errcode='P0002'; end if;
    if p_action in ('prepare','finalize') and u.status='pending' then
      if u.expires_at<=statement_timestamp() then raise exception 'Upload expired' using errcode='22023'; end if;
      perform 1 from public.shops where id=u.shop_id and publication_status<>'archived' for share;
      if not found then raise exception 'Invalid media target' using errcode='22023'; end if;
      if u.artwork_version_id is not null then
        perform 1 from public.stamp_artwork_versions where id=u.artwork_version_id
          and approval_status='draft' and artwork_kind='uploaded' and upload_id is null for share;
        if not found then raise exception 'Artwork changed; initiate again' using errcode='22023'; end if;
      end if;
      perform public.check_edit_object(p_payload,
        '{"sha256":"text","byteSize":"number","width":"number","height":"number"}',
        array['sha256','byteSize','width','height']);
      if exists(select 1 from jsonb_each(p_payload) e where e.key in ('byteSize','width','height')
        and (e.value::text)::numeric<>trunc((e.value::text)::numeric)) then
        raise exception 'Non-integer output' using errcode='22023'; end if;
      if p_action='prepare' then
        if u.content_type<>'image/jpeg' or u.purpose not in ('shop_photo','shop_logo') then
          raise exception 'Not a JPEG shop image' using errcode='22023'; end if;
        if u.output_sha256 is not null and
          p_payload<>jsonb_build_object('sha256',u.output_sha256,'byteSize',u.output_byte_size,
            'width',u.output_width,'height',u.output_height) then
          raise exception 'Output already bound; initiate again' using errcode='23505'; end if;
      elsif p_payload->>'sha256'<>coalesce(u.output_sha256,u.sha256)
        or (p_payload->>'byteSize')::numeric<>coalesce(u.output_byte_size,u.byte_size)
        or (u.content_type='image/jpeg' and (u.output_sha256 is null
          or (p_payload->>'width')::numeric<>u.output_width
          or (p_payload->>'height')::numeric<>u.output_height)) then
        raise exception 'Upload mismatch' using errcode='22023';
      end if;
      old_actor:=current_setting('nibatlas.media_actor',true);
      perform set_config('nibatlas.media_actor',p_actor::text,true);
      if p_action='prepare' then
        if u.output_sha256 is null then
          update public.media_uploads set output_sha256=p_payload->>'sha256',
            output_byte_size=(p_payload->>'byteSize')::integer,
            output_width=(p_payload->>'width')::integer,output_height=(p_payload->>'height')::integer,
            output_content_type='image/png',
            storage_key=environment||'/media/'||id::text||'/v1/'||(p_payload->>'sha256')||'.png'
            where id=u.id returning * into u;
        end if;
      else
        update public.media_uploads set status='validated',width=(p_payload->>'width')::integer,
          height=(p_payload->>'height')::integer,validated_at=statement_timestamp()
          where id=u.id returning * into u;
      end if;
      perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
    end if;
  end if;
  return jsonb_build_object('id',u.id,'storageKey',u.storage_key,'sha256',u.sha256,
    'byteSize',u.byte_size,'contentType',u.content_type,
    'output',case when u.output_sha256 is null then null else
      jsonb_build_object('sha256',u.output_sha256,'byteSize',u.output_byte_size,
        'width',u.output_width,'height',u.output_height) end,
    'purpose',u.purpose,'status',u.status,'expiresAt',u.expires_at,'width',u.width,'height',u.height);
end; $$;
revoke all on function public.media_upload_operation(uuid,text,text,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.media_upload_operation(uuid,text,text,uuid,jsonb) to service_role;
