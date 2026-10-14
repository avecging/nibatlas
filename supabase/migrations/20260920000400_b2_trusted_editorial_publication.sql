-- B2b: trusted editorial publication. No source, date, position or review backfill.
-- Canonical and private documents retain their existing identities and audit/RLS.
alter table public.shops
  add column feature_headline text check (feature_headline is null or length(feature_headline) <= 4000),
  add column field_note_heading text check (field_note_heading is null or length(field_note_heading) <= 4000),
  add column field_note_body text check (field_note_body is null or length(field_note_body) <= 4000),
  add column local_address text check (local_address is null or length(local_address) <= 4000),
  add column unit_floor text check (unit_floor is null or length(unit_floor) <= 4000),
  add column nearest_station text check (nearest_station is null or length(nearest_station) <= 4000),
  add column station_exit text check (station_exit is null or length(station_exit) <= 4000),
  add column walking_guidance text check (walking_guidance is null or length(walking_guidance) <= 4000),
  add column entrance_notes text check (entrance_notes is null or length(entrance_notes) <= 4000),
  add column editions_text text check (editions_text is null or length(editions_text) <= 4000),
  add column payment_methods text check (payment_methods is null or length(payment_methods) <= 4000),
  add column languages text check (languages is null or length(languages) <= 4000),
  add column holiday_note text check (holiday_note is null or length(holiday_note) <= 4000),
  add column internal_notes text check (internal_notes is null or length(internal_notes) <= 4000),
  add column reference_links text check (reference_links is null or length(reference_links) <= 4000),
  add column editorial_experiences jsonb not null default '[]',
  add column reviewed_by uuid references public.profiles(id) on delete restrict,
  add column reviewed_at timestamptz,
  add column position_confirmation jsonb;
alter table public.shop_working_copies add column position_confirmation jsonb;
create temporary table b2_current_bases on commit drop as
select w.shop_id from public.shop_working_copies w
where w.base_fingerprint=md5(public.shop_edit_document(w.shop_id)::text);
create or replace function public.shop_edit_document(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object('shop', jsonb_build_object(
'feature_headline', s.feature_headline,
'field_note_heading', s.field_note_heading,
'field_note_body', s.field_note_body,
'local_address', s.local_address,
'unit_floor', s.unit_floor,
'nearest_station', s.nearest_station,
'station_exit', s.station_exit,
'walking_guidance', s.walking_guidance,
'entrance_notes', s.entrance_notes,
'editions_text', s.editions_text,
'payment_methods', s.payment_methods,
'languages', s.languages,
'holiday_note', s.holiday_note,
'internal_notes', s.internal_notes,
'reference_links', s.reference_links,
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
'experiences', s.editorial_experiences,
'aliases', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'alias', r.alias, 'language_tag', r.language_tag, 'alias_type', r.alias_type) order by to_jsonb(r)::text) from public.shop_aliases r where r.shop_id=s.id), '[]'::jsonb),
'links', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'link_type', r.link_type, 'url', r.url, 'label', r.label, 'is_official', r.is_official, 'sort_order', r.sort_order) order by to_jsonb(r)::text) from public.shop_links r where r.shop_id=s.id), '[]'::jsonb),
'sources', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'label', r.label, 'source_type', r.source_type, 'source_url', r.source_url, 'checked_at', r.checked_at, 'reliability', r.reliability, 'evidence_note', r.evidence_note, 'status', r.status, 'claims', coalesce((select jsonb_agg(c.claim_token order by c.claim_token) from public.shop_source_claims c where c.source_id=r.id), '[]'::jsonb)) order by to_jsonb(r)::text) from public.shop_sources r where r.shop_id=s.id), '[]'::jsonb),
'types', coalesce((select jsonb_agg(jsonb_build_object('shop_type_id', r.shop_type_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at, 'is_primary', r.is_primary) order by to_jsonb(r)::text) from public.shop_shop_types r where r.shop_id=s.id), '[]'::jsonb),
'services', coalesce((select jsonb_agg(jsonb_build_object('service_id', r.service_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_services r where r.shop_id=s.id), '[]'::jsonb),
'specialties', coalesce((select jsonb_agg(jsonb_build_object('specialty_id', r.specialty_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_specialties r where r.shop_id=s.id), '[]'::jsonb),
'brands', coalesce((select jsonb_agg(jsonb_build_object('brand_id', r.brand_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_brands r where r.shop_id=s.id), '[]'::jsonb)
) from public.shops s where s.id=p_id;
$$;
create or replace function public.validate_shop_document(p_id uuid, d jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare s jsonb := d->'shop'; r jsonb; k text; schema jsonb; required text[]; identity_key text; target_table text; exists_id boolean;
begin
  if d is null or octet_length(d::text)>131072 then raise exception 'Invalid catalogue data' using errcode='22023'; end if;
  perform public.check_edit_object(d,'{"experiences":"array","shop":"object","sources":"array","aliases":"array","links":"array","types":"array","services":"array","specialties":"array","brands":"array"}',array['shop','sources','aliases','links','types','services','specialties','brands']);
  perform public.check_edit_object(s,'{"feature_headline":"text","field_note_heading":"text","field_note_body":"text","local_address":"text","unit_floor":"text","nearest_station":"text","station_exit":"text","walking_guidance":"text","entrance_notes":"text","editions_text":"text","payment_methods":"text","languages":"text","holiday_note":"text","internal_notes":"text","reference_links":"text","slug":"text","name":"text","short_description":"text","address_line_1":"text","address_line_2":"text","postal_code":"text","country_code":"text","admin_area_code":"text","admin_area_name":"text","locality_id":"uuid","city_display":"text","neighbourhood":"text","timezone":"text","phone":"text","website_url":"url","opening_hours":"object","appointment_required":"boolean","accessibility_notes":"text","operational_status":"text","source_quality":"text","last_verified_at":"date","position_precision":"text","latitude":"number","longitude":"number"}',array['slug','name','operational_status','source_quality','position_precision']);
  for r in select value from jsonb_array_elements(coalesce(d->'experiences','[]')) loop
    perform public.check_edit_object(r,'{"id":"uuid","category":"text","title":"text","description":"text"}',array['id','category','title']);
    if r->>'category' not in ('fountain_pens','inks_paper','nib_testing','gifts','repairs','other') then
      raise exception 'Invalid experience category' using errcode='22023'; end if;
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(coalesce(d->'experiences','[]'))) then
    raise exception 'Duplicate catalogue item' using errcode='22023'; end if;
  if s->>'reference_links' is not null then
    for k in select regexp_split_to_table(s->>'reference_links', E'\n') loop
      if btrim(k)<>'' then perform public.check_edit_object(jsonb_build_object('url',btrim(k)),'{"url":"url"}'); end if;
    end loop;
  end if;
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
create or replace function public.apply_shop_document(p_id uuid, p_document jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shops;
begin
  s := jsonb_populate_record(null::public.shops, p_document->'shop');
  update public.shops set
feature_headline=s.feature_headline,
field_note_heading=s.field_note_heading,
field_note_body=s.field_note_body,
local_address=s.local_address,
unit_floor=s.unit_floor,
nearest_station=s.nearest_station,
station_exit=s.station_exit,
walking_guidance=s.walking_guidance,
entrance_notes=s.entrance_notes,
editions_text=s.editions_text,
payment_methods=s.payment_methods,
languages=s.languages,
holiday_note=s.holiday_note,
internal_notes=s.internal_notes,
reference_links=s.reference_links,
editorial_experiences=coalesce(p_document->'experiences','[]'),
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
-- Release a replaced primary flag before inserting its successor, regardless of
-- the order of the submitted type array. The whole change remains atomic.
update public.shop_shop_types set is_primary=false where shop_id=p_id and is_primary
  and not exists(select 1 from jsonb_array_elements(p_document->'types') t
    where (t->>'shop_type_id')::uuid=shop_type_id and t->>'is_primary'='true');
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
-- Preserve pre-migration saved content and pre-existing conflict state. New fields
-- default unknown on read; keep saved bytes intact, including near-limit copies.
-- No pending content is applied to public catalogue tables.
update public.shop_working_copies w set base_fingerprint=md5(public.shop_edit_document(w.shop_id)::text)
where w.shop_id in (select shop_id from b2_current_bases);

create function public.shop_position_fingerprint(d jsonb)
returns text language sql immutable set search_path='' as $$
select md5(coalesce(jsonb_object_agg(k, d->'shop'->k order by k),'{}')::text)
from unnest(array['country_code','locality_id','city_display','admin_area_code','admin_area_name','neighbourhood','address_line_1','address_line_2','postal_code','local_address','unit_floor','latitude','longitude','position_precision']) k;
$$;
revoke all on function public.shop_position_fingerprint(jsonb) from public,anon,authenticated,service_role;

create function public.shop_position_confirmed(p_id uuid, d jsonb)
returns boolean language sql stable security definer set search_path='' as $$
select coalesce((case when w.shop_id is not null then w.position_confirmation else s.position_confirmation end)->>'fingerprint'
  = public.shop_position_fingerprint(d),false)
from public.shops s left join public.shop_working_copies w on w.shop_id=s.id where s.id=p_id;
$$;
revoke all on function public.shop_position_confirmed(uuid,jsonb) from public,anon,authenticated,service_role;
create or replace function public.shop_publication_errors(p_id uuid, d jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare errors jsonb:='[]'; s jsonb:=d->'shop'; token text; k text; r jsonb; required text[]:=array['Name','Location'];
begin
  if s->>'country_code' is null or s->>'timezone' is null or s->>'latitude' is null or s->>'longitude' is null or s->>'locality_id' is null then
    errors:=errors||'"Add country, locality, timezone and valid coordinates."'::jsonb;
  end if;
  if not exists(select 1 from jsonb_array_elements(d->'types') t where t->>'is_primary'='true') then
    errors:=errors||'"Choose one primary shop type."'::jsonb;
  end if;
  if nullif(btrim(s->>'address_line_1'),'') is null then
    errors:=errors||'"Add the street address."'::jsonb; end if;
  if not public.shop_position_confirmed(p_id,d) then
    errors:=errors||'"Check and confirm the saved shop position."'::jsonb; end if;
  if not exists(select 1 from public.stamps st join public.stamp_artwork_versions av on av.stamp_id=st.id and av.design_version=st.current_design_version
    where st.shop_id=p_id and st.status='active' and st.stamp_type='atlas' and av.approval_status='approved') then
    errors:=errors||'"Prepare an active Atlas Stamp with approved artwork (artwork package)."'::jsonb;
  end if;
  return errors;
end; $$;
create or replace function public.admin_shop_read(p_id uuid)
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
    'positionConfirmed',public.shop_position_confirmed(p_id,coalesce(w.document,d)),
    'document',coalesce(w.document,d),'publicationErrors',public.shop_publication_errors(p_id,coalesce(w.document,d)));
end; $$;
create or replace function public.admin_shop_write(p_action text, p_id uuid, p_revision text default null, p_document jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.shops; w public.shop_working_copies; d jsonb; fp text; errors jsonb; confirmation jsonb;
begin
  -- Hold current authority through commit: concurrent revocation serializes here.
  perform 1 from public.profiles where id=auth.uid() and role in ('editor','admin') for share;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_id is null or p_action is null or p_action not in ('create','save','confirm_position','publish','discard','temporarily_closed','permanently_closed','open','unknown','archive') then
    raise exception 'Invalid operation' using errcode='22023';
  end if;
  if p_action not in ('create','save') and p_document is not null then raise exception 'Unexpected document' using errcode='22023'; end if;
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
  confirmation:=case when w.shop_id is not null then w.position_confirmation else s.position_confirmation end;
  if p_action='confirm_position' then
    if w.shop_id is not null and w.base_fingerprint<>fp then raise exception 'Revision conflict' using errcode='40001'; end if;
    d:=coalesce(w.document,d);
    perform public.validate_shop_document(p_id,d);
    if d->'shop'->>'latitude' is null or d->'shop'->>'longitude' is null then
      raise exception 'Add a valid position before confirming' using errcode='22023'; end if;
    confirmation:=jsonb_build_object('fingerprint',public.shop_position_fingerprint(d),'actor',auth.uid(),'at',statement_timestamp());
    insert into public.shop_working_copies(shop_id,document,base_fingerprint,position_confirmation)
      values(p_id,d,fp,confirmation) on conflict(shop_id) do update set
      position_confirmation=excluded.position_confirmation,revision=gen_random_uuid(),updated_at=statement_timestamp();
  elsif p_action='save' then
    perform public.validate_shop_document(p_id,p_document);
    if w.shop_id is not null and w.base_fingerprint<>fp then raise exception 'Revision conflict' using errcode='40001'; end if;
    if p_document is not distinct from coalesce(w.document,d) then return public.admin_shop_read(p_id); end if;
    if public.shop_position_fingerprint(p_document) is distinct from public.shop_position_fingerprint(coalesce(w.document,d))
      or confirmation->>'fingerprint' is distinct from public.shop_position_fingerprint(p_document) then confirmation:=null; end if;
    insert into public.shop_working_copies(shop_id,document,base_fingerprint,position_confirmation) values(p_id,p_document,fp,confirmation)
      on conflict(shop_id) do update set document=excluded.document,position_confirmation=excluded.position_confirmation,
      revision=gen_random_uuid(),updated_at=statement_timestamp();
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
    update public.shops set publication_status='published',reviewed_by=auth.uid(),reviewed_at=statement_timestamp(),position_confirmation=confirmation,published_at=coalesce(published_at,statement_timestamp()) where id=p_id;
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
create or replace function public.shop_detail(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'review', case when s.reviewed_at is not null and s.reviewed_by is not null then
      jsonb_build_object('kind','editorial','reviewedAt',s.reviewed_at) end,
    'editorial', case when s.reviewed_at is not null then jsonb_strip_nulls(jsonb_build_object(
      'feature_headline',s.feature_headline,
      'field_note_heading',s.field_note_heading,
      'field_note_body',s.field_note_body,
      'local_address',s.local_address,
      'unit_floor',s.unit_floor,
      'nearest_station',s.nearest_station,
      'station_exit',s.station_exit,
      'walking_guidance',s.walking_guidance,
      'entrance_notes',s.entrance_notes,
      'editions_text',s.editions_text,
      'payment_methods',s.payment_methods,
      'languages',s.languages,
      'holiday_note',s.holiday_note,
      'experiences',s.editorial_experiences,
      'appointment_required',s.appointment_required,'accessibility_notes',s.accessibility_notes)) end,
    'generatedStamp', generated.art,
    'id', s.id,
    'slug', s.slug,
    'name', s.name,
    'localName', local_name.alias,
    'localNameLang', local_name.language_tag,
    'shortDescription', s.short_description,
    'addressLines', case
      when s.address_line_1 is null and s.address_line_2 is null then null
      else to_jsonb(array_remove(array[s.address_line_1, s.address_line_2], null))
    end,
    'postalCode', s.postal_code,
    'countryCode', s.country_code,
    'localityName', coalesce(l.name, s.city_display, s.country_code),
    'neighbourhood', s.neighbourhood,
    'timezone', s.timezone,
    'position', jsonb_build_object(
      'latitude', extensions.st_y(s.location)::double precision,
      'longitude', extensions.st_x(s.location)::double precision
    ),
    'positionPrecision', s.position_precision,
    'primaryType', types.items->>0,
    'specialtyLine', coalesce(specialties.items->>0, services.items->0->>'label'),
    'markerState', 'unvisited',
    'phone', s.phone,
    'websiteUrl', s.website_url,
    'openingHours', s.opening_hours->'entries',
    'openingHoursNote', s.opening_hours->>'note',
    'operationalStatus', s.operational_status,
    'sourceQuality', s.source_quality,
    'lastVerifiedAt', s.last_verified_at,
    'shopTypes', coalesce(types.items, '[]'::jsonb),
    'specialties', coalesce(specialties.items, '[]'::jsonb),
    'services', coalesce(services.items, '[]'::jsonb),
    'brands', coalesce(brands.items, '[]'::jsonb),
    'links', coalesce(links.items, '[]'::jsonb),
    'sources', coalesce(sources.items, '[]'::jsonb),
    'fixtureNotice', case when s.source_quality = 'demo' then 'Demo data' end
  )) || jsonb_build_object(
    'specialtyLine', coalesce(specialties.items->>0, services.items->0->>'label')
  )
  from public.shops s
  left join public.localities l on l.id = s.locality_id
  left join lateral (
    select jsonb_build_object('id',st.id,'designVersion',av.design_version,
      'ink',av.ink,'paletteVersion',av.palette_version,'templateData',av.template_data) as art
    from public.stamps st join public.stamp_artwork_versions av
      on av.stamp_id=st.id and av.design_version=st.current_design_version
    where st.shop_id=s.id and st.stamp_type='atlas' and st.status='active'
      and av.approval_status='approved' and av.artwork_kind='generated_template'
  ) generated on true
  left join lateral (
    select sa.alias, sa.language_tag from public.shop_aliases sa
    where sa.shop_id = s.id and sa.alias_type = 'local_name'
    order by sa.id limit 1
  ) local_name on true
  join lateral (
    select jsonb_agg(st.code order by sst.is_primary desc, st.sort_order, st.code) as items
    from public.shop_shop_types sst join public.shop_types st on st.id = sst.shop_type_id
    where sst.shop_id = s.id
    having count(*) > 0
  ) types on true
  left join lateral (
    select jsonb_agg(sp.label order by sp.sort_order, sp.code) as items
    from public.shop_specialties ss join public.specialties sp on sp.id = ss.specialty_id
    where ss.shop_id = s.id
  ) specialties on true
  left join lateral (
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'label', sv.label, 'note', ss.note, 'confirmedBy', case when s.reviewed_at is null then ss.source_id end,
      'reviewedEditorially',case when s.reviewed_at is not null then true end
    )) order by sv.sort_order, sv.code) as items
    from public.shop_services ss join public.services sv on sv.id = ss.service_id
    where ss.shop_id = s.id and (ss.source_id is not null or s.reviewed_at is not null)
  ) services on true
  left join lateral (
    select jsonb_agg(b.name order by b.name) as items
    from public.shop_brands sb join public.brands b on b.id = sb.brand_id
    where sb.shop_id = s.id
  ) brands on true
  left join lateral (
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'type', sl.link_type, 'label', sl.label, 'url', sl.url, 'isOfficial', sl.is_official
    )) order by sl.sort_order, sl.id) as items
    from public.shop_links sl where sl.shop_id = s.id and sl.is_official
  ) links on true
  left join lateral (
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', ss.id,
      'label', ss.label,
      'kind', ss.source_type,
      'url', ss.source_url,
      'retrievedOn', to_char(ss.checked_at at time zone 'UTC', 'YYYY-MM-DD'),
      'confirms', coalesce(claims.items, '[]'::jsonb)
    )) order by ss.checked_at, ss.id) as items
    from public.shop_sources ss
    left join lateral (
      select jsonb_agg(sc.claim_token order by sc.claim_token) as items
      from public.shop_source_claims sc
      where sc.shop_id = ss.shop_id and sc.source_id = ss.id
    ) claims on true
    where ss.shop_id = s.id
  ) sources on true
  where s.publication_status = 'published' and s.slug = p_slug;
$$;


-- Keep the legacy direct-read surface at the same privacy boundary as v1.
create or replace view public.published_shop_details with (security_barrier = true) as
select s.id, s.slug, s.name, s.short_description, s.address_line_1,
  s.address_line_2, s.postal_code, s.country_code, s.admin_area_name,
  s.locality_id, s.city_display, s.neighbourhood, s.timezone,
  extensions.st_x(s.location)::double precision as longitude,
  extensions.st_y(s.location)::double precision as latitude,
  s.phone, s.website_url, s.opening_hours,
  case when s.reviewed_at is not null and s.reviewed_by is not null then s.appointment_required end as appointment_required,
  case when s.reviewed_at is not null and s.reviewed_by is not null then s.accessibility_notes end as accessibility_notes, s.operational_status, s.source_quality,
  s.last_verified_at, s.updated_at
from public.shops s
where s.publication_status = 'published';
