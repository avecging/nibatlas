begin;
select plan(27);

select has_function('public', 'list_saved_shops', array[]::text[],
  'owner-scoped saved list RPC exists');
select has_function('public', 'save_shop', array['uuid'],
  'idempotent save RPC exists');
select has_function('public', 'unsave_shop', array['uuid'],
  'idempotent unsave RPC exists');

select ok(has_function_privilege('authenticated', 'public.list_saved_shops()', 'EXECUTE'),
  'authenticated users may call the saved list RPC');
select ok(has_function_privilege('authenticated', 'public.save_shop(uuid)', 'EXECUTE'),
  'authenticated users may call the save RPC');
select ok(has_function_privilege('authenticated', 'public.unsave_shop(uuid)', 'EXECUTE'),
  'authenticated users may call the unsave RPC');
select ok(not has_function_privilege('anon', 'public.list_saved_shops()', 'EXECUTE'),
  'anonymous users cannot call the saved list RPC');
select ok(not has_function_privilege('anon', 'public.save_shop(uuid)', 'EXECUTE'),
  'anonymous users cannot call the save RPC');
select ok(not has_function_privilege('anon', 'public.unsave_shop(uuid)', 'EXECUTE'),
  'anonymous users cannot call the unsave RPC');
select ok(not has_function_privilege(
  'authenticated', 'public.saved_shop_summary(uuid,timestamp with time zone)', 'EXECUTE'
), 'authenticated users cannot bypass the owner-scoped RPCs through the summary helper');

insert into auth.users (id, aud, role, email) values
  (
    '10000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'saved-one@example.test'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'saved-two@example.test'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);

select is(
  public.save_shop('00000000-0000-4000-8000-000000000301')->>'id',
  '00000000-0000-4000-8000-000000000301',
  'save returns the requested published shop'
);
select is(
  public.save_shop('00000000-0000-4000-8000-000000000301')->>'markerState',
  'saved',
  'save returns a catalogue-compatible saved marker state'
);
select ok(
  public.save_shop('00000000-0000-4000-8000-000000000301') ? 'savedAt',
  'save returns the persistent saved timestamp'
);
select is(
  public.save_shop('00000000-0000-4000-8000-000000000301')->>'savedAt',
  (
    select to_jsonb(created_at)#>>'{}'
    from public.saved_shops
    where user_id = '10000000-0000-4000-8000-000000000003'
      and shop_id = '00000000-0000-4000-8000-000000000301'
  ),
  'repeated save preserves the original saved timestamp'
);
select is(
  (select count(*)::integer from public.saved_shops),
  1,
  'repeated save creates one owner-shop row'
);
select is(
  public.list_saved_shops()->'savedShopIds'->>0,
  '00000000-0000-4000-8000-000000000301',
  'saved list returns the owner saved identifier'
);
select is(
  public.list_saved_shops()->'shops'->0->>'id',
  '00000000-0000-4000-8000-000000000301',
  'saved list aligns compact details with identifiers'
);
select ok(
  not (public.list_saved_shops() ? 'userId'),
  'saved list does not expose account identity'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);
select is(
  jsonb_array_length(public.list_saved_shops()->'savedShopIds'),
  0,
  'another account sees an empty saved list'
);
select is(
  public.unsave_shop('00000000-0000-4000-8000-000000000301'),
  true,
  'unsaving a published shop is idempotently successful for an account without the row'
);

reset role;
select is(
  (select count(*)::integer from public.saved_shops
   where user_id = '10000000-0000-4000-8000-000000000003'),
  1,
  'one account cannot remove another account saved row'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);
select is(
  public.save_shop('ffffffff-ffff-4fff-8fff-ffffffffffff'),
  null::jsonb,
  'save distinguishes a missing shop'
);
select is(
  public.unsave_shop('ffffffff-ffff-4fff-8fff-ffffffffffff'),
  null::boolean,
  'unsave distinguishes a missing shop'
);
select is(
  public.unsave_shop('00000000-0000-4000-8000-000000000301'),
  true,
  'unsave removes the owner row'
);
select is(
  public.unsave_shop('00000000-0000-4000-8000-000000000301'),
  true,
  'repeated unsave remains successful'
);
select is(
  (select count(*)::integer from public.saved_shops),
  0,
  'repeated unsave leaves no saved row'
);
select ok(
  pg_get_functiondef('public.save_shop(uuid)'::regprocedure) like '%on conflict (user_id, shop_id) do nothing%',
  'save uses the unique owner-shop key as its concurrent idempotency boundary'
);

select * from finish();
rollback;
