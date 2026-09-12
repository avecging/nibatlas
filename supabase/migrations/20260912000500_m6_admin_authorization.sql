-- M6 WP1: current database roles, restricted append-only audit and bootstrap.
-- No public role-management endpoint or catalogue writes are introduced.
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('database_operator', 'account')),
  action text not null check (action = 'profile_role_changed'),
  entity_type text not null check (entity_type = 'profile'),
  entity_id uuid not null,
  before_summary jsonb not null,
  after_summary jsonb not null,
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default statement_timestamp(),
  constraint audit_role_summaries check (
    jsonb_typeof(before_summary) = 'object' and jsonb_typeof(after_summary) = 'object'
    and before_summary ? 'role' and after_summary ? 'role'
    and before_summary - 'role' = '{}'::jsonb and after_summary - 'role' = '{}'::jsonb
    and before_summary->>'role' is not null and after_summary->>'role' is not null
    and before_summary->>'role' in ('user', 'editor', 'admin')
    and after_summary->>'role' in ('user', 'editor', 'admin')
  )
);
alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;
revoke all on public.admin_audit_log from public, anon, authenticated, service_role;

create function public.reject_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Audit history is append-only' using errcode = '42501'; end;
$$;
revoke all on function public.reject_audit_mutation() from public;
create trigger admin_audit_immutable before update or delete on public.admin_audit_log
  for each row execute function public.reject_audit_mutation();
create trigger admin_audit_no_truncate before truncate on public.admin_audit_log
  for each statement execute function public.reject_audit_mutation();

create function public.audit_profile_role_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    insert into public.admin_audit_log (
      actor_user_id, actor_kind, action, entity_type, entity_id, before_summary, after_summary
    ) values (
      auth.uid(), case when auth.uid() is null then 'database_operator' else 'account' end,
      'profile_role_changed', 'profile', new.id,
      jsonb_build_object('role', old.role), jsonb_build_object('role', new.role)
    );
  end if;
  return new;
end;
$$;
revoke all on function public.audit_profile_role_change() from public;
create trigger profiles_audit_role after update of role on public.profiles
  for each row execute function public.audit_profile_role_change();

-- Remove the old broad service-role grant. Auth-user provisioning is already
-- owned by its SECURITY DEFINER trigger; account edits need no role permission.
revoke insert, update, delete, truncate, references, trigger on public.profiles from service_role;
grant update (display_name, home_country_code, preferred_locale, distance_unit)
  on public.profiles to service_role;

create function public.assign_profile_role(p_user_id uuid, p_role text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_user_id is null or p_role is null or p_role not in ('user', 'editor', 'admin') then
    raise exception 'Invalid role assignment' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;
-- SQL-editor/migration operator only. SECURITY INVOKER, no service-role bypass.
revoke all on function public.assign_profile_role(uuid,text) from public, anon, authenticated, service_role;

create function public.admin_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare current_role text;
begin
  select role into current_role from public.profiles where id = auth.uid();
  if current_role is null or current_role not in ('editor', 'admin') then
    raise exception 'Admin access denied' using errcode = '42501';
  end if;
  return jsonb_build_object('role', current_role);
end;
$$;
revoke all on function public.admin_access() from public, anon, service_role;
grant execute on function public.admin_access() to authenticated;

create function public.list_admin_audit(p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rows jsonb;
begin
  -- Check the live database role inside the privileged read too. Revocation
  -- takes effect on the next statement, regardless of JWT metadata/role claims.
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Admin access denied' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'actorUserId', a.actor_user_id, 'actorKind', a.actor_kind,
    'action', a.action, 'entityType', a.entity_type, 'entityId', a.entity_id,
    'before', a.before_summary, 'after', a.after_summary,
    'requestId', a.request_id, 'createdAt', a.created_at
  ) order by a.id), '[]'::jsonb) into rows
  from (select * from public.admin_audit_log where p_after is null or id > p_after
    order by id limit 101) a;
  return rows;
end;
$$;
revoke all on function public.list_admin_audit(uuid) from public, anon, service_role;
grant execute on function public.list_admin_audit(uuid) to authenticated;
