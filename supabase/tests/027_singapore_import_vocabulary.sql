begin;
select no_plan();

select is((select count(*) from public.shop_types where code in
  ('fountain_pen_specialist','stationery_store','nib_repair_services')),3::bigint,
  'foundational shop types are migrated independently of demo seed');
select is((select count(*) from public.localities where country_code='SG' and name='Singapore'),1::bigint,
  'Singapore locality is available in a clean migrated environment');
select is((select count(*) from public.brands where name in
  ('Waterman','LAMY','Graf von Faber-Castell','Faber-Castell','Kaweco')),5::bigint,
  'only the reviewed Singapore batch brands are bootstrapped');
select ok(not exists(select 1 from public.brands where lower(name)='beste'),
  'the distributor is not mistaken for a pen brand');
select ok(not exists(select 1 from public.shop_brands where brand_id in
  (select id from public.brands where name in
  ('Waterman','LAMY','Graf von Faber-Castell','Faber-Castell','Kaweco'))),
  'vocabulary bootstrap creates no shop-brand relationships');

insert into auth.users(id) values ('97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000002');
select public.assign_profile_role('97000000-0000-4000-8000-000000000001','admin');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"97000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.admin_shop_options()$$,'42501',null,
  'ordinary account cannot access catalogue choices');
select set_config('request.jwt.claims','{"sub":"97000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select value->>'code' from jsonb_array_elements(public.admin_shop_options()->'types')
  where value->>'label'='Nib / Repair Services'),'nib_repair_services',
  'admin choices expose the canonical code alongside its label');
select is((select count(*) from jsonb_array_elements(public.admin_shop_options()->'brands') choice
  where lower(choice->>'label') in
  ('waterman','lamy','graf von faber-castell','faber-castell','kaweco')),5::bigint,
  'reviewed brands appear in the same guarded options used by importer');
reset role;

select * from finish();
rollback;
