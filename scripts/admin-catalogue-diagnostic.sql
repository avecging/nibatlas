begin read only;
select exists(select 1 from supabase_migrations.schema_migrations where version='20260914000100') as migration_applied;
select prosecdef as checker_has_trusted_authority,
 not has_function_privilege('authenticated','public.assert_published_shop_has_active_stamp()','EXECUTE') as checker_not_callable_by_accounts,
 not has_table_privilege('authenticated','public.shops','SELECT') as catalogue_still_private
from pg_proc where oid='public.assert_published_shop_has_active_stamp()'::regprocedure;
select count(*)=1 as diagnostic_draft_found,
 bool_and(s.publication_status='draft') as remains_private,
 bool_and(w.document->'shop'->>'name'='Admin workflow diagnostic draft edited') as edit_saved,
 bool_and(w.document->'shop'->>'source_quality'='demo') as labelled_demo
from public.shops s join public.shop_working_copies w on w.shop_id=s.id
where s.slug='admin-workflow-diagnostic-20260914';
select count(*)>=2 as create_and_save_audited,
 bool_and(a.actor_kind='account' and p.role='admin') as authenticated_admin_actor,
 bool_and(exists(select 1 from auth.identities i where i.user_id=p.id and i.provider='google')) as actor_has_google_identity
from public.admin_audit_log a join public.profiles p on p.id=a.actor_user_id
join public.shops s on s.id=a.entity_id
where s.slug='admin-workflow-diagnostic-20260914'
 and a.entity_type in ('shops','shop_working_copies');
rollback;
