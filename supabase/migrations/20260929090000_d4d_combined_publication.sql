-- D4d: one deliberately selected review, durable component outcomes and guarded retry.
begin;
create table public.shop_publications (
 review_id uuid primary key references public.shop_review_events(id),
 actor_id uuid not null references public.profiles(id),
 shop_id uuid not null references public.shops(id),
 environment text not null check(environment in ('staging','production')),
 expected_key text not null check(expected_key ~ '^[a-f0-9]{64}$'),
 outcomes jsonb not null check(jsonb_typeof(outcomes)='array'),
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp()
);
create index shop_publications_owner on public.shop_publications(actor_id,shop_id,environment,created_at desc);
alter table public.shop_publications enable row level security;
alter table public.shop_publications force row level security;
revoke all on public.shop_publications from public,anon,authenticated,service_role;
create table public.shop_publication_events (
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.shop_publications(review_id),
 actor_id uuid not null,
 outcomes jsonb not null,
 created_at timestamptz not null default statement_timestamp()
);
alter table public.shop_publication_events enable row level security;
alter table public.shop_publication_events force row level security;
revoke all on public.shop_publication_events from public,anon,authenticated,service_role;
create trigger shop_publication_events_immutable before update or delete on public.shop_publication_events
 for each row execute function public.reject_audit_mutation();
create trigger shop_publication_events_no_truncate before truncate on public.shop_publication_events
 for each statement execute function public.reject_audit_mutation();

-- Service-only, like media/review. Actor and environment come from the verified
-- cookie and Worker, never from a browser-supplied identity or environment.
create function public.shop_publication_operation(p_actor uuid,p_environment text,p_shop uuid,p_action text default 'read',p_review uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.shop_reviews; p public.shop_publications; state jsonb; after_state jsonb;
 publication_outcomes jsonb; item jsonb; media jsonb; art jsonb; result jsonb; reason text;
 old_claims text; old_sub text; failed boolean; succeeded boolean; fresh boolean:=false;
 core_ok boolean; target uuid; i integer;
begin
 perform 1 from public.profiles where id=p_actor and role='admin' for update;
 if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
 if p_environment is null or p_environment not in ('staging','production') or p_shop is null
  or p_action is null or p_action not in ('read','publish','retry')
  or (p_action='read' and p_review is not null) or (p_action<>'read' and p_review is null) then
  raise exception 'Invalid publication' using errcode='22023'; end if;
 perform 1 from public.shops where id=p_shop and (p_environment<>'production' or source_quality<>'demo') for update;
 if not found then raise exception 'Shop not found' using errcode='P0002'; end if;
 select * into r from public.shop_reviews where actor_id=p_actor and shop_id=p_shop and environment=p_environment;
 if p_action='read' then
  select * into p from public.shop_publications where actor_id=p_actor and shop_id=p_shop and environment=p_environment
   order by created_at desc,review_id desc limit 1;
 else
  select * into p from public.shop_publications where review_id=p_review;
  if p.review_id is not null and (p.actor_id<>p_actor or p.shop_id<>p_shop or p.environment<>p_environment) then
   raise exception 'Review conflict' using errcode='40001'; end if;
 end if;
 if p_action='read' and p.review_id is null then return jsonb_build_object('publication',null); end if;
 -- An archived shop still exposes the durable outcome, but cannot be retried.
 begin state:=public.shop_review_operation(p_actor,p_environment,p_shop);
 exception when sqlstate '22023' or sqlstate 'P0002' then state:=null;
 end;
 fresh:=coalesce(r.id=p.review_id and state->>'reviewKey'=p.expected_key and not (state->>'conflict')::boolean,false);
 if p_action='publish' and p.review_id is null then
  if r.id is distinct from p_review or state is null or not coalesce((state->'review'->>'current')::boolean,false) then
   raise exception 'Review conflict' using errcode='40001'; end if;
  -- Position confirmation is never inferred or performed by this executor.
  if not coalesce((state->'record'->>'positionConfirmed')::boolean,false) then
   raise exception 'Confirm position before review' using errcode='22023'; end if;
  publication_outcomes:=jsonb_build_array(jsonb_build_object('kind','shop','targetId',p_shop,'status','pending','reason',null),
   jsonb_build_object('kind','stamp','targetId',r.choices->'stamp','status','pending','reason',null));
  for item in select value from jsonb_array_elements(state->'media')
    where value->>'kind'='photo' and r.choices->'photos' ? (value->>'id') loop
   publication_outcomes:=publication_outcomes||jsonb_build_array(jsonb_build_object('kind','photo','targetId',item->'id','status','pending','reason',null));
  end loop;
  publication_outcomes:=publication_outcomes||jsonb_build_array(jsonb_build_object('kind','logo','targetId',r.choices->'logo','status','pending','reason',null));
  insert into public.shop_publications(review_id,actor_id,shop_id,environment,expected_key,outcomes)
   values(p_review,p_actor,p_shop,p_environment,state->>'reviewKey',publication_outcomes) returning * into p;
  fresh:=true;
 elsif p_action='retry' then
  if p.review_id is null or not fresh then raise exception 'Review conflict' using errcode='40001'; end if;
 end if;
 -- Publishing the same receipt again only reads its outcome. Retrying failures
 -- is a separate deliberate action, and successes are never executed twice.
 if (p_action='publish' and p.outcomes->0->>'status'='pending') or (p_action='retry' and exists(select 1 from jsonb_array_elements(p.outcomes) x where x->>'status'<>'succeeded')) then
  publication_outcomes:=p.outcomes;
  -- Preserve the existing catalogue writer and its authenticated audit identity.
  -- Only this service-only boundary may establish the already verified actor.
  old_claims:=current_setting('request.jwt.claims',true); old_sub:=current_setting('request.jwt.claim.sub',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  core_ok:=publication_outcomes->0->>'status'='succeeded';
  if not core_ok then
   begin
    target:=(r.choices->>'stamp')::uuid;
    if target is not null then
     select value into art from jsonb_array_elements(state->'stamps') where value->>'id'=target::text;
     if art is null or not (state->'availableStampIds' ? target::text) then raise exception 'Invalid artwork' using errcode='22023'; end if;
     if not (art->>'active')::boolean then
      perform public.stamp_artwork_draft_operation(p_actor,p_environment,p_shop,'activate',
       jsonb_build_object('versionId',target,'revision',art->>'revision'));
     end if;
    end if;
    -- Shop and stamp form one core subtransaction: failed shop publication
    -- cannot leave a newly activated design behind.
    if state->'record'->>'publicationStatus'<>'published' or (state->'record'->>'hasChanges')::boolean then
     result:=public.admin_shop_write('publish',p_shop,state->'record'->>'revision');
     if result->>'code'='publication_incomplete' then raise exception 'Incomplete shop' using errcode='22023'; end if;
    elsif jsonb_array_length(public.shop_publication_errors(p_shop,public.shop_edit_document(p_shop)))>0 then
     raise exception 'Incomplete shop' using errcode='22023';
    end if;
    core_ok:=true;
    publication_outcomes:=jsonb_set(jsonb_set(publication_outcomes,'{0,status}','"succeeded"'),'{1,status}','"succeeded"');
    publication_outcomes:=jsonb_set(jsonb_set(publication_outcomes,'{0,reason}','null'),'{1,reason}','null');
   exception when others then
    -- Subtransaction rollback includes canonical writes, artwork and their audit.
    -- SQL/provider messages never enter the ledger or response.
    reason:=case when sqlstate in ('40001','23505') then 'review_again'
      when sqlstate in ('22023','23514','23503','P0002') then 'requirements' else 'unavailable' end;
    publication_outcomes:=jsonb_set(jsonb_set(publication_outcomes,'{0,status}','"failed"'),'{1,status}','"failed"');
    publication_outcomes:=jsonb_set(jsonb_set(publication_outcomes,'{0,reason}',to_jsonb(reason)),'{1,reason}',to_jsonb(reason));
   end;
  end if;
  if core_ok then
   for i in 2..jsonb_array_length(publication_outcomes)-1 loop
    item:=publication_outcomes->i;
    if item->>'status'='succeeded' then continue; end if;
    begin
     -- Re-read only inside the held shop lock. The reviewed snapshot was
     -- checked before any writes; these changes are this executor's own.
     media:=public.shop_media_operation(p_actor,p_environment,p_shop,'list');
     target:=(item->>'targetId')::uuid;
     if item->>'kind'='logo' and target is null then
      -- D4c null is no selection, never an instruction to hide public content.
      null;
     else
      select value into result from jsonb_array_elements(media) where value->>'id'=target::text;
      if result is null then raise exception 'Media not found' using errcode='P0002'; end if;
      if result->>'status'<>'approved' then
       perform public.shop_media_operation(p_actor,p_environment,p_shop,'publish',target,result->>'revision');
      end if;
     end if;
     publication_outcomes:=jsonb_set(jsonb_set(publication_outcomes,array[i::text,'status'],'"succeeded"'),array[i::text,'reason'],'null');
    exception when others then
     reason:=case when sqlstate in ('40001','23505') then 'review_again'
       when sqlstate in ('22023','23514','23503','P0002') then 'requirements' else 'unavailable' end;
     publication_outcomes:=jsonb_set(jsonb_set(publication_outcomes,array[i::text,'status'],'"failed"'),array[i::text,'reason'],to_jsonb(reason));
    end;
   end loop;
  end if;
  perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  after_state:=public.shop_review_operation(p_actor,p_environment,p_shop);
  update public.shop_publications set expected_key=after_state->>'reviewKey',outcomes=publication_outcomes,updated_at=statement_timestamp()
   where review_id=p.review_id returning * into p;
  -- Ledger/audit failure aborts the entire RPC, including every successful part.
  insert into public.shop_publication_events(review_id,actor_id,outcomes) values(p.review_id,p_actor,publication_outcomes);
  fresh:=true;
 end if;
 failed:=exists(select 1 from jsonb_array_elements(p.outcomes) x where x->>'status'<>'succeeded');
 succeeded:=exists(select 1 from jsonb_array_elements(p.outcomes) x where x->>'status'='succeeded');
 return jsonb_build_object('publication',jsonb_build_object('reviewId',p.review_id,
  'status',case when not failed then 'complete' when succeeded then 'partial' else 'failed' end,
  'outcomes',p.outcomes,'canRetry',failed and fresh,'updatedAt',p.updated_at));
end; $$;
revoke all on function public.shop_publication_operation(uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.shop_publication_operation(uuid,text,uuid,text,uuid) to service_role;
commit;
