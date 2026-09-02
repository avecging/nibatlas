begin;
select plan(34);

select has_function('public', 'viewport_shops', array[
  'double precision', 'double precision', 'double precision', 'double precision',
  'integer', 'shop_operational_status[]', 'text[]', 'integer'
], 'viewport RPC exists');
select has_function('public', 'search_shops', array['text', 'integer'], 'search RPC exists');
select has_function('public', 'shop_detail', array['text'], 'detail RPC exists');
select has_function('public', 'nearby_shops', array[
  'double precision', 'double precision', 'integer', 'integer'
], 'Near Me RPC exists');

select ok(has_function_privilege(
  'anon',
  'public.viewport_shops(double precision,double precision,double precision,double precision,integer,public.shop_operational_status[],text[],integer)',
  'EXECUTE'
), 'anon may execute the viewport RPC');
select ok(has_function_privilege(
  'authenticated', 'public.shop_detail(text)', 'EXECUTE'
), 'authenticated users may execute the public detail RPC');

select is(
  jsonb_array_length(public.viewport_shops(103.7, 1.2, 104.0, 1.5, 12)->'shops'),
  1,
  'Singapore viewport returns its published fixture only'
);
select ok(
  public.viewport_shops(103.7, 1.2, 104.0, 1.5, 12)->'shops'->0 ? 'specialtyLine'
    and public.viewport_shops(103.7, 1.2, 104.0, 1.5, 12)->'shops'->0->'specialtyLine' = 'null'::jsonb,
  'viewport preserves the required explicit null specialtyLine'
);
update public.shop_shop_types
set is_primary = false
where shop_id = '00000000-0000-4000-8000-000000000301';
select is(
  public.viewport_shops(103.7, 1.2, 104.0, 1.5, 12)->'shops'->0->>'primaryType',
  'fountain_pen_specialist',
  'viewport deterministically falls back to an assigned type when no row is marked primary'
);
update public.shop_shop_types
set is_primary = true
where shop_id = '00000000-0000-4000-8000-000000000301';
select is(
  public.viewport_shops(103.7, 1.2, 104.0, 1.5, 12)->'committedBounds'->>'west',
  '103.7',
  'viewport response echoes the committed bounds'
);
select is(
  jsonb_array_length(public.viewport_shops(
    103.7, 1.2, 104.0, 1.5, 12, null,
    array['fountain_pen_specialist'], 500
  )->'shops'),
  1,
  'shop-type filtering uses canonical join rows'
);
select is(
  jsonb_array_length(public.viewport_shops(
    103.7, 1.2, 104.0, 1.5, 12,
    array['unknown']::public.shop_operational_status[], null, 500
  )->'shops'),
  1,
  'operational-status filtering includes matching rows'
);
select is(
  jsonb_array_length(public.viewport_shops(
    103.7, 1.2, 104.0, 1.5, 12,
    array['open']::public.shop_operational_status[], null, 500
  )->'shops'),
  0,
  'operational-status filtering excludes nonmatching rows'
);
select ok(
  (public.viewport_shops(-180, -89, 180, 89, 1, null, null, 1)->>'truncated')::boolean,
  'result cap reports truncation'
);
select is(
  jsonb_array_length(public.viewport_shops(-180, -89, 180, 89, 1, null, null, 1)->'shops'),
  1,
  'result cap is enforced'
);

insert into public.shops (
  id, slug, name, country_code, city_display, timezone, location,
  publication_status, source_quality, published_at
) values
  (
    '00000000-0000-4000-8000-000000000601', 'm2-dateline-east-fixture',
    'Dateline East Demo Fixture', 'FJ', 'Dateline East', 'Pacific/Fiji',
    extensions.st_setsrid(extensions.st_makepoint(179.5, -16.0), 4326),
    'published', 'demo', '2026-09-02 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000602', 'm2-dateline-west-fixture',
    'Dateline West Demo Fixture', 'US', 'Dateline West', 'Pacific/Honolulu',
    extensions.st_setsrid(extensions.st_makepoint(-179.5, -16.0), 4326),
    'published', 'demo', '2026-09-02 00:00:00+00'
  );
insert into public.shop_shop_types (shop_id, shop_type_id, is_primary) values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000102', true),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000102', true);

select is(
  jsonb_array_length(public.viewport_shops(170, -20, -170, -10, 5)->'shops'),
  2,
  'antimeridian-crossing viewport queries both envelopes'
);

select is(
  public.search_shops('第二期東京', 20)->'shops'->0->>'slug',
  'm2-tokyo-demo-fixture',
  'CJK alias prefix search finds the canonical shop'
);
select ok(
  jsonb_array_length(public.search_shops('M2%', 20)->'shops') = 0
    and jsonb_array_length(public.search_shops('M2_', 20)->'shops') = 0,
  'search treats percent and underscore characters as literals rather than LIKE wildcards'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.search_shops('M2 Draft Fixture', 20)->'shops') item
    where item->>'slug' = 'm2-draft-fixture'
  ),
  'search excludes the matching draft shop even when published fuzzy matches exist'
);
select is(
  public.shop_detail('m2-singapore-demo-fixture')->>'id',
  '00000000-0000-4000-8000-000000000301',
  'detail returns a published shop'
);
select ok(
  not (public.shop_detail('m2-singapore-demo-fixture') ? 'addressLines'),
  'detail omits an absent address rather than returning an empty array'
);
select ok(
  jsonb_array_length(public.shop_detail('m2-singapore-demo-fixture')->'sources') = 1
    and public.shop_detail('m2-singapore-demo-fixture')->'sources'->0 ? 'kind'
    and public.shop_detail('m2-singapore-demo-fixture')->'sources'->0 ? 'retrievedOn'
    and not (public.shop_detail('m2-singapore-demo-fixture')->'sources'->0 ? 'evidenceNote'),
  'detail exposes safe source summaries without admin evidence notes'
);
update public.shops
set opening_hours = jsonb_build_object(
  'entries', jsonb_build_array(jsonb_build_object(
    'day', 'monday', 'opens', '10:00', 'closes', '18:00'
  )),
  'note', 'Demo hours only'
)
where slug = 'm2-singapore-demo-fixture';
select ok(
  jsonb_typeof(public.shop_detail('m2-singapore-demo-fixture')->'openingHours') = 'array'
    and public.shop_detail('m2-singapore-demo-fixture')->'openingHours'->0->>'day' = 'monday',
  'detail normalizes stored opening-hours object to the shared entry array'
);
select ok(
  not (public.shop_detail('m2-singapore-demo-fixture') ? 'publicationStatus'),
  'detail excludes publication controls'
);
select is(public.shop_detail('m2-draft-fixture'), null::jsonb,
  'detail returns null for a draft shop');

select is(
  public.nearby_shops(1.290270, 103.851959, 1000, 10)->'shops'->0->>'slug',
  'm2-singapore-demo-fixture',
  'Near Me returns the closest published shop first'
);
select is(
  (public.nearby_shops(1.290270, 103.851959, 1000, 10)->'shops'->0->>'distanceMeters')::integer,
  0,
  'Near Me distance is calculated server-side'
);

select throws_ok(
  $$select public.viewport_shops(200, 0, 10, 20, 5)$$,
  '22023', 'Invalid viewport bounds',
  'invalid viewport coordinates fail closed'
);
select throws_ok(
  $$select public.nearby_shops(91, 0, 1000, 10)$$,
  '22023', 'Invalid coordinate',
  'invalid Near Me coordinates fail closed'
);

select throws_ok($invalid_country$
  insert into public.shops (
    slug, name, country_code, locality_id, timezone, location
  ) values (
    'wrong-locality-country', 'Wrong Locality Country', 'JP',
    '00000000-0000-4000-8000-000000000201', 'Asia/Tokyo',
    extensions.st_setsrid(extensions.st_makepoint(139.7, 35.7), 4326)
  )
$invalid_country$,
  '23503',
  'insert or update on table "shops" violates foreign key constraint "shops_locality_country_fk"',
  'a shop cannot reference a locality in another country');

insert into public.services (id, code, label) values
  ('00000000-0000-4000-8000-000000000701', 'test_service', 'Test Service');
select throws_ok($cross_shop_source$
  insert into public.shop_services (shop_id, service_id, source_id) values (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000502'
  )
$cross_shop_source$,
  '23503',
  'insert or update on table "shop_services" violates foreign key constraint "shop_services_source_shop_fk"',
  'an attribute cannot cite another shop''s source');

select throws_ok($image_without_source$
  insert into public.shop_images (
    shop_id, storage_key, alt_text, credit_text, rights_basis,
    width, height, content_type, moderation_status
  ) values (
    '00000000-0000-4000-8000-000000000301', 'tests/no-source.jpg',
    'Test image', 'Test credit', 'Permission granted',
    100, 100, 'image/jpeg', 'approved'
  )
$image_without_source$,
  '23514',
  'new row for relation "shop_images" violates check constraint "approved_image_metadata"',
  'approved imagery requires a source URL');

select throws_ok($two_primary_types$
  insert into public.shop_shop_types (shop_id, shop_type_id, is_primary) values (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000102', true
  )
$two_primary_types$,
  '23505',
  'duplicate key value violates unique constraint "shop_shop_types_one_primary_idx"',
  'a shop cannot have two primary types');

select ok(not has_table_privilege('anon', 'public.shops', 'SELECT'),
  'RPC grants do not reopen canonical table access');

select * from finish();
rollback;
