-- #112: reciprocal private drafts and independently published directions.
-- No hosted backfill. Empty legacy documents retain their original fingerprints.
begin;
alter table public.shop_working_copies add column related_removed jsonb not null default '{}'::jsonb;
create table public.shop_relationships (
 shop_id uuid not null references public.shops(id) on delete restrict,
 related_shop_id uuid not null references public.shops(id) on delete restrict,
 kind text not null check(kind in ('branch','related')),
 show_public boolean not null default false,
 primary key(shop_id,related_shop_id),
 check(shop_id<>related_shop_id)
);
create index shop_relationships_target on public.shop_relationships(related_shop_id);
alter table public.shop_relationships enable row level security;
alter table public.shop_relationships force row level security;
revoke all on public.shop_relationships from public,anon,authenticated,service_role;
alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links',
      'shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads','shop_images','stamps','stamp_artwork_versions','brands','specialties','localities','shop_types','shop_relationships')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);
create trigger catalogue_audit after insert or update or delete on public.shop_relationships
 for each row execute function public.audit_catalogue_change();
create trigger catalogue_no_truncate before truncate on public.shop_relationships
 for each statement execute function public.reject_catalogue_truncate();

create function public.shop_related_document(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('shop_id',related_shop_id,'kind',kind,'show_public',show_public) order by related_shop_id),'[]')
 from public.shop_relationships where shop_id=p_id;
$$;
revoke all on function public.shop_related_document(uuid) from public,anon,authenticated,service_role;

-- Match the deployed public detail adapter: the existing nearby RPC's first five,
-- remove self/permanently closed, then keep four. No second distance threshold.
create function public.shop_nearby_ids(p_id uuid)
returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg((v->>'id')::uuid order by ord),'{}'::uuid[]) from (
  select v,ord from public.shops s,
  lateral jsonb_array_elements(case when s.location is null then '[]'::jsonb else
   public.nearby_shops(extensions.st_y(s.location),extensions.st_x(s.location),5000,5)->'shops' end)
   with ordinality as items(v,ord)
  where s.id=p_id and v->>'id'<>p_id::text and v->>'operationalStatus'<>'permanently_closed'
  order by ord limit 4
 ) displayed;
$$;
revoke all on function public.shop_nearby_ids(uuid) from public,anon,authenticated,service_role;

alter function public.shop_edit_document(uuid) rename to shop_edit_document_before_related;
revoke all on function public.shop_edit_document_before_related(uuid) from public,anon,authenticated,service_role;
create function public.shop_edit_document(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select public.shop_edit_document_before_related(p_id) || case when r='[]'::jsonb then '{}'::jsonb else jsonb_build_object('related_shops',r) end
 from (select public.shop_related_document(p_id) r) q;
$$;
revoke all on function public.shop_edit_document(uuid) from public,anon,authenticated,service_role;

alter function public.validate_shop_document(uuid,jsonb) rename to validate_shop_document_before_related;
revoke all on function public.validate_shop_document_before_related(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.validate_shop_document(p_id uuid,d jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 if d is null or octet_length(d::text)>131072 then raise exception 'Invalid related shops' using errcode='22023'; end if;
 perform public.validate_shop_document_before_related(p_id,d-'related_shops');
 if not d ? 'related_shops' then return; end if;
 if jsonb_typeof(d->'related_shops') is distinct from 'array' or jsonb_array_length(d->'related_shops')>100 then
  raise exception 'Invalid related shops' using errcode='22023'; end if;
 for r in select value from jsonb_array_elements(d->'related_shops') loop
  perform public.check_edit_object(r,'{"shop_id":"uuid","kind":"text","show_public":"boolean"}',array['shop_id','kind','show_public']);
  if r->>'kind' not in ('branch','related') or (r->>'shop_id')::uuid=p_id
   or not exists(select 1 from public.shops where id=(r->>'shop_id')::uuid) then
   raise exception 'Invalid related shops' using errcode='22023'; end if;
 end loop;
 if (select count(*)<>count(distinct (value->>'shop_id')::uuid) from jsonb_array_elements(d->'related_shops')) then
  raise exception 'Invalid related shops' using errcode='22023'; end if;
end; $$;
revoke all on function public.validate_shop_document(uuid,jsonb) from public,anon,authenticated,service_role;

-- Reconciliation can consume the counterpart's entire private delta. Retain
-- real edits, confirmation changes, removal choices and canonical conflicts.
-- Callers hold the shop/working-copy locks and the relationship writer lock.
create function public.prune_reconciled_related_copy(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare base jsonb;
begin
 base:=public.shop_edit_document(p_id);
 delete from public.shop_working_copies w using public.shops s
 where w.shop_id=p_id and s.id=w.shop_id
  and w.base_fingerprint=md5(base::text)
  and w.document-'related_shops'=base-'related_shops'
  and coalesce(w.document->'related_shops','[]')=coalesce(base->'related_shops','[]')
  and w.position_confirmation is not distinct from s.position_confirmation
  and w.related_removed='{}'::jsonb;
end; $$;
revoke all on function public.prune_reconciled_related_copy(uuid) from public,anon,authenticated,service_role;

-- Change only the reciprocal row in the other shop's saved document. Its public
-- listing and all unrelated private content remain intact. Bump its revision so
-- stale editors/imports/review receipts cannot silently undo the relationship.
create function public.sync_related_private(p_id uuid,p_before jsonb,p_after jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; prior jsonb; next_row jsonb; d jsonb; base jsonb; w public.shop_working_copies; items jsonb; backlink jsonb; removed jsonb;
begin
 for target in select distinct (value->>'shop_id')::uuid from jsonb_array_elements(p_before||p_after) order by 1 loop
  select value into prior from jsonb_array_elements(p_before) where (value->>'shop_id')::uuid=target;
  select value into next_row from jsonb_array_elements(p_after) where (value->>'shop_id')::uuid=target;
  -- Per-side visibility is not a shared edit.
  if prior->>'kind' is not distinct from next_row->>'kind' then continue; end if;
  perform 1 from public.shops where id=target for update;
  base:=public.shop_edit_document(target);
  select * into w from public.shop_working_copies where shop_id=target for update;
  if w.shop_id is not null and w.base_fingerprint<>md5(base::text) then raise exception 'Revision conflict' using errcode='40001'; end if;
  d:=coalesce(w.document,base);
  removed:=coalesce(w.related_removed,'{}');
  select value into backlink from jsonb_array_elements(coalesce(d->'related_shops','[]')) where value->>'shop_id'=p_id::text;
  select coalesce(jsonb_agg(value order by value->>'shop_id'),'[]') into items
   from jsonb_array_elements(coalesce(d->'related_shops','[]')) where value->>'shop_id'<>p_id::text;
  if next_row is null and backlink is not null then removed:=removed||jsonb_build_object(p_id::text,backlink); end if;
  if next_row is not null then
   backlink:=coalesce(backlink,removed->p_id::text);
   removed:=removed-p_id::text;
   if jsonb_array_length(items)>=100 then raise exception 'Invalid related shops' using errcode='22023'; end if;
   items:=items||jsonb_build_array(jsonb_build_object('shop_id',p_id,'kind',next_row->>'kind','show_public',coalesce((backlink->>'show_public')::boolean,false)));
  end if;
  select coalesce(jsonb_agg(value order by value->>'shop_id'),'[]') into items from jsonb_array_elements(items);
  d:=jsonb_set(d,'{related_shops}',items);
  insert into public.shop_working_copies(shop_id,document,base_fingerprint,related_removed,position_confirmation)
   values(target,d,md5(base::text),removed,case when w.shop_id is not null then w.position_confirmation else (select position_confirmation from public.shops where id=target) end)
   on conflict(shop_id) do update set document=excluded.document,related_removed=excluded.related_removed,revision=gen_random_uuid(),updated_at=statement_timestamp();
  perform public.prune_reconciled_related_copy(target);
 end loop;
end; $$;
revoke all on function public.sync_related_private(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

alter function public.apply_shop_document(uuid,jsonb) rename to apply_shop_document_before_related;
revoke all on function public.apply_shop_document_before_related(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.apply_shop_document(p_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; next_row jsonb; before_rows jsonb; after_rows jsonb; base jsonb; w public.shop_working_copies; items jsonb;
begin
 before_rows:=public.shop_related_document(p_id);
 after_rows:=coalesce(p_document->'related_shops',before_rows);
 perform public.apply_shop_document_before_related(p_id,p_document-'related_shops');
 for target in select (value->>'shop_id')::uuid from jsonb_array_elements(before_rows||after_rows)
  union select key::uuid from public.shop_working_copies wc,lateral jsonb_each(wc.related_removed) where wc.shop_id=p_id order by 1 loop
  perform 1 from public.shops where id=target for update;
  base:=public.shop_edit_document(target);
  select * into w from public.shop_working_copies where shop_id=target for update;
  if w.shop_id is not null and w.base_fingerprint<>md5(base::text) then raise exception 'Revision conflict' using errcode='40001'; end if;
  select value into next_row from jsonb_array_elements(after_rows) where (value->>'shop_id')::uuid=target;
  if next_row is null then
   delete from public.shop_relationships where (shop_id=p_id and related_shop_id=target) or (shop_id=target and related_shop_id=p_id);
  else
   insert into public.shop_relationships(shop_id,related_shop_id,kind,show_public)
    values(p_id,target,next_row->>'kind',(next_row->>'show_public')::boolean and not target=any(public.shop_nearby_ids(p_id)))
    on conflict(shop_id,related_shop_id) do update set kind=excluded.kind,show_public=excluded.show_public;
   insert into public.shop_relationships(shop_id,related_shop_id,kind,show_public)
    values(target,p_id,next_row->>'kind',false)
    on conflict(shop_id,related_shop_id) do update set kind=excluded.kind;
  end if;
  -- Publishing one side may update the shared label/remove the canonical pair.
  -- Rebase ONLY this known relationship delta; never absorb an existing conflict.
  if w.shop_id is not null then
   select coalesce(jsonb_agg(value order by value->>'shop_id'),'[]') into items
    from jsonb_array_elements(coalesce(w.document->'related_shops','[]')) where value->>'shop_id'<>p_id::text;
   if next_row is not null then
    items:=items||jsonb_build_array(jsonb_build_object('shop_id',p_id,'kind',next_row->>'kind','show_public',coalesce((
     select value->>'show_public' from jsonb_array_elements(coalesce(w.document->'related_shops','[]')) where value->>'shop_id'=p_id::text)::boolean,false)));
   end if;
   select coalesce(jsonb_agg(value order by value->>'shop_id'),'[]') into items from jsonb_array_elements(items);
   update public.shop_working_copies set document=jsonb_set(document,'{related_shops}',items),
    related_removed=case when next_row is null then related_removed-p_id::text else related_removed end,
    base_fingerprint=md5(public.shop_edit_document(target)::text),revision=gen_random_uuid(),updated_at=statement_timestamp() where shop_id=target;
   perform public.prune_reconciled_related_copy(target);
  end if;
 end loop;
end; $$;
revoke all on function public.apply_shop_document(uuid,jsonb) from public,anon,authenticated,service_role;

-- Nearby has priority and suppression is sticky: never automatically turn a
-- direction on again. Private selections are cleared as well as public flags.
create function public.suppress_nearby_relationships()
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; base jsonb; w public.shop_working_copies; ids uuid[]; items jsonb; removed jsonb;
begin
 for target in select shop_id from public.shop_relationships where show_public
  union select shop_id from public.shop_working_copies where document->'related_shops' @> '[{"show_public":true}]'
   or exists(select 1 from jsonb_each(related_removed) where value->>'show_public'='true') loop
  ids:=public.shop_nearby_ids(target);
  if cardinality(ids)=0 then continue; end if;
  perform 1 from public.shops where id=target for update;
  base:=public.shop_edit_document(target);
  select * into w from public.shop_working_copies where shop_id=target for update;
  update public.shop_relationships set show_public=false where shop_id=target and related_shop_id=any(ids) and show_public;
  if w.shop_id is not null then
   select coalesce(jsonb_agg(case when (value->>'shop_id')::uuid=any(ids) then jsonb_set(value,'{show_public}','false') else value end order by value->>'shop_id'),'[]') into items
    from jsonb_array_elements(coalesce(w.document->'related_shops','[]'));
   select coalesce(jsonb_object_agg(key,case when key::uuid=any(ids) then jsonb_set(value,'{show_public}','false') else value end),'{}') into removed
    from jsonb_each(w.related_removed);
   if items is distinct from coalesce(w.document->'related_shops','[]') or removed is distinct from w.related_removed or base is distinct from public.shop_edit_document(target) then
    update public.shop_working_copies set document=jsonb_set(document,'{related_shops}',items),
     related_removed=removed,
     base_fingerprint=case when w.base_fingerprint=md5(base::text) then md5(public.shop_edit_document(target)::text) else w.base_fingerprint end,
     revision=gen_random_uuid(),updated_at=statement_timestamp() where shop_id=target;
    perform public.prune_reconciled_related_copy(target);
   end if;
  end if;
 end loop;
end; $$;
revoke all on function public.suppress_nearby_relationships() from public,anon,authenticated,service_role;

alter function public.admin_shop_write(text,uuid,text,jsonb) rename to admin_shop_write_before_related;
revoke all on function public.admin_shop_write_before_related(text,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.admin_shop_write(p_action text,p_id uuid,p_revision text default null,p_document jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare before_doc jsonb; after_doc jsonb; result jsonb; removed jsonb; item jsonb; discarded_removed jsonb; target uuid;
begin
 perform 1 from public.profiles where id=auth.uid() and role in ('editor','admin') for share;
 if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
 -- Serialize two-sided catalogue mutations before taking the first shop lock.
 perform pg_catalog.pg_advisory_xact_lock(112,1);
 if p_action<>'create' then
  perform 1 from public.shops where id=p_id for update;
  before_doc:=coalesce((select document from public.shop_working_copies where shop_id=p_id),public.shop_edit_document(p_id));
  select related_removed into discarded_removed from public.shop_working_copies where shop_id=p_id;
 end if;
 -- Old clients/import files do not clear new relationships by omission.
 if p_action='save' and not p_document ? 'related_shops' and before_doc ? 'related_shops' then
  p_document:=p_document||jsonb_build_object('related_shops',before_doc->'related_shops');
 end if;
 result:=public.admin_shop_write_before_related(p_action,p_id,p_revision,p_document);
 if result ? 'code' then return result; end if;
 after_doc:=result->'document';
 if p_action='save' then
  select related_removed into removed from public.shop_working_copies where shop_id=p_id;
  removed:=coalesce(removed,'{}');
  for item in select value from jsonb_array_elements(coalesce(before_doc->'related_shops','[]')) loop
   if not exists(select 1 from jsonb_array_elements(coalesce(after_doc->'related_shops','[]')) r where r->>'shop_id'=item->>'shop_id') then
    removed:=removed||jsonb_build_object(item->>'shop_id',item);
   end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(after_doc->'related_shops','[]')) loop removed:=removed-(item->>'shop_id'); end loop;
  update public.shop_working_copies set related_removed=removed where shop_id=p_id and related_removed is distinct from removed;
 end if;
 if p_action in ('save','discard') then
  perform public.sync_related_private(p_id,coalesce(before_doc->'related_shops','[]'),coalesce(after_doc->'related_shops','[]'));
 end if;
 -- Discarding a never-published link completes its removal. A later addition
 -- must start with a hidden backlink, not inherit the abandoned private choice.
 if p_action='discard' then
  for target in select (value->>'shop_id')::uuid from jsonb_array_elements(coalesce(before_doc->'related_shops','[]'))
   union select key::uuid from jsonb_each(coalesce(discarded_removed,'{}')) loop
   if not exists(select 1 from jsonb_array_elements(coalesce(after_doc->'related_shops','[]')) r where r->>'shop_id'=target::text) then
    update public.shop_working_copies set related_removed=related_removed-p_id::text,revision=gen_random_uuid(),updated_at=statement_timestamp()
     where shop_id=target and related_removed ? p_id::text;
    perform public.prune_reconciled_related_copy(target);
   end if;
  end loop;
 end if;
 perform public.suppress_nearby_relationships();
 return public.admin_shop_read(p_id);
end; $$;
revoke all on function public.admin_shop_write(text,uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.admin_shop_write(text,uuid,text,jsonb) to authenticated;

-- Private context accompanies the saved document; never travels through a public
-- API. Search still uses the existing bounded admin_shop_list endpoint.
create function public.shop_related_context(p_id uuid,p_document jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('shops',coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug,
  'localityName',coalesce(l.name,s.city_display,s.country_code,''),'countryCode',coalesce(s.country_code,''),'publicationStatus',s.publication_status) order by s.id),'[]'),
  'nearbyIds',to_jsonb(public.shop_nearby_ids(p_id)))
 from public.shops s left join public.localities l on l.id=s.locality_id
 where s.id in(select (value->>'shop_id')::uuid from jsonb_array_elements(coalesce(p_document->'related_shops','[]')));
$$;
revoke all on function public.shop_related_context(uuid,jsonb) from public,anon,authenticated,service_role;
alter function public.admin_shop_read(uuid) rename to admin_shop_read_before_related;
revoke all on function public.admin_shop_read_before_related(uuid) from public,anon,authenticated,service_role;
create function public.admin_shop_read(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.admin_shop_read_before_related(p_id);
 return result||jsonb_build_object('relatedContext',public.shop_related_context(p_id,result->'document'));
end; $$;
revoke all on function public.admin_shop_read(uuid) from public,anon,service_role;
grant execute on function public.admin_shop_read(uuid) to authenticated;

alter function public.shop_detail(text) rename to shop_detail_before_related;
revoke all on function public.shop_detail_before_related(text) from public,anon,authenticated,service_role;
create function public.shop_detail(p_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
 select d||jsonb_build_object('relatedShops',coalesce((
  select jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name',s.name,'countryCode',s.country_code,
   'localityName',coalesce(l.name,s.city_display,s.country_code),'kind',r.kind) order by s.name,s.id)
  from public.shop_relationships r join public.shops s on s.id=r.related_shop_id
  left join public.localities l on l.id=s.locality_id
  where r.shop_id=(d->>'id')::uuid and r.show_public and s.publication_status='published'
   and not s.id=any(public.shop_nearby_ids((d->>'id')::uuid))
 ),'[]'::jsonb)) from (select public.shop_detail_before_related(p_slug) d) q where d is not null;
$$;
revoke all on function public.shop_detail(text) from public;
grant execute on function public.shop_detail(text) to anon,authenticated,service_role;
-- Serialize catalogue SQL statements before they take any shop/type row locks.
-- Reconcile their final transaction state, never an intermediate type replacement.
create function public.lock_related_catalogue_statement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(112,1);
 perform set_config('nibatlas.related_reconciled','false',true);
 return null;
end; $$;
create function public.reconcile_related_after_catalogue()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('nibatlas.related_reconciled',true) is distinct from 'true' then
  perform public.suppress_nearby_relationships();
  perform set_config('nibatlas.related_reconciled','true',true);
 end if;
 return null;
end; $$;
revoke all on function public.lock_related_catalogue_statement() from public,anon,authenticated,service_role;
revoke all on function public.reconcile_related_after_catalogue() from public,anon,authenticated,service_role;
create trigger related_catalogue_lock before insert or update or delete on public.shops
 for each statement execute function public.lock_related_catalogue_statement();
create trigger related_catalogue_lock before insert or update or delete on public.shop_shop_types
 for each statement execute function public.lock_related_catalogue_statement();
create constraint trigger related_nearby_refresh after insert or update or delete on public.shops
 deferrable initially deferred for each row execute function public.reconcile_related_after_catalogue();
create constraint trigger related_nearby_refresh after insert or update or delete on public.shop_shop_types
 deferrable initially deferred for each row execute function public.reconcile_related_after_catalogue();

create or replace function public.shop_review_operation(p_actor uuid,p_environment text,p_shop uuid,p_save jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; w public.shop_working_copies; r public.shop_reviews;
 d jsonb; record jsonb; media jsonb; stamps jsonb; key text; conflict boolean;
 choices jsonb; item jsonb; available_stamps jsonb; vocabulary jsonb; request_id uuid; previous_id uuid;
begin
 -- Same lock order as media/stamp writers: current role, shop, then dependent rows.
 perform 1 from public.profiles where id=p_actor and role in ('editor','admin') for update;
 if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(112,1);
 if p_environment is null or p_environment not in ('staging','production') or p_shop is null then
  raise exception 'Invalid review' using errcode='22023'; end if;
 select * into s from public.shops where id=p_shop for update;
 if not found or (p_environment='production' and s.source_quality='demo') then
  raise exception 'Shop not found' using errcode='P0002'; end if;
 if s.publication_status='archived' then raise exception 'Invalid review' using errcode='22023'; end if;
 select * into w from public.shop_working_copies where shop_id=p_shop;
 d:=public.shop_edit_document(p_shop);
 conflict:=w.shop_id is not null and w.base_fingerprint<>md5(d::text);
 -- Same saved-document projection as admin_shop_read, under the shared writer lock.
 record:=jsonb_build_object('id',p_shop,'publicationStatus',s.publication_status,
  'revision',coalesce(w.revision::text,md5(d::text)),'hasChanges',w.shop_id is not null,
  'positionConfirmed',public.shop_position_confirmed(p_shop,coalesce(w.document,d)),
  'document',coalesce(w.document,d),'publicationErrors',public.shop_publication_errors(p_shop,coalesce(w.document,d)));
 record:=record||jsonb_build_object('relatedContext',public.shop_related_context(p_shop,record->'document'));
 media:=public.shop_media_operation(p_actor,p_environment,p_shop,'list');
 stamps:=public.stamp_artwork_draft_operation(p_actor,p_environment,p_shop,'list');
 -- The legacy list retains versions from every environment for history. Only
 -- current-environment validated uploads can be selected for this review.
 select coalesce(jsonb_agg(v->'id' order by v->>'id'),'[]'::jsonb) into available_stamps
 from jsonb_array_elements(stamps) v join public.stamp_artwork_versions av on av.id=(v->>'id')::uuid
 where ((v->>'active')::boolean or (v->>'kind'='uploaded' and v->>'status'='draft' and (v->>'hasArtwork')::boolean))
 and (av.upload_id is null and av.artwork_kind<>'uploaded' or exists(
   select 1 from public.media_uploads u where u.id=av.upload_id and u.environment=p_environment
    and u.shop_id=p_shop and u.purpose='artwork_png' and u.artwork_version_id=av.id and u.status='validated'));
 -- Referenced labels/order also affect the public renderer. Unrelated choice
 -- creation does not invalidate a review; edits to its actual vocabulary do.
 select coalesce(jsonb_agg(v order by kind,id),'[]'::jsonb) into vocabulary from (
  select 'locality' kind,l.id,to_jsonb(l) v from public.localities l
   where l.id::text in(d#>>'{shop,locality_id}',record#>>'{document,shop,locality_id}')
  union all select 'type',t.id,to_jsonb(t) from public.shop_types t where exists(
   select 1 from jsonb_array_elements(coalesce(d->'types','[]'::jsonb)||coalesce(record#>'{document,types}','[]'::jsonb)) x
    where x->>'shop_type_id'=t.id::text)
  union all select 'service',t.id,to_jsonb(t) from public.services t where exists(
   select 1 from jsonb_array_elements(coalesce(d->'services','[]'::jsonb)||coalesce(record#>'{document,services}','[]'::jsonb)) x
    where x->>'service_id'=t.id::text)
  union all select 'specialty',t.id,to_jsonb(t) from public.specialties t where exists(
   select 1 from jsonb_array_elements(coalesce(d->'specialties','[]'::jsonb)||coalesce(record#>'{document,specialties}','[]'::jsonb)) x
    where x->>'specialty_id'=t.id::text)
  union all select 'brand',t.id,to_jsonb(t) from public.brands t where exists(
   select 1 from jsonb_array_elements(coalesce(d->'brands','[]'::jsonb)||coalesce(record#>'{document,brands}','[]'::jsonb)) x
    where x->>'brand_id'=t.id::text)
 ) refs;
 -- Bind private AND canonical state, all gallery metadata/membership/order,
 -- every retained artwork revision/credit and the active design, plus environment.
 -- Provider keys never leave SQL. The client preview hash is not accepted here.
 key:=encode(extensions.digest(jsonb_build_array('shop-review-v1',p_environment,record,d,
  to_jsonb(s),to_jsonb(w),media,stamps,available_stamps,vocabulary)::text,'sha256'),'hex');
 select * into r from public.shop_reviews where actor_id=p_actor and shop_id=p_shop and environment=p_environment;
 if p_save is not null then
  if jsonb_typeof(p_save)<>'object' or octet_length(p_save::text)>8192
   or p_save-array['id','previousId','reviewKey','choices']<>'{}'::jsonb
   or not p_save ?& array['id','previousId','reviewKey','choices']
   or jsonb_typeof(p_save->'id') is distinct from 'string'
   or p_save->>'id' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(p_save->'previousId') not in ('null','string')
   or (p_save->>'previousId' is not null and p_save->>'previousId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
   or jsonb_typeof(p_save->'reviewKey') is distinct from 'string'
   or p_save->>'reviewKey' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid review' using errcode='22023'; end if;
  choices:=p_save->'choices';
  if jsonb_typeof(choices) is distinct from 'object' or choices-array['photos','logo','stamp']<>'{}'::jsonb
   or not choices ?& array['photos','logo','stamp']
   or jsonb_typeof(choices->'photos') is distinct from 'array'
   or jsonb_typeof(choices->'logo') not in ('null','string')
   or jsonb_typeof(choices->'stamp') not in ('null','string') then raise exception 'Invalid review' using errcode='22023'; end if;
  if jsonb_array_length(choices->'photos')>50
   or (select count(distinct value) from jsonb_array_elements(choices->'photos'))<>jsonb_array_length(choices->'photos') then
   raise exception 'Invalid review' using errcode='22023'; end if;
  request_id:=(p_save->>'id')::uuid; previous_id:=(p_save->>'previousId')::uuid;
  -- A lost response may be replayed, but never revives an old/stale review.
  if r.id=request_id then
   if r.review_key is distinct from p_save->>'reviewKey' or r.choices is distinct from choices then
    raise exception 'Review conflict' using errcode='40001'; end if;
  else
   if conflict or key is distinct from p_save->>'reviewKey' or r.id is distinct from previous_id then
    raise exception 'Review conflict' using errcode='40001'; end if;
   for item in select value from jsonb_array_elements(choices->'photos') loop
    if jsonb_typeof(item)<>'string' or not exists(select 1 from jsonb_array_elements(media) m
      where m->>'id'=item#>>'{}' and m->>'kind'='photo' and m->>'status'<>'rejected') then
     raise exception 'Invalid review' using errcode='22023'; end if;
   end loop;
   if choices->>'logo' is not null and not exists(select 1 from jsonb_array_elements(media) m
     where m->>'id'=choices->>'logo' and m->>'kind'='logo' and m->>'status'<>'rejected') then
    raise exception 'Invalid review' using errcode='22023'; end if;
   if choices->>'stamp' is not null and not available_stamps ? (choices->>'stamp') then
    raise exception 'Invalid review' using errcode='22023'; end if;
   -- Retained request IDs cannot be reused after another review supersedes them.
   if exists(select 1 from public.shop_review_events where id=request_id) then
    raise exception 'Review conflict' using errcode='40001'; end if;
   insert into public.shop_reviews(actor_id,shop_id,environment,id,review_key,choices)
    values(p_actor,p_shop,p_environment,request_id,key,choices)
    on conflict(actor_id,shop_id,environment) do update
     set id=excluded.id,review_key=excluded.review_key,choices=excluded.choices,reviewed_at=statement_timestamp()
    returning * into r;
   insert into public.shop_review_events(id,actor_id,shop_id,environment,review_key,choices_hash)
    values(request_id,p_actor,p_shop,p_environment,key,encode(extensions.digest(choices::text,'sha256'),'hex'));
  end if;
 end if;
 return jsonb_build_object('record',record,'media',media,'stamps',stamps,'availableStampIds',available_stamps,'reviewKey',key,'conflict',conflict,
  'review',case when r.id is null then null else jsonb_build_object('id',r.id,'choices',r.choices,
   'reviewedAt',r.reviewed_at,'current',r.review_key=key and not conflict) end);
end; $$;

-- These existing outer writers lock shops before calling admin_shop_write.
-- Insert the same advisory lock immediately after their existing live-role lock.
-- Guard the exact insertion point so a changed upstream definition fails closed.
do $locks$
declare signature text; definition text;
 marker constant text := 'if not found then raise exception ''Admin access denied'' using errcode=''42501''; end if;';
begin
 foreach signature in array array[
  'public.admin_import_operation(text,uuid,uuid,jsonb)',
  'public.admin_import_publication(text,uuid,uuid,uuid,jsonb)',
  'public.shop_publication_operation(uuid,text,uuid,text,uuid)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if length(definition)-length(replace(definition,marker,''))<>length(marker) then
   raise exception 'Unexpected catalogue writer definition: %',signature;
  end if;
  execute replace(definition,marker,marker||E'\n perform pg_catalog.pg_advisory_xact_lock(112,1);');
 end loop;
end; $locks$;
commit;
