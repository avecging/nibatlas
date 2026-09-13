-- M6 WP2: private working copies and atomic catalogue operations.
-- Incomplete geography is permitted only outside publication; never invent a point.
alter table public.shops alter column country_code drop not null,
  alter column timezone drop not null, alter column location drop not null;
alter table public.shops add constraint published_geography_required check (
  publication_status <> 'published' or (country_code is not null and timezone is not null and location is not null)
);
create or replace function public.validate_iana_timezone()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.timezone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown IANA timezone' using errcode = '22023';
  end if;
  return new;
end; $$;

create table public.shop_working_copies (
  shop_id uuid primary key references public.shops(id) on delete restrict,
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 131072),
  revision uuid not null default gen_random_uuid(),
  base_fingerprint text not null,
  updated_at timestamptz not null default statement_timestamp()
);
alter table public.shop_working_copies enable row level security;
alter table public.shop_working_copies force row level security;
revoke all on public.shop_working_copies from public, anon, authenticated, service_role;

-- Narrow helper used only by checked RPCs. An explicit projection prevents future
-- columns (including private media approval data) entering this edit contract.
create function public.shop_edit_document(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object('shop', jsonb_build_object(
'slug', s.slug,
'name', s.name,
'short_description', s.short_description,
'address_line_1', s.address_line_1,
'address_line_2', s.address_line_2,
'postal_code', s.postal_code,
'country_code', s.country_code,
'admin_area_code', s.admin_area_code,
'admin_area_name', s.admin_area_name,
'locality_id', s.locality_id,
'city_display', s.city_display,
'neighbourhood', s.neighbourhood,
'timezone', s.timezone,
'phone', s.phone,
'website_url', s.website_url,
'appointment_required', s.appointment_required,
'accessibility_notes', s.accessibility_notes,
'operational_status', s.operational_status,
'source_quality', s.source_quality,
'last_verified_at', s.last_verified_at,
'position_precision', s.position_precision, 'latitude', extensions.st_y(s.location), 'longitude', extensions.st_x(s.location),
'opening_hours', s.opening_hours),
'aliases', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'alias', r.alias, 'language_tag', r.language_tag, 'alias_type', r.alias_type) order by to_jsonb(r)::text) from public.shop_aliases r where r.shop_id=s.id), '[]'::jsonb),
'links', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'link_type', r.link_type, 'url', r.url, 'label', r.label, 'is_official', r.is_official, 'sort_order', r.sort_order) order by to_jsonb(r)::text) from public.shop_links r where r.shop_id=s.id), '[]'::jsonb),
'sources', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'label', r.label, 'source_type', r.source_type, 'source_url', r.source_url, 'checked_at', r.checked_at, 'reliability', r.reliability, 'evidence_note', r.evidence_note, 'status', r.status, 'claims', coalesce((select jsonb_agg(c.claim_token order by c.claim_token) from public.shop_source_claims c where c.source_id=r.id), '[]'::jsonb)) order by to_jsonb(r)::text) from public.shop_sources r where r.shop_id=s.id), '[]'::jsonb),
'types', coalesce((select jsonb_agg(jsonb_build_object('shop_type_id', r.shop_type_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at, 'is_primary', r.is_primary) order by to_jsonb(r)::text) from public.shop_shop_types r where r.shop_id=s.id), '[]'::jsonb),
'services', coalesce((select jsonb_agg(jsonb_build_object('service_id', r.service_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_services r where r.shop_id=s.id), '[]'::jsonb),
'specialties', coalesce((select jsonb_agg(jsonb_build_object('specialty_id', r.specialty_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_specialties r where r.shop_id=s.id), '[]'::jsonb),
'brands', coalesce((select jsonb_agg(jsonb_build_object('brand_id', r.brand_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_brands r where r.shop_id=s.id), '[]'::jsonb)
) from public.shops s where s.id=p_id;
$$;
revoke all on function public.shop_edit_document(uuid) from public, anon, authenticated, service_role;

-- JSON boundary validation applies even to direct PostgREST RPC calls.
create function public.check_edit_object(p_value jsonb, p_schema jsonb, p_required text[] default '{}')
returns void language plpgsql set search_path = '' as $$
declare k text; v jsonb; t text;
begin
  if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Invalid catalogue data' using errcode='22023'; end if;
  for k,v in select * from jsonb_each(p_value) loop
    t := p_schema->>k;
    if t is null then raise exception 'Invalid catalogue data' using errcode='22023'; end if;
    if v='null'::jsonb then continue; end if;
    if (t in ('text','uuid','date','url') and (jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 4000 or btrim(v#>>'{}')=''))
      or (t='boolean' and jsonb_typeof(v)<>'boolean')
      or (t='number' and jsonb_typeof(v)<>'number')
      or (t='object' and jsonb_typeof(v)<>'object')
      or (t='array' and (jsonb_typeof(v)<>'array' or jsonb_array_length(v)>100)) then
      raise exception 'Invalid catalogue data' using errcode='22023';
    end if;
    if t='uuid' then perform (v#>>'{}')::uuid; end if;
    if t='date' and ((v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}(T| |$)' or (v#>>'{}')::timestamptz > statement_timestamp()) then
      raise exception 'Invalid catalogue date' using errcode='22023';
    end if;
    if t='url' and ((v#>>'{}') !~* '^https?://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$') then
      raise exception 'Invalid catalogue URL' using errcode='22023';
    end if;
  end loop;
  foreach k in array p_required loop
    if p_value->>k is null then raise exception 'Missing catalogue field' using errcode='22023'; end if;
  end loop;
end; $$;
revoke all on function public.check_edit_object(jsonb,jsonb,text[]) from public, anon, authenticated, service_role;

create function public.validate_shop_document(p_id uuid, d jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare s jsonb := d->'shop'; r jsonb; k text; schema jsonb; required text[]; identity_key text; target_table text; exists_id boolean;
begin
  if d is null or octet_length(d::text)>131072 then raise exception 'Invalid catalogue data' using errcode='22023'; end if;
  perform public.check_edit_object(d,'{"shop":"object","sources":"array","aliases":"array","links":"array","types":"array","services":"array","specialties":"array","brands":"array"}',array['shop','sources','aliases','links','types','services','specialties','brands']);
  perform public.check_edit_object(s,'{"slug":"text","name":"text","short_description":"text","address_line_1":"text","address_line_2":"text","postal_code":"text","country_code":"text","admin_area_code":"text","admin_area_name":"text","locality_id":"uuid","city_display":"text","neighbourhood":"text","timezone":"text","phone":"text","website_url":"url","opening_hours":"object","appointment_required":"boolean","accessibility_notes":"text","operational_status":"text","source_quality":"text","last_verified_at":"date","position_precision":"text","latitude":"number","longitude":"number"}',array['slug','name','operational_status','source_quality','position_precision']);
  if s->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(s->>'slug')>120 or length(s->>'name')>300
    or (s->>'country_code' is not null and s->>'country_code' !~ '^[A-Z]{2}$')
    or (s->>'timezone' is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=s->>'timezone'))
    or (s->>'latitude' is null) <> (s->>'longitude' is null)
    or (s->>'latitude')::numeric not between -90 and 90 or (s->>'longitude')::numeric not between -180 and 180
    or s->>'operational_status' not in ('open','temporarily_closed','permanently_closed','unknown')
    or s->>'source_quality' not in ('verified','sourced','community_unverified','demo')
    or s->>'position_precision' not in ('street','locality') then
    raise exception 'Invalid catalogue data' using errcode='22023';
  end if;
  if s->>'locality_id' is not null and not exists(select 1 from public.localities where id=(s->>'locality_id')::uuid and country_code=s->>'country_code') then
    raise exception 'Locality must match country' using errcode='22023';
  end if;
  -- Demo and test-venue identity cannot be laundered into a real catalogue.
  if exists(select 1 from public.shops where id=p_id and source_quality='demo') and s->>'source_quality'<>'demo' then
    raise exception 'Demo identity is permanent' using errcode='22023';
  end if;
  if s->'opening_hours' is not null and s->'opening_hours'<>'null'::jsonb then
    perform public.check_edit_object(s->'opening_hours','{"entries":"array","note":"text"}');
    for r in select value from jsonb_array_elements(coalesce(s->'opening_hours'->'entries','[]'::jsonb)) loop
      perform public.check_edit_object(r,'{"day":"text","opens":"text","closes":"text","closed":"boolean","note":"text"}',array['day']);
      if r->>'day' not in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')
        or (r->>'opens' is null)<>(r->>'closes' is null)
        or (r->>'opens' is not null and (r->>'opens' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or r->>'closes' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
        or (r->>'closed'='true' and r->>'opens' is not null) then
        raise exception 'Invalid opening hours' using errcode='22023';
      end if;
    end loop;
  end if;
  foreach k in array array['sources','aliases','links','types','services','specialties','brands'] loop
    identity_key := 'id'; target_table := null;
    if k='sources' then
      schema := '{"id":"uuid","label":"text","source_type":"text","source_url":"url","checked_at":"date","reliability":"text","evidence_note":"text","status":"text","claims":"array"}';
      required := array['id','label','source_type','checked_at','reliability','status','claims'];
    elsif k='aliases' then
      schema := '{"id":"uuid","alias":"text","language_tag":"text","alias_type":"text"}'; required:=array['id','alias','language_tag','alias_type'];
    elsif k='links' then
      schema := '{"id":"uuid","link_type":"text","url":"url","label":"text","is_official":"boolean","sort_order":"number"}'; required:=array['id','link_type','url','is_official','sort_order'];
    else
      identity_key := case k when 'types' then 'shop_type_id' when 'services' then 'service_id' when 'specialties' then 'specialty_id' else 'brand_id' end;
      target_table := case k when 'types' then 'shop_types' else k end;
      schema := jsonb_build_object(identity_key,'uuid','source_id','uuid','note','text','last_verified_at','date');
      required := array[identity_key];
      if k='types' then schema:=schema || '{"is_primary":"boolean"}'; required:=required || 'is_primary'::text; end if;
    end if;
    if (select count(*) <> count(distinct value->>identity_key) from jsonb_array_elements(d->k)) then
      raise exception 'Duplicate catalogue item' using errcode='22023';
    end if;
    for r in select value from jsonb_array_elements(d->k) loop
      perform public.check_edit_object(r,schema,required);
      if target_table is not null then
        execute format('select exists(select 1 from public.%I where id=$1)',target_table) into exists_id using (r->>identity_key)::uuid;
        if not exists_id then raise exception 'Unknown catalogue vocabulary' using errcode='22023'; end if;
        if r->>'source_id' is not null and not exists(select 1 from jsonb_array_elements(d->'sources') a where a->>'id'=r->>'source_id') then
          raise exception 'Source must belong to this shop' using errcode='22023';
        end if;
      elsif k='sources' then
        if r->>'source_type' not in ('official','brand_dealer_list','community_list','founder_visit','demo_fixture')
          or r->>'reliability' not in ('primary','secondary','direct','unknown') or r->>'status' not in ('active','stale','unavailable')
          or (r->>'source_type'='demo_fixture' and s->>'source_quality'<>'demo')
          or exists(select 1 from public.shop_sources where id=(r->>'id')::uuid and shop_id<>p_id)
          or exists(select 1 from jsonb_array_elements(r->'claims') c where jsonb_typeof(c)<>'string' or length(btrim(c#>>'{}')) not between 1 and 200)
          or (select count(*)<>count(distinct value) from jsonb_array_elements(r->'claims')) then
          raise exception 'Invalid source' using errcode='22023';
        end if;
      elsif k='aliases' then
        if r->>'language_tag' !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
          or r->>'alias_type' not in ('local_name','romanization','former_name','search_synonym')
          or exists(select 1 from public.shop_aliases where id=(r->>'id')::uuid and shop_id<>p_id) then
          raise exception 'Invalid alias' using errcode='22023';
        end if;
      elsif k='links' then
        if r->>'link_type' not in ('website','instagram','facebook','x','line','directions','contact')
          or exists(select 1 from public.shop_links where id=(r->>'id')::uuid and shop_id<>p_id)
          or (r->>'sort_order')::numeric not between 0 and 1000 or trunc((r->>'sort_order')::numeric)<>(r->>'sort_order')::numeric then
          raise exception 'Invalid link' using errcode='22023';
        end if;
      end if;
    end loop;
  end loop;
  if (select count(*) from jsonb_array_elements(d->'types') where value->>'is_primary'='true')>1
    or (select count(*)<>count(distinct lower(value->>'alias')) from jsonb_array_elements(d->'aliases'))
    or (select count(*)<>count(distinct value->>'url') from jsonb_array_elements(d->'links')) then
    raise exception 'Duplicate catalogue item' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(d->'types') t join public.shop_types st on st.id=(t->>'shop_type_id')::uuid where st.code='test_venue') and s->>'source_quality'<>'demo' then
    raise exception 'Test venues must remain demo' using errcode='22023';
  end if;
end; $$;
revoke all on function public.validate_shop_document(uuid,jsonb) from public, anon, authenticated, service_role;
create function public.apply_shop_document(p_id uuid, p_document jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shops;
begin
  s := jsonb_populate_record(null::public.shops, p_document->'shop');
  update public.shops set
slug=s.slug,
name=s.name,
short_description=s.short_description,
address_line_1=s.address_line_1,
address_line_2=s.address_line_2,
postal_code=s.postal_code,
country_code=s.country_code,
admin_area_code=s.admin_area_code,
admin_area_name=s.admin_area_name,
locality_id=s.locality_id,
city_display=s.city_display,
neighbourhood=s.neighbourhood,
timezone=s.timezone,
phone=s.phone,
website_url=s.website_url,
appointment_required=s.appointment_required,
accessibility_notes=s.accessibility_notes,
operational_status=s.operational_status,
source_quality=s.source_quality,
last_verified_at=s.last_verified_at,
position_precision=s.position_precision, opening_hours=jsonb_strip_nulls(s.opening_hours),
location=case when p_document->'shop'->>'latitude' is null then null else
extensions.st_setsrid(extensions.st_makepoint((p_document->'shop'->>'longitude')::float8,
(p_document->'shop'->>'latitude')::float8),4326) end where id=p_id;
delete from public.shop_aliases where shop_id=p_id and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_document->'aliases'));
delete from public.shop_links where shop_id=p_id and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_document->'links'));
delete from public.shop_shop_types where shop_id=p_id and shop_type_id not in (select (value->>'shop_type_id')::uuid from jsonb_array_elements(p_document->'types'));
delete from public.shop_services where shop_id=p_id and service_id not in (select (value->>'service_id')::uuid from jsonb_array_elements(p_document->'services'));
delete from public.shop_specialties where shop_id=p_id and specialty_id not in (select (value->>'specialty_id')::uuid from jsonb_array_elements(p_document->'specialties'));
delete from public.shop_brands where shop_id=p_id and brand_id not in (select (value->>'brand_id')::uuid from jsonb_array_elements(p_document->'brands'));
delete from public.shop_source_claims where shop_id=p_id and not exists (select 1 from jsonb_array_elements(p_document->'sources') r, jsonb_array_elements_text(r->'claims') c where (r->>'id')::uuid=source_id and c=claim_token);
insert into public.shop_sources as existing (shop_id,id,label,source_type,source_url,checked_at,reliability,evidence_note,status) select p_id,r.id,r.label,r.source_type,r.source_url,r.checked_at,r.reliability,r.evidence_note,r.status from jsonb_populate_recordset(null::public.shop_sources,p_document->'sources') r
on conflict (id) do update set label=excluded.label,source_type=excluded.source_type,source_url=excluded.source_url,checked_at=excluded.checked_at,reliability=excluded.reliability,evidence_note=excluded.evidence_note,status=excluded.status
where existing.shop_id=excluded.shop_id and (existing.label,existing.source_type,existing.source_url,existing.checked_at,existing.reliability,existing.evidence_note,existing.status) is distinct from (excluded.label,excluded.source_type,excluded.source_url,excluded.checked_at,excluded.reliability,excluded.evidence_note,excluded.status);
insert into public.shop_aliases as existing (shop_id,id,alias,language_tag,alias_type) select p_id,r.id,r.alias,r.language_tag,r.alias_type from jsonb_populate_recordset(null::public.shop_aliases,p_document->'aliases') r
on conflict (id) do update set alias=excluded.alias,language_tag=excluded.language_tag,alias_type=excluded.alias_type
where existing.shop_id=excluded.shop_id and (existing.alias,existing.language_tag,existing.alias_type) is distinct from (excluded.alias,excluded.language_tag,excluded.alias_type);
insert into public.shop_links as existing (shop_id,id,link_type,url,label,is_official,sort_order) select p_id,r.id,r.link_type,r.url,r.label,r.is_official,r.sort_order from jsonb_populate_recordset(null::public.shop_links,p_document->'links') r
on conflict (id) do update set link_type=excluded.link_type,url=excluded.url,label=excluded.label,is_official=excluded.is_official,sort_order=excluded.sort_order
where existing.shop_id=excluded.shop_id and (existing.link_type,existing.url,existing.label,existing.is_official,existing.sort_order) is distinct from (excluded.link_type,excluded.url,excluded.label,excluded.is_official,excluded.sort_order);
insert into public.shop_shop_types as existing (shop_id,shop_type_id,note,source_id,last_verified_at,is_primary) select p_id,r.shop_type_id,r.note,r.source_id,r.last_verified_at,r.is_primary from jsonb_populate_recordset(null::public.shop_shop_types,p_document->'types') r
on conflict (shop_id,shop_type_id) do update set note=excluded.note,source_id=excluded.source_id,last_verified_at=excluded.last_verified_at,is_primary=excluded.is_primary
where existing.shop_id=excluded.shop_id and (existing.note,existing.source_id,existing.last_verified_at,existing.is_primary) is distinct from (excluded.note,excluded.source_id,excluded.last_verified_at,excluded.is_primary);
insert into public.shop_services as existing (shop_id,service_id,note,source_id,last_verified_at) select p_id,r.service_id,r.note,r.source_id,r.last_verified_at from jsonb_populate_recordset(null::public.shop_services,p_document->'services') r
on conflict (shop_id,service_id) do update set note=excluded.note,source_id=excluded.source_id,last_verified_at=excluded.last_verified_at
where existing.shop_id=excluded.shop_id and (existing.note,existing.source_id,existing.last_verified_at) is distinct from (excluded.note,excluded.source_id,excluded.last_verified_at);
insert into public.shop_specialties as existing (shop_id,specialty_id,note,source_id,last_verified_at) select p_id,r.specialty_id,r.note,r.source_id,r.last_verified_at from jsonb_populate_recordset(null::public.shop_specialties,p_document->'specialties') r
on conflict (shop_id,specialty_id) do update set note=excluded.note,source_id=excluded.source_id,last_verified_at=excluded.last_verified_at
where existing.shop_id=excluded.shop_id and (existing.note,existing.source_id,existing.last_verified_at) is distinct from (excluded.note,excluded.source_id,excluded.last_verified_at);
insert into public.shop_brands as existing (shop_id,brand_id,note,source_id,last_verified_at) select p_id,r.brand_id,r.note,r.source_id,r.last_verified_at from jsonb_populate_recordset(null::public.shop_brands,p_document->'brands') r
on conflict (shop_id,brand_id) do update set note=excluded.note,source_id=excluded.source_id,last_verified_at=excluded.last_verified_at
where existing.shop_id=excluded.shop_id and (existing.note,existing.source_id,existing.last_verified_at) is distinct from (excluded.note,excluded.source_id,excluded.last_verified_at);
delete from public.shop_sources where shop_id=p_id and id not in (
 select (value->>'id')::uuid from jsonb_array_elements(p_document->'sources'));
insert into public.shop_source_claims(shop_id,source_id,claim_token)
select p_id, (r->>'id')::uuid, c from jsonb_array_elements(p_document->'sources') r,
jsonb_array_elements_text(r->'claims') c on conflict do nothing;
end; $$;
revoke all on function public.apply_shop_document(uuid,jsonb) from public, anon, authenticated, service_role;

-- Extend the WP1 audit without persisting evidence notes, URLs or field values.
alter table public.admin_audit_log drop constraint admin_audit_log_action_check,
  drop constraint admin_audit_log_entity_type_check, drop constraint audit_role_summaries;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links','shop_shop_types','shop_services','shop_specialties','shop_brands')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);
create function public.audit_catalogue_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare b jsonb; a jsonb; target uuid; req uuid;
begin
  if TG_OP <> 'INSERT' then b:=to_jsonb(old)-array['created_at','updated_at']; end if;
  if TG_OP <> 'DELETE' then a:=to_jsonb(new)-array['created_at','updated_at']; end if;
  if a is not distinct from b then return null; end if;
  target := case when TG_TABLE_NAME='shops' then coalesce(a,b)->>'id' else coalesce(a,b)->>'shop_id' end;
  req := coalesce(nullif(current_setting('nibatlas.admin_request_id',true),'')::uuid,gen_random_uuid());
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary,request_id)
  values(auth.uid(),case when auth.uid() is null then 'database_operator' else 'account' end,
    'catalogue_'||lower(TG_OP),TG_TABLE_NAME,target,
    jsonb_strip_nulls(jsonb_build_object('fingerprint',case when b is not null then md5(b::text) end,'publicationStatus',b->>'publication_status','operationalStatus',b->>'operational_status')),
    jsonb_strip_nulls(jsonb_build_object('fingerprint',case when a is not null then md5(a::text) end,'publicationStatus',a->>'publication_status','operationalStatus',a->>'operational_status')),req);
  return null;
end; $$;
revoke all on function public.audit_catalogue_change() from public, anon, authenticated, service_role;
do $$ declare t text; begin
  foreach t in array array['shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links','shop_shop_types','shop_services','shop_specialties','shop_brands'] loop
    execute format('create trigger catalogue_audit after insert or update or delete on public.%I for each row execute function public.audit_catalogue_change()',t);
  end loop;
end; $$;

create function public.shop_publication_errors(p_id uuid, d jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare errors jsonb:='[]'; s jsonb:=d->'shop';
begin
  if s->>'country_code' is null or s->>'timezone' is null or s->>'latitude' is null or s->>'longitude' is null or s->>'locality_id' is null then
    errors:=errors||'"Add country, locality, timezone and sourced coordinates."'::jsonb;
  end if;
  if not exists(select 1 from jsonb_array_elements(d->'types') t where t->>'is_primary'='true') then
    errors:=errors||'"Choose one primary shop type."'::jsonb;
  end if;
  if not exists(select 1 from jsonb_array_elements(d->'sources') r where r->>'checked_at' is not null
    and (r->>'source_url' is not null or r->>'source_type' in ('founder_visit','demo_fixture'))) then
    errors:=errors||'"Add a dated source with a URL, or a documented founder visit."'::jsonb;
  end if;
  if not exists(select 1 from public.stamps st join public.stamp_artwork_versions av on av.stamp_id=st.id and av.design_version=st.current_design_version
    where st.shop_id=p_id and st.status='active' and st.stamp_type='atlas' and av.approval_status='approved') then
    errors:=errors||'"Prepare an active Atlas Stamp with approved artwork (artwork package)."'::jsonb;
  end if;
  return errors;
end; $$;
revoke all on function public.shop_publication_errors(uuid,jsonb) from public, anon, authenticated, service_role;

create function public.admin_shop_read(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.shops; w public.shop_working_copies; d jsonb; fingerprint text;
begin
  perform public.admin_access();
  select * into s from public.shops where id=p_id;
  if not found then raise exception 'Shop not found' using errcode='P0002'; end if;
  d:=public.shop_edit_document(p_id); fingerprint:=md5(d::text);
  select * into w from public.shop_working_copies where shop_id=p_id;
  return jsonb_build_object('id',p_id,'publicationStatus',s.publication_status,
    'revision',coalesce(w.revision::text,fingerprint),'hasChanges',w.shop_id is not null,
    'document',coalesce(w.document,d),'publicationErrors',public.shop_publication_errors(p_id,coalesce(w.document,d)));
end; $$;
revoke all on function public.admin_shop_read(uuid) from public, anon, service_role;
grant execute on function public.admin_shop_read(uuid) to authenticated;

create function public.admin_shop_list(p_after uuid default null, p_query text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.admin_access();
  if p_query is null or length(p_query)>120 then raise exception 'Invalid query' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug,'publicationStatus',publication_status,'operationalStatus',operational_status,'hasChanges',has_changes) order by id),'[]') into result
  from (select s.*,exists(select 1 from public.shop_working_copies w where w.shop_id=s.id) has_changes from public.shops s
    where (p_after is null or s.id>p_after) and (p_query='' or strpos(lower(s.name),lower(p_query))>0 or strpos(s.slug,lower(p_query))>0)
    order by s.id limit 51) entries;
  return result;
end; $$;
revoke all on function public.admin_shop_list(uuid,text) from public, anon, service_role;
grant execute on function public.admin_shop_list(uuid,text) to authenticated;

create function public.admin_shop_options()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_access();
  return jsonb_build_object(
    'localities',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',name||' ('||country_code||')','countryCode',country_code) order by country_code,name),'[]') from public.localities),
    'types',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label) order by sort_order),'[]') from public.shop_types),
    'services',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label) order by sort_order),'[]') from public.services),
    'specialties',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label) order by sort_order),'[]') from public.specialties),
    'brands',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',name) order by name),'[]') from public.brands));
end; $$;
revoke all on function public.admin_shop_options() from public, anon, service_role;
grant execute on function public.admin_shop_options() to authenticated;

create function public.admin_shop_write(p_action text, p_id uuid, p_revision text default null, p_document jsonb default null)
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
