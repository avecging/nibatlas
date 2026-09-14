-- Founder acceptance: the WP1 admin assignment alone unlocks all shop RPCs.
begin;
select no_plan();
insert into auth.users(id) values ('63000000-0000-4000-8000-000000000001');
select public.assign_profile_role('63000000-0000-4000-8000-000000000001','admin');
select throws_ok($$select public.assign_profile_role('63000000-0000-4000-8000-000000000001','founder')$$,
  '22023','Invalid role assignment','founder is a responsibility, not another role');

set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select throws_ok('select public.admin_shop_list()','42501','Admin access denied','missing identity cannot list catalogue');
select throws_ok($$select public.admin_shop_write('create','63000000-0000-4000-8000-000000000090',null,'{"name":"Explicit admin test draft","slug":"explicit-admin-test-draft"}')$$,
  '42501','Admin access denied','missing identity cannot create a draft');

select set_config('request.jwt.claims','{"sub":"63000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is(public.admin_access()->>'role','admin','existing WP1 role is authoritative');
select ok(jsonb_array_length(public.admin_shop_list())>0,'admin lists catalogue without another assignment');
select ok(jsonb_array_length(public.admin_shop_options()->'types')>0,'admin reads editor options');
select is(public.admin_shop_write('create','63000000-0000-4000-8000-000000000090',null,
  '{"name":"Explicit admin test draft","slug":"explicit-admin-test-draft"}')->>'publicationStatus',
  'draft','admin creates a private draft');
-- PostgREST commits as authenticated, outside the write RPC's definer scope.
select lives_ok('set constraints all immediate',
  'admin draft passes deferred invariants under the API caller');
set constraints all deferred;
select lives_ok($$select public.admin_shop_write('save','63000000-0000-4000-8000-000000000090',
  public.admin_shop_read('63000000-0000-4000-8000-000000000090')->>'revision',
  jsonb_set(public.admin_shop_read('63000000-0000-4000-8000-000000000090')->'document',
    '{shop,name}','"Edited admin test draft"'))$$,'admin saves a draft');
select is(public.admin_shop_read('63000000-0000-4000-8000-000000000090')->'document'->'shop'->>'name',
  'Edited admin test draft','admin reopens and previews saved edits');
select is(public.shop_detail('explicit-admin-test-draft'),null,'admin draft stays private');
select is(public.admin_shop_write('publish','63000000-0000-4000-8000-000000000090',
  public.admin_shop_read('63000000-0000-4000-8000-000000000090')->>'revision')->>'code',
  'publication_incomplete','admin still obeys publication prerequisites');

-- Use an already complete, explicitly labelled demo with approved artwork.
select lives_ok($$select public.admin_shop_write('save','00000000-0000-4000-8000-000000000301',
  public.admin_shop_read('00000000-0000-4000-8000-000000000301')->>'revision',
  jsonb_set(public.admin_shop_read('00000000-0000-4000-8000-000000000301')->'document',
    '{shop,name}','"Admin edited demo fixture"'))$$,'admin edits a published demo privately');
select is(public.admin_shop_write('publish','00000000-0000-4000-8000-000000000301',
  public.admin_shop_read('00000000-0000-4000-8000-000000000301')->>'revision')->>'publicationStatus',
  'published','admin publishes a complete revision');
select is(public.admin_shop_write('temporarily_closed','00000000-0000-4000-8000-000000000301',
  public.admin_shop_read('00000000-0000-4000-8000-000000000301')->>'revision')->'document'->'shop'->>'operational_status',
  'temporarily_closed','admin closes a shop');
select is(public.admin_shop_write('archive','00000000-0000-4000-8000-000000000301',
  public.admin_shop_read('00000000-0000-4000-8000-000000000301')->>'revision')->>'publicationStatus',
  'archived','admin archives a shop');
select lives_ok('set constraints all immediate',
  'publication and archive pass deferred invariants under the API caller');
select ok(not has_table_privilege('authenticated','public.shops','SELECT'),
  'constraint fix grants no direct private catalogue reads');
select ok(not has_function_privilege('authenticated','public.assert_published_shop_has_active_stamp()','EXECUTE'),
  'constraint checker is trigger-only');
reset role;
select ok(exists(select 1 from public.admin_audit_log where actor_user_id='63000000-0000-4000-8000-000000000001'
  and entity_type='shop_working_copies'),'admin saves remain audited');
select public.assign_profile_role('63000000-0000-4000-8000-000000000001','user');
set local role authenticated;
select throws_ok('select public.admin_shop_list()','42501','Admin access denied','revoked admin loses catalogue access with the same JWT');
select throws_ok($$select public.admin_shop_read('63000000-0000-4000-8000-000000000090')$$,
  '42501','Admin access denied','ordinary account cannot reopen an admin draft');
reset role;
set constraints all immediate;
select * from finish();
rollback;
