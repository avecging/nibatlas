begin;
select no_plan();
insert into auth.users(id) values ('80000000-0000-4000-8000-000000000001'),('80000000-0000-4000-8000-000000000002');
select public.assign_profile_role('80000000-0000-4000-8000-000000000001','editor');
create temp table b2_checks(k text primary key,v jsonb);
grant all on b2_checks to authenticated;
create function pg_temp.b2(action text, doc jsonb default null) returns jsonb language sql as $$
 select public.admin_shop_write(action,'80000000-0000-4000-8000-000000000010',
 public.admin_shop_read('80000000-0000-4000-8000-000000000010')->>'revision',doc);
$$;
create function pg_temp.b2read() returns jsonb language sql as $$
 select public.admin_shop_read('80000000-0000-4000-8000-000000000010');
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('create','80000000-0000-4000-8000-000000000010',null,'{"name":"B2 synthetic shop","slug":"b2-synthetic-shop"}');
select is(pg_temp.b2read()->>'positionConfirmed','false','creation never implies position confirmation');
select throws_ok($$select pg_temp.b2('confirm_position')$$,'22023','Add a valid position before confirming','cannot confirm absent coordinates');
select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop}',
 (pg_temp.b2read()->'document'->'shop') || '{"country_code":"SG","locality_id":"00000000-0000-4000-8000-000000000201","timezone":"Asia/Singapore","latitude":0,"longitude":0,"source_quality":"demo","address_line_1":"Synthetic address","field_note_heading":"A synthetic story","field_note_body":"Paragraph one.\n\n第二段。","local_address":"本地地址","nearest_station":"Synthetic station","unit_floor":"Level 2","appointment_required":false,"accessibility_notes":"Synthetic access note","internal_notes":"PRIVATE B2 NOTES","reference_links":"https://example.test/private-maintenance"}'));
select pg_temp.b2('save',jsonb_set(jsonb_set(pg_temp.b2read()->'document','{types}',
 '[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":true}]'),'{experiences}',
 '[{"id":"80000000-0000-4000-8000-000000000021","category":"nib_testing","title":"Synthetic testing","description":"First\n\nSecond"}]'));
select is(pg_temp.b2('publish')->>'code','publication_incomplete','valid decimal pair is not an attestation');
select throws_ok($$select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop,position_confirmation}','{"fingerprint":"fake"}'))$$,'22023','Invalid catalogue data','document cannot forge confirmation');
select throws_ok($$select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop,reviewed_at}','"2026-01-01"'))$$,'22023','Invalid catalogue data','document cannot forge review time');
select throws_ok($$select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop,reference_links}','"javascript:alert(1)"'))$$,'22023','Invalid catalogue URL','private links still require safe URLs');
insert into b2_checks values('before_confirmation',pg_temp.b2read());
select is(pg_temp.b2('confirm_position')->>'positionConfirmed','true','deliberate action confirms zero position');
select throws_ok($$select public.admin_shop_write('confirm_position','80000000-0000-4000-8000-000000000010',
 (select v->>'revision' from b2_checks where k='before_confirmation'))$$,'40001','Revision conflict','confirmation changes revision and rejects stale replay');
select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop,name}','"B2 synthetic renamed"'));
select is(pg_temp.b2read()->>'positionConfirmed','true','ordinary rename retains confirmation');
select is(pg_temp.b2read()->'document'->'shop'->>'slug','b2-synthetic-shop','ordinary rename retains URL');
select is(public.shop_detail('b2-synthetic-shop'),null,'private content stays absent before publish');
select is(pg_temp.b2('publish')->>'publicationStatus','published','trusted publication needs no sources, claims, postcode, hours or photo');
select is(public.shop_detail('b2-synthetic-shop')->'sources','[]'::jsonb,'no fabricated source/date/claims');
select is(public.shop_detail('b2-synthetic-shop')->'review'->>'kind','editorial','public review is explicitly editorial');
select is(public.shop_detail('b2-synthetic-shop')->'editorial'->>'field_note_body',E'Paragraph one.\n\n第二段。','paragraphs survive public projection');
select is(public.shop_detail('b2-synthetic-shop')->'editorial'->>'appointment_required','false','known no remains distinct from unknown');
select ok(not (public.shop_detail('b2-synthetic-shop')::text like '%PRIVATE B2%' or public.shop_detail('b2-synthetic-shop')::text like '%private-maintenance%'), 'public detail excludes optional internal notes/references');
select ok(not (public.shop_detail('b2-synthetic-shop')::text like '%80000000-0000-4000-8000-000000000001%'),'public review excludes account identity');
insert into b2_checks values('published',public.shop_detail('b2-synthetic-shop'));
select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop,latitude}','1'));
select is(pg_temp.b2read()->>'positionConfirmed','false','coordinate edit invalidates confirmation server-side');
select is(public.shop_detail('b2-synthetic-shop'),(select v from b2_checks where k='published'),'private edits leave public content and review untouched');
select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop,latitude}','0'));
select is(pg_temp.b2read()->>'positionConfirmed','false','reverting coordinates does not revive invalidated confirmation');
select pg_temp.b2('discard');
select is(pg_temp.b2read()->>'positionConfirmed','true','discard restores canonical confirmation');
select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop,address_line_1}','"Changed address"'));
select is(pg_temp.b2read()->>'positionConfirmed','false','address edit invalidates confirmation');
select pg_temp.b2('confirm_position');
select pg_temp.b2('save',jsonb_set(pg_temp.b2read()->'document','{shop,position_precision}','"street"'));
select is(pg_temp.b2read()->>'positionConfirmed','false','accuracy edit invalidates confirmation');
select pg_temp.b2('confirm_position');
-- An operator canonical change after review still conflicts, even with a current private revision.
reset role;
select is((select reviewed_by::text from public.shops where slug='b2-synthetic-shop'),'80000000-0000-4000-8000-000000000001','actual acting editor recorded privately');
select is((select reviewed_at from public.shops where slug='b2-synthetic-shop'),
 ((select v from b2_checks where k='published')->'review'->>'reviewedAt')::timestamptz,'public time matches recorded event');
select is((select last_verified_at from public.shops where slug='b2-synthetic-shop'),null,'review does not invent legacy verification');
select ok(not exists(select 1 from public.admin_audit_log where (before_summary::text||after_summary::text) like '%PRIVATE B2%'),'audit has no raw private content');
update public.shops set name='Operator revision' where slug='b2-synthetic-shop';
set local role authenticated;
select throws_ok($$select pg_temp.b2('publish')$$,'40001','Revision conflict','operator race requires re-review');
select throws_ok($$select pg_temp.b2('confirm_position')$$,'40001','Revision conflict','position confirmation cannot rebase a stale copy');
select set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok('select pg_temp.b2read()','42501','Admin access denied','ordinary signed-in user cannot read notes/draft');
select throws_ok($$select pg_temp.b2('confirm_position')$$,'42501','Admin access denied','ordinary account cannot confirm');
select ok(not has_function_privilege('authenticated','public.shop_position_fingerprint(jsonb)','EXECUTE'),'no direct helper access');
select ok(not has_table_privilege('authenticated','public.shops','SELECT'),'canonical table including private metadata stays denied');
-- Old practical fields must not escape via the legacy direct PostgREST view.
reset role;
update public.shops set appointment_required=true, accessibility_notes='UNREVIEWED PRIVATE PRACTICAL'
where id='00000000-0000-4000-8000-000000000301';
set local role anon;
select is((select appointment_required from public.published_shop_details where id='00000000-0000-4000-8000-000000000301'),null,'legacy direct view withholds unreviewed appointment');
select is((select accessibility_notes from public.published_shop_details where id='00000000-0000-4000-8000-000000000301'),null,'legacy direct view withholds unreviewed accessibility');
select is(public.shop_detail('m2-singapore-demo-fixture')->'editorial',null,'v1 also withholds legacy unreviewed practical fields');
select is((select appointment_required from public.published_shop_details where slug='b2-synthetic-shop'),false,'legacy direct view exposes explicitly reviewed known No');
select ok(not (select to_jsonb(v)::text like '%PRIVATE B2%' from public.published_shop_details v where slug='b2-synthetic-shop'),'legacy direct view excludes internal notes');
select ok(not (public.shop_detail('b2-synthetic-shop')::text like '%PRIVATE B2%'),'anonymous projection contains no private notes');
reset role;
select * from finish();
rollback;
