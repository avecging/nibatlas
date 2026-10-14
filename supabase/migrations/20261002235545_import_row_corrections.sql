-- #123: a correction creates a new reviewed operation for the same explicit target.
-- Completed operations remain immutable replay-safe outcomes. No validation,
-- revision, owner, duplicate or publication check is bypassed.
begin;
create or replace function public.admin_import_operation(p_action text,p_batch uuid,p_operation uuid,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.import_batches; o public.import_operations; latest public.import_operations;
 target uuid; completed_target uuid; rev text; d jsonb; checked jsonb; context jsonb; saved jsonb; n integer;
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
  -- Keep the original completed target through pending/failed correction chains.
  select target_id into completed_target from public.import_operations
   where batch_id=p_batch and row_id=p_payload->'row'->>'rowId' and status='imported'
   order by operation_revision desc limit 1;
  if latest.id is distinct from (p_payload->>'previousOperation')::uuid
   or (completed_target is not null and (
    p_payload->>'revision' is null
    or (p_payload->>'targetId')::uuid is distinct from completed_target
    or p_payload->'row'->'cells'->>'shop_id' is distinct from completed_target::text
    or p_payload->'preview'->>'action' is distinct from 'update_private_draft')) then
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
  if latest.id is not null and latest.status<>'imported' then update public.import_operations set patch=null,preview=null,status='skipped',reason='superseded' where id=latest.id; end if;
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
