begin;
select plan(32);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'saved_shops', 'saved shops table exists');
select col_is_pk('public', 'profiles', 'id', 'profile identity is the auth user id');
select col_is_pk(
  'public', 'saved_shops', array['user_id', 'shop_id'],
  'saved shops are unique per user and shop'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is forced on profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.saved_shops'::regclass),
  'RLS is enabled on saved shops'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.saved_shops'::regclass),
  'RLS is forced on saved shops'
);

select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous users cannot read profiles');
select ok(not has_table_privilege('anon', 'public.saved_shops', 'SELECT'),
  'anonymous users cannot read saved shops');
select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT'),
  'authenticated users may read profiles through RLS');
select ok(has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'),
  'authenticated users may update their display name through RLS');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated users cannot update account roles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  'authenticated users cannot create arbitrary profiles');
select ok(has_table_privilege('authenticated', 'public.saved_shops', 'SELECT')
  and has_table_privilege('authenticated', 'public.saved_shops', 'INSERT')
  and has_table_privilege('authenticated', 'public.saved_shops', 'DELETE'),
  'authenticated users may manage saved shops through RLS');
select ok(not has_table_privilege('authenticated', 'public.saved_shops', 'UPDATE'),
  'saved rows are not mutable');

insert into auth.users (id, aud, role, email) values
  (
    '10000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'magic-link@example.test'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'google@example.test'
  );

select is(
  (select count(*)::integer from public.profiles
   where id in (
     '10000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000002'
   )),
  2,
  'every auth identity receives one profile'
);
select ok(
  exists (
    select 1 from public.profiles
    where id = '10000000-0000-4000-8000-000000000001'
      and display_name is null
      and preferred_locale = 'en'
      and distance_unit = 'metric'
      and role = 'user'
  ),
  'new profiles use private minimal defaults'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is((select count(*)::integer from public.profiles), 1,
  'a signed-in user sees only their profile');
select is(
  (with changed as (
    update public.profiles
    set display_name = 'Ada'
    where id = '10000000-0000-4000-8000-000000000001'
    returning 1
  ) select count(*)::integer from changed),
  1,
  'a signed-in user may update an allowed field on their profile'
);
select throws_ok($blank_display_name$
  update public.profiles
  set display_name = ' '
  where id = '10000000-0000-4000-8000-000000000001'
$blank_display_name$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_display_name_valid"',
  'a profile cannot store a blank display name'
);
select is(
  (with changed as (
    update public.profiles
    set display_name = 'Not yours'
    where id = '10000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*)::integer from changed),
  0,
  'a signed-in user cannot update another profile'
);

select lives_ok($own_save$
  insert into public.saved_shops (user_id, shop_id) values (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000301'
  )
$own_save$, 'a signed-in user may save a shop for themself');

select throws_ok($other_save$
  insert into public.saved_shops (user_id, shop_id) values (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000301'
  )
$other_save$,
  '42501',
  'new row violates row-level security policy for table "saved_shops"',
  'a signed-in user cannot save a shop for another account'
);

reset role;
insert into public.saved_shops (user_id, shop_id) values (
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000302'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is((select count(*)::integer from public.saved_shops), 1,
  'a signed-in user sees only their saved rows');
select is(
  (with removed as (
    delete from public.saved_shops
    where user_id = '10000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*)::integer from removed),
  0,
  'a signed-in user cannot delete another account''s saved row'
);
select is(
  (with removed as (
    delete from public.saved_shops
    where user_id = '10000000-0000-4000-8000-000000000001'
    returning 1
  ) select count(*)::integer from removed),
  1,
  'a signed-in user may remove their saved row'
);

reset role;
insert into public.saved_shops (user_id, shop_id) values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000301'
);
delete from auth.users
where id = '10000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.profiles
   where id = '10000000-0000-4000-8000-000000000001'),
  0,
  'deleting an auth user removes their profile'
);
select is(
  (select count(*)::integer from public.saved_shops
   where user_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'deleting an auth user removes their saved rows'
);

select is(
  (select display_name from public.profiles
   where id = '10000000-0000-4000-8000-000000000002'),
  null::text,
  'one account lifecycle cannot change another profile'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.provision_profile_for_auth_user()',
    'EXECUTE'
  ),
  'the trusted service role retains profile-provisioning access'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.provision_profile_for_auth_user()',
    'EXECUTE'
  ),
  'authenticated users cannot invoke the provisioning trigger function'
);

select * from finish();
rollback;
