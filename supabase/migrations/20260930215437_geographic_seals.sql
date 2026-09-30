-- Geographic seals: private drafts, immutable publication/award snapshots, no hosted seed.
begin;
create table public.geographic_seals (
 id uuid primary key default gen_random_uuid(),
 scope text not null check(scope in ('country','locality')),
 country_code text not null check(country_code ~ '^[A-Z]{2}$'),
 locality_id uuid references public.localities(id) on delete restrict,
 draft jsonb not null,
 revision uuid not null default gen_random_uuid(),
 published_version integer,
 published boolean not null default false,
 check((scope='locality')=(locality_id is not null)),
 check(not published or published_version is not null),
 unique nulls not distinct(scope,country_code,locality_id)
);
create table public.geographic_seal_versions (
 id uuid primary key default gen_random_uuid(),
 seal_id uuid not null references public.geographic_seals(id) on delete restrict,
 version integer not null check(version>0),
 snapshot jsonb not null,
 unique(seal_id,version)
);
alter table public.geographic_seals add foreign key(id,published_version)
 references public.geographic_seal_versions(seal_id,version);
create table public.geographic_seal_awards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 seal_id uuid not null,
 version integer not null,
 collection_id uuid not null references public.stamp_collections(id) on delete cascade,
 awarded_at timestamptz not null default now(),
 foreign key(seal_id,version) references public.geographic_seal_versions(seal_id,version),
 unique(user_id,seal_id)
);
create table public.geographic_seal_receipts (
 award_id uuid primary key references public.geographic_seal_awards(id) on delete cascade,
 acknowledged_at timestamptz not null default now()
);
alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links',
      'shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads','shop_images','stamps','stamp_artwork_versions','brands','specialties','localities','shop_types','shop_relationships','geographic_seals','geographic_seal_versions')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);

create or replace function public.audit_catalogue_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare b jsonb; a jsonb; target uuid; req uuid;
begin
  if TG_OP <> 'INSERT' then b:=to_jsonb(old)-array['created_at','updated_at']; end if;
  if TG_OP <> 'DELETE' then a:=to_jsonb(new)-array['created_at','updated_at']; end if;
  if a is not distinct from b then return null; end if;
  target := case when TG_TABLE_NAME in ('shops','brands','specialties','localities','shop_types','geographic_seals','geographic_seal_versions') then coalesce(a,b)->>'id' else coalesce(a,b)->>'shop_id' end;
  req := coalesce(nullif(current_setting('nibatlas.admin_request_id',true),'')::uuid,gen_random_uuid());
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary,request_id)
  values(auth.uid(),case when auth.uid() is null then 'database_operator' else 'account' end,
    'catalogue_'||lower(TG_OP),TG_TABLE_NAME,target,
    jsonb_strip_nulls(jsonb_build_object('fingerprint',case when b is not null then md5(b::text) end,'publicationStatus',b->>'publication_status','operationalStatus',b->>'operational_status')),
    jsonb_strip_nulls(jsonb_build_object('fingerprint',case when a is not null then md5(a::text) end,'publicationStatus',a->>'publication_status','operationalStatus',a->>'operational_status')),req);
  return null;
end; $$;
revoke all on function public.audit_catalogue_change() from public, anon, authenticated, service_role;


do $$ declare t text; begin
 foreach t in array array['geographic_seals','geographic_seal_versions','geographic_seal_awards','geographic_seal_receipts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger no_truncate before truncate on public.%I for each statement execute function public.reject_catalogue_truncate()',t);
 end loop;
 foreach t in array array['geographic_seals','geographic_seal_versions'] loop
  execute format('create trigger catalogue_audit after insert or update or delete on public.%I for each row execute function public.audit_catalogue_change()',t);
 end loop;
end $$;
-- Awards may be deleted only through account/history deletion, never rewritten.
create trigger immutable_award before update on public.geographic_seal_awards
 for each row execute function public.reject_audit_mutation();
create trigger immutable_version before update or delete on public.geographic_seal_versions
 for each row execute function public.reject_audit_mutation();

create function public.admin_geographic_seals(p_action text,p_id uuid default null,p_revision uuid default null,p_document jsonb default null,p_after uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.geographic_seals; s jsonb; l public.localities; eligible jsonb; n integer;
begin
 perform 1 from public.profiles where id=auth.uid() and role in ('editor','admin') for share;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(q) order by id),'[]') from
   (select * from public.geographic_seals where p_after is null or id>p_after order by id limit 51) q);
 end if;
 if p_action not in ('save','publish','unpublish') or p_action is null then raise exception 'Invalid action' using errcode='22023'; end if;
 if p_id is not null then
  select * into d from public.geographic_seals where id=p_id for update;
  if not found or d.revision is distinct from p_revision then raise exception 'Reload changed seal' using errcode='40001'; end if;
 elsif p_action<>'save' then raise exception 'Save first' using errcode='22023';
 end if;
 if p_action='save' then
  perform public.check_edit_object(p_document,'{"scope":"text","countryCode":"text","countryLabel":"text","localityId":"uuid","ink":"text","eligibleShopIds":"array"}',array['scope','countryCode','countryLabel','ink','eligibleShopIds']);
  if p_document->>'scope' not in ('country','locality') or p_document->>'countryCode' !~ '^[A-Z]{2}$'
   or length(btrim(p_document->>'countryLabel')) not between 1 and 100
   or p_document->>'ink' not in ('vermilion','navy','teal','indigo','plum','moss','ochre','brick')
   or jsonb_typeof(p_document->'eligibleShopIds') is distinct from 'array'
   or jsonb_array_length(p_document->'eligibleShopIds')>(case when p_document->>'scope'='locality' then 1 else 4 end)
   or octet_length(p_document::text)>4096 then raise exception 'Invalid seal' using errcode='22023'; end if;
  if p_document->>'scope'='locality' then
   select * into l from public.localities where id=(p_document->>'localityId')::uuid and country_code=p_document->>'countryCode' for share;
   if not found then raise exception 'Invalid locality' using errcode='22023'; end if;
  elsif p_document->>'localityId' is not null then raise exception 'Invalid locality' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_document->'eligibleShopIds') v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^[0-9a-fA-F-]{36}$')
   or (select count(*)<>count(distinct (v#>>'{}')::uuid) from jsonb_array_elements(p_document->'eligibleShopIds') v) then raise exception 'Invalid shops' using errcode='22023'; end if;
  if p_id is not null and (d.scope<>p_document->>'scope' or d.country_code<>p_document->>'countryCode' or d.locality_id is distinct from l.id) then raise exception 'Place cannot change' using errcode='22023'; end if;
  s:=p_document||jsonb_build_object('eligibleShopIds',(select coalesce(jsonb_agg(value::uuid order by value::uuid),'[]') from jsonb_array_elements_text(p_document->'eligibleShopIds')),'localitySlug',l.slug,'localityName',l.name,'template','cartouche-v1');
  if p_id is null then
   insert into public.geographic_seals(scope,country_code,locality_id,draft) values(p_document->>'scope',p_document->>'countryCode',l.id,s) returning * into d;
  else
   update public.geographic_seals set draft=s,revision=gen_random_uuid() where id=p_id returning * into d;
  end if;
 elsif p_action='publish' then
  -- Lock selected shop rows so the published membership/name snapshot is coherent.
  perform 1 from public.shops where id in (select value::uuid from jsonb_array_elements_text(d.draft->'eligibleShopIds')) order by id for share;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by id),'[]') into eligible from public.shops
   where id in (select value::uuid from jsonb_array_elements_text(d.draft->'eligibleShopIds'))
    and publication_status='published' and country_code=d.country_code and (d.scope='country' or locality_id=d.locality_id);
  if jsonb_array_length(eligible)<>jsonb_array_length(d.draft->'eligibleShopIds') then raise exception 'Choose published shops in this place' using errcode='22023'; end if;
  s:=d.draft||jsonb_build_object('eligibleShops',eligible);
  select version into n from public.geographic_seal_versions where seal_id=d.id and snapshot=s order by version desc limit 1;
  if n is null then
   select coalesce(max(version),0)+1 into n from public.geographic_seal_versions where seal_id=d.id;
   insert into public.geographic_seal_versions(seal_id,version,snapshot) values(d.id,n,s);
  end if;
  update public.geographic_seals set published=true,published_version=n,revision=gen_random_uuid() where id=d.id returning * into d;
 else
  update public.geographic_seals set published=false,revision=gen_random_uuid() where id=d.id returning * into d;
 end if;
 return to_jsonb(d);
end $$;
revoke all on function public.admin_geographic_seals(text,uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_geographic_seals(text,uuid,uuid,jsonb,uuid) to authenticated;

-- The historical collection geography is authoritative, including closed/moved shops.
create function public.geographic_seal_progress(p_user uuid,p_snapshot jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
 with visits as (
  select distinct on (shop_id) id,shop_id,collected_at from public.stamp_collections
  where user_id=p_user and place_snapshot->>'countryCode'=p_snapshot->>'countryCode'
   and (p_snapshot->>'scope'='country' or place_snapshot->>'localitySlug'=p_snapshot->>'localitySlug')
  order by shop_id,collected_at,id
 ), ordered as (select *,row_number() over(order by collected_at,id) ordinal from visits),
 eligible as (select * from ordered where p_snapshot->'eligibleShopIds' ? shop_id::text),
 qualifying as (
  select id,collected_at from ordered where ordinal=case when p_snapshot->>'scope'='locality' then 2 else 5 end
  union all
  select id,collected_at from eligible where (select count(*) from eligible)=jsonb_array_length(p_snapshot->'eligibleShopIds')
   and jsonb_array_length(p_snapshot->'eligibleShopIds')>0 and id=(select id from eligible order by collected_at desc,id desc limit 1)
 )
 select jsonb_build_object('count',(select count(*) from visits),'collectedIds',coalesce((select jsonb_agg(shop_id order by shop_id) from eligible),'[]'),
  'qualifyingCollectionId',(select id from qualifying order by collected_at,id limit 1));
$$;
revoke all on function public.geographic_seal_progress(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.award_geographic_seal(p_user uuid,p_seal uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.geographic_seals; s jsonb; q uuid;
begin
 select * into d from public.geographic_seals where id=p_seal for share;
 if not found or not d.published or exists(select 1 from public.geographic_seal_awards where user_id=p_user and seal_id=d.id) then return; end if;
 select snapshot into s from public.geographic_seal_versions where seal_id=d.id and version=d.published_version;
 q:=(public.geographic_seal_progress(p_user,s)->>'qualifyingCollectionId')::uuid;
 if q is not null then
  insert into public.geographic_seal_awards(user_id,seal_id,version,collection_id) values(p_user,d.id,d.published_version,q) on conflict(user_id,seal_id) do nothing;
 end if;
end $$;
revoke all on function public.award_geographic_seal(uuid,uuid) from public,anon,authenticated,service_role;
create function public.derive_geographic_seals()
returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 for sid in select d.id from public.geographic_seals d join public.geographic_seal_versions v on v.seal_id=d.id and v.version=d.published_version
  where d.published and d.country_code=new.place_snapshot->>'countryCode'
   and (d.scope='country' or v.snapshot->>'localitySlug'=new.place_snapshot->>'localitySlug') order by d.id loop
  perform public.award_geographic_seal(new.user_id,sid);
 end loop;
 return new;
end $$;
revoke all on function public.derive_geographic_seals() from public,anon,authenticated,service_role;
create trigger derive_geographic_seals after insert on public.stamp_collections for each row execute function public.derive_geographic_seals();

-- A POST reconciles old verified visits lazily, bounded to 50 definitions per page.
-- It also returns preserved unpublished awards, never draft definitions.
create function public.my_geographic_seals(p_after uuid default null,p_ack uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; ids uuid[]; result jsonb;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_ack is null or cardinality(p_ack)>50 then raise exception 'Invalid receipts' using errcode='22023'; end if;
 insert into public.geographic_seal_receipts(award_id) select id from public.geographic_seal_awards where user_id=uid and id=any(p_ack) on conflict do nothing;
 select array_agg(id order by id) into ids from (
  select d.id from public.geographic_seals d where (p_after is null or d.id>p_after) and
   (d.published or exists(select 1 from public.geographic_seal_awards a where a.seal_id=d.id and a.user_id=uid)) order by d.id limit 51
 ) q;
 foreach sid in array coalesce(ids[1:50],'{}'::uuid[]) loop perform public.award_geographic_seal(uid,sid); end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'published',d.published,
  'current',case when d.published then v.snapshot end,
  'progress',case when d.published then public.geographic_seal_progress(uid,v.snapshot)-'qualifyingCollectionId' end,
  'award',case when a.id is not null then jsonb_build_object('id',a.id,'sealId',d.id,'version',a.version,'snapshot',av.snapshot,
   'earnedOn',to_char(c.collected_at at time zone c.shop_timezone,'YYYY-MM-DD'),'shopId',c.shop_id,
   'unseen',r.award_id is null) end) order by d.id),'[]') into result
 from public.geographic_seals d
 left join public.geographic_seal_versions v on v.seal_id=d.id and v.version=d.published_version
 left join public.geographic_seal_awards a on a.seal_id=d.id and a.user_id=uid
 left join public.geographic_seal_versions av on av.seal_id=a.seal_id and av.version=a.version
 left join public.stamp_collections c on c.id=a.collection_id
 left join public.geographic_seal_receipts r on r.award_id=a.id
 where d.id=any(ids[1:50]);
 return jsonb_build_object('rows',result,'nextCursor',case when cardinality(ids)>50 then ids[50] end);
end $$;
revoke all on function public.my_geographic_seals(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.my_geographic_seals(uuid,uuid[]) to authenticated;
commit;
