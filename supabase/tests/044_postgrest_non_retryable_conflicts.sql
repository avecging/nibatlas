begin;
select no_plan();

select ok(
  not exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosrc like '%40001%'
  ),
  'application functions do not raise retryable serialization failures'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosrc like '%PT409%'
  ),
  15,
  'all application conflict functions use explicit HTTP 409 errors'
);

select * from finish();
rollback;
