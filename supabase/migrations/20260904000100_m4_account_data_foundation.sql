-- Milestone 4, work package 1: private account and saved-shop data foundation.
-- Authentication flows and application endpoints follow in later work packages.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  home_country_code text,
  preferred_locale text not null default 'en',
  distance_unit text not null default 'metric',
  role text not null default 'user',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint profiles_display_name_valid check (
    display_name is null
    or (
      display_name = btrim(display_name)
      and length(display_name) > 0
      and char_length(display_name) <= 40
    )
  ),
  constraint profiles_home_country_code_valid check (
    home_country_code is null or home_country_code ~ '^[A-Z]{2}$'
  ),
  constraint profiles_preferred_locale_valid check (
    preferred_locale ~ '^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$'
  ),
  constraint profiles_distance_unit_valid check (
    distance_unit in ('metric', 'imperial')
  ),
  constraint profiles_role_valid check (
    role in ('user', 'editor', 'admin')
  )
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.saved_shops (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, shop_id)
);

-- The primary key serves owner-scoped lists. The reverse index prevents shop
-- deletion from scanning every account's saved rows.
create index saved_shops_shop_id_idx on public.saved_shops (shop_id);

create function public.provision_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Cover any identities that predate this migration before installing the
-- trigger for magic-link, Google, and future approved auth identities.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create trigger auth_user_provision_profile
  after insert on auth.users
  for each row execute function public.provision_profile_for_auth_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.saved_shops enable row level security;
alter table public.saved_shops force row level security;

revoke all on table public.profiles, public.saved_shops from public, anon, authenticated;
grant all on table public.profiles, public.saved_shops to service_role;

grant select on table public.profiles to authenticated;
grant update (display_name, home_country_code, preferred_locale, distance_unit)
  on table public.profiles to authenticated;

grant select, insert, delete on table public.saved_shops to authenticated;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy saved_shops_select_own
on public.saved_shops
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy saved_shops_insert_own
on public.saved_shops
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy saved_shops_delete_own
on public.saved_shops
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on function public.provision_profile_for_auth_user() from public;
