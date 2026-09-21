begin;
select no_plan();
insert into auth.users(id) values ('93000000-0000-4000-8000-000000000001'),('93000000-0000-4000-8000-000000000002'),('93000000-0000-4000-8000-000000000003');
select public.assign_profile_role('93000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('93000000-0000-4000-8000-000000000002','admin');
create temp table import_work(i integer primary key,id uuid,op uuid,payload jsonb,result jsonb);
grant all on import_work to authenticated;
create temp table import_before(k text primary key,v jsonb);
grant all on import_before to authenticated;
create function pg_temp.payload(i integer,target uuid,rev text,d jsonb) returns jsonb language sql as $$
 select jsonb_build_object('row',jsonb_build_object('rowId','row-'||i,'line',i+1,'cells',jsonb_build_object('name',d->'shop'->>'name'),'issues','[]'::jsonb,'fileDuplicates','[]'::jsonb),
 'preview',jsonb_build_object('action',case when rev is null then 'new_private_draft' else 'update_private_draft' end),
 'targetId',target,'revision',rev,'document',d,
 'reviewKey',public.admin_import_preview('validate',jsonb_build_array(jsonb_build_object('rowId','row-'||i,'id',target,'revision',rev,'document',d)))->0->>'reviewKey');
$$;
create function pg_temp.ledger(i integer,action text,payload jsonb) returns jsonb language sql as $$
 select public.admin_import_operation(action,'93000000-0000-4000-8000-000000000010',('95000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,payload);
$$;
-- Byte-identical canonical and sensitive state must survive all import updates.
insert into import_before values('public',(select jsonb_agg(to_jsonb(s) order by id) from public.shops s where publication_status='published'));
insert into import_before values('collections',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.stamp_collections c));
insert into import_before values('art',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.stamp_artwork_versions a));
insert into import_before values('media',(select coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') from public.media_uploads m));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
-- 200 rows: 100 new, 100 updates (including one genuine seeded published record).
-- Synthetic slugs and isolated fixtures use hash names to avoid accidental fuzzy peers.
select public.admin_shop_write('create',('94000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,null,
 jsonb_build_object('name',md5('existing-'||i),'slug','synthetic-existing-'||i)) from generate_series(101,200) i;
insert into import_work(i,id,op,payload)
select i,('94000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('95000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 pg_temp.payload(i,('94000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 case when i>100 then public.admin_shop_read(('94000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid)->>'revision' end,
 case when i>100 then jsonb_set(public.admin_shop_read(('94000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid)->'document','{shop,internal_notes}','"synthetic private import"')
 else jsonb_build_object('shop',jsonb_build_object('name',md5('new-'||i),'slug','synthetic-new-'||i,'operational_status','unknown','position_precision','locality','source_quality','community_unverified'),
 'sources','[]'::jsonb,'aliases','[]'::jsonb,'links','[]'::jsonb,'types','[]'::jsonb,'services','[]'::jsonb,'specialties','[]'::jsonb,'brands','[]'::jsonb,'experiences','[]'::jsonb) end)
from generate_series(1,200) i;
select is(pg_temp.ledger(i,'review',payload)->>'status','ready','review row '||i) from import_work order by i;
select is(jsonb_array_length(public.admin_import_batches('93000000-0000-4000-8000-000000000010')->'operations'),200,'200 durable operations reopen');
-- Replay review is idempotent; altered content cannot reuse the operation ID.
select is(pg_temp.ledger(1,'review',(select payload from import_work where i=1))->>'status','ready','repeated review returns existing identity');
select throws_ok($$select pg_temp.ledger(1,'review',jsonb_set((select payload from import_work where i=1),'{row,cells,name}','"changed"'))$$,'40001','Operation conflict','changed row requires new operation');
-- A lost response is simulated by executing and discarding its result, then replaying.
update import_work set result=pg_temp.ledger(i,'execute',jsonb_build_object('document',payload->'document','reviewKey',payload->>'reviewKey')) where i<=100;
select is(count(*)::integer,100,'first half imported') from import_work where result->>'status'='imported';
select is(jsonb_array_length(public.admin_import_batches('93000000-0000-4000-8000-000000000010')->'operations'),200,'reload retains both successful and remaining work');
-- Change one draft after review, and introduce a duplicate after review.
select public.admin_shop_write('save',(select id from import_work where i=101),(select payload->>'revision' from import_work where i=101),
 jsonb_set((select payload->'document' from import_work where i=101),'{shop,internal_notes}','"concurrent editor"'));
select public.admin_shop_write('create','96000000-0000-4000-8000-000000000102',null,
 jsonb_build_object('name',(select payload->'document'->'shop'->>'name' from import_work where i=102),'slug','synthetic-duplicate'));
-- Inject a recoverable database failure for one row; the following rows still run.
reset role;
create function pg_temp.fail_one_import() returns trigger language plpgsql as $$
begin
 if new.shop_id='94000000-0000-4000-8000-000000000103' then raise exception 'Synthetic failure' using errcode='23514'; end if;
 return new;
end; $$;
create trigger synthetic_import_failure before insert or update on public.shop_working_copies for each row execute function pg_temp.fail_one_import();
set local role authenticated;
update import_work set result=pg_temp.ledger(i,'execute',jsonb_build_object('document',payload->'document','reviewKey',payload->>'reviewKey')) where i>100;
select is((select result->>'status' from import_work where i=101),'conflicted','stale private revision conflicts');
select is((select result->>'status' from import_work where i=102),'conflicted','new duplicate requires review');
select is((select result->>'status' from import_work where i=103),'failed','isolated database failure reports failed');
select is(count(*)::integer,197,'other rows complete despite per-row conflicts and failure') from import_work where result->>'status'='imported';
reset role;
drop trigger synthetic_import_failure on public.shop_working_copies;
set local role authenticated;
update import_work set result=pg_temp.ledger(i,'execute',jsonb_build_object('document',payload->'document','reviewKey',payload->>'reviewKey')) where i=103;
select is((select result->>'status' from import_work where i=103),'imported','failed transaction retries after recovery');
select is(count(*)::integer,198,'198 imports after recoverable retry') from import_work where result->>'status'='imported';
insert into import_before select 'replay',jsonb_agg(public.admin_shop_read(id) order by i) from import_work;
select is(pg_temp.ledger(i,'execute','{}')->>'status',result->>'status','replay stable outcome '||i) from import_work order by i;
select is((select jsonb_agg(public.admin_shop_read(id) order by i) from import_work),(select v from import_before where k='replay'),'retries do not change revisions');
-- Correction creates a distinct revision. Completed rows may not be revised.
select public.admin_import_operation('review','93000000-0000-4000-8000-000000000010','96000000-0000-4000-8000-000000000101',
 pg_temp.payload(101,(select id from import_work where i=101),public.admin_shop_read((select id from import_work where i=101))->>'revision',
 jsonb_set(public.admin_shop_read((select id from import_work where i=101))->'document','{shop,internal_notes}','null'))
 ||jsonb_build_object('previousOperation',(select op from import_work where i=101)));
select is(public.admin_import_operation_read('93000000-0000-4000-8000-000000000010','96000000-0000-4000-8000-000000000101')->>'operation_revision','2','corrected clear gets revision 2');
select is(public.admin_import_operation('execute','93000000-0000-4000-8000-000000000010','96000000-0000-4000-8000-000000000101',
 jsonb_build_object('document',jsonb_set(public.admin_shop_read((select id from import_work where i=101))->'document','{shop,internal_notes}','null'),
 'reviewKey',public.admin_import_operation_read('93000000-0000-4000-8000-000000000010','96000000-0000-4000-8000-000000000101')->>'review_key'))->>'status','imported','reviewed explicit clear succeeds');
select is(public.admin_shop_read((select id from import_work where i=101))->'document'->'shop'->'internal_notes','null'::jsonb,'explicit clear saved');
select throws_ok($$select public.admin_import_operation('review','93000000-0000-4000-8000-000000000010','96000000-0000-4000-8000-000000000001',
 (select payload||jsonb_build_object('previousOperation',op) from import_work where i=1))$$,'40001','Operation conflict','cannot repeat successful row as a new operation revision');
-- A published target receives a private working copy only.
reset role;
insert into import_before values('published-id',to_jsonb((select id from public.shops where publication_status='published' limit 1)));
set local role authenticated;
select public.admin_import_operation('review','93000000-0000-4000-8000-000000000010','96000000-0000-4000-8000-000000000201',
 pg_temp.payload(201,((select v from import_before where k='published-id')#>>'{}')::uuid,
 public.admin_shop_read(((select v from import_before where k='published-id')#>>'{}')::uuid)->>'revision',
 jsonb_set(public.admin_shop_read(((select v from import_before where k='published-id')#>>'{}')::uuid)->'document','{shop,internal_notes}','"private only"')));
select is(public.admin_import_operation('execute','93000000-0000-4000-8000-000000000010','96000000-0000-4000-8000-000000000201',
 jsonb_build_object('document',jsonb_set(public.admin_shop_read(((select v from import_before where k='published-id')#>>'{}')::uuid)->'document','{shop,internal_notes}','"private only"'),
 'reviewKey',public.admin_import_operation_read('93000000-0000-4000-8000-000000000010','96000000-0000-4000-8000-000000000201')->>'review_key'))->>'status','imported','published target import succeeds');
select is(public.admin_shop_read(((select v from import_before where k='published-id')#>>'{}')::uuid)->'document'->'shop'->>'internal_notes','private only','published target actually receives a private draft');
-- Other admins, ordinary users, revocation, direct-table and expired access.
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.admin_import_batches()$$,'42501','Admin access denied','ordinary user cannot list batches');
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.admin_import_batches('93000000-0000-4000-8000-000000000010')$$,'42501','Batch unavailable','another admin cannot read private batch');
select throws_ok($$select pg_temp.ledger(1,'execute','{}')$$,'42501','Batch unavailable','another admin cannot execute batch');
select throws_ok($$select * from public.import_operations$$,'42501',null,'direct ledger access denied');
reset role;
select public.assign_profile_role('93000000-0000-4000-8000-000000000001','user');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.admin_import_batches('93000000-0000-4000-8000-000000000010')$$,'42501','Admin access denied','revoked owner cannot read');
select throws_ok($$select pg_temp.ledger(1,'execute','{}')$$,'42501','Admin access denied','revoked owner cannot replay');
reset role;
select is((select jsonb_agg(to_jsonb(s) order by id) from public.shops s where publication_status='published'),(select v from import_before where k='public'),'published rows byte-identical');
select is((select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.stamp_collections c),(select v from import_before where k='collections'),'collections unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') from public.media_uploads m),(select v from import_before where k='media'),'media unchanged');
select ok(not exists(select 1 from jsonb_array_elements((select v from import_before where k='art')) a left join public.stamp_artwork_versions v on v.id=(a->>'id')::uuid where to_jsonb(v) is distinct from a),'existing artwork unchanged');
select is((select count(*)::integer from public.stamps where shop_id in (select id from import_work where i<=100)),100,'exactly one generated stamp per new shop');
select ok(exists(select 1 from public.import_audit_events where status='conflicted'),'conflicts audited');
select ok(exists(select 1 from public.import_audit_events where status='imported' and catalogue_request_id is not null),'successful import linked to catalogue audit');
select throws_ok($$delete from public.import_audit_events$$,'42501','Audit history is append-only','import audit immutable');
update public.import_batches set expires_at=statement_timestamp()-interval '1 day' where id='93000000-0000-4000-8000-000000000010';
select public.purge_import_payloads();
select is((select count(*)::integer from public.import_operations where patch is not null or preview is not null),0,'expired private payloads purged');
select public.assign_profile_role('93000000-0000-4000-8000-000000000001','admin');
set local role authenticated;
select throws_ok($$select pg_temp.ledger(1,'execute','{}')$$,'42501','Batch unavailable','expired operation cannot be replayed even with restored admin role');
set constraints all immediate;
select * from finish();
rollback;
