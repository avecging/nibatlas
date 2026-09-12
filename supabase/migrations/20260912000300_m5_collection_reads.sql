-- Private, bounded historical reads. Current slugs are navigation only; an
-- archived shop does not remove its owner's immutable impression.
create or replace function public.list_stamp_collections(p_after uuid default null)
returns jsonb language sql stable security definer
set search_path = '' as $$
  select coalesce(jsonb_agg(x.value order by x.id), '[]'::jsonb)
  from (
    select c.id, jsonb_build_object(
      'id',c.id,'shopId',c.shop_id,'stampId',c.stamp_id,
      'collectedAt',c.collected_at,'shopTimezone',c.shop_timezone,
      'shopName',c.shop_name_snapshot,'place',c.place_snapshot,'stamp',c.stamp_snapshot,
      'shopSlug',case when s.publication_status='published' then s.slug else null end
    ) as value
    from public.stamp_collections c
    join public.shops s on s.id=c.shop_id
    where c.user_id=(select auth.uid()) and (select auth.role())='authenticated'
      and (p_after is null or c.id>p_after)
    order by c.id limit 101
  ) x;
$$;
revoke all on function public.list_stamp_collections(uuid) from public, anon, service_role;
grant execute on function public.list_stamp_collections(uuid) to authenticated;
