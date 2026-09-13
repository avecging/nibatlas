-- WP3 first slice: private transport manifests, NOT an artwork approval model.
-- Existing artwork versions, shop_images and collected snapshots are untouched.
create table public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  environment text not null check (environment in ('staging','production')),
  shop_id uuid not null references public.shops(id) on delete restrict,
  artwork_version_id uuid references public.stamp_artwork_versions(id) on delete restrict,
  purpose text not null check (purpose in ('artwork_png','shop_photo')),
  storage_key text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size integer not null check (byte_size between 1 and 5242880),
  content_type text not null check (content_type='image/png'),
  source_ref text not null check (length(btrim(source_ref)) between 1 and 2000),
  rights_basis text not null check (length(btrim(rights_basis)) between 1 and 2000),
  credit_text text not null check (length(btrim(credit_text)) between 1 and 300),
  alt_text text not null check (length(btrim(alt_text)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','validated')),
  width integer, height integer,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '24 hours'),
  validated_at timestamptz,
  check ((purpose='artwork_png') = (artwork_version_id is not null)),
  check (storage_key = environment || '/media/' || id::text || '/v1/' || sha256 || '.png'),
  check ((status='pending' and width is null and height is null and validated_at is null)
    or (status='validated' and width is not null and height is not null and width between 1 and 2048 and height between 1 and 2048 and validated_at is not null)),
  check (purpose <> 'artwork_png' or status <> 'validated' or (width=1200 and height=800))
);
alter table public.media_uploads enable row level security;
alter table public.media_uploads force row level security;
revoke all on public.media_uploads from public, anon, authenticated, service_role;
create index media_uploads_actor_created on public.media_uploads(created_by,created_at);

-- Extend the same bounded fingerprint audit shape; never copy rights/evidence.
alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links','shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);
create function public.audit_media_upload()
returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb; actor uuid;
begin
  if tg_op <> 'INSERT' then b:=to_jsonb(old); end if;
  if tg_op <> 'DELETE' then a:=to_jsonb(new); end if;
  if a is not distinct from b then return null; end if;
  -- Set only by the service-only RPC. Operator writes remain honestly attributed.
  actor:=nullif(current_setting('nibatlas.media_actor',true),'')::uuid;
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary)
  values(actor,case when actor is null then 'database_operator' else 'account' end,
    'catalogue_'||lower(tg_op),'media_uploads',(coalesce(a,b)->>'id')::uuid,
    case when b is null then '{}'::jsonb else jsonb_build_object('fingerprint',md5(b::text)) end,
    case when a is null then '{}'::jsonb else jsonb_build_object('fingerprint',md5(a::text)) end);
  return null;
end; $$;
revoke all on function public.audit_media_upload() from public,anon,authenticated,service_role;
create trigger media_upload_audit after insert or update or delete on public.media_uploads
  for each row execute function public.audit_media_upload();
create trigger media_upload_no_truncate before truncate on public.media_uploads
  for each statement execute function public.reject_catalogue_truncate();

create function public.protect_validated_media_upload()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='validated' then
    raise exception 'Validated upload is immutable' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
revoke all on function public.protect_validated_media_upload() from public,anon,authenticated,service_role;
create trigger media_upload_immutable before update or delete on public.media_uploads
  for each row execute function public.protect_validated_media_upload();

create function public.media_upload_operation(p_actor uuid, p_environment text, p_action text,
  p_id uuid, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.media_uploads; a public.stamp_artwork_versions; s public.shops; old_actor text;
begin
  -- Server attests verified cookie identity and bytes. Browser RPC access is denied.
  -- Serialize initiation limits and concurrent revocation through this transaction.
  perform 1 from public.profiles where id=p_actor and role in ('editor','admin') for update;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_environment is null or p_environment not in ('staging','production') or p_id is null
    or p_action is null or p_action not in ('initiate','read','finalize') then
    raise exception 'Invalid media request' using errcode='22023'; end if;
  if p_action='initiate' then
    perform public.check_edit_object(p_payload,
      '{"shopId":"uuid","artworkVersionId":"uuid","purpose":"text","sha256":"text","byteSize":"number","contentType":"text","sourceRef":"text","rightsBasis":"text","creditText":"text","altText":"text"}',
      array['shopId','purpose','sha256','byteSize','contentType','sourceRef','altText']);
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
      -- Reuse canonical rights and illustrator credit; never approval evidence.
      if p_payload ? 'rightsBasis' or p_payload ? 'creditText' then
        raise exception 'Use artwork rights and credit' using errcode='22023'; end if;
    end if;
    old_actor:=current_setting('nibatlas.media_actor',true);
    perform set_config('nibatlas.media_actor',p_actor::text,true);
    insert into public.media_uploads(id,created_by,environment,shop_id,artwork_version_id,purpose,storage_key,
      sha256,byte_size,content_type,source_ref,rights_basis,credit_text,alt_text)
    values(p_id,p_actor,p_environment,s.id,(p_payload->>'artworkVersionId')::uuid,p_payload->>'purpose',
      p_environment||'/media/'||p_id::text||'/v1/'||(p_payload->>'sha256')||'.png',p_payload->>'sha256',
      (p_payload->>'byteSize')::integer,p_payload->>'contentType',p_payload->>'sourceRef',
      case when a.id is not null then a.rights_basis else p_payload->>'rightsBasis' end,
      case when a.id is not null then a.illustrator_credit else p_payload->>'creditText' end,p_payload->>'altText') returning * into u;
    perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
  else
    select * into u from public.media_uploads where id=p_id and created_by=p_actor and environment=p_environment for update;
    if not found then raise exception 'Upload not found' using errcode='P0002'; end if;
    if p_action='finalize' and u.status='pending' then
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
      if p_payload->>'sha256'<>u.sha256 or (p_payload->>'byteSize')::numeric<>u.byte_size then
        raise exception 'Upload mismatch' using errcode='22023'; end if;
      old_actor:=current_setting('nibatlas.media_actor',true);
      perform set_config('nibatlas.media_actor',p_actor::text,true);
      update public.media_uploads set status='validated',width=(p_payload->>'width')::integer,
        height=(p_payload->>'height')::integer,validated_at=statement_timestamp() where id=u.id returning * into u;
      perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
    end if;
  end if;
  -- Private Worker-only projection; approval evidence is never returned.
  return jsonb_build_object('id',u.id,'storageKey',u.storage_key,'sha256',u.sha256,'byteSize',u.byte_size,
    'purpose',u.purpose,'status',u.status,'expiresAt',u.expires_at,'width',u.width,'height',u.height);
end; $$;
revoke all on function public.media_upload_operation(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.media_upload_operation(uuid,text,text,uuid,jsonb) to service_role;
