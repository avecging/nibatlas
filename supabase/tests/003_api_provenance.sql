begin;
select plan(14);

select has_table('public', 'shop_source_claims', 'source claim registry exists');
select col_not_null('public', 'shop_sources', 'label', 'source labels are required');
select ok(not has_table_privilege('anon', 'public.shop_source_claims', 'SELECT'),
  'anonymous users cannot read the canonical claim registry');

select throws_ok($bad_kind$
  insert into public.shop_sources (
    shop_id, label, source_type, checked_at, reliability
  ) values (
    '00000000-0000-4000-8000-000000000301', 'Unknown source', 'uncontrolled_kind',
    '2026-09-02 00:00:00+00', 'unknown'
  )
$bad_kind$,
  '23514',
  'new row for relation "shop_sources" violates check constraint "shop_sources_type_vocabulary"',
  'source kinds are a controlled wire vocabulary');

select throws_ok($blank_label$
  insert into public.shop_sources (
    shop_id, label, source_type, checked_at, reliability
  ) values (
    '00000000-0000-4000-8000-000000000301', ' ', 'official',
    '2026-09-02 00:00:00+00', 'primary'
  )
$blank_label$,
  '23514',
  'new row for relation "shop_sources" violates check constraint "shop_sources_label_not_blank"',
  'source labels cannot be blank');

select throws_ok($cross_shop_claim$
  insert into public.shop_source_claims (shop_id, source_id, claim_token) values (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000502',
    'Cross-shop test claim'
  )
$cross_shop_claim$,
  '23503',
  'insert or update on table "shop_source_claims" violates foreign key constraint "shop_source_claims_source_shop_fk"',
  'a claim cannot cite another shop''s source');

select ok(
  public.shop_detail('m2-singapore-demo-fixture')->'sources'->0 ? 'label'
    and public.shop_detail('m2-singapore-demo-fixture')->'sources'->0 ? 'confirms'
    and not (public.shop_detail('m2-singapore-demo-fixture')->'sources'->0 ? 'evidenceNote'),
  'detail exposes safe evidence metadata without admin notes');

select is(
  public.shop_detail('m2-singapore-demo-fixture')->>'primaryType',
  'fountain_pen_specialist',
  'detail includes the required primary map type');
select is(
  public.shop_detail('m2-singapore-demo-fixture')->>'markerState',
  'unvisited',
  'detail includes cache-safe default user state');
select ok(
  public.shop_detail('m2-singapore-demo-fixture') ? 'specialtyLine'
    and public.shop_detail('m2-singapore-demo-fixture')->'specialtyLine' = 'null'::jsonb,
  'detail preserves the required explicit null specialty line');

insert into public.shops (
  id, slug, name, country_code, city_display, timezone, location,
  publication_status, source_quality, published_at
) values (
  '00000000-0000-4000-8000-000000000603', 'm2-typeless-demo-fixture',
  'Typeless Demo Fixture', 'SG', 'Singapore', 'Asia/Singapore',
  extensions.st_setsrid(extensions.st_makepoint(103.852, 1.291), 4326),
  'published', 'demo', '2026-09-02 00:00:00+00'
);
select is(
  public.shop_detail('m2-typeless-demo-fixture'),
  null::jsonb,
  'detail hides a published row that cannot satisfy the required map type contract');

insert into public.services (id, code, label) values
  ('00000000-0000-4000-8000-000000000703', 'unsourced_api_test', 'Unsourced API Test');
insert into public.shop_services (shop_id, service_id) values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000703'
);
select ok(
  public.viewport_shops(103.7, 1.2, 104.0, 1.5, 12)->'shops'->0 ? 'specialtyLine'
    and public.viewport_shops(103.7, 1.2, 104.0, 1.5, 12)->'shops'->0->'specialtyLine' = 'null'::jsonb,
  'viewport never promotes an unsourced service into its public specialty line');

insert into public.services (id, code, label) values
  ('00000000-0000-4000-8000-000000000702', 'api_test_service', 'API Test Service');
insert into public.shop_source_claims (shop_id, source_id, claim_token) values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000501',
  'Service: API Test Service'
);
insert into public.shop_services (shop_id, service_id, source_id) values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000501'
);

select is(
  public.shop_detail('m2-singapore-demo-fixture')->'services'->0->>'confirmedBy',
  '00000000-0000-4000-8000-000000000501',
  'sourced service claims project the stable source UUID');
select ok(
  public.shop_detail('m2-singapore-demo-fixture')->'sources'->0->'confirms'
    @> '["Service: API Test Service"]'::jsonb,
  'source summaries project the claim tokens they explicitly support');

select * from finish();
rollback;
