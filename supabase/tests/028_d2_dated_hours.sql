begin;
select no_plan();
insert into auth.users(id) values ('98000000-0000-4000-8000-000000000001'),('98000000-0000-4000-8000-000000000002');
select public.assign_profile_role('98000000-0000-4000-8000-000000000001','editor');
create function pg_temp.read_d2() returns jsonb language sql as $$
  select public.admin_shop_read('98000000-0000-4000-8000-000000000010');
$$;
create function pg_temp.write_d2(doc jsonb) returns jsonb language sql as $$
  select public.admin_shop_write('save','98000000-0000-4000-8000-000000000010',
    pg_temp.read_d2()->>'revision', doc);
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('create','98000000-0000-4000-8000-000000000010',null,'{"name":"D2 synthetic shop","slug":"d2-synthetic-shop"}');
select pg_temp.write_d2(jsonb_set(pg_temp.read_d2()->'document','{shop}',
  (pg_temp.read_d2()->'document'->'shop') || '{"country_code":"SG","locality_id":"00000000-0000-4000-8000-000000000201","timezone":"Asia/Singapore","latitude":1.3,"longitude":103.8,"source_quality":"demo","address_line_1":"Synthetic address","holiday_note":"General guidance","opening_hours":{"entries":[{"day":"monday","opens":"09:00","closes":"17:00"}],"exceptions":[{"date":"2026-12-25","closed":true,"note":"Holiday"},{"date":"2026-12-31","closed":false,"opens":"09:00","closes":"12:00"},{"date":"2026-12-31","closed":false,"opens":"22:00","closes":"02:00"}]}}'));
select is(jsonb_array_length(pg_temp.read_d2()->'document'->'shop'->'opening_hours'->'exceptions'),3,'exceptions survive a private save');
select is(public.shop_detail('d2-synthetic-shop'),null,'private exceptions remain unavailable publicly');
select throws_ok($$select pg_temp.write_d2(jsonb_set(pg_temp.read_d2()->'document','{shop,opening_hours,exceptions,0,date}','"2026-02-30"'))$$,'22023','Invalid opening hours','impossible date rejected by SQL');
select throws_ok($$select pg_temp.write_d2(jsonb_set(pg_temp.read_d2()->'document','{shop,opening_hours,exceptions,0,date}','"2026-13-01"'))$$,'22023','Invalid opening hours','out-of-range month returns bounded validation error');
select throws_ok($$select pg_temp.write_d2(jsonb_set(pg_temp.read_d2()->'document','{shop,opening_hours,exceptions,0,opens}','"09:00"'))$$,'22023','Invalid opening hours','closed date cannot carry a time');
select throws_ok($$select pg_temp.write_d2(jsonb_set(pg_temp.read_d2()->'document','{shop,opening_hours,exceptions}',
  (pg_temp.read_d2()->'document'->'shop'->'opening_hours'->'exceptions') || '[{"date":"2026-12-25","closed":false}]'::jsonb))$$,'22023','Invalid opening hours','closure cannot coexist with another period');
select pg_temp.write_d2(jsonb_set(pg_temp.read_d2()->'document','{types}',
  '[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":true}]'::jsonb));
select public.admin_shop_write('confirm_position','98000000-0000-4000-8000-000000000010',pg_temp.read_d2()->>'revision');
select public.admin_shop_write('publish','98000000-0000-4000-8000-000000000010',pg_temp.read_d2()->>'revision');
select is(jsonb_array_length(public.shop_detail('d2-synthetic-shop')->'openingHoursExceptions'),3,'published detail exposes reviewed date exceptions');
select is(public.shop_detail('d2-synthetic-shop')->'editorial'->>'holiday_note','General guidance','existing prose remains intact');
select pg_temp.write_d2(jsonb_set(pg_temp.read_d2()->'document','{shop,opening_hours,exceptions,0,note}','"Changed privately"'));
select is(public.shop_detail('d2-synthetic-shop')->'openingHoursExceptions'->0->>'note','Holiday','draft edits do not publish exceptions');
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok('select pg_temp.read_d2()','42501','Admin access denied','ordinary user cannot read draft exceptions');
reset role;
select * from finish();
rollback;
