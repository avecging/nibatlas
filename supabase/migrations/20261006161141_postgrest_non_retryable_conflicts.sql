-- Application conflicts must not use PostgreSQL's retryable serialization code.
-- PT409 keeps the existing HTTP contract without triggering PostgREST retries.
do $$
declare
  targets oid[] := array[
    'public.admin_shop_write(text,uuid,text,jsonb)'::regprocedure,
    'public.shop_media_operation(uuid,text,uuid,text,uuid,text)'::regprocedure,
    'public.stamp_artwork_draft_operation(uuid,text,uuid,text,jsonb)'::regprocedure,
    'public.shop_media_arrange(uuid,text,uuid,jsonb)'::regprocedure,
    'public.admin_import_operation(text,uuid,uuid,jsonb)'::regprocedure,
    'public.admin_import_publication(text,uuid,uuid,uuid,jsonb)'::regprocedure,
    'public.shop_review_operation(uuid,text,uuid,jsonb)'::regprocedure,
    'public.shop_publication_operation(uuid,text,uuid,text,uuid)'::regprocedure,
    'public.sync_related_private(uuid,jsonb,jsonb)'::regprocedure,
    'public.apply_shop_document(uuid,jsonb)'::regprocedure,
    'public.admin_geographic_seals(text,uuid,uuid,jsonb,uuid)'::regprocedure,
    'public.geographic_seal_file(uuid,text,text,uuid,uuid,jsonb)'::regprocedure,
    'public.admin_geographic_seals_v2(text,uuid,uuid,jsonb,uuid,text,text,text,integer)'::regprocedure,
    'public.admin_about_page(text,uuid,jsonb)'::regprocedure,
    'public.admin_shop_verification_policy(uuid,boolean,text,integer,text)'::regprocedure
  ];
  target record;
  changed integer := 0;
begin
  for target in
    select p.oid, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    where p.oid = any(targets) and p.prosrc like '%40001%'
  loop
    execute replace(target.definition, '''40001''', '''PT409''');
    changed := changed + 1;
  end loop;

  if changed <> cardinality(targets) then
    raise exception 'Expected to update % application conflict functions, updated %',
      cardinality(targets), changed;
  end if;

  if exists(select 1 from pg_proc p where p.oid = any(targets) and p.prosrc like '%40001%') then
    raise exception 'Retryable SQLSTATE remains in an application conflict function';
  end if;
end;
$$;
