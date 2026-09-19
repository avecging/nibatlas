-- Issue #73: truthful founder/admin stamp drafts and PNG attachment.
-- Existing generated/commissioned rows are preserved. Approved history stays immutable.
alter table public.stamp_artwork_versions
  add column artwork_origin text,
  add column creator_name text,
  add column creator_url text,
  add column upload_id uuid unique references public.media_uploads(id) on delete restrict;

-- This migration adds derived fields to already-approved rows. Hold an exclusive
-- lock and suspend only the approved-row update guard for this exact backfill;
-- all pre-existing artwork, credit, approval and collection fields stay intact.
lock table public.stamp_artwork_versions in access exclusive mode;
alter table public.stamp_artwork_versions disable trigger stamp_artwork_versions_protect_approved;
update public.stamp_artwork_versions
set artwork_origin=case when artwork_kind='generated_template' then 'generated_template' else 'commissioned' end,
    creator_name=case when artwork_kind='commissioned' then illustrator_credit else null end,
    creator_url=case when artwork_kind='commissioned' then illustrator_credit_url else null end;
alter table public.stamp_artwork_versions enable trigger stamp_artwork_versions_protect_approved;
alter table public.stamp_artwork_versions alter column artwork_origin set not null;

-- Keep old generated/commissioned insertion contracts working after the additive
-- column. New neutral uploads must always state their origin explicitly.
create function public.fill_stamp_artwork_origin()
returns trigger language plpgsql set search_path='' as $origin$
begin
  if new.artwork_origin is null then
    if new.artwork_kind='generated_template' then new.artwork_origin:='generated_template';
    elsif new.artwork_kind='commissioned' then new.artwork_origin:='commissioned';
    else raise exception 'Uploaded artwork requires an explicit origin' using errcode='23514';
    end if;
  end if;
  if new.artwork_kind='commissioned' then
    new.creator_name:=coalesce(new.creator_name,new.illustrator_credit);
    new.creator_url:=coalesce(new.creator_url,new.illustrator_credit_url);
  end if;
  return new;
end; $origin$;
revoke all on function public.fill_stamp_artwork_origin() from public,anon,authenticated,service_role;
create trigger stamp_artwork_fill_origin before insert on public.stamp_artwork_versions
  for each row execute function public.fill_stamp_artwork_origin();

alter table public.stamp_artwork_versions drop constraint stamp_artwork_template_shape;
alter table public.stamp_artwork_versions add constraint stamp_artwork_template_shape check (
  (artwork_kind='generated_template' and template_data is not null and jsonb_typeof(template_data)='object'
    and artwork_origin='generated_template')
  or (artwork_kind='commissioned' and template_data is null and artwork_origin='commissioned')
  or (artwork_kind='uploaded' and template_data is null
    and artwork_origin in ('founder_created','ai_assisted','commissioned'))
);
alter table public.stamp_artwork_versions add constraint stamp_artwork_creator_shape check (
  artwork_kind<>'uploaded' or (
    creator_name is not null and creator_name=btrim(creator_name)
    and char_length(creator_name) between 1 and 300
    and (creator_url is null or (char_length(creator_url) between 1 and 2000 and creator_url ~* '^https?://'))
  )
);

-- MVP uploaded artwork does not inherit the old commissioning evidence gate.
-- Legacy commissioned approvals retain every existing requirement.
alter table public.stamp_artwork_versions drop constraint stamp_artwork_approval_complete;
alter table public.stamp_artwork_versions add constraint stamp_artwork_approval_complete check (
  (approval_status='draft' and approved_at is null)
  or (approval_status='approved' and approved_at is not null
    and (artwork_kind='uploaded'
      or (approval_evidence_ref is not null and length(btrim(approval_evidence_ref))>0)))
);
alter table public.stamp_artwork_versions add constraint uploaded_stamp_artwork_complete check (
  artwork_kind<>'uploaded' or approval_status<>'approved' or (
    upload_id is not null
    and transparent_png_key is not null and length(btrim(transparent_png_key))>0
    and transparent_png_sha256 ~ '^[0-9a-f]{64}$'
    and creator_name is not null and length(btrim(creator_name))>0
  )
);

-- Stamp/admin changes join the existing bounded fingerprint audit without copying
-- creator links, private storage keys or any legacy commissioning evidence.
alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links',
      'shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads','shop_images','stamps','stamp_artwork_versions')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);
create function public.audit_stamp_catalogue()
returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb; actor uuid;
begin
  if tg_op<>'INSERT' then b:=to_jsonb(old)-array['created_at','updated_at']; end if;
  if tg_op<>'DELETE' then a:=to_jsonb(new)-array['created_at','updated_at']; end if;
  if a is not distinct from b then return null; end if;
  actor:=nullif(current_setting('nibatlas.media_actor',true),'')::uuid;
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary)
  values(actor,case when actor is null then 'database_operator' else 'account' end,
    'catalogue_'||lower(tg_op),tg_table_name,(coalesce(a,b)->>'id')::uuid,
    case when b is null then '{}'::jsonb else jsonb_build_object('fingerprint',md5(b::text)) end,
    case when a is null then '{}'::jsonb else jsonb_build_object('fingerprint',md5(a::text)) end);
  return null;
end; $$;
revoke all on function public.audit_stamp_catalogue() from public,anon,authenticated,service_role;
create trigger stamps_admin_audit after insert or update or delete on public.stamps
  for each row execute function public.audit_stamp_catalogue();
create trigger stamp_artwork_admin_audit after insert or update or delete on public.stamp_artwork_versions
  for each row execute function public.audit_stamp_catalogue();
create trigger stamps_no_truncate before truncate on public.stamps
  for each statement execute function public.reject_catalogue_truncate();
create trigger stamp_artwork_no_truncate before truncate on public.stamp_artwork_versions
  for each statement execute function public.reject_catalogue_truncate();

-- Replace the upload boundary only for the new neutral uploaded kind. No rights,
-- source, alt-text or commissioning metadata is fabricated or required.
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
        if u.content_type<>'image/jpeg' or u.purpose<>'shop_photo' then
          raise exception 'Not a JPEG photo' using errcode='22023'; end if;
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

-- Service-only stamp draft boundary. Activation is intentionally added only after
-- collection snapshots/delivery are made compatible in the following migration.
create function public.stamp_artwork_draft_operation(
  p_actor uuid,p_environment text,p_shop uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; st public.stamps; a public.stamp_artwork_versions;
  u public.media_uploads; v integer; old_actor text; result jsonb;
begin
  perform 1 from public.profiles where id=p_actor and role in ('editor','admin') for update;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_environment is null or p_environment not in ('staging','production') or p_shop is null
    or p_action is null or p_action not in ('list','create','attach','preview') then
    raise exception 'Invalid stamp request' using errcode='22023'; end if;
  select * into s from public.shops where id=p_shop for update;
  if not found or s.publication_status='archived'
    or (p_environment='production' and s.source_quality='demo') then
    raise exception 'Invalid stamp target' using errcode='22023'; end if;

  if p_action='create' then
    if (select count(*) from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
      where x.shop_id=p_shop and x.stamp_type='atlas')>=50 then
      raise exception 'Stamp version limit reached' using errcode='54000'; end if;
    perform public.check_edit_object(p_payload,
      '{"origin":"text","creatorName":"text","creatorUrl":"text","ink":"text"}',
      array['origin','creatorName','ink']);
    if p_payload->>'origin' not in ('founder_created','ai_assisted','commissioned')
      or nullif(btrim(p_payload->>'creatorName'),'') is null
      or char_length(p_payload->>'creatorName')>300
      or (p_payload ? 'creatorUrl' and
        (nullif(btrim(p_payload->>'creatorUrl'),'') is null
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
    values(st.id,v,'uploaded',p_payload->>'origin',btrim(p_payload->>'creatorName'),
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
  elsif p_action='preview' then
    perform public.check_edit_object(p_payload,'{"versionId":"uuid"}',array['versionId']);
    select av.* into a from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
      where av.id=(p_payload->>'versionId')::uuid and x.shop_id=p_shop and av.upload_id is not null
        and exists(select 1 from public.media_uploads u where u.id=av.upload_id
          and u.environment=p_environment and u.status='validated');
    if not found then raise exception 'Stamp artwork not found' using errcode='P0002'; end if;
    return jsonb_build_object('storageKey',a.transparent_png_key);
  elsif p_payload<>'{}'::jsonb then
    raise exception 'Invalid stamp request' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',av.id,'stampId',st2.id,'designVersion',av.design_version,
      'kind',av.artwork_kind,'origin',av.artwork_origin,'status',av.approval_status,
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
