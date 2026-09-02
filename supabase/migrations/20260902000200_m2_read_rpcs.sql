-- Milestone 2, work package 2: integrity follow-up and public read RPCs.
-- All functions expose published catalogue data only. Coordinates supplied to
-- Near Me exist only for the duration of the statement and are never stored.

-- Forward-only repairs for integrity gaps found in the WP1 review after merge.
alter table public.localities
  add constraint localities_id_country_unique unique (id, country_code);

alter table public.shops drop constraint shops_locality_id_fkey;
alter table public.shops
  add constraint shops_locality_country_fk
  foreign key (locality_id, country_code)
  references public.localities (id, country_code)
  on delete restrict;

alter table public.shop_sources
  add constraint shop_sources_shop_id_id_unique unique (shop_id, id);

alter table public.shop_shop_types drop constraint shop_shop_types_source_id_fkey;
alter table public.shop_shop_types
  add constraint shop_shop_types_source_shop_fk
  foreign key (shop_id, source_id)
  references public.shop_sources (shop_id, id)
  on delete restrict;

alter table public.shop_services drop constraint shop_services_source_id_fkey;
alter table public.shop_services
  add constraint shop_services_source_shop_fk
  foreign key (shop_id, source_id)
  references public.shop_sources (shop_id, id)
  on delete restrict;

alter table public.shop_specialties drop constraint shop_specialties_source_id_fkey;
alter table public.shop_specialties
  add constraint shop_specialties_source_shop_fk
  foreign key (shop_id, source_id)
  references public.shop_sources (shop_id, id)
  on delete restrict;

alter table public.shop_brands drop constraint shop_brands_source_id_fkey;
alter table public.shop_brands
  add constraint shop_brands_source_shop_fk
  foreign key (shop_id, source_id)
  references public.shop_sources (shop_id, id)
  on delete restrict;

alter table public.shop_images drop constraint approved_image_metadata;
alter table public.shop_images
  add constraint approved_image_metadata check (
    moderation_status <> 'approved'
    or (
      alt_text is not null and length(btrim(alt_text)) > 0
      and credit_text is not null and length(btrim(credit_text)) > 0
      and source_url is not null and length(btrim(source_url)) > 0
      and rights_basis is not null and length(btrim(rights_basis)) > 0
    )
  );

-- The map contract requires one presentation type. The eventual publish/admin
-- transaction will enforce presence; this partial unique index prevents two.
alter table public.shop_shop_types
  add column is_primary boolean not null default false;

with first_type as (
  select distinct on (sst.shop_id) sst.shop_id, sst.shop_type_id
  from public.shop_shop_types sst
  join public.shop_types st on st.id = sst.shop_type_id
  order by sst.shop_id, st.sort_order, st.code
)
update public.shop_shop_types sst
set is_primary = true
from first_type ft
where sst.shop_id = ft.shop_id and sst.shop_type_id = ft.shop_type_id;

create unique index shop_shop_types_one_primary_idx
  on public.shop_shop_types (shop_id)
  where is_primary;

create type public.position_precision as enum ('street', 'locality');
alter table public.shops
  add column position_precision public.position_precision not null default 'locality';

-- Unknown booking requirements must remain unknown; false is a factual claim,
-- not a safe default. jsonb_strip_nulls omits this from public detail when absent.
alter table public.shops alter column appointment_required drop default;
alter table public.shops alter column appointment_required drop not null;
update public.shops set appointment_required = null where source_quality = 'demo';

create index shops_location_geography_gist_idx
  on public.shops using gist ((location::extensions.geography));

create function public.viewport_shops(
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
as $$
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
    left join lateral (
      select st.code
      from public.shop_shop_types sst
      join public.shop_types st on st.id = sst.shop_type_id
      where sst.shop_id = s.id and sst.is_primary
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
      where ss.shop_id = s.id
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
          'specialtyLine', specialty_line,
          'operationalStatus', operational_status,
          'markerState', 'unvisited',
          'sourceQuality', source_quality,
          'fixtureNotice', case when source_quality = 'demo' then 'Demo data' end
        )) order by ordinal
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
$$;

create function public.search_shops(p_query text, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_query text := lower(btrim(p_query));
  v_result jsonb;
begin
  if p_query is null or length(v_query) < 1 or length(v_query) > 120 then
    raise exception 'Search query must contain 1 to 120 characters' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'Limit must be between 1 and 50' using errcode = '22023';
  end if;

  with candidates as (
    select
      s.id, s.slug, s.name, s.country_code,
      coalesce(l.name, s.city_display, s.country_code) as locality_name,
      matched_alias.alias as matched_alias,
      least(
        case when lower(s.name) = v_query then 0 when lower(s.name) like v_query || '%' then 1 else 2 end,
        coalesce(matched_alias.match_class, 3)
      ) as match_class,
      greatest(
        extensions.similarity(lower(s.name), v_query),
        coalesce(matched_alias.score, 0)
      ) as score
    from public.shops s
    left join public.localities l on l.id = s.locality_id
    left join lateral (
      select sa.alias,
        case when lower(sa.alias) = v_query then 0
          when lower(sa.alias) like v_query || '%' then 1 else 2 end as match_class,
        extensions.similarity(lower(sa.alias), v_query) as score
      from public.shop_aliases sa
      where sa.shop_id = s.id
        and (lower(sa.alias) like v_query || '%' or extensions.similarity(lower(sa.alias), v_query) >= 0.2)
      order by match_class, score desc, sa.id
      limit 1
    ) matched_alias on true
    where s.publication_status = 'published'
      and (
        lower(s.name) like v_query || '%'
        or extensions.similarity(lower(s.name), v_query) >= 0.2
        or matched_alias.alias is not null
      )
  ), ranked as (
    select * from candidates
    order by match_class, score desc, name, id
    limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', id, 'slug', slug, 'name', name, 'countryCode', country_code,
    'localityName', locality_name, 'matchedAlias', matched_alias
  )) order by match_class, score desc, name, id), '[]'::jsonb)
  into v_result
  from ranked;

  return jsonb_build_object('shops', v_result, 'query', p_query);
end;
$$;

create function public.shop_detail(p_slug text)
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
    'addressLines', to_jsonb(array_remove(array[s.address_line_1, s.address_line_2], null)),
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
    'phone', s.phone,
    'websiteUrl', s.website_url,
    'openingHours', s.opening_hours,
    'appointmentRequired', s.appointment_required,
    'accessibilityNotes', s.accessibility_notes,
    'operationalStatus', s.operational_status,
    'sourceQuality', s.source_quality,
    'lastVerifiedAt', s.last_verified_at,
    'shopTypes', coalesce(types.items, '[]'::jsonb),
    'specialties', coalesce(specialties.items, '[]'::jsonb),
    'services', coalesce(services.items, '[]'::jsonb),
    'brands', coalesce(brands.items, '[]'::jsonb),
    'links', coalesce(links.items, '[]'::jsonb),
    'fixtureNotice', case when s.source_quality = 'demo' then 'Demo data' end
  ))
  from public.shops s
  left join public.localities l on l.id = s.locality_id
  left join lateral (
    select sa.alias, sa.language_tag from public.shop_aliases sa
    where sa.shop_id = s.id and sa.alias_type = 'local_name'
    order by sa.id limit 1
  ) local_name on true
  left join lateral (
    select jsonb_agg(st.code order by sst.is_primary desc, st.sort_order, st.code) as items
    from public.shop_shop_types sst join public.shop_types st on st.id = sst.shop_type_id
    where sst.shop_id = s.id
  ) types on true
  left join lateral (
    select jsonb_agg(sp.label order by sp.sort_order, sp.code) as items
    from public.shop_specialties ss join public.specialties sp on sp.id = ss.specialty_id
    where ss.shop_id = s.id
  ) specialties on true
  left join lateral (
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('label', sv.label, 'note', ss.note))
      order by sv.sort_order, sv.code) as items
    from public.shop_services ss join public.services sv on sv.id = ss.service_id
    where ss.shop_id = s.id
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
  where s.publication_status = 'published' and s.slug = p_slug;
$$;

create function public.nearby_shops(
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

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;

  with matched as (
    select s.id, s.slug, s.name, s.country_code,
      coalesce(l.name, s.city_display, s.country_code) as locality_name,
      extensions.st_y(s.location)::double precision as latitude,
      extensions.st_x(s.location)::double precision as longitude,
      round(extensions.st_distance(s.location::extensions.geography, v_point))::integer as distance_m
    from public.shops s
    left join public.localities l on l.id = s.locality_id
    where s.publication_status = 'published'
      and extensions.st_dwithin(s.location::extensions.geography, v_point, p_radius_m)
    order by s.location::extensions.geography <-> v_point, s.id
    limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'slug', slug, 'name', name, 'countryCode', country_code,
    'localityName', locality_name,
    'position', jsonb_build_object('latitude', latitude, 'longitude', longitude),
    'distanceMeters', distance_m
  ) order by distance_m, id), '[]'::jsonb)
  into v_result from matched;

  return jsonb_build_object('shops', v_result, 'radiusMeters', p_radius_m);
end;
$$;

revoke all on function public.viewport_shops(double precision, double precision, double precision, double precision, integer, public.shop_operational_status[], text[], integer) from public;
revoke all on function public.search_shops(text, integer) from public;
revoke all on function public.shop_detail(text) from public;
revoke all on function public.nearby_shops(double precision, double precision, integer, integer) from public;

grant execute on function public.viewport_shops(double precision, double precision, double precision, double precision, integer, public.shop_operational_status[], text[], integer) to anon, authenticated, service_role;
grant execute on function public.search_shops(text, integer) to anon, authenticated, service_role;
grant execute on function public.shop_detail(text) to anon, authenticated, service_role;
grant execute on function public.nearby_shops(double precision, double precision, integer, integer) to anon, authenticated, service_role;

comment on function public.viewport_shops is 'Bounded published marker/card projection with explicit cap and antimeridian handling.';
comment on function public.search_shops is 'Published canonical-name and alias search with exact/prefix/trigram ranking.';
comment on function public.shop_detail is 'Published shop detail projection; excludes draft controls and admin provenance.';
comment on function public.nearby_shops is 'Published distance-sorted discovery read. Input coordinates are never persisted.';
