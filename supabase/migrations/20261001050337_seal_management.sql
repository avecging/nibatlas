-- Founder revision: scalable seal management, geography-based eligibility and retained uploads.
begin;
create table public.geographic_seal_assets (
 id uuid primary key default gen_random_uuid(),
 seal_id uuid not null references public.geographic_seals(id) on delete restrict,
 environment text not null check(environment in ('staging','production')),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 content_type text not null check(content_type in ('image/png','image/svg+xml')),
 byte_size integer not null check(byte_size between 1 and 5242880),
 ready boolean not null default false,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(seal_id,environment,sha256)
);
alter table public.geographic_seal_assets enable row level security;
alter table public.geographic_seal_assets force row level security;
revoke all on public.geographic_seal_assets from public,anon,authenticated,service_role;
create trigger no_truncate before truncate on public.geographic_seal_assets for each statement execute function public.reject_catalogue_truncate();
-- Assets are immutable after validation; their IDs and credits enter audited seal drafts/versions.
create function public.protect_geographic_seal_asset() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-array['ready','created_by']) is distinct from (to_jsonb(old)-array['ready','created_by'])
  or (old.ready and not new.ready) or (new.created_by is not null and new.created_by is distinct from old.created_by) then
  raise exception 'Artwork is immutable' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public.protect_geographic_seal_asset() from public,anon,authenticated,service_role;
create trigger immutable_asset before update or delete on public.geographic_seal_assets for each row execute function public.protect_geographic_seal_asset();

alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links',
      'shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads','shop_images','stamps','stamp_artwork_versions','brands','specialties','localities','shop_types','shop_relationships','geographic_seals','geographic_seal_versions','geographic_seal_assets')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);


-- The service-only file boundary rechecks the verified cookie actor's current role/ownership.
create function public.geographic_seal_file(p_actor uuid,p_environment text,p_action text,p_id uuid default null,p_seal uuid default null,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.geographic_seal_assets; editor boolean; ext text; before_value jsonb; changed boolean:=false;
begin
 if p_actor is null or p_environment is null or p_environment not in ('staging','production') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.profiles where id=p_actor and role in ('editor','admin') for share;editor:=found;
 if p_action='reserve' then
  if not editor then raise exception 'Forbidden' using errcode='42501';end if;
  perform 1 from public.geographic_seals where id=p_seal for update;
  if not found then raise exception 'Unknown seal' using errcode='22023';end if;
  perform public.check_edit_object(p_payload,'{"sha256":"text","contentType":"text","byteSize":"number"}',array['sha256','contentType','byteSize']);
  if p_payload->>'sha256' !~ '^[a-f0-9]{64}$' or p_payload->>'contentType' not in ('image/png','image/svg+xml') or (p_payload->>'byteSize')::numeric not between 1 and 5242880 or (p_payload->>'byteSize')::numeric<>trunc((p_payload->>'byteSize')::numeric) then raise exception 'Invalid artwork' using errcode='22023';end if;
  select * into a from public.geographic_seal_assets where seal_id=p_seal and environment=p_environment and sha256=p_payload->>'sha256';
  if not found then
   if (select count(*) from public.geographic_seal_assets where seal_id=p_seal)>=100 then raise exception 'Artwork limit' using errcode='22023';end if;
   insert into public.geographic_seal_assets(seal_id,environment,sha256,content_type,byte_size,created_by) values(p_seal,p_environment,p_payload->>'sha256',p_payload->>'contentType',(p_payload->>'byteSize')::integer,p_actor) returning * into a;
     changed:=true;
  elsif a.content_type<>p_payload->>'contentType' or a.byte_size<>(p_payload->>'byteSize')::integer then raise exception 'Artwork conflict' using errcode='40001';end if;
 elsif p_action in ('finalize','read') then
  select * into a from public.geographic_seal_assets where id=p_id and environment=p_environment;
  if not found then raise exception 'Artwork not found' using errcode='P0002';end if;
  if p_action='finalize' then
   if not editor then raise exception 'Forbidden' using errcode='42501';end if;
   if not a.ready then
    before_value:=to_jsonb(a);changed:=true;
    update public.geographic_seal_assets set ready=true where id=a.id returning * into a;
   end if;
  elsif not a.ready or not (editor or exists(select 1 from public.geographic_seals s join public.geographic_seal_versions v on v.seal_id=s.id and v.version=s.published_version where s.published and v.snapshot->>'artworkId'=a.id::text)
   or exists(select 1 from public.geographic_seal_awards w join public.geographic_seal_versions v on v.seal_id=w.seal_id and v.version=w.version where w.user_id=p_actor and v.snapshot->>'artworkId'=a.id::text)) then
   raise exception 'Artwork not found' using errcode='P0002';
  end if;
 else raise exception 'Invalid action' using errcode='22023';end if;
 if changed then
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary,request_id)
  values(p_actor,'account',case when before_value is null then 'catalogue_insert' else 'catalogue_update' end,'geographic_seal_assets',a.id,
   case when before_value is null then '{}'::jsonb else jsonb_build_object('fingerprint',md5(before_value::text)) end,jsonb_build_object('fingerprint',md5(to_jsonb(a)::text)),gen_random_uuid());
 end if;
 ext:=case when a.content_type='image/png' then 'png' else 'svg' end;
 return jsonb_build_object('id',a.id,'sha256',a.sha256,'byteSize',a.byte_size,'contentType',a.content_type,'ready',a.ready,'key',a.environment||'/seals/'||a.id::text||'/'||a.sha256||'.'||ext);
end $$;
revoke all on function public.geographic_seal_file(uuid,text,text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.geographic_seal_file(uuid,text,text,uuid,uuid,jsonb) to service_role;

create index geographic_seal_scope_country_id on public.geographic_seals(scope,country_code,id);
create index geographic_seal_country_id on public.geographic_seals(country_code,id);
create index if not exists shop_seal_geography on public.shops(country_code,locality_id,id) where publication_status='published';
create function public.admin_geographic_seals_v2(p_action text,p_id uuid default null,p_revision uuid default null,p_document jsonb default null,p_after uuid default null,p_query text default '',p_scope text default '',p_country text default '',p_before integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.geographic_seals; s jsonb; l public.localities; n integer; asset uuid;
begin
 perform 1 from public.profiles where id=auth.uid() and role in ('editor','admin') for share;
 if not found then raise exception 'Forbidden' using errcode='42501';end if;
 if length(p_query)>100 or p_scope not in ('','locality','country') or (p_country<>'' and p_country !~ '^[A-Z]{2}$') then raise exception 'Invalid filters' using errcode='22023';end if;
 if p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(q) order by id),'[]') from
   (select * from public.geographic_seals where (p_after is null or id>p_after) and (p_scope='' or scope=p_scope) and (p_country='' or country_code=p_country)
    and (p_query='' or strpos(lower(concat_ws(' ',draft->>'name',draft->>'countryLabel',draft->>'localityName')),lower(p_query))>0) order by id limit 51) q);
 end if;
 if p_action in ('get','history') then
  select * into d from public.geographic_seals where id=p_id;
  if not found then raise exception 'Unknown seal' using errcode='22023';end if;
  if p_action='get' then return to_jsonb(d);end if;
  return (select coalesce(jsonb_agg(to_jsonb(q) order by version desc),'[]') from (select version,snapshot from public.geographic_seal_versions where seal_id=p_id and (p_before is null or version<p_before) order by version desc limit 21) q);
 end if;
 if p_action not in ('save','publish','unpublish') or p_action is null then raise exception 'Invalid action' using errcode='22023';end if;
 if p_id is not null then
  select * into d from public.geographic_seals where id=p_id for update;
  if not found or d.revision is distinct from p_revision then raise exception 'Reload changed seal' using errcode='40001';end if;
 elsif p_action<>'save' then raise exception 'Save first' using errcode='22023';end if;
 if p_action='save' then
  perform public.check_edit_object(p_document,'{"scope":"text","countryCode":"text","countryLabel":"text","localityId":"uuid","ink":"text","eligibleShopIds":"array","name":"text","origin":"text","creatorName":"text","creatorUrl":"text","artworkId":"uuid"}',array['scope','countryCode','countryLabel','ink']);
  if p_document->>'scope' not in ('country','locality') or p_document->>'countryCode' !~ '^[A-Z]{2}$'
   or length(btrim(p_document->>'countryLabel')) not between 1 and 100
   or p_document->>'ink' not in ('vermilion','navy','teal','indigo','plum','moss','ochre','brick')
   or coalesce(p_document->>'origin','generated') not in ('generated','founder_created','ai_assisted','commissioned')
   or (p_document ? 'name' and length(btrim(p_document->>'name')) not between 1 and 100)
   or (p_document ? 'creatorName' and length(btrim(p_document->>'creatorName')) not between 1 and 300)
   or (p_document ? 'creatorUrl' and (p_document->>'creatorName' is null or length(p_document->>'creatorUrl')>2000 or p_document->>'creatorUrl' !~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'))
   or octet_length(p_document::text)>8192 then raise exception 'Invalid seal' using errcode='22023';end if;
  if p_document->>'scope'='locality' then
   select * into l from public.localities where id=(p_document->>'localityId')::uuid and country_code=p_document->>'countryCode' for share;
   if not found then raise exception 'Invalid locality' using errcode='22023';end if;
  elsif p_document->>'localityId' is not null then raise exception 'Invalid locality' using errcode='22023';end if;
  if p_id is not null and (d.scope<>p_document->>'scope' or d.country_code<>p_document->>'countryCode' or d.locality_id is distinct from l.id) then raise exception 'Place cannot change' using errcode='22023';end if;
  asset:=(p_document->>'artworkId')::uuid;
  if asset is not null and not exists(select 1 from public.geographic_seal_assets where id=asset and seal_id=p_id and ready) then raise exception 'Invalid artwork' using errcode='22023';end if;
  if asset is not null and coalesce(p_document->>'origin','generated')='generated' then raise exception 'Choose truthful origin' using errcode='22023';end if;
  s:=p_document||jsonb_build_object('name',coalesce(p_document->>'name',l.name,p_document->>'countryLabel'),'origin',coalesce(p_document->>'origin','generated'),'eligibleShopIds','[]'::jsonb,'eligibleShops','[]'::jsonb,'eligibilityMode','automatic','localitySlug',l.slug,'localityName',l.name,'template','cartouche-v1');
  if p_id is null then
   insert into public.geographic_seals(scope,country_code,locality_id,draft) values(p_document->>'scope',p_document->>'countryCode',l.id,s) returning * into d;
  else update public.geographic_seals set draft=s,revision=gen_random_uuid() where id=p_id returning * into d;end if;
 elsif p_action='publish' then
  s:=d.draft||jsonb_build_object('eligibleShopIds','[]'::jsonb,'eligibleShops','[]'::jsonb,'eligibilityMode','automatic');
  if coalesce(s->>'origin','generated')<>'generated' and not exists(select 1 from public.geographic_seal_assets where id=(s->>'artworkId')::uuid and seal_id=d.id and ready) then raise exception 'Save artwork first' using errcode='22023';end if;
  select version into n from public.geographic_seal_versions where seal_id=d.id and snapshot=s order by version desc limit 1;
  if n is null then
   select coalesce(max(version),0)+1 into n from public.geographic_seal_versions where seal_id=d.id;
   insert into public.geographic_seal_versions(seal_id,version,snapshot) values(d.id,n,s);
  end if;
  update public.geographic_seals set published=true,published_version=n,revision=gen_random_uuid() where id=d.id returning * into d;
 else update public.geographic_seals set published=false,revision=gen_random_uuid() where id=d.id returning * into d;end if;
 return to_jsonb(d);
end $$;
revoke all on function public.admin_geographic_seals_v2(text,uuid,uuid,jsonb,uuid,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_geographic_seals_v2(text,uuid,uuid,jsonb,uuid,text,text,text,integer) to authenticated;
-- Retire the old picker writer: direct REST calls cannot restore manual eligibility.
revoke all on function public.admin_geographic_seals(text,uuid,uuid,jsonb,uuid) from authenticated;

-- Future eligibility follows the published shop's current geography. Awards are never rewritten.
create or replace function public.geographic_seal_progress(p_user uuid,p_snapshot jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
 with eligible as (
  select s.id from public.shops s left join public.localities l on l.id=s.locality_id
  where s.publication_status='published' and s.country_code=p_snapshot->>'countryCode'
   and (p_snapshot->>'scope'='country' or l.id=(p_snapshot->>'localityId')::uuid)
 ), totals as (select count(*)::integer total,greatest(1,least(count(*)::integer,case when p_snapshot->>'scope'='locality' then 2 else 5 end)) required from eligible),
 visits as (select distinct on(c.shop_id) c.id,c.shop_id,c.collected_at from public.stamp_collections c join eligible e on e.id=c.shop_id where c.user_id=p_user order by c.shop_id,c.collected_at,c.id),
 ordered as (select *,row_number() over(order by collected_at,id) ordinal from visits)
 select jsonb_build_object('count',(select count(*) from visits),'collectedIds','[]'::jsonb,'required',required,'eligibleTotal',total,
 'qualifyingCollectionId',(select id from ordered where ordinal=required)) from totals;
$$;
revoke all on function public.geographic_seal_progress(uuid,jsonb) from public,anon,authenticated,service_role;
create or replace function public.derive_geographic_seals()
returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 for sid in select d.id from public.geographic_seals d join public.shops s on s.id=new.shop_id
  where d.published and d.country_code=s.country_code and (d.scope='country' or d.locality_id=s.locality_id) order by d.id loop
  perform public.award_geographic_seal(new.user_id,sid);
 end loop;
 return new;
end $$;
revoke all on function public.derive_geographic_seals() from public,anon,authenticated,service_role;
commit;
