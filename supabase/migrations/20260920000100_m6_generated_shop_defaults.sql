-- Package B1: one system-generated default for a newly administered shop.
-- No backfill of existing art, no media manifests, and no public catalogue writes.
-- Kept private so manual creation and the future bounded importer share the same
-- locked operation; callers must already have established the actor/environment.
create function public.ensure_shop_generated_default(p_actor uuid, p_shop uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s public.shops; stamp_id uuid; old_actor text; k text; i integer;
  ink_hash bigint:=2166136261; motif_hash bigint:=2166136261;
  inks text[]:=array['vermilion','navy','teal','indigo','plum','moss','ochre','brick'];
  motifs text[]:=array['storefront','shophouse','ink-bottle','nib','arcade','harbour','counter','workbench'];
begin
  -- Same lock order as admin shop writes: current role, then shop. SHARE also
  -- allows safe concurrent operations by one editor; the shop lock serializes
  -- this operation with uploads, publication and collection snapshots.
  perform 1 from public.profiles where id=p_actor and role in ('editor','admin') for share;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  select * into s from public.shops where id=p_shop for update;
  if not found or s.publication_status='archived' then
    raise exception 'Invalid stamp target' using errcode='22023'; end if;
  -- Any existing identity is authoritative, even if retired or an unfinished
  -- custom draft. Never resurrect it, substitute art or create a second stamp.
  if exists(select 1 from public.stamps where shop_id=p_shop and stamp_type='atlas') then return; end if;

  -- FNV-1a over an ASCII UUID key: matches the existing frontend generator's
  -- palette/motif assignment, pinned independently of mutable names/geography.
  k:='stamp-'||p_shop::text;
  for i in 1..length(k) loop
    ink_hash:=mod((ink_hash # ascii(substr(k,i,1))::bigint)*16777619,4294967296);
  end loop;
  k:='motif:'||k;
  for i in 1..length(k) loop
    motif_hash:=mod((motif_hash # ascii(substr(k,i,1))::bigint)*16777619,4294967296);
  end loop;
  old_actor:=current_setting('nibatlas.media_actor',true);
  perform set_config('nibatlas.media_actor',p_actor::text,true);
  insert into public.stamps(shop_id,name) values(p_shop,btrim(left(s.name||' Atlas Stamp',120))) returning id into stamp_id;
  insert into public.stamp_artwork_versions(stamp_id,design_version,artwork_kind,approval_status,
    template_data,ink,palette_version,approved_at,approval_evidence_ref)
  values(stamp_id,1,'generated_template','approved',
    jsonb_build_object('tier','shop','motif',motifs[(motif_hash%8)::integer+1]),
    inks[(ink_hash%8)::integer+1]::public.stamp_ink,1,statement_timestamp(),'system-generated-default:v1');
  update public.stamps set status='active',current_design_version=1 where id=stamp_id;
  perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
end; $$;
revoke all on function public.ensure_shop_generated_default(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.admin_shop_write(p_action text, p_id uuid, p_revision text default null, p_document jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.shops; w public.shop_working_copies; d jsonb; fp text; errors jsonb;
begin
  -- Hold current authority through commit: concurrent revocation serializes here.
  perform 1 from public.profiles where id=auth.uid() and role in ('editor','admin') for share;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_id is null or p_action is null or p_action not in ('create','save','publish','discard','temporarily_closed','permanently_closed','open','unknown','archive') then
    raise exception 'Invalid operation' using errcode='22023';
  end if;
  perform set_config('nibatlas.admin_request_id',gen_random_uuid()::text,true);
  if p_action='create' then
    perform public.check_edit_object(p_document,'{"name":"text","slug":"text"}',array['name','slug']);
    if length(p_document->>'name')>300 or length(p_document->>'slug')>120 then raise exception 'Invalid catalogue data' using errcode='22023'; end if;
    insert into public.shops(id,name,slug) values(p_id,p_document->>'name',p_document->>'slug');
    perform public.ensure_shop_generated_default(auth.uid(),p_id);
    return public.admin_shop_read(p_id);
  end if;
  select * into s from public.shops where id=p_id for update;
  if not found then raise exception 'Shop not found' using errcode='P0002'; end if;
  d:=public.shop_edit_document(p_id); fp:=md5(d::text);
  select * into w from public.shop_working_copies where shop_id=p_id for update;
  if p_revision is null or p_revision<>coalesce(w.revision::text,fp) then raise exception 'Revision conflict' using errcode='40001'; end if;
  if s.publication_status='archived' then raise exception 'Archived shop is read-only' using errcode='22023'; end if;
  if p_action='save' then
    perform public.validate_shop_document(p_id,p_document);
    if w.shop_id is not null and w.base_fingerprint<>fp then raise exception 'Revision conflict' using errcode='40001'; end if;
    if p_document is not distinct from coalesce(w.document,d) then return public.admin_shop_read(p_id); end if;
    insert into public.shop_working_copies(shop_id,document,base_fingerprint) values(p_id,p_document,fp)
      on conflict(shop_id) do update set document=excluded.document,revision=gen_random_uuid(),updated_at=statement_timestamp();
  elsif p_action='discard' then
    if w.shop_id is null then raise exception 'No saved changes' using errcode='22023'; end if;
    delete from public.shop_working_copies where shop_id=p_id;
  elsif p_action='publish' then
    if s.publication_status='published' and w.shop_id is null then raise exception 'No saved changes' using errcode='22023'; end if;
    if w.shop_id is not null and w.base_fingerprint<>fp then raise exception 'Revision conflict' using errcode='40001'; end if;
    d:=coalesce(w.document,d);
    perform public.validate_shop_document(p_id,d);
    errors:=public.shop_publication_errors(p_id,d);
    if jsonb_array_length(errors)>0 then return jsonb_build_object('code','publication_incomplete','requirements',errors); end if;
    if w.shop_id is not null then perform public.apply_shop_document(p_id,d); end if;
    update public.shops set publication_status='published',published_at=coalesce(published_at,statement_timestamp()) where id=p_id;
    delete from public.shop_working_copies where shop_id=p_id;
  else
    -- Urgent closure never accidentally publishes an unrelated working copy.
    if w.shop_id is not null then raise exception 'Publish or discard saved changes first' using errcode='22023'; end if;
    if p_action='archive' then
      update public.shops set publication_status='archived' where id=p_id;
    else
      if s.publication_status<>'published' or s.operational_status::text=p_action then raise exception 'Invalid status transition' using errcode='22023'; end if;
      update public.shops set operational_status=p_action::public.shop_operational_status where id=p_id;
    end if;
  end if;
  return public.admin_shop_read(p_id);
end; $$;
revoke all on function public.admin_shop_write(text,uuid,text,jsonb) from public, anon, service_role;
grant execute on function public.admin_shop_write(text,uuid,text,jsonb) to authenticated;

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
