begin;
-- No persistent changes: all diagnostic writes and their audit rows roll back.
select pg_get_userbyid(relowner) as profiles_owner,
 has_table_privilege('postgres','public.profiles','SELECT') as can_select,
 has_any_column_privilege('postgres','public.profiles','UPDATE') as can_lock
from pg_class where oid='public.profiles'::regclass;
select count(*) as admin_profiles,
 bool_and((select count(*)=1 from auth.users same where lower(same.email)=lower(u.email))) as unique_email_identity,
 bool_and((select count(*)=1 from auth.identities i where i.user_id=u.id and i.provider='google')) as single_google_identity
from public.profiles p join auth.users u on u.id=p.id where p.role='admin';
do $$
declare actor uuid; target uuid := gen_random_uuid(); result jsonb; phase text := 'identity'; message text; attributed boolean;
begin
 select id into actor from public.profiles where role='admin' order by id limit 1;
 if actor is null then raise notice 'No existing admin profile'; return; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if auth.uid() is distinct from actor then raise exception 'Identity mismatch'; end if;
 phase := 'admin_access';
 result := public.admin_access();
 raise notice 'admin_access: %',result->>'role';
 phase := 'admin_shop_write';
 result := public.admin_shop_write('create',target,null,jsonb_build_object('name','Explicit diagnostic test draft','slug','diagnostic-'||target));
 raise notice 'admin_shop_write: %',result->>'publicationStatus';
 execute 'reset role';
 select exists(select 1 from public.admin_audit_log where entity_id=target and action='catalogue_insert' and actor_user_id=actor and actor_kind='account') into attributed;
 raise notice 'audit_actor_matches_authenticated_admin: %',attributed;
exception when others then
 execute 'reset role';
 message := case when sqlerrm like 'permission denied for %' or sqlerrm='Admin access denied' then sqlerrm else 'database error (details omitted)' end;
 raise notice '%: rejected, SQLSTATE %, %',phase,sqlstate,message;
end $$;
rollback;
