begin;
select no_plan();
insert into auth.users(id) values ('a3000000-0000-4000-8000-000000000001'),('a3000000-0000-4000-8000-000000000002'),('a3000000-0000-4000-8000-000000000003');
select public.assign_profile_role('a3000000-0000-4000-8000-000000000001','admin');
select public.assign_profile_role('a3000000-0000-4000-8000-000000000002','admin');
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
 select public.admin_import_operation(action,'a3000000-0000-4000-8000-000000000010',('a5000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,payload);
$$;

create function pg_temp.complete(d jsonb) returns jsonb language sql as $$
 select jsonb_set(jsonb_set(d,'{shop}',d->'shop'||'{"country_code":"SG","locality_id":"00000000-0000-4000-8000-000000000201","timezone":"Asia/Singapore","latitude":0,"longitude":0,"source_quality":"demo","address_line_1":"Synthetic C3 address"}'),'{types}','[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":true}]');
$$;
create function pg_temp.state(i integer) returns jsonb language sql as $$
 select public.admin_import_publication_read('a3000000-0000-4000-8000-000000000010',0,('a5000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid);
$$;
create function pg_temp.pub(i integer,action text,rev integer default 1) returns jsonb language sql as $$
 select public.admin_import_publication(action,'a3000000-0000-4000-8000-000000000010',
 ('a5000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 ('a6000000-0000-4000-8000-'||lpad((i+rev*1000)::text,12,'0'))::uuid,
 case when action='review' then jsonb_build_object('reviewKey',pg_temp.state(i)->>'reviewKey','previousOperation',pg_temp.state(i)->'publication'->>'id') else '{}'::jsonb end);
$$;
create function pg_temp.edit(i integer,field text,value jsonb) returns jsonb language sql as $$
 select public.admin_shop_write('save',w.id,public.admin_shop_read(w.id)->>'revision',
 jsonb_set(public.admin_shop_read(w.id)->'document',array['shop',field],value)) from import_work w where w.i=$1;
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
-- Reuse C2's real 200-row mixed create/update foundation and C2 RPCs.
select public.admin_shop_write('create',('a4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,null,
 jsonb_build_object('name',md5('existing-c3-'||i),'slug','synthetic-c3-existing-'||i)) from generate_series(101,200) i;
-- One target is already public, then receives a private import update.
select public.admin_shop_write('save','a4000000-0000-4000-8000-000000000101',public.admin_shop_read('a4000000-0000-4000-8000-000000000101')->>'revision',pg_temp.complete(public.admin_shop_read('a4000000-0000-4000-8000-000000000101')->'document'));
select public.admin_shop_write('confirm_position','a4000000-0000-4000-8000-000000000101',public.admin_shop_read('a4000000-0000-4000-8000-000000000101')->>'revision');
select public.admin_shop_write('publish','a4000000-0000-4000-8000-000000000101',public.admin_shop_read('a4000000-0000-4000-8000-000000000101')->>'revision');
insert into import_work(i,id,op,payload)
select i,('a4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a5000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 pg_temp.payload(i,('a4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 case when i>100 then public.admin_shop_read(('a4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid)->>'revision' end,
 pg_temp.complete(case when i>100 then jsonb_set(public.admin_shop_read(('a4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid)->'document','{shop,internal_notes}','"synthetic C3 private import"')
 else jsonb_build_object('shop',jsonb_build_object('name',md5('new-c3-'||i),'slug','synthetic-c3-new-'||i,'operational_status','unknown','position_precision','locality','source_quality','demo'),
 'sources','[]'::jsonb,'aliases','[]'::jsonb,'links','[]'::jsonb,'types','[]'::jsonb,'services','[]'::jsonb,'specialties','[]'::jsonb,'brands','[]'::jsonb,'experiences','[]'::jsonb) end))
from generate_series(1,200) i;
select is(pg_temp.ledger(i,'review',payload)->>'status','ready','C2 review '||i) from import_work;
update import_work set result=pg_temp.ledger(i,'execute',jsonb_build_object('document',payload->'document','reviewKey',payload->>'reviewKey'));
select is(count(*)::integer,200,'200 real C2 operations imported') from import_work where result->>'status'='imported';
select is(pg_temp.state(101)->>'kind','private_update','public target distinguished from new draft');
select is(pg_temp.state(1)->>'positionConfirmed','false','C2 success and zero coordinate pair do not imply confirmation');
select is(jsonb_array_length(public.admin_import_publication_read('a3000000-0000-4000-8000-000000000010')->'rows'),25,'review reads bounded to 25');
select is(public.admin_import_publication_read('a3000000-0000-4000-8000-000000000010')->>'nextOffset','25','bounded next page');
select is(public.admin_import_publication_read('a3000000-0000-4000-8000-000000000010',175)->'nextOffset','null'::jsonb,'last page ends at 200');
select throws_ok($$select public.admin_import_publication_read('a3000000-0000-4000-8000-000000000010',500)$$,'22023','Invalid offset','bounded offset enforced');
select pg_temp.edit(3,'address_line_1','null');
select is(pg_temp.state(3)->'record'->'document'->'shop'->'address_line_1','null'::jsonb,'incomplete fixture targets row 3 only');
select is(pg_temp.state(1)->'record'->'document'->'shop'->>'address_line_1','Synthetic C3 address','neighboring fixture remains unchanged');
-- Row 2 is deliberately deselected; every other row gets an exact revision review.
select is(pg_temp.pub(i,'review')->>'reviewed','true','deliberate review '||i) from import_work where i<>2;
select is(pg_temp.pub(1,'review')->'publication'->>'operation_revision','1','lost review response replays identity');
select is(pg_temp.pub(1,'publish')->'publication'->>'status','failed','unconfirmed position cannot publish');
select is(pg_temp.pub(i,'confirm_position')->>'positionConfirmed','true','explicit coordinate confirmation '||i) from import_work where i<>2;
insert into import_before values('confirm-replay',pg_temp.state(1)->'record');
select pg_temp.pub(1,'confirm_position');
select is(pg_temp.state(1)->'record',(select v from import_before where k='confirm-replay'),'lost confirmation response does not repeat confirmation');
-- Non-location edits invalidate review; location edits invalidate both.
select pg_temp.edit(4,'internal_notes','"changed after review"');
select pg_temp.edit(6,'latitude','1');
select is(pg_temp.state(4)->>'reviewed','false','all private edits require re-review');
select is(pg_temp.state(6)->>'positionConfirmed','false','changed coordinates invalidate saved confirmation');
reset role;
update public.shops set name='Synthetic operator change' where id=(select id from import_work where i=5);
insert into import_before select 'art',coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.stamp_artwork_versions v;
insert into import_before select 'stamps',coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.stamps v;
insert into import_before select 'media',coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.shop_images v;
insert into import_before select 'collections',coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.stamp_collections v;
create function pg_temp.fail_one_publication() returns trigger language plpgsql as $$
begin
 if new.id='a4000000-0000-4000-8000-000000000007' and new.publication_status='published' then raise exception 'Synthetic failure' using errcode='23514'; end if;
 return new;
end; $$;
create trigger synthetic_publication_failure before update on public.shops for each row execute function pg_temp.fail_one_publication();
set local role authenticated;
update import_work set result=pg_temp.pub(i,'publish') where i<>2;
select is((select result->'publication'->>'status' from import_work where i=1),'published','eligible draft reviewed confirmed published');
select is((select result->'publication'->>'status' from import_work where i=3),'failed','incomplete row fails separately');
select is((select result->'publication'->>'status' from import_work where i=4),'conflicted','stale private revision conflicts');
select is((select result->'publication'->>'status' from import_work where i=5),'conflicted','stale public revision conflicts');
select is((select result->'publication'->>'status' from import_work where i=6),'conflicted','changed coordinates conflict');
select is((select result->'publication'->>'status' from import_work where i=7),'failed','recoverable partial publication failure');
select is((select count(*)::integer from import_work where result->'publication'->>'status'='published'),194,'194 selected rows succeed independently');
select is(pg_temp.state(2)->'publication','null'::jsonb,'deselected row has no publication attempt');
select is(pg_temp.state(2)->'record'->>'publicationStatus','draft','deselected row stays private');
select is(public.shop_detail('synthetic-c3-existing-101')->>'id','a4000000-0000-4000-8000-000000000101','existing ID and slug stable');
insert into import_before values('published-replay',pg_temp.state(1)->'record');
select pg_temp.pub(1,'publish');
select is(pg_temp.state(1)->'record',(select v from import_before where k='published-replay'),'lost publication response replay preserves revision');
select is(pg_temp.state(1)->>'kind','already_published','reload identifies published row');
reset role;
drop trigger synthetic_publication_failure on public.shops;
set local role authenticated;
select is(pg_temp.pub(7,'publish')->'publication'->>'status','published','retry only failed row after transient failure');
select pg_temp.pub(4,'review',2);
select is(pg_temp.pub(4,'publish',2)->'publication'->>'status','published','fresh review permits non-location edit with valid existing confirmation');
select pg_temp.pub(6,'review',2);
select is(pg_temp.pub(6,'publish',2)->'publication'->>'status','failed','re-review cannot infer position confirmation');
select pg_temp.pub(6,'confirm_position',2);
select is(pg_temp.pub(6,'publish',2)->'publication'->>'status','published','deliberately reconfirmed changed coordinates publish');
select pg_temp.edit(3,'address_line_1','"Corrected synthetic address"');
select pg_temp.pub(3,'review',2);
select pg_temp.pub(3,'confirm_position',2);
select is(pg_temp.pub(3,'publish',2)->'publication'->>'status','published','corrected incomplete row reviewed confirmed published');
select throws_ok($$select pg_temp.pub(5,'review',2)$$,'40001','Review changed','canonical-base conflict cannot be silently rebased');
select is(pg_temp.pub(4,'publish')->'publication'->>'operation_revision','2','superseded operation cannot republish');
-- RPC ownership and current-role checks also precede successful replays.
select throws_ok($$select public.admin_import_publication('publish','a3000000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000001001')$$,'40001','Operation conflict','cross-row operation rejected');
reset role;
insert into public.import_batches(id,owner_id) values('a3000000-0000-4000-8000-000000000011','a3000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.admin_import_publication_read('a3000000-0000-4000-8000-000000000011',0,'a5000000-0000-4000-8000-000000000001')$$,'22023','Import row unavailable','cross-batch row denied');
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select pg_temp.state(1)$$,'42501','Batch unavailable','other admin cannot read');
select throws_ok($$select pg_temp.pub(1,'publish')$$,'42501','Batch unavailable','other admin cannot replay');
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select pg_temp.state(1)$$,'42501','Admin access denied','ordinary user denied');
select throws_ok($$select pg_temp.pub(1,'publish')$$,'42501','Admin access denied','ordinary publication denied');
reset role;
select public.assign_profile_role('a3000000-0000-4000-8000-000000000001','editor');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select pg_temp.pub(1,'publish')$$,'42501','Admin access denied','revoked/downgraded admin denied even for completed replay');
select throws_ok($$select * from public.import_publications$$,'42501',null,'direct ledger read denied');
select ok(not has_function_privilege('authenticated','public.import_publication_state(uuid,boolean)','execute'),'private helper inaccessible');
reset role;
select is((select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.stamp_artwork_versions v),(select v from import_before where k='art'),'artwork byte-identical');
select is((select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.stamps v),(select v from import_before where k='stamps'),'stamp state byte-identical');
select is((select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.shop_images v),(select v from import_before where k='media'),'media byte-identical');
select is((select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.stamp_collections v),(select v from import_before where k='collections'),'collections and impressions byte-identical');
select is((select count(*)::integer from public.import_audit_events where operation_id='a6000000-0000-4000-8000-000000001001' and status='publication_published'),1,'one publication audit event after replay');
select ok(exists(select 1 from public.import_audit_events where status='publication_published' and catalogue_request_id is not null),'successful publications linked to catalogue audit');
select throws_ok($$delete from public.import_audit_events$$,'42501','Audit history is append-only','audit remains append-only');
select public.assign_profile_role('a3000000-0000-4000-8000-000000000001','admin');
update public.import_batches set expires_at=statement_timestamp()-interval '1 day' where id='a3000000-0000-4000-8000-000000000010';
set local role authenticated;
select throws_ok($$select pg_temp.pub(1,'publish')$$,'42501','Batch unavailable','expired replay denied');
set constraints all immediate;
select * from finish();
rollback;
