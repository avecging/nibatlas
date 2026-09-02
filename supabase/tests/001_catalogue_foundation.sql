begin;
select plan(18);

select has_extension('postgis', 'PostGIS is installed');
select has_extension('pg_trgm', 'pg_trgm is installed');
select has_table('public', 'shops', 'shops table exists');
select has_table('public', 'localities', 'localities table exists');
select has_table('public', 'shop_sources', 'shop provenance table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.shops'::regclass),
  'RLS is enabled on shops'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.shops'::regclass),
  'RLS is forced on shops'
);
select ok(not has_table_privilege('anon', 'public.shops', 'SELECT'),
  'anon cannot select the canonical shops table');
select ok(not has_table_privilege('authenticated', 'public.shop_sources', 'SELECT'),
  'authenticated users cannot read admin provenance');
select ok(has_table_privilege('anon', 'public.published_shop_markers', 'SELECT'),
  'anon can select the published marker projection');
select ok(has_table_privilege('authenticated', 'public.published_shop_details', 'SELECT'),
  'authenticated users can select the published detail projection');

select is((select count(*)::integer from public.published_shop_markers), 2,
  'only two published fixtures appear in the marker projection');
select is((select count(*)::integer from public.published_shop_details), 2,
  'only two published fixtures appear in the detail projection');
select is((select count(*)::integer from public.published_shop_details where slug = 'm2-draft-fixture'), 0,
  'draft shops are absent from the public detail projection');
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'published_shop_details'
      and column_name in ('publication_status', 'published_at')
  ), 'publication controls are absent from the public detail projection'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'published_shop_details'
      and column_name in ('source_url', 'evidence_note')
  ), 'provenance evidence is absent from the public detail projection'
);
select is((select count(*)::integer from public.shop_types), 4,
  'the four MVP shop types are seeded');
select is((select count(*)::integer from public.shops where source_quality = 'demo'), 3,
  'all deterministic shop fixtures are marked demo');

select * from finish();
rollback;

