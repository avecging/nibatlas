begin read only;
select p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef,
  has_function_privilege('authenticated',p.oid,'execute') as account_execute,
  has_function_privilege('anon',p.oid,'execute') as anonymous_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('admin_access','admin_shop_list','admin_shop_read','admin_shop_options','admin_shop_write');
select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('postgres','authenticated');
do $$
declare actor uuid; operation text; result jsonb; message text;
begin
  select id into actor from public.profiles where role='admin' order by id limit 1;
  if actor is null then raise notice 'No existing admin profile found'; return; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  foreach operation in array array['admin_access','admin_shop_list','admin_shop_options'] loop
    begin
      execute 'set local role authenticated';
      execute format('select public.%I()',operation) into result;
      execute 'reset role';
      raise notice '%: allowed',operation;
    exception when others then
      execute 'reset role';
      message := case when sqlerrm like 'permission denied for %' or sqlerrm='Admin access denied' then sqlerrm else 'database error (details omitted)' end;
      raise notice '%: rejected, SQLSTATE %, %',operation,sqlstate,message;
    end;
  end loop;
end $$;
rollback;
