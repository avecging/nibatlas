-- Resolve PR #76 review: public generated art is the active stored design, never
-- rehashed from a mutable slug. No data changes or private storage/credit fields.
create or replace function public.shop_detail(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select jsonb_strip_nulls(jsonb_build_object(
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

