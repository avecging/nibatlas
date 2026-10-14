-- Milestone 3, WP2: make the public detail and Nearby contracts honest and
-- presentation-complete. Historical Milestone 2 migrations remain immutable.

-- These two columns do not carry a source reference. They remain available to
-- admin/import work, but are not public claims until a later migration gives
-- each populated value an explicit source UUID.
create or replace function public.shop_detail(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select jsonb_strip_nulls(jsonb_build_object(
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
      'label', sv.label, 'note', ss.note, 'confirmedBy', ss.source_id
    )) order by sv.sort_order, sv.code) as items
    from public.shop_services ss join public.services sv on sv.id = ss.service_id
    where ss.shop_id = s.id and ss.source_id is not null
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

comment on function public.shop_detail is
  'Published detail projection. Unsourced internal practical columns are withheld until they carry per-field provenance.';

create or replace function public.nearby_shops(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer default 10000,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_point extensions.geography;
  v_result jsonb;
begin
  if p_latitude is null or p_longitude is null or p_radius_m is null or p_limit is null
    or p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinate' using errcode = '22023';
  end if;
  if p_radius_m < 1 or p_radius_m > 100000 then
    raise exception 'Radius must be between 1 and 100000 metres' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Limit must be between 1 and 100' using errcode = '22023';
  end if;

  v_point := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude), 4326
  )::extensions.geography;

  with matched as (
    select
      s.id,
      s.slug,
      s.name,
      s.country_code,
      coalesce(l.name, s.city_display, s.country_code) as locality_name,
      extensions.st_y(s.location)::double precision as latitude,
      extensions.st_x(s.location)::double precision as longitude,
      s.position_precision,
      primary_type.code as primary_type,
      s.operational_status,
      round(extensions.st_distance(s.location::extensions.geography, v_point))::integer as distance_m
    from public.shops s
    left join public.localities l on l.id = s.locality_id
    join lateral (
      select st.code
      from public.shop_shop_types sst
      join public.shop_types st on st.id = sst.shop_type_id
      where sst.shop_id = s.id
      order by sst.is_primary desc, st.sort_order, st.code
      limit 1
    ) primary_type on true
    where s.publication_status = 'published'
      and s.operational_status <> 'permanently_closed'
      and extensions.st_dwithin(s.location::extensions.geography, v_point, p_radius_m)
    order by s.location::extensions.geography <-> v_point, s.id
    limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'slug', slug,
    'name', name,
    'countryCode', country_code,
    'localityName', locality_name,
    'position', jsonb_build_object('latitude', latitude, 'longitude', longitude),
    'positionPrecision', position_precision,
    'primaryType', primary_type,
    'operationalStatus', operational_status,
    'distanceMeters', distance_m
  ) order by distance_m, id), '[]'::jsonb)
  into v_result from matched;

  return jsonb_build_object('shops', v_result, 'radiusMeters', p_radius_m);
end;
$$;

comment on function public.nearby_shops is
  'Published distance-sorted discovery read with precision, type, and status required for honest presentation. Input coordinates are never persisted.';
