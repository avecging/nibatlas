-- Add an explicit generated-template selector. Existing snapshots and awards are untouched.
-- Omitted template keeps legacy clients on cartouche-v1; the new editor sends v2.
create or replace function public.admin_geographic_seals_v2(p_action text,p_id uuid default null,p_revision uuid default null,p_document jsonb default null,p_after uuid default null,p_query text default '',p_scope text default '',p_country text default '',p_before integer default null)
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
  perform public.check_edit_object(p_document,'{"scope":"text","countryCode":"text","countryLabel":"text","localityId":"uuid","ink":"text","eligibleShopIds":"array","name":"text","origin":"text","creatorName":"text","creatorUrl":"text","artworkId":"uuid","artworkTreatment":"text","template":"text"}',array['scope','countryCode','countryLabel','ink']);
  if p_document->>'scope' not in ('country','locality') or p_document->>'countryCode' !~ '^[A-Z]{2}$'
   or length(btrim(p_document->>'countryLabel')) not between 1 and 100
   or p_document->>'ink' not in ('vermilion','navy','teal','indigo','plum','moss','ochre','brick')
   or (p_document ? 'template' and (coalesce(p_document->>'template','') not in ('cartouche-v1','cartouche-v2')))
   or (p_document ? 'artworkTreatment' and coalesce(p_document->>'artworkTreatment','')<>'ink-v1')
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
  s:=p_document||jsonb_build_object('name',coalesce(p_document->>'name',l.name,p_document->>'countryLabel'),'origin',coalesce(p_document->>'origin','generated'),'eligibleShopIds','[]'::jsonb,'eligibleShops','[]'::jsonb,'eligibilityMode','automatic','localitySlug',l.slug,'localityName',l.name,'template',coalesce(p_document->>'template','cartouche-v1'));
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
