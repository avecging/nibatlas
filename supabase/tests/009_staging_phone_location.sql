begin;
select plan(11);
select is(current_setting('nibatlas.fixture_environment', true), null::text, 'fixture opt-in is absent by default');
set local nibatlas.fixture_environment = 'staging';
\ir ../fixtures/staging-phone-location.sql
\ir ../fixtures/staging-phone-location.sql
set constraints all immediate;
select is((select count(*)::integer from public.shops where slug = 'location-test-fairprice-compassvale-link'), 1, 'fixture is idempotent');
select is(public.shop_detail('location-test-fairprice-compassvale-link')->>'primaryType', 'test_venue', 'non-pen test type reaches detail');
select is(public.shop_detail('location-test-fairprice-compassvale-link')->>'sourceQuality', 'demo', 'fixture remains demo');
select is(public.shop_detail('location-test-fairprice-compassvale-link')->>'postalCode', '543277', 'reconciled postcode');
select is(public.shop_detail('location-test-fairprice-compassvale-link')->'position', '{"latitude":1.3824209,"longitude":103.8938611}'::jsonb, 'public venue pin, not viewport centre');
select is(public.shop_detail('location-test-fairprice-compassvale-link')->'services', '[]'::jsonb, 'no invented pen services');
select is(public.shop_detail('location-test-fairprice-compassvale-link')->'brands', '[]'::jsonb, 'no invented brands');
select is((select count(*)::integer from public.stamps where shop_id = '00000000-0000-4000-8000-000000000304' and status = 'active'), 1, 'exactly one active test stamp');
select throws_ok($$update public.shops set source_quality = 'sourced' where id = '00000000-0000-4000-8000-000000000304'$$, '23514', 'Test venues must remain demo data', 'test venue cannot become real catalogue data');
select is((select count(*)::integer from public.shop_images where shop_id = '00000000-0000-4000-8000-000000000304'), 0, 'photo delivery is deferred');
select * from finish();
rollback;
