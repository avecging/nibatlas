-- Additive labels for administrator-created types; existing public filters stay canonical.
-- Function bodies retain prior visibility, provenance, precision and privacy checks.

create or replace function public.viewport_shops(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_zoom integer,
  p_operational_statuses public.shop_operational_status[] default null,
  p_shop_type_codes text[] default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $viewport$
declare
  v_limit integer;
  v_left extensions.geometry;
  v_right extensions.geometry;
  v_shops jsonb;
  v_truncated boolean;
begin
  if p_west is null or p_south is null or p_east is null or p_north is null
    or p_zoom is null or p_limit is null
    or p_west < -180 or p_west > 180 or p_east < -180 or p_east > 180
    or p_south < -90 or p_south > 90 or p_north < -90 or p_north > 90
    or p_south >= p_north or p_west = p_east then
    raise exception 'Invalid viewport bounds' using errcode = '22023';
  end if;
  if p_zoom < 0 or p_zoom > 24 then
    raise exception 'Zoom must be between 0 and 24' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 500 then
    raise exception 'Limit must be between 1 and 500' using errcode = '22023';
  end if;
  if p_shop_type_codes is not null and exists (
    select 1
    from unnest(p_shop_type_codes) requested(code)
    left join public.shop_types st on st.code = requested.code
    where st.id is null
  ) then
    raise exception 'Unknown shop type code' using errcode = '22023';
  end if;

  v_limit := p_limit;
  if p_west < p_east then
    v_left := extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326);
  else
    v_left := extensions.st_makeenvelope(p_west, p_south, 180, p_north, 4326);
    v_right := extensions.st_makeenvelope(-180, p_south, p_east, p_north, 4326);
  end if;

  with matched as (
    select
      s.id, s.slug, s.name, local_name.alias as local_name,
      local_name.language_tag as local_name_lang,
      s.country_code, coalesce(l.name, s.city_display, s.country_code) as locality_name,
      extensions.st_y(s.location)::double precision as latitude,
      extensions.st_x(s.location)::double precision as longitude,
      primary_type.code as primary_type,
      coalesce(specialty.label, service.label) as specialty_line,
      s.operational_status, s.source_quality,
      row_number() over (order by s.id) as ordinal
    from public.shops s
    left join public.localities l on l.id = s.locality_id
    left join lateral (
      select sa.alias, sa.language_tag
      from public.shop_aliases sa
      where sa.shop_id = s.id and sa.alias_type = 'local_name'
      order by sa.id limit 1
    ) local_name on true
    join lateral (
      select st.code
      from public.shop_shop_types sst
      join public.shop_types st on st.id = sst.shop_type_id
      where sst.shop_id = s.id
      order by sst.is_primary desc, st.sort_order, st.code
      limit 1
    ) primary_type on true
    left join lateral (
      select sp.label
      from public.shop_specialties ss
      join public.specialties sp on sp.id = ss.specialty_id
      where ss.shop_id = s.id
      order by sp.sort_order, sp.code limit 1
    ) specialty on true
    left join lateral (
      select sv.label
      from public.shop_services ss
      join public.services sv on sv.id = ss.service_id
      where ss.shop_id = s.id and ss.source_id is not null
      order by sv.sort_order, sv.code limit 1
    ) service on true
    where s.publication_status = 'published'
      and (
        (v_right is null and s.location && v_left and extensions.st_intersects(s.location, v_left))
        or (v_right is not null and (
          (s.location && v_left and extensions.st_intersects(s.location, v_left))
          or (s.location && v_right and extensions.st_intersects(s.location, v_right))
        ))
      )
      and (p_operational_statuses is null or cardinality(p_operational_statuses) = 0
        or s.operational_status = any(p_operational_statuses))
      and (p_shop_type_codes is null or cardinality(p_shop_type_codes) = 0 or exists (
        select 1
        from public.shop_shop_types filter_sst
        join public.shop_types filter_st on filter_st.id = filter_sst.shop_type_id
        where filter_sst.shop_id = s.id and filter_st.code = any(p_shop_type_codes)
      ))
    order by s.id
    limit v_limit + 1
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', id,
          'slug', slug,
          'name', name,
          'localName', local_name,
          'localNameLang', local_name_lang,
          'countryCode', country_code,
          'localityName', locality_name,
          'position', jsonb_build_object('latitude', latitude, 'longitude', longitude),
          'primaryType', primary_type,
          'primaryTypeLabel', (select label from public.shop_types where code=primary_type),
          'operationalStatus', operational_status,
          'markerState', 'unvisited',
          'sourceQuality', source_quality,
          'fixtureNotice', case when source_quality = 'demo' then 'Demo data' end
        )) || jsonb_build_object('specialtyLine', specialty_line) order by ordinal
      ) filter (where ordinal <= v_limit),
      '[]'::jsonb
    ),
    count(*) > v_limit
  into v_shops, v_truncated
  from matched;

  return jsonb_build_object(
    'shops', v_shops,
    'truncated', v_truncated,
    'committedBounds', jsonb_build_object(
      'west', p_west, 'south', p_south, 'east', p_east, 'north', p_north
    ),
    'zoom', p_zoom
  );
end;
$viewport$;

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
    'primaryTypeLabel', (select label from public.shop_types where code=primary_type),
    'operationalStatus', operational_status,
    'distanceMeters', distance_m
  ) order by distance_m, id), '[]'::jsonb)
  into v_result from matched;

  return jsonb_build_object('shops', v_result, 'radiusMeters', p_radius_m);
end;
$$;

create or replace function public.saved_shop_summary(p_shop_id uuid, p_saved_at timestamptz)
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
    'countryCode', s.country_code,
    'localityName', coalesce(l.name, s.city_display, s.country_code),
    'position', jsonb_build_object(
      'latitude', extensions.st_y(s.location)::double precision,
      'longitude', extensions.st_x(s.location)::double precision
    ),
    'primaryType', primary_type.code,
    'primaryTypeLabel', (select label from public.shop_types where code=primary_type.code),
    'operationalStatus', s.operational_status,
    'markerState', 'saved',
    'sourceQuality', s.source_quality,
    'fixtureNotice', case when s.source_quality = 'demo' then 'Demo data' end,
    'savedAt', p_saved_at
  )) || jsonb_build_object(
    -- Catalogue summaries require the key even when no evidenced specialty or
    -- service exists. `jsonb_strip_nulls` is still useful for optional fields.
    'specialtyLine', coalesce(specialty.label, service.label)
  )
  from public.shops s
  left join public.localities l on l.id = s.locality_id
  left join lateral (
    select sa.alias, sa.language_tag
    from public.shop_aliases sa
    where sa.shop_id = s.id and sa.alias_type = 'local_name'
    order by sa.id
    limit 1
  ) local_name on true
  join lateral (
    select st.code
    from public.shop_shop_types sst
    join public.shop_types st on st.id = sst.shop_type_id
    where sst.shop_id = s.id
    order by sst.is_primary desc, st.sort_order, st.code
    limit 1
  ) primary_type on true
  left join lateral (
    select sp.label
    from public.shop_specialties ss
    join public.specialties sp on sp.id = ss.specialty_id
    where ss.shop_id = s.id
    order by sp.sort_order, sp.code
    limit 1
  ) specialty on true
  left join lateral (
    select sv.label
    from public.shop_services ss
    join public.services sv on sv.id = ss.service_id
    where ss.shop_id = s.id and ss.source_id is not null
    order by sv.sort_order, sv.code
    limit 1
  ) service on true
  where s.id = p_shop_id and s.publication_status = 'published';
$$;

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
    'primaryTypeLabel', (select label from public.shop_types where code=types.items->>0),
    'shopTypeLabels', (select jsonb_object_agg(st.code,st.label) from public.shop_types st join public.shop_shop_types rel on rel.shop_type_id=st.id where rel.shop_id=s.id),
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
