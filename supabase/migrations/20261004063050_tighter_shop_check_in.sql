-- Founder-approved beta tightening: 45m by default; uncertainty never widens it.
-- Preserve existing encrypted-position, nonce, snapshot and private-history rules.
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
  radius := coalesce(radius,45);
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
          elsif accuracy > least(radius,45) then result := 'poor_accuracy';
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



-- The service-only adapter and cookie-bound UI share locked, audited updates.
create or replace function public.set_shop_verification_policy(
  p_actor_id uuid,p_shop_id uuid,p_radius_m integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare old_policy jsonb; new_policy jsonb;
begin
  perform 1 from public.profiles where id=p_actor_id and role in ('admin','editor') for share;
  if not found then raise exception 'Permission denied' using errcode='42501'; end if;
  if (p_radius_m is not null and p_radius_m not between 25 and 300)
    or p_reason is null or length(btrim(p_reason)) not between 10 and 500 then
    raise exception 'Invalid verification policy' using errcode='22023'; end if;
  -- Shop lock also serializes creation of a previously absent override with
  -- verification/confirmation, which take a shared lock on the same shop.
  perform 1 from public.shops where id=p_shop_id and publication_status<>'archived' for update;
  if not found then raise exception 'Shop not found' using errcode='P0002'; end if;
  select to_jsonb(p) into old_policy from stamp_private.shop_verification_policy p where shop_id=p_shop_id;
  if p_radius_m is null then
    delete from stamp_private.shop_verification_policy where shop_id=p_shop_id;
  else
    insert into stamp_private.shop_verification_policy(shop_id,radius_m,reason,updated_by)
    values(p_shop_id,p_radius_m,btrim(p_reason),p_actor_id)
    on conflict(shop_id) do update set radius_m=excluded.radius_m,reason=excluded.reason,
      updated_by=excluded.updated_by,updated_at=clock_timestamp();
  end if;
  select to_jsonb(p) into new_policy from stamp_private.shop_verification_policy p where shop_id=p_shop_id;
  if old_policy is distinct from new_policy then
    -- Shop settings use existing succinct fingerprint-only catalogue audit.
    -- The reset reason is hashed too; notes never appear in the audit response.
    insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary)
    values(p_actor_id,'account','catalogue_update','shops',p_shop_id,
      jsonb_build_object('fingerprint',md5(coalesce(old_policy,'null'::jsonb)::text)),
      jsonb_build_object('fingerprint',md5(jsonb_build_object('policy',new_policy,'reason',btrim(p_reason))::text)));
  end if;
end; $$;
revoke all on function public.set_shop_verification_policy(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.set_shop_verification_policy(uuid,uuid,integer,text) to service_role;

create function public.admin_shop_verification_policy(
  p_shop uuid,p_save boolean default false,p_revision text default null,
  p_radius integer default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); policy jsonb; revision text;
begin
  perform 1 from public.profiles where id=actor and role in ('admin','editor') for share;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_save is null then raise exception 'Invalid verification policy' using errcode='22023'; end if;
  if p_save then
    perform 1 from public.shops where id=p_shop and publication_status<>'archived' for update;
  else
    perform 1 from public.shops where id=p_shop for share;
  end if;
  if not found then raise exception 'Shop not found' using errcode='P0002'; end if;
  select to_jsonb(p) into policy from stamp_private.shop_verification_policy p where shop_id=p_shop;
  revision:=md5(coalesce(policy,'null'::jsonb)::text);
  if p_save then
    if p_revision is distinct from revision then
      raise exception 'Policy changed; reload' using errcode='40001'; end if;
    perform public.set_shop_verification_policy(actor,p_shop,p_radius,p_reason);
    select to_jsonb(p) into policy from stamp_private.shop_verification_policy p where shop_id=p_shop;
    revision:=md5(coalesce(policy,'null'::jsonb)::text);
  elsif p_revision is not null or p_radius is not null or p_reason is not null then
    raise exception 'Invalid verification policy' using errcode='22023';
  end if;
  return jsonb_build_object('radiusMeters',coalesce((policy->>'radius_m')::integer,45),
    'custom',policy is not null,'reason',policy->>'reason','revision',revision);
end; $$;
revoke all on function public.admin_shop_verification_policy(uuid,boolean,text,integer,text) from public,anon,service_role;
grant execute on function public.admin_shop_verification_policy(uuid,boolean,text,integer,text) to authenticated;
