-- Issue #73: activate uploaded artwork only after collection snapshots and
-- delivery understand the new neutral uploaded kind. #70 recollection remains deferred.

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
      and length(btrim(coalesce(stamp_snapshot->>'creatorName','')))>0
      and coalesce(stamp_snapshot->>'transparentPngSha256','') ~ '^[0-9a-f]{64}$'))
);

create or replace function public.validate_collection_stamp_snapshot()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare artwork public.stamp_artwork_versions%rowtype;
begin
  select versions.* into artwork
  from public.stamps stamp join public.stamp_artwork_versions versions
    on versions.stamp_id=stamp.id and versions.design_version=stamp.current_design_version
  where stamp.id=new.stamp_id and stamp.status='active'
    and stamp.current_design_version=new.stamp_design_version
    and versions.approval_status='approved';
  if not found then
    raise exception 'Collection requires the active approved stamp design' using errcode='23514';
  end if;
  if new.stamp_snapshot->>'artworkKind'<>artwork.artwork_kind::text
    or new.stamp_snapshot->>'ink'<>artwork.ink::text
    or new.stamp_snapshot->>'paletteVersion'<>artwork.palette_version::text
    or (artwork.artwork_kind='generated_template'
      and new.stamp_snapshot->'templateData' is distinct from artwork.template_data)
    or (artwork.artwork_kind='commissioned'
      and new.stamp_snapshot->>'illustratorCredit' is distinct from artwork.illustrator_credit)
    or (artwork.artwork_kind='uploaded' and (
      new.stamp_snapshot->>'artworkOrigin' is distinct from artwork.artwork_origin
      or new.stamp_snapshot->>'creatorName' is distinct from artwork.creator_name
      or new.stamp_snapshot->>'creatorUrl' is distinct from artwork.creator_url
      or new.stamp_snapshot->>'transparentPngSha256' is distinct from artwork.transparent_png_sha256))
  then
    raise exception 'Collection stamp snapshot does not match approved artwork' using errcode='23514';
  end if;
  return new;
end; $$;
revoke all on function public.validate_collection_stamp_snapshot() from public;

create or replace function public.stamp_verification_action(
  p_action text, p_user_id uuid, p_shop_id uuid, p_request_id uuid,
  p_nonce_hash text, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  n stamp_private.verification_nonces%rowtype;
  s public.shops%rowtype;
  a public.stamps%rowtype;
  art public.stamp_artwork_versions%rowtype;
  loc public.localities%rowtype;
  c public.stamp_collections%rowtype;
  t timestamptz;
  radius integer;
  binding text;
  result text;
  flags text[] := '{}';
  position jsonb;
  lat double precision;
  lon double precision;
  accuracy double precision;
  distance double precision;
  point extensions.geography;
  iv bytea; ciphertext bytea; mac bytea;
  stamp_snapshot jsonb;
begin
  if p_user_id is null or p_shop_id is null or p_request_id is null
    or p_nonce_hash is null or p_nonce_hash !~ '^[a-f0-9]{64}$'
    or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_action is null or p_action not in ('nonce','context_verify','context_collect','verify','collect')
    or not exists(select 1 from auth.users where id=p_user_id) then
    return jsonb_build_object('code','invalid_request');
  end if;
  -- Serializes all issuance for this owner, including different nonces/shops.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 5102));
  t := clock_timestamp();
  if p_action <> 'nonce' then
    select * into n from stamp_private.verification_nonces
      where request_id=p_request_id and nonce_hash=p_nonce_hash
        and user_id=p_user_id and shop_id=p_shop_id for update;
    if not found then return jsonb_build_object('code','invalid_nonce'); end if;
    if n.expires_at <= t then return jsonb_build_object('code','expired_nonce'); end if;
    if n.state in ('consumed','failed') or
      (p_action in ('context_verify','verify') and n.state <> 'issued') then
      return jsonb_build_object('code','reused_nonce');
    end if;
    if p_action in ('context_collect','collect') and n.state <> 'verified' then
      return jsonb_build_object('code','invalid_nonce');
    end if;
  end if;

  -- Hold the canonical rows stable through snapshot insertion. Publication,
  -- retirement, redesign or policy changes between stages invalidate the proof.
  select * into s from public.shops where id=p_shop_id for share;
  if not found or s.publication_status <> 'published'
    or s.operational_status in ('temporarily_closed','permanently_closed')
    or s.locality_id is null then
    return jsonb_build_object('code','shop_unavailable');
  end if;
  select * into a from public.stamps where shop_id=s.id and status='active' and stamp_type='atlas' for share;
  if not found or (a.availability_start is not null and a.availability_start > t)
    or (a.availability_end is not null and a.availability_end <= t) then
    return jsonb_build_object('code','shop_unavailable');
  end if;
  select * into art from public.stamp_artwork_versions
    where stamp_id=a.id and design_version=a.current_design_version and approval_status='approved' for share;
  if not found then return jsonb_build_object('code','shop_unavailable'); end if;
  select * into loc from public.localities where id=s.locality_id for share;
  if not found then return jsonb_build_object('code','shop_unavailable'); end if;
  select radius_m into radius from stamp_private.shop_verification_policy where shop_id=s.id for share;
  if found then flags := array_append(flags,'policy_override'); end if;
  radius := coalesce(radius,150);
  binding := encode(extensions.digest(concat_ws('|',s.id,s.location::text,s.timezone,
    s.updated_at,loc.updated_at,a.id,a.current_design_version,a.updated_at,radius),'sha256'),'hex');

  select * into c from public.stamp_collections where user_id=p_user_id and stamp_id=a.id;
  if found then
    if p_action <> 'nonce' then
      update stamp_private.verification_nonces set state='consumed', encryption_key=null where request_id=n.request_id;
    end if;
    return jsonb_build_object('code','duplicate','collection',stamp_private.collection_response(c));
  end if;
  if p_action='nonce' then
    insert into stamp_private.verification_nonces(request_id,nonce_hash,user_id,shop_id,expires_at,encryption_key)
    values(p_request_id,p_nonce_hash,p_user_id,p_shop_id,t+interval '90 seconds',extensions.gen_random_bytes(64));
    return jsonb_build_object('code','nonce_issued');
  end if;
  if p_action='context_verify' then
    return jsonb_build_object('code','context','key',encode(n.encryption_key,'hex'));
  end if;
  if p_action='context_collect' then
    return jsonb_build_object('code','context','countryCode',s.country_code);
  end if;

  if p_action='verify' then
    -- Server times bound acquisition; a client clock cannot prolong this window.
    if t - n.created_at > interval '30 seconds' then
      result := 'stale_position';
    elsif p_payload->>'permission' = 'denied' then
      result := 'permission_denied';
    else
      -- Encrypt-then-MAC with independent 256-bit keys. No encrypted envelope
      -- or reversible position hash is retained. Malformed data fails closed.
      begin
        iv := decode(p_payload->>'iv','hex');
        ciphertext := decode(p_payload->>'ciphertext','hex');
        mac := decode(p_payload->>'mac','hex');
        if octet_length(iv) <> 16 or octet_length(ciphertext) not between 16 and 1024
          or mac is null or mac <> extensions.hmac(iv || ciphertext,substring(n.encryption_key from 33 for 32),'sha256') then
          result := 'invalid_request';
        else
          position := convert_from(extensions.decrypt_iv(ciphertext,substring(n.encryption_key from 1 for 32),iv,'aes-cbc/pad:pkcs'),'UTF8')::jsonb;
          lat := (position->>'latitude')::double precision;
          lon := (position->>'longitude')::double precision;
          accuracy := (position->>'accuracy')::double precision;
          if lat is null or lon is null or accuracy is null
            or not (lat between -90 and 90) or not (lon between -180 and 180)
            or not (accuracy between 0 and 1000000) then result := 'invalid_request';
          elsif accuracy > 100 then result := 'poor_accuracy';
          else
            point := extensions.st_setsrid(extensions.st_makepoint(lon,lat),4326)::extensions.geography;
            distance := extensions.st_distance(s.location::extensions.geography,point);
            -- One micrometre absorbs geography projection/JSON floating-point roundoff
            -- at the inclusive boundary; it is not accuracy-based widening.
            if extensions.st_dwithin(s.location::extensions.geography,point,radius + 0.000001) then
              result := 'confirmation_required';
            else result := 'outside_radius'; end if;
          end if;
        end if;
      exception when others then
        result := 'invalid_request';
      end;
    end if;
    if (select count(*) from public.verification_attempts attempts where attempts.user_id=p_user_id
      and attempts.attempted_at > t-interval '10 minutes' and attempts.result in ('outside_radius','poor_accuracy')) >= 2 then
      flags := array_append(flags,'repeated_failure');
    end if;
    update stamp_private.verification_nonces set
      state=case when result='confirmation_required' then 'verified' else 'failed' end,
      encryption_key=null,
      verified_at=case when result='confirmation_required' then t end,
      expires_at=case when result='confirmation_required' then t+interval '60 seconds' else expires_at end,
      stamp_id=a.id, design_version=a.current_design_version, catalogue_binding=binding,
      distance_m=case when distance is not null then ceil(distance/25)*25 end,
      accuracy_m=case when accuracy between 0 and 1000000 then ceil(accuracy/10)*10 end,
      radius_m=radius, anomaly_flags=flags where request_id=n.request_id;
    insert into public.verification_attempts(user_id,shop_id,request_id,result,distance_bucket_m,accuracy_bucket_m,radius_m,anomaly_flags)
      select p_user_id,p_shop_id,p_request_id,result,distance_m,accuracy_m,radius,flags
        from stamp_private.verification_nonces where request_id=n.request_id;
    return jsonb_build_object('code',result);
  end if;

  if p_payload->'confirmedAtShop' is distinct from 'true'::jsonb then
    return jsonb_build_object('code','invalid_request');
  end if;
  if n.catalogue_binding is distinct from binding or n.stamp_id is distinct from a.id
    or n.design_version is distinct from a.current_design_version then
    update stamp_private.verification_nonces set state='failed',encryption_key=null where request_id=n.request_id;
    return jsonb_build_object('code','shop_unavailable');
  end if;
  if length(btrim(coalesce(p_payload->>'countryLabel',''))) not between 1 and 120 then
    return jsonb_build_object('code','invalid_request');
  end if;
  if exists(select 1 from public.stamp_collections where user_id=p_user_id and collected_at>t-interval '1 minute') then
    flags := array_append(flags,'rapid_collection');
  end if;
  stamp_snapshot := jsonb_build_object('id',a.id,'name',a.name,'designVersion',art.design_version,
    'artworkKind',art.artwork_kind,'ink',art.ink,'paletteVersion',art.palette_version,
    'canvasWidth',art.canvas_width,'canvasHeight',art.canvas_height);
  if art.artwork_kind='generated_template' then
    stamp_snapshot := stamp_snapshot || jsonb_build_object('templateData',art.template_data);
  elsif art.artwork_kind='commissioned' then
    stamp_snapshot := stamp_snapshot || jsonb_build_object('illustratorCredit',art.illustrator_credit,
      'illustratorCreditUrl',art.illustrator_credit_url,'makerMarkConfirmed',art.maker_mark_confirmed,
      'cleanSvgKey',art.clean_svg_key,'cleanSvgSha256',art.clean_svg_sha256,
      'outlinedSvgKey',art.outlined_svg_key,'outlinedSvgSha256',art.outlined_svg_sha256,
      'transparentPngKey',art.transparent_png_key,'transparentPngSha256',art.transparent_png_sha256);
  else
    stamp_snapshot := stamp_snapshot || jsonb_build_object('artworkOrigin',art.artwork_origin,
      'creatorName',art.creator_name,'creatorUrl',art.creator_url,
      'transparentPngSha256',art.transparent_png_sha256);
  end if;
  insert into public.stamp_collections(user_id,stamp_id,shop_id,stamp_design_version,collected_at,
    shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
  values(p_user_id,a.id,s.id,art.design_version,t,s.timezone,'geofence',1,s.name,
    jsonb_build_object('countryCode',s.country_code,'countryLabel',p_payload->>'countryLabel',
      'localityId',loc.id,'localityName',loc.name,'localitySlug',loc.slug,
      'localityNameLocal',loc.name_local,'localityNameLocalLanguageTag',loc.name_local_language_tag,
      'localityType',loc.locality_type,'parentLocalityId',loc.parent_locality_id,
      'adminAreaCode',s.admin_area_code,'adminAreaName',s.admin_area_name),stamp_snapshot)
  on conflict(user_id,stamp_id) do nothing returning * into c;
  result := 'success';
  if not found then
    select * into c from public.stamp_collections where user_id=p_user_id and stamp_id=a.id;
    result := 'duplicate';
  end if;
  update stamp_private.verification_nonces set state='consumed',encryption_key=null where request_id=n.request_id;
  insert into public.verification_attempts(user_id,shop_id,request_id,result,anomaly_flags)
    values(p_user_id,p_shop_id,p_request_id,result,flags);
  return jsonb_build_object('code',result,'collection',stamp_private.collection_response(c));
end;
$$;


create or replace function public.stamp_artwork_draft_operation(
  p_actor uuid,p_environment text,p_shop uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; st public.stamps; a public.stamp_artwork_versions;
  u public.media_uploads; v integer; old_actor text; result jsonb; actor_role text;
begin
  select role into actor_role from public.profiles where id=p_actor and role in ('editor','admin') for update;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_environment not in ('staging','production') or p_shop is null
    or p_action not in ('list','create','attach','activate','preview') then
    raise exception 'Invalid stamp request' using errcode='22023'; end if;
  select * into s from public.shops where id=p_shop for update;
  if not found or s.publication_status='archived'
    or (p_environment='production' and s.source_quality='demo') then
    raise exception 'Invalid stamp target' using errcode='22023'; end if;

  if p_action='create' then
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
    if not found then
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
      and artwork_version_id=a.id and purpose='artwork_png' and status='validated' for share;
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
    if p_payload->>'revision' !~ '^[a-f0-9]{32}
    perform public.check_edit_object(p_payload,'{"versionId":"uuid"}',array['versionId']);
    select av.* into a from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
      where av.id=(p_payload->>'versionId')::uuid and x.shop_id=p_shop and av.upload_id is not null;
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
end; $$; then
      raise exception 'Invalid stamp request' using errcode='22023'; end if;
    select av.* into a from public.stamp_artwork_versions av join public.stamps x on x.id=av.stamp_id
      where av.id=(p_payload->>'versionId')::uuid and x.shop_id=p_shop
        and av.artwork_kind='uploaded' and av.approval_status='draft' for update of av;
    if not found or a.upload_id is null or a.transparent_png_key is null
      or a.transparent_png_sha256 is null then
      raise exception 'Invalid stamp target' using errcode='22023'; end if;
    if md5(to_jsonb(a)::text)<>p_payload->>'revision' then
      raise exception 'Stamp artwork changed; reload' using errcode='40001'; end if;
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
      where av.id=(p_payload->>'versionId')::uuid and x.shop_id=p_shop and av.upload_id is not null;
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

-- Resolve only approved immutable bytes. Current active artwork is public for a
-- published shop; an owner may also resolve the exact historical version already
-- preserved in their private collection.
create function public.stamp_artwork_file_operation(
  p_actor uuid,p_environment text,p_stamp uuid,p_version integer)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare a public.stamp_artwork_versions; st public.stamps; s public.shops; allowed boolean:=false;
begin
  if p_environment not in ('staging','production') or p_stamp is null
    or p_version is null or p_version<1 then
    raise exception 'Invalid stamp request' using errcode='22023'; end if;
  select av.* into a from public.stamp_artwork_versions av
  where av.stamp_id=p_stamp and av.design_version=p_version
    and av.approval_status='approved'
    and av.artwork_kind in ('uploaded','commissioned');
  if not found or a.transparent_png_key is null then
    raise exception 'Stamp artwork not found' using errcode='P0002'; end if;
  select * into st from public.stamps where id=a.stamp_id;
  if not found then raise exception 'Stamp artwork not found' using errcode='P0002'; end if;
  select * into s from public.shops where id=st.shop_id;
  allowed:=s.publication_status='published' and st.status='active'
    and st.current_design_version=p_version;
  if not allowed and p_actor is not null then
    allowed:=exists(select 1 from public.stamp_collections c
      where c.user_id=p_actor and c.stamp_id=p_stamp and c.stamp_design_version=p_version);
  end if;
  if not allowed then raise exception 'Stamp artwork not found' using errcode='P0002'; end if;
  if a.artwork_kind='uploaded' and not exists(select 1 from public.media_uploads u
    where u.id=a.upload_id and u.environment=p_environment and u.status='validated') then
    raise exception 'Stamp artwork not found' using errcode='P0002'; end if;
  return jsonb_build_object('storageKey',a.transparent_png_key);
end; $$;
revoke all on function public.stamp_artwork_file_operation(uuid,text,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.stamp_artwork_file_operation(uuid,text,uuid,integer)
  to service_role;
