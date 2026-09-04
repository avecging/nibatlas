-- Milestone 4, work package 4: owner-scoped saved-shop application seam.
-- These RPCs derive account identity from the authenticated JWT and expose
-- only the compact catalogue projection needed to reconcile saved state.

create function public.saved_shop_summary(p_shop_id uuid, p_saved_at timestamptz)
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

create function public.list_saved_shops()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  return (
    select jsonb_build_object(
      'savedShopIds', coalesce(jsonb_agg(ss.shop_id order by ss.created_at desc, ss.shop_id), '[]'::jsonb),
      'shops', coalesce(jsonb_agg(public.saved_shop_summary(ss.shop_id, ss.created_at)
        order by ss.created_at desc, ss.shop_id), '[]'::jsonb)
    )
    from public.saved_shops ss
    join public.shops s on s.id = ss.shop_id and s.publication_status = 'published'
    where ss.user_id = v_user_id
  );
end;
$$;

create function public.save_shop(p_shop_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_saved_at timestamptz;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not exists (
    select 1 from public.shops
    where id = p_shop_id and publication_status = 'published'
  ) then
    return null;
  end if;

  insert into public.saved_shops (user_id, shop_id)
  values (v_user_id, p_shop_id)
  on conflict (user_id, shop_id) do nothing;

  select created_at into v_saved_at
  from public.saved_shops
  where user_id = v_user_id and shop_id = p_shop_id;

  return public.saved_shop_summary(p_shop_id, v_saved_at);
end;
$$;

create function public.unsave_shop(p_shop_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_published boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select exists (
    select 1 from public.shops
    where id = p_shop_id and publication_status = 'published'
  ) into v_published;

  if not v_published then
    return null;
  end if;

  delete from public.saved_shops
  where user_id = v_user_id and shop_id = p_shop_id;

  return true;
end;
$$;

revoke all on function public.saved_shop_summary(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.list_saved_shops() from public, anon;
revoke all on function public.save_shop(uuid) from public, anon;
revoke all on function public.unsave_shop(uuid) from public, anon;

grant execute on function public.list_saved_shops() to authenticated;
grant execute on function public.save_shop(uuid) to authenticated;
grant execute on function public.unsave_shop(uuid) to authenticated;

grant execute on function public.saved_shop_summary(uuid, timestamptz) to service_role;
