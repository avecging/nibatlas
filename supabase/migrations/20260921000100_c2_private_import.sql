-- Package C2: private recovery ledger; publication is deliberately separate.
begin;
create table public.import_batches (
 id uuid primary key, owner_id uuid not null references public.profiles(id),
 created_at timestamptz not null default statement_timestamp(),
 expires_at timestamptz not null default statement_timestamp()+interval '30 days'
);
create table public.import_operations (
 id uuid primary key, batch_id uuid not null references public.import_batches(id),
 row_id text not null check(length(row_id) between 1 and 100),
 operation_revision integer not null check(operation_revision between 1 and 100),
 target_id uuid not null, expected_revision text, review_key text not null,
 patch jsonb, preview jsonb,
 status text not null check(status in ('ready','imported','skipped','conflicted','failed')),
 reason text, result_revision text, created_at timestamptz not null default statement_timestamp(),
 unique(batch_id,row_id,operation_revision)
);
create index import_batches_owner on public.import_batches(owner_id,created_at desc);
create index import_operations_batch on public.import_operations(batch_id,row_id,operation_revision desc);
alter table public.import_batches enable row level security;
alter table public.import_operations enable row level security;
revoke all on public.import_batches,public.import_operations from public,anon,authenticated,service_role;
-- No table policies: ordinary API callers must use the current-role/owner RPCs.

-- Minimal append-only recovery audit: no source cells, documents or names.
create table public.import_audit_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
 batch_id uuid not null, operation_id uuid not null, operation_revision integer not null,
 status text not null, review_key text not null, catalogue_request_id uuid, created_at timestamptz not null default statement_timestamp()
);
alter table public.import_audit_events enable row level security;
revoke all on public.import_audit_events from public,anon,authenticated,service_role;
create trigger import_audit_immutable before update or delete on public.import_audit_events
 for each row execute function public.reject_audit_mutation();
create trigger import_audit_no_truncate before truncate on public.import_audit_events
 for each statement execute function public.reject_audit_mutation();
create function public.audit_import_operation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.status is distinct from old.status then
  insert into public.import_audit_events(actor_id,batch_id,operation_id,operation_revision,status,review_key,catalogue_request_id)
   values(auth.uid(),new.batch_id,new.id,new.operation_revision,new.status,new.review_key,
    case when new.status='imported' then nullif(current_setting('nibatlas.admin_request_id',true),'')::uuid end);
 end if;
 return null;
end; $$;
revoke all on function public.audit_import_operation() from public,anon,authenticated,service_role;
create trigger import_operation_audit after insert or update on public.import_operations
 for each row execute function public.audit_import_operation();

create function public.import_review_key(p_id uuid,p_revision text,p_document jsonb)
returns text language sql stable security definer set search_path='' as $$
 select encode(extensions.digest(jsonb_build_array(p_id,p_revision,p_document,
   case when exists(select 1 from public.shops where id=p_id) then public.shop_edit_document(p_id) else null end,
   (select publication_status from public.shops where id=p_id))::text,'sha256'),'hex');
$$;
revoke all on function public.import_review_key(uuid,text,jsonb) from public,anon,authenticated,service_role;
-- Extend the read-only preview without changing its underlying validation rules.
alter function public.admin_import_preview(text,jsonb) rename to import_preview_v1;
revoke all on function public.import_preview_v1(text,jsonb) from public,anon,authenticated,service_role;
create function public.admin_import_preview(p_mode text,p_rows jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; r jsonb; v jsonb; i integer:=0; output jsonb:='[]';
begin
 result:=public.import_preview_v1(p_mode,p_rows);
 if p_mode<>'validate' then return result; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  v:=result->i; i:=i+1;
  output:=output||jsonb_build_array(v||jsonb_build_object('reviewKey',
   case when v->'issues'='[]'::jsonb then public.import_review_key((r->>'id')::uuid,r->>'revision',r->'document') else null end));
 end loop;
 return output;
end; $$;
revoke all on function public.admin_import_preview(text,jsonb) from public,anon,service_role;
grant execute on function public.admin_import_preview(text,jsonb) to authenticated;

-- Payloads expire, but identity/outcome tombstones remain to deny old replays.
-- Database-owner maintenance: bounded cleanup; never part of per-row execution.
create function public.purge_import_payloads() returns void language sql security definer set search_path='' as $$
 update public.import_operations o set patch=null,preview=null
 where o.id in (select x.id from public.import_operations x join public.import_batches b on b.id=x.batch_id
 where b.expires_at<=statement_timestamp() and (x.patch is not null or x.preview is not null) limit 500);
$$;
revoke all on function public.purge_import_payloads() from public,anon,authenticated,service_role;

create function public.admin_import_batches(p_batch uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
  raise exception 'Admin access denied' using errcode='42501'; end if;
 if p_batch is null then
  select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]') into result from (
   select b.id,b.created_at as "createdAt",b.expires_at as "expiresAt",
    (select count(distinct row_id) from public.import_operations where batch_id=b.id) as rows
   from public.import_batches b where owner_id=auth.uid() and expires_at>statement_timestamp()
   order by created_at desc limit 50) x;
  return result;
 end if;
 if not exists(select 1 from public.import_batches where id=p_batch and owner_id=auth.uid() and expires_at>statement_timestamp()) then
  raise exception 'Batch unavailable' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.row_id),'[]') into result from (
  select distinct on(row_id) id,row_id,operation_revision,target_id,expected_revision,review_key,patch,preview,status,reason,result_revision
  from public.import_operations where batch_id=p_batch order by row_id,operation_revision desc) x;
 return jsonb_build_object('id',p_batch,'operations',result);
end; $$;
revoke all on function public.admin_import_batches(uuid) from public,anon,service_role;
grant execute on function public.admin_import_batches(uuid) to authenticated;

-- Execution fetches one operation, not every private row in the batch.
create function public.admin_import_operation_read(p_batch uuid,p_operation uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') or
 not exists(select 1 from public.import_batches where id=p_batch and owner_id=auth.uid() and expires_at>statement_timestamp()) then
  raise exception 'Batch unavailable' using errcode='42501'; end if;
 select to_jsonb(o) into result from public.import_operations o where o.batch_id=p_batch and o.id=p_operation;
 if result is null then raise exception 'Operation unavailable' using errcode='22023'; end if;
 return result;
end; $$;
revoke all on function public.admin_import_operation_read(uuid,uuid) from public,anon,service_role;
grant execute on function public.admin_import_operation_read(uuid,uuid) to authenticated;

-- Each call is a single recoverable row transaction. Lock order is role, batch,
-- operation, then shop; manual writers use the same role/shop locks.
create function public.admin_import_operation(p_action text,p_batch uuid,p_operation uuid,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.import_batches; o public.import_operations; latest public.import_operations;
 target uuid; rev text; d jsonb; checked jsonb; context jsonb; saved jsonb; n integer;
 result_status text; result_reason text; proposed_key text;
begin
 perform 1 from public.profiles where id=auth.uid() and role='admin' for share;
 if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
 if p_action is null or p_action not in ('review','execute') or p_batch is null or p_operation is null
  or p_payload is null or octet_length(p_payload::text)>2097152 then
  raise exception 'Invalid import operation' using errcode='22023'; end if;
 if p_action='review' then
  insert into public.import_batches(id,owner_id) values(p_batch,auth.uid()) on conflict do nothing;
 end if;
 select * into b from public.import_batches where id=p_batch for update;
 if not found or b.owner_id<>auth.uid() or b.expires_at<=statement_timestamp() then
  raise exception 'Batch unavailable' using errcode='42501'; end if;
 select * into o from public.import_operations where id=p_operation for update;
 if o.id is not null and o.batch_id<>p_batch then raise exception 'Operation conflict' using errcode='40001'; end if;
 if p_action='review' then
  perform public.check_edit_object(p_payload,'{"row":"object","preview":"object","document":"object","targetId":"uuid","revision":"text","reviewKey":"text","previousOperation":"uuid"}',array['row','preview','document','targetId','reviewKey']);
  if o.id is not null then
   if o.row_id is distinct from p_payload->'row'->>'rowId' or o.review_key is distinct from p_payload->>'reviewKey'
    or o.patch is distinct from p_payload->'row' then raise exception 'Operation conflict' using errcode='40001'; end if;
   return jsonb_build_object('id',o.id,'rowId',o.row_id,'status',o.status,'reason',o.reason,'targetId',o.target_id);
  end if;
  if length(p_payload->'row'->>'rowId') not between 1 and 100
   or p_payload->'row'->'issues' is distinct from '[]'::jsonb or p_payload->'row'->'fileDuplicates' is distinct from '[]'::jsonb
   or p_payload->'preview'->>'action' not in ('new_private_draft','update_private_draft') then
   raise exception 'Unresolved row' using errcode='22023'; end if;
  select * into latest from public.import_operations where batch_id=p_batch and row_id=p_payload->'row'->>'rowId'
   order by operation_revision desc limit 1;
  if latest.id is distinct from (p_payload->>'previousOperation')::uuid or latest.status='imported' then
   raise exception 'Operation conflict' using errcode='40001'; end if;
  if latest.id is null and (select count(distinct row_id) from public.import_operations where batch_id=p_batch)>=500 then
   raise exception 'Batch limit reached' using errcode='22023'; end if;
  target:=(p_payload->>'targetId')::uuid; rev:=p_payload->>'revision'; d:=p_payload->'document';
  -- Compare against the exact read-only review. This is not a bearer token.
  perform 1 from public.shops where id=target for update;
  proposed_key:=public.import_review_key(target,rev,d);
  if proposed_key is distinct from p_payload->>'reviewKey' then raise exception 'Review changed' using errcode='40001'; end if;
  checked:=public.admin_import_preview('validate',jsonb_build_array(jsonb_build_object('rowId',p_payload->'row'->>'rowId','id',target,'revision',rev,'document',d)))->0;
  if checked->'issues'<>'[]'::jsonb then raise exception 'Review changed' using errcode='40001'; end if;
  n:=coalesce(latest.operation_revision,0)+1;
  if latest.id is not null then update public.import_operations set patch=null,preview=null,status='skipped',reason='superseded' where id=latest.id; end if;
  insert into public.import_operations(id,batch_id,row_id,operation_revision,target_id,expected_revision,review_key,patch,preview,status)
   values(p_operation,p_batch,p_payload->'row'->>'rowId',n,target,rev,proposed_key,p_payload->'row',p_payload->'preview','ready') returning * into o;
 else
  perform public.check_edit_object(p_payload,'{"document":"object","reviewKey":"text"}',array[]::text[]);
  if o.id is null then raise exception 'Operation unavailable' using errcode='22023'; end if;
  if o.status in ('imported','skipped','conflicted') then
   return jsonb_build_object('id',o.id,'rowId',o.row_id,'status',o.status,'reason',o.reason,'targetId',o.target_id);
  end if;
  target:=o.target_id; rev:=o.expected_revision; d:=p_payload->'document';
  -- Serialize import duplicate checks across batches, with one-row transactions.
  perform pg_advisory_xact_lock(73219,2);
  begin
   perform 1 from public.shops where id=target for update;
   if d is null or public.import_review_key(target,rev,d) is distinct from o.review_key
    or p_payload->>'reviewKey' is distinct from o.review_key then raise exception 'Review changed' using errcode='40001'; end if;
   checked:=public.admin_import_preview('validate',jsonb_build_array(jsonb_build_object('rowId',o.row_id,'id',target,'revision',rev,'document',d)))->0;
   if checked->'issues'<>'[]'::jsonb then raise exception 'Review changed' using errcode='40001'; end if;
   context:=public.admin_import_preview('context',jsonb_build_array(jsonb_build_object('rowId',o.row_id,'id',case when rev is not null then target else null end,
    'name',d->'shop'->>'name','slug',d->'shop'->>'slug','country',d->'shop'->>'country_code')))->0;
   if jsonb_array_length(context->'candidates')>0 or (context->>'truncated')::boolean then
    raise exception 'Duplicates changed' using errcode='40001'; end if;
   if rev is null then
    saved:=public.admin_shop_write('create',target,null,jsonb_build_object('name',d->'shop'->>'name','slug',d->'shop'->>'slug'));
    rev:=saved->>'revision';
   end if;
   saved:=public.admin_shop_write('save',target,rev,d);
   result_status:='imported'; result_reason:=null;
  exception when sqlstate '40001' or unique_violation then
   result_status:='conflicted'; result_reason:='Record or duplicate changed. Reopen, correct and review this row again.';
  when sqlstate '22023' or check_violation or foreign_key_violation then
   result_status:='failed'; result_reason:='Draft validation failed. Correct the row and review again.';
  end;
  update public.import_operations set status=result_status,reason=result_reason,result_revision=saved->>'revision' where id=o.id returning * into o;
 end if;
 return jsonb_build_object('id',o.id,'rowId',o.row_id,'status',o.status,'reason',o.reason,'targetId',o.target_id);
end; $$;
revoke all on function public.admin_import_operation(text,uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.admin_import_operation(text,uuid,uuid,jsonb) to authenticated;
commit;
