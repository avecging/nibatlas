-- Milestone 2, work package 3: stable public provenance for the versioned API.
-- Display labels may change; evidence references use source UUIDs.

alter table public.shop_sources
  add column label text;

update public.shop_sources
set label = case
  when source_type = 'demo_fixture' then 'Demo fixture'
  else initcap(replace(source_type, '_', ' '))
end;

alter table public.shop_sources
  alter column label set not null,
  add constraint shop_sources_label_not_blank check (length(btrim(label)) > 0),
  add constraint shop_sources_type_vocabulary check (source_type in (
    'official', 'brand_dealer_list', 'community_list', 'founder_visit', 'demo_fixture'
  ));

create table public.shop_source_claims (
  shop_id uuid not null,
  source_id uuid not null,
  claim_token text not null check (length(btrim(claim_token)) > 0),
  created_at timestamptz not null default statement_timestamp(),
  primary key (source_id, claim_token),
  constraint shop_source_claims_source_shop_fk
    foreign key (shop_id, source_id)
    references public.shop_sources (shop_id, id)
    on delete cascade
);

create index shop_source_claims_shop_idx
  on public.shop_source_claims (shop_id, source_id);

alter table public.shop_source_claims enable row level security;
alter table public.shop_source_claims force row level security;
revoke all on table public.shop_source_claims from anon, authenticated;
grant all on table public.shop_source_claims to service_role;

-- Keep the shared specialtyLine honest: an unsourced service is not a public
-- map-card claim. This replaces the merged WP2 function without rewriting its
-- historical migration.
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
as $
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
$;

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

comment on table public.shop_source_claims is
  'Claim tokens explicitly supported by a shop source. Admin-only canonical evidence; safe tokens are projected through shop_detail.';
comment on column public.shop_services.source_id is
  'Stable evidence reference projected as confirmedBy; Milestone 3 maps frontend sourced claims to source UUIDs.';
