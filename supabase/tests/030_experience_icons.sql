begin;
select no_plan();
insert into auth.users(id) values ('99000000-0000-4000-8000-000000000001'),('99000000-0000-4000-8000-000000000002');
select public.assign_profile_role('99000000-0000-4000-8000-000000000001','editor');
create function pg_temp.icon_record() returns jsonb language sql as $$
  select public.admin_shop_read('99000000-0000-4000-8000-000000000010');
$$;
create function pg_temp.save_icon(doc jsonb) returns jsonb language sql as $$
  select public.admin_shop_write('save','99000000-0000-4000-8000-000000000010',pg_temp.icon_record()->>'revision',doc);
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('create','99000000-0000-4000-8000-000000000010',null,'{"name":"Icon synthetic shop","slug":"icon-synthetic-shop"}');
select pg_temp.save_icon(jsonb_set(pg_temp.icon_record()->'document','{experiences}',
  '[{"id":"99000000-0000-4000-8000-000000000020","category":"nib_testing","title":"Synthetic experience"}]'));
select is(pg_temp.icon_record()->'document'->'experiences'->0->>'icon',null,'legacy rows need no icon');
select pg_temp.save_icon(jsonb_set(pg_temp.icon_record()->'document','{experiences,0,icon}','"ink"'));
select is(pg_temp.icon_record()->'document'->'experiences'->0->>'icon','ink','icon survives private save');
select is(public.shop_detail('icon-synthetic-shop'),null,'private icon is not published');
select lives_ok(format('select pg_temp.save_icon(%L::jsonb)',
 jsonb_set(pg_temp.icon_record()->'document','{experiences,0,icon}',to_jsonb(icon))),
 'accepts curated icon '||icon) from unnest(array['pen','nib','ink','swatch','paper','book','tools','gift','workshop','chat']) icon;
select pg_temp.save_icon(jsonb_set(pg_temp.icon_record()->'document','{experiences,0,icon}','"ink"')); 
select throws_ok($$select pg_temp.save_icon(jsonb_set(pg_temp.icon_record()->'document','{experiences,0,icon}','"<svg/>"'))$$,'22023','Invalid experience icon','reject arbitrary markup');
select throws_ok($$select pg_temp.save_icon(jsonb_set(pg_temp.icon_record()->'document','{experiences,0,icon}','"unknown"'))$$,'22023','Invalid experience icon','reject unknown icon');
select pg_temp.save_icon(jsonb_set(pg_temp.icon_record()->'document','{shop}',
  (pg_temp.icon_record()->'document'->'shop') || '{"country_code":"SG","locality_id":"00000000-0000-4000-8000-000000000201","timezone":"Asia/Singapore","latitude":1.3,"longitude":103.8,"source_quality":"demo","address_line_1":"Synthetic address"}'));
select pg_temp.save_icon(jsonb_set(pg_temp.icon_record()->'document','{types}',
 '[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":true}]'));
select public.admin_shop_write('confirm_position','99000000-0000-4000-8000-000000000010',pg_temp.icon_record()->>'revision');
select public.admin_shop_write('publish','99000000-0000-4000-8000-000000000010',pg_temp.icon_record()->>'revision');
select is(public.shop_detail('icon-synthetic-shop')->'editorial'->'experiences'->0->>'icon','ink','explicit publication carries icon');
select pg_temp.save_icon(jsonb_set(pg_temp.icon_record()->'document','{experiences,0,icon}','"nib"'));
select is(public.shop_detail('icon-synthetic-shop')->'editorial'->'experiences'->0->>'icon','ink','later private icon does not change publication');
select set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok('select pg_temp.icon_record()','42501','Admin access denied','ordinary user cannot read private choices');
reset role;
select * from finish();
rollback;
