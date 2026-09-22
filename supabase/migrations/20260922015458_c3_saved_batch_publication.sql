-- C3 adds a publication ledger; C2 and the manual shop writer remain unchanged.
begin;
create table public.import_publications (
 id uuid primary key,
 import_id uuid not null references public.import_operations(id),
 batch_id uuid not null references public.import_batches(id),
 operation_revision integer not null check(operation_revision between 1 and 100),
 expected_revision text not null, review_key text not null,
 initial_review_key text not null,
 position_confirmed boolean not null default false,
 status text not null check(status in ('reviewed','published','conflicted','failed')),
 reason text, result_revision text,
 created_at timestamptz not null default statement_timestamp(), published_at timestamptz,
 unique(import_id,operation_revision)
);
create index import_publications_batch on public.import_publications(batch_id,import_id);
alter table public.import_publications enable row level security;
revoke all on public.import_publications from public,anon,authenticated,service_role;

create function public.audit_import_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.status is distinct from old.status or new.review_key is distinct from old.review_key then
  insert into public.import_audit_events(actor_id,batch_id,operation_id,operation_revision,status,review_key,catalogue_request_id)
  values(auth.uid(),new.batch_id,new.id,new.operation_revision,
   case when TG_OP='UPDATE' and new.status='reviewed' then 'publication_position_confirmed' else 'publication_'||new.status end,
   new.review_key,case when new.status='published' or (TG_OP='UPDATE' and new.status='reviewed')
    then nullif(current_setting('nibatlas.admin_request_id',true),'')::uuid end);
 end if;
 return null;
end; $$;
revoke all on function public.audit_import_publication() from public,anon,authenticated,service_role;
create trigger import_publication_audit after insert or update on public.import_publications
 for each row execute function public.audit_import_publication();

-- Private helper. No raw document is duplicated in the durable ledger.
create function public.import_publication_state(p_import uuid,p_detail boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.import_operations; p public.import_publications; r jsonb; d jsonb;
 k text; blockers jsonb:='[]'; conflict boolean:=false; reviewed boolean:=false;
 kind text; result jsonb; confirmable boolean:=false; reviewable boolean:=false;
begin
 select * into o from public.import_operations where id=p_import;
 if not found then raise exception 'Import row unavailable' using errcode='22023'; end if;
 select * into p from public.import_publications where import_id=p_import order by operation_revision desc limit 1;
 if o.status='imported' and exists(select 1 from public.shops where id=o.target_id) then
  r:=public.admin_shop_read(o.target_id); d:=public.shop_edit_document(o.target_id);
  k:=public.import_review_key(o.target_id,r->>'revision',r->'document');
  conflict:=exists(select 1 from public.shop_working_copies where shop_id=o.target_id and base_fingerprint<>md5(d::text));
  reviewed:=p.status in ('reviewed','failed') and p.review_key=k and p.expected_revision=r->>'revision' and not conflict;
  kind:=case when r->>'publicationStatus'='published' and not (r->>'hasChanges')::boolean then 'already_published'
    when r->>'publicationStatus'='published' then 'private_update' else 'new_draft' end;
  blockers:=r->'publicationErrors';
  if r->>'publicationStatus'='archived' then blockers:=blockers||'"Archived shops cannot be published."'::jsonb; end if;
  if conflict then blockers:=blockers||'"Public state changed. Open the editor to reconcile the saved copy, then review again."'::jsonb; end if;
  if p.id is not null and p.status<>'published' and not reviewed then
   blockers:=blockers||'"Saved or public revision changed. Review this row again."'::jsonb;
  end if;
  reviewable:=not conflict and r->>'publicationStatus'<>'archived' and kind<>'already_published' and coalesce(p.status,'')<>'published';
  confirmable:=reviewed and not (r->>'positionConfirmed')::boolean
   and r->'document'->'shop'->>'latitude' is not null and r->'document'->'shop'->>'longitude' is not null;
 else
  kind:='not_imported'; blockers:=jsonb_build_array(coalesce(o.reason,'Finish or correct the private import before publication review.'));
 end if;
 result:=jsonb_build_object('importId',o.id,'rowId',o.row_id,'targetId',o.target_id,
  'name',coalesce(r->'document'->'shop'->>'name',o.preview->>'name',o.row_id),
  'slug',r->'document'->'shop'->>'slug','kind',kind,'importStatus',o.status,
  'reviewKey',k,'revision',r->>'revision','positionConfirmed',coalesce((r->>'positionConfirmed')::boolean,false),
  'coordinates',jsonb_build_object('latitude',r->'document'->'shop'->'latitude','longitude',r->'document'->'shop'->'longitude','address',r->'document'->'shop'->'address_line_1'),
  'blockers',blockers,'conflict',conflict or (p.id is not null and p.status<>'published' and not reviewed),
  'reviewed',coalesce(reviewed,false),'canReview',reviewable,'canConfirm',coalesce(confirmable,false),
  'canPublish',coalesce(reviewed and blockers='[]'::jsonb and kind<>'already_published' and r->>'publicationStatus'<>'archived',false),
  'publication',case when p.id is not null then to_jsonb(p)-'initial_review_key'-'batch_id'-'import_id' else null end);
 if p_detail then result:=result||jsonb_build_object('options',public.admin_shop_options(),'record',r,'publicDocument',case when r->>'publicationStatus'='published' then d else null end); end if;
 return result;
end; $$;
revoke all on function public.import_publication_state(uuid,boolean) from public,anon,authenticated,service_role;

create function public.admin_import_publication_read(p_batch uuid,p_offset integer default 0,p_import uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; n integer;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.import_batches where id=p_batch and owner_id=auth.uid() and expires_at>statement_timestamp()) then
  raise exception 'Batch unavailable' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>499 then raise exception 'Invalid offset' using errcode='22023'; end if;
 if p_import is not null then
  if not exists(select 1 from public.import_operations where id=p_import and batch_id=p_batch) then raise exception 'Import row unavailable' using errcode='22023'; end if;
  return public.import_publication_state(p_import,true);
 end if;
 select coalesce(jsonb_agg(public.import_publication_state(x.id) order by x.row_id),'[]') into rows from (
  select distinct on(row_id) id,row_id from public.import_operations where batch_id=p_batch
  order by row_id,operation_revision desc offset p_offset limit 25) x;
 select count(distinct row_id) into n from public.import_operations where batch_id=p_batch;
 return jsonb_build_object('rows',rows,'nextOffset',case when p_offset+25<n then p_offset+25 else null end);
end; $$;
revoke all on function public.admin_import_publication_read(uuid,integer,uuid) from public,anon,service_role;
grant execute on function public.admin_import_publication_read(uuid,integer,uuid) to authenticated;

-- One selected row per request/transaction: successful rows survive failures.
-- Lock order matches C2: live role, batch, import, publication, shop.
create function public.admin_import_publication(p_action text,p_batch uuid,p_import uuid,p_operation uuid,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.import_batches; o public.import_operations; p public.import_publications; latest public.import_publications;
 state jsonb; r jsonb; k text; n integer;
begin
 perform 1 from public.profiles where id=auth.uid() and role='admin' for share;
 if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
 if p_action is null or p_action not in ('review','confirm_position','publish') or p_batch is null or p_import is null or p_operation is null
  or p_payload is null or octet_length(p_payload::text)>4096 then raise exception 'Invalid publication operation' using errcode='22023'; end if;
 perform public.check_edit_object(p_payload,case when p_action='review' then '{"reviewKey":"text","previousOperation":"uuid"}'::jsonb else '{}'::jsonb end,
  case when p_action='review' then array['reviewKey'] else array[]::text[] end);
 select * into b from public.import_batches where id=p_batch for update;
 if not found or b.owner_id<>auth.uid() or b.expires_at<=statement_timestamp() then raise exception 'Batch unavailable' using errcode='42501'; end if;
 select * into o from public.import_operations where id=p_import and batch_id=p_batch for update;
 if not found or o.status<>'imported' then raise exception 'Import row unavailable' using errcode='22023'; end if;
 select * into p from public.import_publications where id=p_operation for update;
 if p.id is not null and (p.batch_id<>p_batch or p.import_id<>p_import) then raise exception 'Operation conflict' using errcode='40001'; end if;
 select * into latest from public.import_publications where import_id=p_import order by operation_revision desc limit 1;
 if p_action='review' and p.id is not null then
  if p.initial_review_key is distinct from p_payload->>'reviewKey' then raise exception 'Operation conflict' using errcode='40001'; end if;
  return public.import_publication_state(p_import);
 end if;
 if p_action<>'review' then
  if p.id is null then raise exception 'Operation unavailable' using errcode='22023'; end if;
  -- Replay is authorized, but never repeats a publication/confirmation or old review.
  if p.status='published' or p.id<>latest.id then return public.import_publication_state(p_import); end if;
 end if;
 perform 1 from public.shops where id=o.target_id for update;
 state:=public.import_publication_state(p_import,true);
 if p_action='review' then
  if latest.id is distinct from (p_payload->>'previousOperation')::uuid or not (state->>'canReview')::boolean
   or state->>'reviewKey' is distinct from p_payload->>'reviewKey' then raise exception 'Review changed' using errcode='40001'; end if;
  n:=coalesce(latest.operation_revision,0)+1;
  insert into public.import_publications(id,import_id,batch_id,operation_revision,expected_revision,review_key,initial_review_key,position_confirmed,status)
  values(p_operation,p_import,p_batch,n,state->>'revision',state->>'reviewKey',state->>'reviewKey',(state->>'positionConfirmed')::boolean,'reviewed');
 else
  if p.status='conflicted' then return public.import_publication_state(p_import); end if;
  begin
   if not (state->>'reviewed')::boolean then raise exception 'Review changed' using errcode='40001'; end if;
   if p_action='confirm_position' then
    if p.position_confirmed then return public.import_publication_state(p_import); end if;
    r:=public.admin_shop_write('confirm_position',o.target_id,p.expected_revision);
    k:=public.import_review_key(o.target_id,r->>'revision',r->'document');
    update public.import_publications set expected_revision=r->>'revision',review_key=k,position_confirmed=true,status='reviewed',reason=null where id=p.id;
   else
    r:=public.admin_shop_write('publish',o.target_id,p.expected_revision);
    if r->>'code'='publication_incomplete' then
     update public.import_publications set status='failed',reason='Publication requirements are incomplete. Check the blockers, correct and review again.' where id=p.id;
    else
     update public.import_publications set status='published',result_revision=r->>'revision',published_at=statement_timestamp(),reason=null where id=p.id;
    end if;
   end if;
  exception when sqlstate '40001' or unique_violation then
   update public.import_publications set status='conflicted',reason='Saved or public state changed. Review again.' where id=p.id;
  when sqlstate '22023' or check_violation or foreign_key_violation or sqlstate 'P0002' then
   update public.import_publications set status='failed',reason='The row could not be published or confirmed. Check its requirements and retry or review again.' where id=p.id;
  end;
 end if;
 return public.import_publication_state(p_import);
end; $$;
revoke all on function public.admin_import_publication(text,uuid,uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.admin_import_publication(text,uuid,uuid,uuid,jsonb) to authenticated;
commit;
