-- A non-pen venue needs an honest type because public projections require one.
-- It never appears in the four public pen-shop filter choices.
insert into public.shop_types (id, code, label, sort_order) values
('00000000-0000-4000-8000-000000000105', 'test_venue', 'Staging test venue', 1000);

create function public.enforce_test_venue_demo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_shop uuid;
begin
  if tg_table_name = 'shops' then target_shop := new.id;
  elsif tg_table_name = 'shop_shop_types' then
    if new.shop_type_id <> '00000000-0000-4000-8000-000000000105'
      and not exists (select 1 from public.shop_types where id = new.shop_type_id and code = 'test_venue') then
      return null;
    end if;
    target_shop := new.shop_id;
  end if;
  if exists (
    select 1 from public.shop_shop_types j
    join public.shop_types t on t.id = j.shop_type_id
    join public.shops s on s.id = j.shop_id
    where (t.code = 'test_venue' or t.id = '00000000-0000-4000-8000-000000000105')
      and s.source_quality <> 'demo'
      and (target_shop is null or s.id = target_shop)
  ) then
    raise exception 'Test venues must remain demo data' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function public.enforce_test_venue_demo() from public;
create constraint trigger test_venue_type_guard after insert or update on public.shop_shop_types
  deferrable initially deferred for each row execute function public.enforce_test_venue_demo();
create constraint trigger test_venue_quality_guard after update on public.shops
  deferrable initially deferred for each row execute function public.enforce_test_venue_demo();
create constraint trigger test_venue_vocabulary_guard after update on public.shop_types
  deferrable initially deferred for each row execute function public.enforce_test_venue_demo();
