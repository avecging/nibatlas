-- Match public shop_detail ordering for tied vocabulary sort orders.
-- Read-only projection change: no catalogue rows, grants or role semantics change.
begin;
create or replace function public.admin_shop_options()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_access();
  return jsonb_build_object(
    'localities',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',name||' ('||country_code||')','countryCode',country_code) order by country_code,name),'[]') from public.localities),
    'types',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'code',code) order by sort_order,code),'[]') from public.shop_types),
    'services',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'code',code) order by sort_order,code),'[]') from public.services),
    'specialties',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'code',code) order by sort_order,code),'[]') from public.specialties),
    'brands',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',name) order by name),'[]') from public.brands));
end; $$;
revoke all on function public.admin_shop_options() from public,anon,service_role;
grant execute on function public.admin_shop_options() to authenticated;

commit;
