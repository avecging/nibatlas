-- The M5 constraint runs at transaction end, after the M6 SECURITY DEFINER
-- write RPC has returned to PostgREST's authenticated caller. Its old invoker
-- context could not read private catalogue tables, so even draft creation
-- rolled back with 42501. Give only this invariant checker its owner's read
-- authority; keep table grants, RLS, live admin checks and the constraint intact.
alter function public.assert_published_shop_has_active_stamp() security definer;
alter function public.assert_published_shop_has_active_stamp() set search_path = '';
revoke all on function public.assert_published_shop_has_active_stamp()
  from public, anon, authenticated, service_role;
