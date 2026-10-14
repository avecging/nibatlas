begin;
select no_plan();

select is((select count(*) from public.shop_types where code in
 ('fountain_pen_specialist','stationery_store','bookshop','art_supply_store',
  'brand_boutique','luxury_shop','maker_workshop','department_store','distributor')),9::bigint,
 'all nine main store types are available independently of fixture seed');
select is((select count(*) from public.shop_types where code in ('vintage_used','nib_repair_services')),0::bigint,
 'stock and repair experiences are not store types');

select lives_ok($$select public.validate_shop_document('00000000-0000-4000-8000-000000000301',
 public.shop_edit_document('00000000-0000-4000-8000-000000000301'))$$,
 'existing single-type shop remains valid');
select lives_ok($$select public.validate_shop_document('00000000-0000-4000-8000-000000000301',
 jsonb_set(public.shop_edit_document('00000000-0000-4000-8000-000000000301'),'{types}','[]'))$$,
 'incomplete private drafts may omit a type');
select throws_ok($$select public.validate_shop_document('00000000-0000-4000-8000-000000000301',
 jsonb_set(public.shop_edit_document('00000000-0000-4000-8000-000000000301'),'{types}',
 '[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":true},
   {"shop_type_id":"00000000-0000-4000-8000-000000000102","is_primary":false}]'))$$,
 '22023','Choose one main store type; use Experiences for secondary features',
 'direct RPC validation rejects secondary types');
select throws_ok($$select public.validate_shop_document('00000000-0000-4000-8000-000000000301',
 jsonb_set(public.shop_edit_document('00000000-0000-4000-8000-000000000301'),'{types}',
 '[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":false}]'))$$,
 '22023','Choose one main store type; use Experiences for secondary features',
 'a supplied type must be the main type');
select ok(not has_function_privilege('authenticated','public.validate_shop_document(uuid,jsonb)','execute'),
 'validator remains private to the existing guarded writers');
select * from finish();
rollback;
