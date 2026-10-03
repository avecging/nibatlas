-- Additive, frozen generated shop seals. No existing artwork or collection rewrite.
begin;
alter table public.stamp_artwork_versions add constraint stamp_shop_seal_template check (
  artwork_kind<>'generated_template' or not (template_data ?| array['template','shape']) or coalesce((
    template_data->>'tier'='shop' and template_data->>'template'='shop-seal-v1'
    and template_data->>'shape' in ('shield','oval','rectangle')
    and template_data->>'motif' in ('storefront','shophouse','ink-bottle','nib','arcade','harbour','counter','workbench')
  ),false)
);

create or replace function public.ensure_shop_generated_default(p_actor uuid, p_shop uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s public.shops; stamp_id uuid; old_actor text; k text; i integer;
  ink_hash bigint:=2166136261; motif_hash bigint:=2166136261; shape_hash bigint:=2166136261;
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
  k:='shape:stamp-'||p_shop::text;
  for i in 1..length(k) loop
    shape_hash:=mod((shape_hash # ascii(substr(k,i,1))::bigint)*16777619,4294967296);
  end loop;
  old_actor:=current_setting('nibatlas.media_actor',true);
  perform set_config('nibatlas.media_actor',p_actor::text,true);
  insert into public.stamps(shop_id,name) values(p_shop,btrim(left(s.name||' Atlas Stamp',120))) returning id into stamp_id;
  insert into public.stamp_artwork_versions(stamp_id,design_version,artwork_kind,approval_status,
    template_data,ink,palette_version,approved_at,approval_evidence_ref)
  values(stamp_id,1,'generated_template','approved',
    jsonb_build_object('tier','shop','motif',motifs[(motif_hash%8)::integer+1],
      'template','shop-seal-v1','shape',(array['shield','oval','rectangle'])[(shape_hash%3)::integer+1]),
    inks[(ink_hash%8)::integer+1]::public.stamp_ink,1,statement_timestamp(),'system-generated-default:shop-seal-v1');
  update public.stamps set status='active',current_design_version=1 where id=stamp_id;
  perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
end; $$;
revoke all on function public.ensure_shop_generated_default(uuid,uuid) from public,anon,authenticated,service_role;


create or replace function public.stamp_artwork_draft_operation(
  p_actor uuid,p_environment text,p_shop uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; st public.stamps; a public.stamp_artwork_versions;
  u public.media_uploads; base_art public.stamp_artwork_versions; v integer; old_actor text; result jsonb; actor_role text;
begin
  select role into actor_role from public.profiles where id=p_actor and role in ('editor','admin') for share;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_environment is null or p_environment not in ('staging','production') or p_shop is null
    or p_action is null or p_action not in ('list','create','attach','activate','preview','ensure_default','create_generated') then
    raise exception 'Invalid stamp request' using errcode='22023'; end if;
  select * into s from public.shops where id=p_shop for update;
  if not found or s.publication_status='archived'
    or (p_environment='production' and s.source_quality='demo') then
    raise exception 'Invalid stamp target' using errcode='22023'; end if;

  if p_action='ensure_default' then
    if p_payload is distinct from '{}'::jsonb then
      raise exception 'Invalid stamp request' using errcode='22023'; end if;
    perform public.ensure_shop_generated_default(p_actor,p_shop);
  elsif p_action='create_generated' then
    perform public.check_edit_object(p_payload,
      '{"shape":"text","ink":"text","baseVersionId":"uuid","baseRevision":"text"}',array['shape','ink']);
    if not (p_payload ?& array['baseVersionId','baseRevision'])
      or p_payload->>'shape' not in ('shield','oval','rectangle')
      or p_payload->>'ink' not in ('vermilion','navy','teal','indigo','plum','moss','ochre','brick')
      or ((p_payload->>'baseVersionId' is null)<>(p_payload->>'baseRevision' is null))
      or (p_payload->>'baseRevision' is not null and p_payload->>'baseRevision' !~ '^[a-f0-9]{32}$') then
      raise exception 'Invalid stamp metadata' using errcode='22023'; end if;
    select av.* into base_art from public.stamps x join public.stamp_artwork_versions av
      on av.stamp_id=x.id and av.design_version=x.current_design_version
      where x.shop_id=p_shop and x.stamp_type='atlas' and x.status='active' for update of av;
    if base_art.id is distinct from (p_payload->>'baseVersionId')::uuid
      or (base_art.id is not null and md5(to_jsonb(base_art)::text) is distinct from p_payload->>'baseRevision') then
      raise exception 'Stamp artwork changed; reload' using errcode='40001'; end if;
    select * into st from public.stamps where shop_id=p_shop and stamp_type='atlas'
      order by (status='active') desc,created_at,id limit 1 for update;
    -- A lost response can be retried without spending another retained version.
    select * into a from public.stamp_artwork_versions av where av.stamp_id=st.id
      and av.approval_status='draft' and av.artwork_kind='generated_template'
      and av.template_data=jsonb_build_object('tier','shop','motif','nib','template','shop-seal-v1','shape',p_payload->>'shape')
      and av.ink::text=p_payload->>'ink' order by av.design_version desc limit 1;
    if a.id is null then
      if (select count(*) from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
        where x.shop_id=p_shop and x.stamp_type='atlas')>=50 then
        raise exception 'Stamp version limit reached' using errcode='54000'; end if;
      old_actor:=current_setting('nibatlas.media_actor',true);
      perform set_config('nibatlas.media_actor',p_actor::text,true);
      if st.id is null then
        insert into public.stamps(shop_id,name) values(p_shop,btrim(left(s.name||' Atlas Stamp',120))) returning * into st;
      end if;
      select coalesce(max(design_version),0)+1 into v from public.stamp_artwork_versions where stamp_id=st.id;
      insert into public.stamp_artwork_versions(stamp_id,design_version,artwork_kind,template_data,ink,palette_version,approval_evidence_ref)
        values(st.id,v,'generated_template',
          jsonb_build_object('tier','shop','motif','nib','template','shop-seal-v1','shape',p_payload->>'shape'),
          (p_payload->>'ink')::public.stamp_ink,1,'admin-generated-default:shop-seal-v1');
      perform set_config('nibatlas.media_actor',coalesce(old_actor,''),true);
    end if;
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
        and av.artwork_kind in ('uploaded','generated_template') and av.approval_status='draft' for update of av;
    if not found or (a.artwork_kind='uploaded' and (a.upload_id is null or a.transparent_png_key is null
      or a.transparent_png_sha256 is null)) then
      raise exception 'Invalid stamp target' using errcode='22023'; end if;
    if md5(to_jsonb(a)::text)<>p_payload->>'revision' then
      raise exception 'Stamp artwork changed; reload' using errcode='40001'; end if;
    if a.artwork_kind='uploaded' and not exists(select 1 from public.media_uploads receipt where receipt.id=a.upload_id
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

-- Preserve the current review function in full; only expand its exact eligibility
-- predicate. Generated drafts need no PNG receipt; uploaded drafts still do.
do $review$
declare definition text; marker text;
begin
 definition:=pg_get_functiondef('public.shop_review_operation(uuid,text,uuid,jsonb)'::regprocedure);
 marker:=$old$(v->>'kind'='uploaded' and v->>'status'='draft' and (v->>'hasArtwork')::boolean)$old$;
 if length(definition)-length(replace(definition,marker,''))<>length(marker) then
  raise exception 'Unexpected review stamp eligibility definition'; end if;
 definition:=replace(definition,marker,$new$(v->>'status'='draft' and (v->>'kind'='generated_template' or (v->>'kind'='uploaded' and (v->>'hasArtwork')::boolean)))$new$);
 execute definition;
end; $review$;
commit;
