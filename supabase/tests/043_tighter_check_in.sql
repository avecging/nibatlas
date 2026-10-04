begin;
select no_plan();
-- Synthetic account/shop fixtures only; no hosted catalogue or user position.
insert into auth.users(id,aud,role,email) values
 ('10000000-0000-4000-8000-000000000053','authenticated','authenticated','policy-editor@example.test'),
 ('10000000-0000-4000-8000-000000000054','authenticated','authenticated','policy-user@example.test');
update public.profiles set role='editor' where id='10000000-0000-4000-8000-000000000053';
select ok(not has_function_privilege('anon','public.admin_shop_verification_policy(uuid,boolean,text,integer,text)','EXECUTE'),'anonymous cannot read policy');
select ok(not has_function_privilege('authenticated','public.set_shop_verification_policy(uuid,uuid,integer,text)','EXECUTE'),'browser cannot supply a policy actor');
select ok(not has_table_privilege('authenticated','stamp_private.shop_verification_policy','UPDATE'),'browser has no direct policy write');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000054","role":"authenticated"}',true);
select throws_ok($$select public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301')$$,'42501','Admin access denied','ordinary account cannot read/write policies');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000053","role":"authenticated"}',true);
select is((public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301')->>'radiusMeters')::integer,45,'default is 45 metres');
select is(public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301')->>'custom','false','default is not an override');
select is((public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301',true,md5('null'),60,'Validated synthetic mall entrance')->>'radiusMeters')::integer,60,'editor can save a justified override');
select throws_ok($$select public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301',true,md5('null'),70,'Another validated entrance')$$,'40001','Policy changed; reload','stale tab cannot overwrite policy');
select throws_ok($$select public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301',true,public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301')->>'revision',70,'short')$$,'22023','Invalid verification policy','a short reason cannot save');
select throws_ok($$select public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301',true,public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301')->>'revision',301,'A meaningful but excessive radius')$$,'22023','Invalid verification policy','server rejects excessive radius');
select is((public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301',true,public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301')->>'revision',null,'Restore the checked default entrance')->>'radiusMeters')::integer,45,'reset returns to 45 metres');
reset role;
select is((select count(*)::integer from public.admin_audit_log where actor_user_id='10000000-0000-4000-8000-000000000053' and entity_type='shops' and entity_id='00000000-0000-4000-8000-000000000301'),2,'successful changes audited once; rejected saves add no audit');
select ok(not exists(select 1 from stamp_private.shop_verification_policy where shop_id='00000000-0000-4000-8000-000000000301'),'reset removes the override');
update public.profiles set role='user' where id='10000000-0000-4000-8000-000000000053';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000053","role":"authenticated"}',true);
select throws_ok($$select public.admin_shop_verification_policy('00000000-0000-4000-8000-000000000301',true,md5('null'),60,'Previously authorized but now revoked')$$,'42501','Admin access denied','revoked role cannot use an old policy revision');
reset role;
select * from finish();
rollback;
