-- Issue #73: photo/logo metadata is optional; do not invent values or rewrite history.
-- Stamp workflow is a separate slice: its existing gates remain explicit below.
alter table public.media_uploads alter column source_ref drop not null,
  alter column rights_basis drop not null, alter column credit_text drop not null,
  alter column alt_text drop not null;
alter table public.media_uploads drop constraint media_uploads_purpose_check;
alter table public.media_uploads add constraint media_uploads_purpose_check
  check (purpose in ('shop_photo','shop_logo','artwork_png'));
-- Logos accept unchanged PNG only, preserving transparency and complete artwork.
create or replace function public.media_upload_operation(p_actor uuid, p_environment text, p_action text,
  p_id uuid, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.media_uploads; a public.stamp_artwork_versions; s public.shops; old_actor text;
begin
  -- Server attests verified cookie identity and bytes. Browser RPC access is denied.
  -- Serialize initiation limits and concurrent revocation through this transaction.
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
    if (select count(*) from public.media_uploads where created_by=p_actor and created_at>statement_timestamp()-interval '24 hours') >= 100 then
      raise exception 'Upload limit reached' using errcode='54000'; end if;
    select * into s from public.shops where id=(p_payload->>'shopId')::uuid for share;
    if not found or s.publication_status='archived' or (p_environment='production' and s.source_quality='demo') then
      raise exception 'Invalid media target' using errcode='22023'; end if;
    if p_payload->>'purpose'='artwork_png' then
      select av.* into a from public.stamp_artwork_versions av join public.stamps st on st.id=av.stamp_id
        where av.id=(p_payload->>'artworkVersionId')::uuid and st.shop_id=s.id for share of av;
      if not found or a.approval_status<>'draft' or a.artwork_kind<>'commissioned' then
        raise exception 'Invalid media target' using errcode='22023'; end if;
      if nullif(btrim(p_payload->>'sourceRef'),'') is null or nullif(btrim(p_payload->>'altText'),'') is null
        or nullif(btrim(a.rights_basis),'') is null or nullif(btrim(a.illustrator_credit),'') is null then
        raise exception 'Artwork metadata incomplete' using errcode='22023'; end if;
      -- Reuse canonical rights and illustrator credit; never approval evidence.
      if p_payload ? 'rightsBasis' or p_payload ? 'creditText' then
        raise exception 'Use artwork rights and credit' using errcode='22023'; end if;
    end if;
    old_actor:=current_setting('nibatlas.media_actor',true);
    perform set_config('nibatlas.media_actor',p_actor::text,true);
    insert into public.media_uploads(id,created_by,environment,shop_id,artwork_version_id,purpose,storage_key,
      sha256,byte_size,content_type,source_ref,rights_basis,credit_text,alt_text)
    values(p_id,p_actor,p_environment,s.id,(p_payload->>'artworkVersionId')::uuid,p_payload->>'purpose',
      case when p_payload->>'contentType'='image/png' then p_environment||'/media/'||p_id::text||'/v1/'||(p_payload->>'sha256')||'.png' else null end,p_payload->>'sha256',
      (p_payload->>'byteSize')::integer,p_payload->>'contentType',p_payload->>'sourceRef',
      case when a.id is not null then a.rights_basis else p_payload->>'rightsBasis' end,
      case when a.id is not null then a.illustrator_credit else p_payload->>'creditText' end,p_payload->>'altText') returning * into u;
    perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
  else
    select * into u from public.media_uploads where id=p_id and created_by=p_actor and environment=p_environment for update;
    if not found then raise exception 'Upload not found' using errcode='P0002'; end if;
    if p_action in ('prepare','finalize') and u.status='pending' then
      if u.expires_at<=statement_timestamp() then raise exception 'Upload expired' using errcode='22023'; end if;
      perform 1 from public.shops where id=u.shop_id and publication_status<>'archived' for share;
      if not found then raise exception 'Invalid media target' using errcode='22023'; end if;
      if u.artwork_version_id is not null then
        perform 1 from public.stamp_artwork_versions where id=u.artwork_version_id
          and approval_status='draft' and artwork_kind='commissioned'
          and rights_basis=u.rights_basis and illustrator_credit=u.credit_text for share;
        if not found then raise exception 'Artwork changed; initiate again' using errcode='22023'; end if;
      end if;
      perform public.check_edit_object(p_payload,'{"sha256":"text","byteSize":"number","width":"number","height":"number"}',array['sha256','byteSize','width','height']);
      if exists (select 1 from jsonb_each(p_payload) e where e.key in ('byteSize','width','height')
        and (e.value::text)::numeric <> trunc((e.value::text)::numeric)) then
        raise exception 'Non-integer output' using errcode='22023'; end if;
      if p_action='prepare' then
        if u.content_type<>'image/jpeg' or u.purpose<>'shop_photo' then
          raise exception 'Not a JPEG photo' using errcode='22023'; end if;
        if u.output_sha256 is not null then
          if p_payload<>jsonb_build_object('sha256',u.output_sha256,'byteSize',u.output_byte_size,'width',u.output_width,'height',u.output_height) then
            raise exception 'Output already bound; initiate again' using errcode='23505'; end if;
        end if;
      elsif p_payload->>'sha256'<>coalesce(u.output_sha256,u.sha256)
        or (p_payload->>'byteSize')::numeric<>coalesce(u.output_byte_size,u.byte_size)
        or (u.content_type='image/jpeg' and (u.output_sha256 is null
          or (p_payload->>'width')::numeric<>u.output_width or (p_payload->>'height')::numeric<>u.output_height)) then
        raise exception 'Upload mismatch' using errcode='22023';
      end if;
      old_actor:=current_setting('nibatlas.media_actor',true);
      perform set_config('nibatlas.media_actor',p_actor::text,true);
      if p_action='prepare' then
        if u.output_sha256 is null then
          update public.media_uploads set output_sha256=p_payload->>'sha256',output_byte_size=(p_payload->>'byteSize')::integer,
            output_width=(p_payload->>'width')::integer,output_height=(p_payload->>'height')::integer,output_content_type='image/png',
            storage_key=environment||'/media/'||id::text||'/v1/'||(p_payload->>'sha256')||'.png'
          where id=u.id returning * into u;
        end if;
      else
      update public.media_uploads set status='validated',width=(p_payload->>'width')::integer,
        height=(p_payload->>'height')::integer,validated_at=statement_timestamp() where id=u.id returning * into u;
      end if;
      perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
    end if;
  end if;
  -- Private Worker-only projection; approval evidence is never returned.
  return jsonb_build_object('id',u.id,'storageKey',u.storage_key,'sha256',u.sha256,'byteSize',u.byte_size,
    'contentType',u.content_type,'output',case when u.output_sha256 is null then null else jsonb_build_object('sha256',u.output_sha256,'byteSize',u.output_byte_size,'width',u.output_width,'height',u.output_height) end,'purpose',u.purpose,'status',u.status,'expiresAt',u.expires_at,'width',u.width,'height',u.height);
end; $$;
revoke all on function public.media_upload_operation(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.media_upload_operation(uuid,text,text,uuid,jsonb) to service_role;

alter table public.shop_images add column upload_id uuid unique references public.media_uploads(id) on delete restrict,
  add column kind text not null default 'photo' check (kind in ('photo','logo'));
alter table public.shop_images drop constraint approved_image_metadata;
-- Accessible fallback text is derived from the actual shop name and media kind.
-- Existing optional metadata stays intact. Only validated receipts enter delivery.
revoke all on public.shop_images from public,anon,authenticated,service_role;

alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links','shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads','shop_images')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);
create function public.audit_shop_media()
returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb; actor uuid;
begin
  if tg_op<>'INSERT' then b:=to_jsonb(old)-array['created_at','updated_at']; end if;
  if tg_op<>'DELETE' then a:=to_jsonb(new)-array['created_at','updated_at']; end if;
  if a is not distinct from b then return null; end if;
  actor:=nullif(current_setting('nibatlas.media_actor',true),'')::uuid;
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary)
  values(actor,case when actor is null then 'database_operator' else 'account' end,
    'catalogue_'||lower(tg_op),'shop_images',(coalesce(a,b)->>'id')::uuid,
    case when b is null then '{}'::jsonb else jsonb_build_object('fingerprint',md5(b::text)) end,
    case when a is null then '{}'::jsonb else jsonb_build_object('fingerprint',md5(a::text)) end);
  return null;
end; $$;
revoke all on function public.audit_shop_media() from public,anon,authenticated,service_role;
create trigger shop_media_audit after insert or update or delete on public.shop_images for each row execute function public.audit_shop_media();
create trigger shop_media_no_truncate before truncate on public.shop_images for each statement execute function public.reject_catalogue_truncate();
create function public.protect_shop_media_identity()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.upload_id is not null and (tg_op='DELETE' or
    (to_jsonb(new)-array['moderation_status','updated_at']) is distinct from (to_jsonb(old)-array['moderation_status','updated_at'])) then
    raise exception 'Attached media identity is immutable' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
revoke all on function public.protect_shop_media_identity() from public,anon,authenticated,service_role;
create trigger shop_media_immutable before update or delete on public.shop_images for each row execute function public.protect_shop_media_identity();

-- Service-only. A null actor is allowed solely for the bounded published projection.
-- No public RPC returns private keys, source references, drafts or audit metadata.
create function public.shop_media_operation(p_actor uuid,p_environment text,p_shop uuid,p_action text,
  p_id uuid default null,p_revision text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; u public.media_uploads; i public.shop_images; old_actor text; result jsonb; actor_role text;
begin
  if p_environment is null or p_environment not in ('staging','production') or p_shop is null
    or p_action is null or p_action not in ('list','attach','publish','hide','preview','public_list','public_file') then
    raise exception 'Invalid media request' using errcode='22023'; end if;
  if p_action not in ('public_list','public_file') then
    select role into actor_role from public.profiles where id=p_actor and role in ('editor','admin') for update;
    if not found or (p_action in ('publish','hide') and actor_role<>'admin') then
      raise exception 'Admin access denied' using errcode='42501'; end if;
  end if;
  -- Serialize per-shop attachments and logo replacement; blocks concurrent archive.
  select * into s from public.shops where id=p_shop for update;
  if not found or (p_environment='production' and s.source_quality='demo')
    or (p_action in ('public_list','public_file') and s.publication_status<>'published') then
    raise exception 'Media not found' using errcode='P0002'; end if;
  if p_action in ('attach','publish','hide') and s.publication_status='archived' then
    raise exception 'Invalid media target' using errcode='22023'; end if;
  if p_action='attach' then
    select * into u from public.media_uploads where id=p_id and created_by=p_actor
      and environment=p_environment and shop_id=p_shop and purpose in ('shop_photo','shop_logo') and status='validated' for share;
    if not found then raise exception 'Invalid media target' using errcode='22023'; end if;
    select * into i from public.shop_images where upload_id=u.id;
    if not found then
      if (select count(*) from public.shop_images where shop_id=p_shop and upload_id is not null)>=50 then
        raise exception 'Shop media limit' using errcode='54000'; end if;
      old_actor:=current_setting('nibatlas.media_actor',true);
      perform set_config('nibatlas.media_actor',p_actor::text,true);
      insert into public.shop_images(shop_id,upload_id,kind,storage_key,width,height,content_type,alt_text,credit_text,rights_basis)
      values(p_shop,u.id,case when u.purpose='shop_logo' then 'logo' else 'photo' end,u.storage_key,u.width,u.height,'image/png',u.alt_text,u.credit_text,u.rights_basis);
      perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
    end if;
  elsif p_action in ('publish','hide','preview','public_file') then
    select im.* into i from public.shop_images im join public.media_uploads m on m.id=im.upload_id
      where im.id=p_id and im.shop_id=p_shop and m.environment=p_environment and m.status='validated'
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
    if i.moderation_status is distinct from (case when p_action='publish' then 'approved' else 'draft' end)::public.image_moderation_status then
      update public.shop_images set moderation_status=(case when p_action='publish' then 'approved' else 'draft' end)::public.image_moderation_status where id=i.id;
    end if;
    perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',im.id,'kind',im.kind,'width',im.width,'height',im.height,
    'altText',coalesce(nullif(btrim(im.alt_text),''),case when im.kind='logo' then s.name||' logo' else 'Photo of '||s.name end),
    'creditText',im.credit_text) || case when p_action='public_list' then '{}'::jsonb else
    jsonb_build_object('status',im.moderation_status,'revision',md5(to_jsonb(im)::text)) end order by im.created_at,im.id),'[]'::jsonb)
    into result from public.shop_images im join public.media_uploads m on m.id=im.upload_id
    where im.shop_id=p_shop and m.environment=p_environment and m.status='validated'
      and (p_action<>'public_list' or im.moderation_status='approved');
  return result;
end; $$;
revoke all on function public.shop_media_operation(uuid,text,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.shop_media_operation(uuid,text,uuid,text,uuid,text) to service_role;
