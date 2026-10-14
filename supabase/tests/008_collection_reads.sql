begin;
select no_plan();
insert into auth.users(id,aud,role,email) values
 ('10000000-0000-4000-8000-000000000081','authenticated','authenticated','read-one@example.test'),
 ('10000000-0000-4000-8000-000000000082','authenticated','authenticated','read-two@example.test');
-- Administrative test setup only; browsers still have no insert permission.
insert into public.stamp_collections(id,user_id,stamp_id,shop_id,stamp_design_version,
 shop_timezone,verification_method,verification_version,shop_name_snapshot,place_snapshot,stamp_snapshot)
values('20000000-0000-4000-8000-000000000081','10000000-0000-4000-8000-000000000081',
 '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301',1,
 'Asia/Singapore','geofence',1,'Historical name',
 '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Historical locality","localitySlug":"singapore"}',
 '{"id":"00000000-0000-4000-8000-000000000601","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}');
select ok(not has_function_privilege('anon','public.list_stamp_collections(uuid)','EXECUTE'),'anonymous cannot list collections');
select ok(not has_function_privilege('service_role','public.list_stamp_collections(uuid)','EXECUTE'),'read route uses the owner client, not service role');
select ok(not has_table_privilege('authenticated','public.stamp_collections','INSERT'),'read integration grants no direct issuance');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.list_stamp_collections()),1,'owner sees own impression');
select is(public.list_stamp_collections()->0->>'shopName','Historical name','read preserves historical name');
select ok(not ((public.list_stamp_collections()->0) ?| array['user_id','distance_m','reported_accuracy_m','anomaly_flags']), 'read omits diagnostics and provider fields');
select is(jsonb_array_length(public.list_stamp_collections('20000000-0000-4000-8000-000000000081')),0,'cursor is exclusive');
select is(jsonb_array_length(public.list_stamp_collections('20000000-0000-4000-8000-000000000080')),1,'cursor immediately before row includes it');
reset role;
update public.shops set name='Current renamed shop',publication_status='archived' where id='00000000-0000-4000-8000-000000000301';
set local role authenticated;
select is(jsonb_array_length(public.list_stamp_collections()),1,'archived shop does not erase history');
select is(public.list_stamp_collections()->0->>'shopName','Historical name','catalogue edits do not rewrite impression');
select is(public.list_stamp_collections()->0->>'shopSlug',null::text,'unpublished shop has no public navigation');
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000082","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.list_stamp_collections()),0,'another owner cannot see the collection');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.list_stamp_collections()),0,'missing subject sees nothing');
reset role;
select * from finish();
rollback;
