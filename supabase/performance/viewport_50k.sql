\set ON_ERROR_STOP on
begin;

alter table public.shops disable trigger shops_validate_timezone;

insert into public.shops (
  id, slug, name, country_code, city_display, timezone, location,
  publication_status, source_quality, published_at
)
select
  md5('perf-global-' || g)::uuid,
  'perf-global-' || g,
  'Synthetic global shop ' || g,
  'SG', 'Synthetic', 'Asia/Singapore',
  extensions.st_setsrid(extensions.st_makepoint(
    -179.9 + ((g * 37) % 720) * 0.5,
    -79.9 + ((g * 53) % 320) * 0.5
  ), 4326),
  'published', 'demo', '2026-09-02 00:00:00+00'
from generate_series(1, 40000) g;

insert into public.shops (
  id, slug, name, country_code, city_display, timezone, location,
  publication_status, source_quality, published_at
)
select
  md5('perf-tokyo-' || g)::uuid,
  'perf-tokyo-' || g,
  'Synthetic Tokyo shop ' || g,
  'JP', 'Tokyo', 'Asia/Tokyo',
  extensions.st_setsrid(extensions.st_makepoint(
    139.5 + ((g * 17) % 1000) / 2000.0,
    35.5 + ((g * 29) % 1000) / 2000.0
  ), 4326),
  'published', 'demo', '2026-09-02 00:00:00+00'
from generate_series(1, 10000) g;

insert into public.shop_shop_types (shop_id, shop_type_id, is_primary)
select s.id, '00000000-0000-4000-8000-000000000102', true
from public.shops s
where s.slug like 'perf-global-%' or s.slug like 'perf-tokyo-%';

-- Give 10k shops aliases, but make only 20 of them relevant to the benchmark.
-- This catches the former per-published-shop lateral alias lookup.
insert into public.shop_aliases (
  id, shop_id, alias, language_tag, alias_type
)
select
  md5('perf-alias-' || s.slug)::uuid,
  s.id,
  case when substring(s.slug from '([0-9]+)$')::integer <= 20
    then 'Rarelookup alias ' || s.slug
    else 'Unrelated catalogue alias ' || s.slug
  end,
  'en',
  'search_synonym'
from public.shops s
where s.slug like 'perf-global-%'
  and substring(s.slug from '([0-9]+)$')::integer <= 10000;

alter table public.shops enable trigger shops_validate_timezone;
analyze public.shops;
analyze public.shop_aliases;
analyze public.shop_shop_types;

do $$
declare
  started_at timestamptz;
  samples_ms double precision[] := '{}';
  round_p95_ms double precision[] := '{}';
  p95_ms double precision;
  gate_ms double precision;
  response jsonb;
begin
  response := public.viewport_shops(139.5, 35.5, 140.0, 36.0, 12, null, null, 500);
  if jsonb_array_length(response->'shops') <> 500 or not (response->>'truncated')::boolean then
    raise exception 'Synthetic dense viewport did not exercise the result cap';
  end if;

  for i in 1..3 loop
    perform public.viewport_shops(139.5, 35.5, 140.0, 36.0, 12, null, null, 500);
  end loop;

  for round_number in 1..3 loop
    samples_ms := '{}';
    for i in 1..20 loop
      started_at := clock_timestamp();
      perform public.viewport_shops(139.5, 35.5, 140.0, 36.0, 12, null, null, 500);
      samples_ms := array_append(
        samples_ms,
        extract(epoch from (clock_timestamp() - started_at)) * 1000
      );
    end loop;

    select percentile_disc(0.95) within group (order by sample)
    into p95_ms
    from unnest(samples_ms) sample;
    round_p95_ms := array_append(round_p95_ms, p95_ms);
  end loop;

  select percentile_disc(0.5) within group (order by sample)
  into gate_ms
  from unnest(round_p95_ms) sample;

  raise notice 'viewport_shops median p95: % ms (rounds: %) on 50k synthetic shops',
    round(gate_ms::numeric, 2), round_p95_ms;

  if gate_ms >= 250 then
    raise exception 'viewport_shops median p95 % ms exceeds the 250 ms budget',
      round(gate_ms::numeric, 2);
  end if;
end;
$$;

do $$
declare
  started_at timestamptz;
  samples_ms double precision[] := '{}';
  round_p95_ms double precision[] := '{}';
  p95_ms double precision;
  gate_ms double precision;
  response jsonb;
begin
  response := public.search_shops('rarelookup', 20);
  if jsonb_array_length(response->'shops') <> 20 then
    raise exception 'Synthetic alias search did not return all 20 selective matches';
  end if;

  for i in 1..3 loop
    perform public.search_shops('rarelookup', 20);
  end loop;

  for round_number in 1..3 loop
    samples_ms := '{}';
    for i in 1..20 loop
      started_at := clock_timestamp();
      perform public.search_shops('rarelookup', 20);
      samples_ms := array_append(
        samples_ms,
        extract(epoch from (clock_timestamp() - started_at)) * 1000
      );
    end loop;

    select percentile_disc(0.95) within group (order by sample)
    into p95_ms
    from unnest(samples_ms) sample;
    round_p95_ms := array_append(round_p95_ms, p95_ms);
  end loop;

  select percentile_disc(0.5) within group (order by sample)
  into gate_ms
  from unnest(round_p95_ms) sample;

  raise notice 'search_shops alias median p95: % ms (rounds: %) on 50k shops / 10k aliases',
    round(gate_ms::numeric, 2), round_p95_ms;

  if gate_ms >= 250 then
    raise exception 'search_shops alias median p95 % ms exceeds the 250 ms budget',
      round(gate_ms::numeric, 2);
  end if;
end;
$$;

rollback;
