-- Synthetic full-document persistence and same-row correction regression for #123.
begin;
select no_plan();
insert into public.brands(id,slug,name) values ('e1230000-0000-4000-8000-000000000004','synthetic-import-audit-brand','Synthetic import audit brand');
insert into public.specialties(id,code,label,sort_order) values ('e1230000-0000-4000-8000-000000000005','synthetic_import_audit','Synthetic import audit specialty',999);
insert into auth.users(id) values ('e1230000-0000-4000-8000-000000000001');
select public.assign_profile_role('e1230000-0000-4000-8000-000000000001','admin');
create temp table field_audit(d jsonb, payload jsonb, saved jsonb, result jsonb);
grant all on field_audit to authenticated;
insert into field_audit(d) values (jsonb_build_object(
 'shop', '{"name":"Synthetic full field audit e123","slug":"synthetic-field-audit-e123","source_quality":"community_unverified","operational_status":"unknown","position_precision":"street","country_code":"SG","locality_id":"00000000-0000-4000-8000-000000000201","timezone":"Asia/Singapore","latitude":-33.25,"longitude":0,"postal_code":"00123","appointment_required":false,"website_url":"https://example.test","phone":"+6512345678","address_line_1":"Synthetic street","address_line_2":"Synthetic second line","feature_headline":"Synthetic headline","field_note_heading":"Synthetic heading","field_note_body":"Synthetic story","local_address":"試験住所","unit_floor":"#01-01","nearest_station":"Synthetic station","station_exit":"Exit A","walking_guidance":"Synthetic walking guidance","entrance_notes":"Synthetic entrance","editions_text":"Synthetic editions","payment_methods":"Cash","languages":"English","holiday_note":"Synthetic holiday note","internal_notes":"PRIVATE synthetic note","reference_links":"https://example.test/reference","short_description":"Synthetic description","city_display":"Synthetic city","admin_area_code":"SG-01","admin_area_name":"Synthetic area","neighbourhood":"Synthetic neighbourhood","accessibility_notes":"Synthetic accessibility"}'::jsonb,
 'sources','[]'::jsonb,'aliases','[{"id":"e1230000-0000-4000-8000-000000000002","alias":"試験店","language_tag":"ja-JP","alias_type":"local_name"}]'::jsonb,
 'links','[{"id":"e1230000-0000-4000-8000-000000000003","link_type":"wechat","account_value":"synthetic-id","url":null,"label":null,"is_official":true,"sort_order":1}]'::jsonb,
 'types','[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":true}]'::jsonb,
 'brands',jsonb_build_array(jsonb_build_object('brand_id','e1230000-0000-4000-8000-000000000004'::uuid)),
 'specialties',jsonb_build_array(jsonb_build_object('specialty_id','e1230000-0000-4000-8000-000000000005'::uuid)),
 'services','[]'::jsonb,'experiences','[]'::jsonb));
create function pg_temp.payload(d jsonb, rev text default null, previous_op uuid default null) returns jsonb language sql as $$
 select jsonb_build_object('row',jsonb_build_object('rowId','audit','line',2,'cells',jsonb_build_object('name',d->'shop'->>'name','shop_id',case when rev is not null then 'e1230000-0000-4000-8000-000000000010' end),'issues','[]'::jsonb,'fileDuplicates','[]'::jsonb),
 'preview',jsonb_build_object('action',case when rev is null then 'new_private_draft' else 'update_private_draft' end),
 'targetId','e1230000-0000-4000-8000-000000000010','revision',rev,'document',d,'previousOperation',previous_op,
 'reviewKey',public.admin_import_preview('validate',jsonb_build_array(jsonb_build_object('rowId','audit','id','e1230000-0000-4000-8000-000000000010','revision',rev,'document',d)))->0->>'reviewKey');
$$;
create function pg_temp.run(action text, op uuid, payload jsonb) returns jsonb language sql as $$
 select public.admin_import_operation(action,'e1230000-0000-4000-8000-000000000020',op,payload);
$$;
create function pg_temp.state() returns jsonb language sql as $$
 select public.admin_import_publication_read('e1230000-0000-4000-8000-000000000020',0,'e1230000-0000-4000-8000-000000000030');
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e1230000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update field_audit set payload=pg_temp.payload(d);
select is(pg_temp.run('review','e1230000-0000-4000-8000-000000000030',payload)->>'status','ready','full field import reviewed') from field_audit;
select is(pg_temp.run('execute','e1230000-0000-4000-8000-000000000030',jsonb_build_object('document',d,'reviewKey',payload->>'reviewKey'))->>'status','imported','full field import saved privately') from field_audit;
update field_audit set saved=public.admin_shop_read('e1230000-0000-4000-8000-000000000010');
select is(saved->'document'->'shop'->e.key,e.value,'normal editor read retains '||e.key) from field_audit,jsonb_each(d->'shop') e;
select is(saved->'document'->g,d->g,'normal editor read retains relationship '||g) from field_audit,unnest(array['aliases','links','types','brands','specialties']) g;
select is(saved->>'positionConfirmed','false','coordinates saved without falsely confirming') from field_audit;
select public.admin_import_publication('review','e1230000-0000-4000-8000-000000000020','e1230000-0000-4000-8000-000000000030','e1230000-0000-4000-8000-000000000040',jsonb_build_object('reviewKey',pg_temp.state()->>'reviewKey','previousOperation',null));
select is(public.admin_import_publication('publish','e1230000-0000-4000-8000-000000000020','e1230000-0000-4000-8000-000000000030','e1230000-0000-4000-8000-000000000040')->'publication'->>'status','failed','cannot publish without explicit position confirmation');
select public.admin_import_publication('confirm_position','e1230000-0000-4000-8000-000000000020','e1230000-0000-4000-8000-000000000030','e1230000-0000-4000-8000-000000000040');
select is(public.admin_import_publication('publish','e1230000-0000-4000-8000-000000000020','e1230000-0000-4000-8000-000000000030','e1230000-0000-4000-8000-000000000040')->'publication'->>'status','published','publish same imported coordinates without re-entry');
update field_audit set saved=public.admin_shop_read('e1230000-0000-4000-8000-000000000010');
select is(saved->'document'->'shop'->e.key,e.value,'published/editor roundtrip retains '||e.key) from field_audit,jsonb_each(d->'shop') e;
select ok((saved->'document'->g) @> (d->g),'published/editor roundtrip retains relationship '||g) from field_audit,unnest(array['aliases','links','types','brands','specialties']) g;
-- The next row_id revision may update only the exact original target, with a fresh review.
update field_audit set d=jsonb_set(saved->'document','{shop,latitude}','-34');
update field_audit set payload=pg_temp.payload(d,saved->>'revision','e1230000-0000-4000-8000-000000000030');
select throws_ok($$select pg_temp.run('review','e1230000-0000-4000-8000-000000000031',jsonb_set(payload,'{row,cells,shop_id}','"e1230000-0000-4000-8000-000000000099"')) from field_audit$$,'PT409','Operation conflict','correction cannot retarget original completed row');
select is(pg_temp.run('review','e1230000-0000-4000-8000-000000000031',payload)->>'status','ready','same target correction receives new reviewed operation') from field_audit;
select throws_ok($$select pg_temp.run('review','e1230000-0000-4000-8000-000000000032',
 jsonb_set(jsonb_set(payload,'{previousOperation}','"e1230000-0000-4000-8000-000000000031"'),'{targetId}','"e1230000-0000-4000-8000-000000000099"')) from field_audit$$,
 'PT409','Operation conflict','pending correction cannot retarget a completed ancestor');
select is(pg_temp.run('execute','e1230000-0000-4000-8000-000000000031',jsonb_build_object('document',d,'reviewKey',payload->>'reviewKey'))->>'status','imported','same-row correction succeeds') from field_audit;
select is(public.admin_import_operation_read('e1230000-0000-4000-8000-000000000020','e1230000-0000-4000-8000-000000000030')->>'status','imported','previous completed operation is not rewritten');
select is(pg_temp.run('execute','e1230000-0000-4000-8000-000000000030','{}')->>'status','imported','old completed replay is harmless');
select is(public.admin_shop_read('e1230000-0000-4000-8000-000000000010')->'document'->'shop'->>'latitude','-34','old replay cannot overwrite correction');
select is(public.admin_shop_read('e1230000-0000-4000-8000-000000000010')->>'positionConfirmed','false','location correction clears confirmation');
reset role;
select is(extensions.st_y(location),-33.25::double precision,'published map position unchanged by private correction') from public.shops where id='e1230000-0000-4000-8000-000000000010';
select is(extensions.st_x(location),0::double precision,'longitude zero survives publication') from public.shops where id='e1230000-0000-4000-8000-000000000010';
select * from finish();
rollback;
