begin;
select no_plan();
-- Every coordinate in this file is synthetic test data, never a real user fix.
insert into auth.users(id,aud,role,email) values
 ('10000000-0000-4000-8000-000000000051','authenticated','authenticated','wp2-one@example.test'),
 ('10000000-0000-4000-8000-000000000052','authenticated','authenticated','wp2-two@example.test');

create function pg_temp.start_nonce(k integer, owner_id uuid default '10000000-0000-4000-8000-000000000051', shop uuid default '00000000-0000-4000-8000-000000000301')
returns jsonb language sql as $$
 select public.stamp_verification_action('nonce',owner_id,shop,
   ('20000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid,
   encode(extensions.digest(k::text,'sha256'),'hex'));
$$;
create function pg_temp.action(k integer, op text, payload jsonb default '{}', owner_id uuid default '10000000-0000-4000-8000-000000000051', shop uuid default '00000000-0000-4000-8000-000000000301')
returns jsonb language sql as $$
 select public.stamp_verification_action(op,owner_id,shop,
   ('20000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid,
   encode(extensions.digest(k::text,'sha256'),'hex'),payload);
$$;
create function pg_temp.fix(k integer, metres double precision default 0, acc double precision default 10)
returns jsonb language plpgsql as $$
declare key bytea; iv bytea := extensions.gen_random_bytes(16); ct bytea; p extensions.geometry;
begin
 select encryption_key into key from stamp_private.verification_nonces where request_id=('20000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid;
 select extensions.st_project(location::extensions.geography,metres,0)::extensions.geometry into p from public.shops where id='00000000-0000-4000-8000-000000000301';
 ct := extensions.encrypt_iv(convert_to(jsonb_build_object('latitude',extensions.st_y(p),'longitude',extensions.st_x(p),'accuracy',acc)::text,'UTF8'),substring(key from 1 for 32),iv,'aes-cbc/pad:pkcs');
 return jsonb_build_object('iv',encode(iv,'hex'),'ciphertext',encode(ct,'hex'),
   'mac',encode(extensions.hmac(iv||ct,substring(key from 33 for 32),'sha256'),'hex'));
end;
$$;
select ok(not has_function_privilege('authenticated','public.stamp_verification_action(text,uuid,uuid,uuid,text,jsonb)','EXECUTE'),'browser cannot call privileged verification');
select ok(not has_function_privilege('anon','public.stamp_verification_rate_limit(uuid)','EXECUTE'),'anonymous cannot touch throttle');
select ok(not has_table_privilege('authenticated','public.verification_attempts','SELECT'),'attempt history is private');
select ok(not has_table_privilege('service_role','public.stamp_collections','INSERT'),'server also issues only through constrained RPC');
select ok(not has_schema_privilege('authenticated','stamp_private','USAGE'),'nonce and override schema is inaccessible');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.verification_attempts'::regclass),'attempts enforce RLS');
select ok(exists(select 1 from cron.job where jobname='nibatlas-verification-retention' and active),'automatic purge is installed');

select is(pg_temp.start_nonce(1)->>'code','nonce_issued','nonce starts flow');
select is(pg_temp.action(1,'collect','{"confirmedAtShop":true,"countryLabel":"Singapore"}')->>'code','invalid_nonce','cannot collect before verification');
select is(pg_temp.action(1,'context_verify','{}','10000000-0000-4000-8000-000000000052')->>'code','invalid_nonce','wrong user fails');
select is(pg_temp.action(1,'context_verify','{}','10000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000302')->>'code','invalid_nonce','wrong shop fails');
select is(public.stamp_verification_action('verify','10000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000301','20000000-0000-4000-8000-000000000001',repeat('0',64))->>'code','invalid_nonce','wrong nonce hash fails');
select is(pg_temp.action(1,'verify',pg_temp.fix(1,149.999,100))->>'code','confirmation_required','immediately inside geofence; accuracy exactly 100 accepted');
select is(pg_temp.action(1,'context_verify')->>'code','reused_nonce','successful verification nonce cannot verify again');
select ok((select encryption_key is null from stamp_private.verification_nonces where request_id='20000000-0000-4000-8000-000000000001'),'key destroyed after verification');
select is(pg_temp.action(1,'collect','{"confirmedAtShop":false,"countryLabel":"Singapore"}')->>'code','invalid_request','explicit confirmation required');

select pg_temp.start_nonce(2);
select is(pg_temp.action(2,'verify',pg_temp.fix(2,150.001))->>'code','outside_radius','immediately outside geofence rejected');
select pg_temp.start_nonce(3);
select is(pg_temp.action(3,'verify',pg_temp.fix(3,150))->>'code','confirmation_required','exact boundary is inclusive');
select pg_temp.start_nonce(4);
select is(pg_temp.action(4,'verify',pg_temp.fix(4,0,100.001))->>'code','poor_accuracy','worse than 100 rejected');
select pg_temp.start_nonce(5);
update stamp_private.verification_nonces set created_at=clock_timestamp()-interval '31 seconds' where request_id='20000000-0000-4000-8000-000000000005';
select is(pg_temp.action(5,'verify',pg_temp.fix(5))->>'code','stale_position','server acquisition window rejects stale fix');
select pg_temp.start_nonce(6);
update stamp_private.verification_nonces set expires_at=clock_timestamp()-interval '1 second' where request_id='20000000-0000-4000-8000-000000000006';
select is(pg_temp.action(6,'verify')->>'code','expired_nonce','expired nonce rejected');
select pg_temp.start_nonce(7);
select is(pg_temp.action(7,'verify','{"permission":"denied"}')->>'code','permission_denied','denied location does not issue');
select pg_temp.start_nonce(8);
select is(pg_temp.action(8,'verify',pg_temp.fix(8)||'{"mac":"0000"}'::jsonb)->>'code','invalid_request','tampered ciphertext rejected before decryption');
select pg_temp.start_nonce(9);
select is(pg_temp.action(9,'verify',pg_temp.fix(9,170))->>'code','outside_radius','poor accuracy never silently widens radius');
select ok((select 'repeated_failure'=any(anomaly_flags) from public.verification_attempts where request_id='20000000-0000-4000-8000-000000000009'),'privacy-safe repeated failure flag recorded');

select throws_ok($$select public.set_shop_verification_policy('10000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000301',200,'Mall entrance coordinate review')$$,'42501','Permission denied','ordinary user cannot authorize override');
update public.profiles set role='admin' where id='10000000-0000-4000-8000-000000000052';
select public.set_shop_verification_policy('10000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000301',200,'Mall entrance coordinate review');
select pg_temp.start_nonce(10);
select is(pg_temp.action(10,'verify',pg_temp.fix(10,175))->>'code','confirmation_required','controlled shop override adapts geofence');
select is(pg_temp.action(1,'collect','{"confirmedAtShop":true,"countryLabel":"Singapore"}')->>'code','shop_unavailable','policy change invalidates previously verified proof');
select is(pg_temp.action(10,'collect','{"confirmedAtShop":true,"countryLabel":"Singapore"}')->>'code','success','verification then explicit confirmation issues');
select is(pg_temp.action(10,'collect','{"confirmedAtShop":true,"countryLabel":"Singapore"}')->>'code','reused_nonce','consumed nonce cannot issue again');
select is(pg_temp.start_nonce(11)->>'code','duplicate','duplicate returns original collection before requesting location');
select is((select count(*)::integer from public.stamp_collections where user_id='10000000-0000-4000-8000-000000000051'),1,'only one collection exists');
select ok((select stamp_snapshot->'templateData' = art.template_data and c.shop_timezone=s.timezone and c.shop_name_snapshot=s.name and c.place_snapshot->>'localityName'=l.name
 from public.stamp_collections c join public.stamp_artwork_versions art on art.stamp_id=c.stamp_id and art.design_version=c.stamp_design_version join public.shops s on s.id=c.shop_id join public.localities l on l.id=s.locality_id where c.user_id='10000000-0000-4000-8000-000000000051'),'server snapshots preserve approved artwork, timezone and place');
select ok((select distance_m is null and reported_accuracy_m is null and anomaly_flags='{}' from public.stamp_collections where user_id='10000000-0000-4000-8000-000000000051'),'permanent owner-readable record contains no diagnostics');

-- Catalogue eligibility and changes before confirmation, on the second user.
select is(pg_temp.start_nonce(12,'10000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000399')->>'code','shop_unavailable','missing shop unavailable');
update public.shops set publication_status='draft' where id='00000000-0000-4000-8000-000000000301';
select is(pg_temp.start_nonce(13,'10000000-0000-4000-8000-000000000052')->>'code','shop_unavailable','unpublished shop unavailable');
update public.shops set publication_status='published',operational_status='temporarily_closed' where id='00000000-0000-4000-8000-000000000301';
select is(pg_temp.start_nonce(14,'10000000-0000-4000-8000-000000000052')->>'code','shop_unavailable','closed shop unavailable');
update public.shops set operational_status='open' where id='00000000-0000-4000-8000-000000000301';
update public.stamps set status='retired' where id='00000000-0000-4000-8000-000000000601';
select is(pg_temp.start_nonce(15,'10000000-0000-4000-8000-000000000052')->>'code','shop_unavailable','inactive stamp unavailable');
update public.stamps set status='active',availability_start=clock_timestamp()+interval '1 day' where id='00000000-0000-4000-8000-000000000601';
select is(pg_temp.start_nonce(16,'10000000-0000-4000-8000-000000000052')->>'code','shop_unavailable','unavailable stamp window rejected');
update public.stamps set availability_start=null where id='00000000-0000-4000-8000-000000000601';
select pg_temp.start_nonce(17,'10000000-0000-4000-8000-000000000052');
select is(pg_temp.action(17,'verify',pg_temp.fix(17),'10000000-0000-4000-8000-000000000052')->>'code','confirmation_required','second user verifies');
update stamp_private.verification_nonces set expires_at=clock_timestamp()-interval '1 second' where request_id='20000000-0000-4000-8000-000000000017';
select is(pg_temp.action(17,'collect','{"confirmedAtShop":true,"countryLabel":"Singapore"}','10000000-0000-4000-8000-000000000052')->>'code','expired_nonce','confirmation expiry is enforced');

select ok((select bool_and(public.stamp_verification_rate_limit('10000000-0000-4000-8000-000000000051')) from generate_series(1,12)),'initial budget allows immediate retry flow');
select is(public.stamp_verification_rate_limit('10000000-0000-4000-8000-000000000051'),false,'rate limit enforced');
update stamp_private.verification_buckets set window_start=clock_timestamp()-interval '1 day' where period='minute';
select is(public.stamp_verification_rate_limit('10000000-0000-4000-8000-000000000051'),true,'minute budget resets');
update stamp_private.verification_buckets set requests=100 where period='day';
select is(public.stamp_verification_rate_limit('10000000-0000-4000-8000-000000000051'),false,'daily budget also enforced');

select ok(not exists(select 1 from information_schema.columns where
 (table_schema='stamp_private' or (table_schema='public' and table_name in ('verification_attempts','stamp_collections')))
 and (column_name ~* '(latitude|longitude|position|ciphertext|payload)' or udt_name in ('geometry','geography'))),'no raw or encrypted positions in persisted schema');
update public.verification_attempts set attempted_at=clock_timestamp()-interval '31 days' where request_id='20000000-0000-4000-8000-000000000002';
update stamp_private.verification_nonces set expires_at=clock_timestamp()-interval '2 hours' where request_id='20000000-0000-4000-8000-000000000006';
select public.purge_stamp_verification_data();
select is((select count(*)::integer from public.verification_attempts where attempted_at<clock_timestamp()-interval '30 days'),0,'30-day attempts purge');
select is((select count(*)::integer from stamp_private.verification_nonces where request_id='20000000-0000-4000-8000-000000000006'),0,'expired nonce cleanup');
select ok(exists(select 1 from public.verification_attempts),'recent diagnostics preserved');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000052","role":"authenticated"}',true);
select is((select count(*)::integer from public.stamp_collections),0,'owner RLS hides other collection');
select throws_ok($$insert into public.stamp_collections(user_id) values('10000000-0000-4000-8000-000000000052')$$,'42501','permission denied for table stamp_collections','browser direct insert denied');
select throws_ok($$select public.stamp_verification_action('nonce','10000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000301',gen_random_uuid(),repeat('a',64))$$,'42501','permission denied for function stamp_verification_action','browser RPC issuance denied');
reset role;
select * from finish();
rollback;
