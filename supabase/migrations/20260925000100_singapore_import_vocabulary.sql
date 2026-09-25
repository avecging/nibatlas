-- Canonical Singapore import vocabulary. Shop type codes were already seeded in M2;
-- expose those codes to the existing admin choice endpoint. Import remains read-only
-- with respect to vocabulary. Real geography and these five reviewed brands are
-- catalogue configuration, never demo seed content.
begin;

insert into public.localities
  (id,country_code,name,locality_type,slug,centroid)
values
  ('00000000-0000-4000-8000-000000000201','SG','Singapore','city','singapore',
   extensions.st_setsrid(extensions.st_makepoint(103.8198,1.3521),4326))
on conflict (id) do nothing;

do $$
declare item record; existing_id uuid; matches integer;
begin
  -- Fail visibly on conflicting geography instead of silently offering a wrong
  -- country-scoped mapping.
  if not exists (
    select 1 from public.localities
    where id='00000000-0000-4000-8000-000000000201'
      and country_code='SG' and name='Singapore' and slug='singapore'
  ) then raise exception 'Singapore locality identity conflicts with existing data'; end if;
  if (select count(*) from public.localities where country_code='SG' and lower(name)='singapore')<>1
  then raise exception 'Ambiguous Singapore locality'; end if;

  for item in select * from (values
    ('00000000-0000-4000-8000-000000000901'::uuid,'waterman','Waterman'),
    ('00000000-0000-4000-8000-000000000902'::uuid,'lamy','LAMY'),
    ('00000000-0000-4000-8000-000000000903'::uuid,'graf-von-faber-castell','Graf von Faber-Castell'),
    ('00000000-0000-4000-8000-000000000904'::uuid,'faber-castell','Faber-Castell'),
    ('00000000-0000-4000-8000-000000000905'::uuid,'kaweco','Kaweco')
  ) as v(id,slug,name) loop
    -- A brand created by the admin UI may have a UUID-based slug and a
    -- different case. Preserve that identity and its existing relationships.
    select count(*),min(id) into matches,existing_id
      from public.brands
      where lower(btrim(regexp_replace(name,'[[:space:]]+',' ','g')))=lower(item.name);
    if matches>1 then raise exception 'Ambiguous canonical brand: %',item.name; end if;
    if matches=0 then
      if exists(select 1 from public.brands where id=item.id or slug=item.slug)
      then raise exception 'Canonical brand identity conflicts: %',item.name; end if;
      insert into public.brands(id,slug,name) values(item.id,item.slug,item.name);
    end if;
  end loop;
end $$;

-- Keep the same guarded, bounded admin endpoint; add only canonical code
-- metadata, alongside UUID and display label, for typed CSV mappings.
create or replace function public.admin_shop_options()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_access();
  return jsonb_build_object(
    'localities',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',name||' ('||country_code||')','countryCode',country_code) order by country_code,name),'[]') from public.localities),
    'types',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'code',code) order by sort_order),'[]') from public.shop_types),
    'services',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'code',code) order by sort_order),'[]') from public.services),
    'specialties',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'code',code) order by sort_order),'[]') from public.specialties),
    'brands',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',name) order by name),'[]') from public.brands));
end; $$;
revoke all on function public.admin_shop_options() from public,anon,service_role;
grant execute on function public.admin_shop_options() to authenticated;
commit;
