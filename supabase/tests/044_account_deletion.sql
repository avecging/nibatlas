begin;
select no_plan();

-- Synthetic admin fixture: exercise every account-linked constraint that used
-- to block auth.users deletion after the server had already revoked sessions.
insert into auth.users(id,aud,role,email) values
 ('f1000000-0000-4000-8000-000000000001','authenticated','authenticated','delete-admin@example.test');
update public.profiles set role='admin' where id='f1000000-0000-4000-8000-000000000001';

insert into public.saved_shops(user_id,shop_id) values
 ('f1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000301');
insert into public.import_batches(id,owner_id) values
 ('f1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001');
insert into public.import_operations(
 id,batch_id,row_id,operation_revision,target_id,review_key,status
) values (
 'f1000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000002',
 'delete-account-fixture',1,'00000000-0000-4000-8000-000000000301',repeat('b',64),'imported'
);
insert into public.import_publications(
 id,import_id,batch_id,operation_revision,expected_revision,review_key,
 initial_review_key,status
) values (
 'f1000000-0000-4000-8000-000000000008','f1000000-0000-4000-8000-000000000004',
 'f1000000-0000-4000-8000-000000000002',1,'synthetic-revision',repeat('b',64),
 repeat('b',64),'published'
);
insert into public.shop_reviews(actor_id,shop_id,environment,id,review_key,choices) values
 ('f1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000301','staging',
  'f1000000-0000-4000-8000-000000000003',repeat('a',64),'{}');

insert into public.import_audit_events(actor_id,batch_id,operation_id,operation_revision,status,review_key) values
 ('f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000004',1,'imported',repeat('b',64));
insert into public.shop_review_events(id,actor_id,shop_id,environment,review_key,choices_hash) values
 ('f1000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000301','staging',repeat('c',64),repeat('d',64));
insert into public.shop_publications(review_id,actor_id,shop_id,environment,expected_key,outcomes) values
 ('f1000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000301','staging',repeat('c',64),'[]');
insert into public.about_images(id,actor_id,environment,sha256,byte_size,width,height) values
 ('f1000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000001',
  'staging',repeat('e',64),100,10,10);
insert into public.media_uploads(
 id,created_by,environment,shop_id,purpose,storage_key,sha256,byte_size,
 content_type,source_ref,rights_basis,credit_text,alt_text
) values (
 'f1000000-0000-4000-8000-000000000007','f1000000-0000-4000-8000-000000000001','staging',
 '00000000-0000-4000-8000-000000000301','shop_photo',
 'staging/media/f1000000-0000-4000-8000-000000000007/v1/'||repeat('f',64)||'.png',
 repeat('f',64),100,'image/png','Synthetic deletion fixture','Test-only rights',
 'Synthetic credit','Synthetic image'
);
insert into stamp_private.shop_verification_policy(shop_id,radius_m,reason,updated_by) values
 ('00000000-0000-4000-8000-000000000301',45,'Synthetic deletion lifecycle test',
  'f1000000-0000-4000-8000-000000000001');
update public.shops set reviewed_by='f1000000-0000-4000-8000-000000000001',reviewed_at=statement_timestamp()
 where id='00000000-0000-4000-8000-000000000301';

select ok(not has_function_privilege('anon','public.account_deletion_session()','EXECUTE'),
 'anonymous callers cannot probe the account-deletion session check');
set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1000000-0000-4000-8000-000000000099"}',true);
select throws_ok(
 $$select public.account_deletion_session()$$,
 '28000','Authentication required',
 'a signed JWT without a live auth.sessions row cannot authorize deletion'
);
reset role;

insert into auth.sessions(id,user_id) values
 ('f1000000-0000-4000-8000-000000000098','f1000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1000000-0000-4000-8000-000000000098"}',true);
select is(
 public.account_deletion_session(),
 'f1000000-0000-4000-8000-000000000001'::uuid,
 'a live Auth session authorizes only its own account identity'
);
reset role;

select lives_ok(
 $$delete from auth.users where id='f1000000-0000-4000-8000-000000000001'$$,
 'an admin account can be deleted despite retained catalogue and audit history'
);

select ok(not exists(select 1 from public.profiles where id='f1000000-0000-4000-8000-000000000001'),
 'the private profile is deleted');
select ok(not exists(select 1 from public.saved_shops where user_id='f1000000-0000-4000-8000-000000000001'),
 'saved shops are deleted');
select ok(not exists(select 1 from public.import_batches where owner_id='f1000000-0000-4000-8000-000000000001'),
 'private import working data is deleted');
select ok(not exists(select 1 from public.import_publications where batch_id='f1000000-0000-4000-8000-000000000002'),
 'private import publication ledgers cascade with their deleted batch and operation');
select ok(not exists(select 1 from public.shop_reviews where actor_id='f1000000-0000-4000-8000-000000000001'),
 'private durable review choices are deleted');

select ok(exists(select 1 from public.import_audit_events where actor_id='f1000000-0000-4000-8000-000000000001'),
 'append-only import audit keeps only the now-unresolvable actor UUID');
select ok(exists(select 1 from public.shop_publications where actor_id='f1000000-0000-4000-8000-000000000001'),
 'catalogue publication outcomes retain the opaque former actor UUID');
select ok(exists(select 1 from public.about_images where actor_id='f1000000-0000-4000-8000-000000000001'),
 'an unpublished About media submission survives as catalogue provenance without an account reference');
select ok(exists(select 1 from public.media_uploads where created_by='f1000000-0000-4000-8000-000000000001'),
 'a pending catalogue media submission survives without an account reference');
select ok(exists(select 1 from stamp_private.shop_verification_policy where updated_by='f1000000-0000-4000-8000-000000000001'),
 'verification policy survives with an opaque former actor UUID');
select is((select reviewed_by from public.shops where id='00000000-0000-4000-8000-000000000301'),
 'f1000000-0000-4000-8000-000000000001'::uuid,
 'canonical review provenance survives with an opaque former actor UUID');

select * from finish();
rollback;
