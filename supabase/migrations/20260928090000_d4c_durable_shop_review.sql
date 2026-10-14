-- D4c: private owner-scoped review only. No publication writer consumes this receipt.
begin;
create table public.shop_reviews (
 actor_id uuid not null references public.profiles(id),
 shop_id uuid not null references public.shops(id),
 environment text not null check(environment in ('staging','production')),
 id uuid not null unique,
 review_key text not null check(review_key ~ '^[a-f0-9]{64}$'),
 choices jsonb not null check(jsonb_typeof(choices)='object' and octet_length(choices::text)<=4096),
 reviewed_at timestamptz not null default statement_timestamp(),
 primary key(actor_id,shop_id,environment)
);
alter table public.shop_reviews enable row level security;
alter table public.shop_reviews force row level security;
revoke all on public.shop_reviews from public,anon,authenticated,service_role;

-- Audit contains fingerprints, never documents, captions, coordinates or credits.
create table public.shop_review_events (
 id uuid primary key,
 actor_id uuid not null,
 shop_id uuid not null,
 environment text not null check(environment in ('staging','production')),
 review_key text not null check(review_key ~ '^[a-f0-9]{64}$'),
 choices_hash text not null check(choices_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default statement_timestamp()
);
alter table public.shop_review_events enable row level security;
alter table public.shop_review_events force row level security;
revoke all on public.shop_review_events from public,anon,authenticated,service_role;
create trigger shop_review_events_immutable before update or delete on public.shop_review_events
 for each row execute function public.reject_audit_mutation();
create trigger shop_review_events_no_truncate before truncate on public.shop_review_events
 for each statement execute function public.reject_audit_mutation();

create function public.shop_review_operation(p_actor uuid,p_environment text,p_shop uuid,p_save jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shops; w public.shop_working_copies; r public.shop_reviews;
 d jsonb; record jsonb; media jsonb; stamps jsonb; key text; conflict boolean;
 choices jsonb; item jsonb; available_stamps jsonb; vocabulary jsonb; request_id uuid; previous_id uuid;
begin
 -- Same lock order as media/stamp writers: current role, shop, then dependent rows.
 perform 1 from public.profiles where id=p_actor and role in ('editor','admin') for update;
 if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
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
revoke all on function public.shop_review_operation(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.shop_review_operation(uuid,text,uuid,jsonb) to service_role;
commit;
