begin;
select no_plan();
-- Insert in reverse lexical order: public rendering breaks ties by code.
insert into public.shop_types(id,code,label,sort_order) values
 ('99000000-0000-4000-8000-000000000003','type_99000000_0000_4000_8000_000000000003','Synthetic Z',900),
 ('99000000-0000-4000-8000-000000000002','type_99000000_0000_4000_8000_000000000002','Synthetic A',900);
insert into public.specialties(id,code,label,sort_order) values
 ('99000000-0000-4000-8000-000000000005','d3_z','Synthetic Z',900),
 ('99000000-0000-4000-8000-000000000004','d3_a','Synthetic A',900);
insert into public.services(id,code,label,sort_order) values
 ('99000000-0000-4000-8000-000000000007','d3_z','Synthetic Z',900),
 ('99000000-0000-4000-8000-000000000006','d3_a','Synthetic A',900);
insert into auth.users(id) values ('99000000-0000-4000-8000-000000000001');
select public.assign_profile_role('99000000-0000-4000-8000-000000000001','admin');
create temp table expected as select
 (select jsonb_agg(id::text order by sort_order,code) from public.shop_types) types,
 (select jsonb_agg(id::text order by sort_order,code) from public.specialties) specialties,
 (select jsonb_agg(id::text order by sort_order,code) from public.services) services;
grant select on expected to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select jsonb_agg(v->>'id' order by ord) from jsonb_array_elements(public.admin_shop_options()->'types') with ordinality a(v,ord)),(select types from expected),'type options match public ordering including ties');
select is((select jsonb_agg(v->>'id' order by ord) from jsonb_array_elements(public.admin_shop_options()->'specialties') with ordinality a(v,ord)),(select specialties from expected),'specialty options match public ordering including ties');
select is((select jsonb_agg(v->>'id' order by ord) from jsonb_array_elements(public.admin_shop_options()->'services') with ordinality a(v,ord)),(select services from expected),'service options match public ordering including ties');
reset role;
select * from finish();
rollback;
