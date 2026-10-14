-- One main store type; shared RPC validation retains all existing guards.
begin;
-- Preserve existing UUIDs. Refuse ambiguous choices or retirement of a type
-- still referenced by a shop/private draft/pending import. No reclassification.
-- Serialize with manual/import draft writes before checking JSON references.
select pg_advisory_xact_lock(112,1);
lock table public.shop_types in share row exclusive mode;
do $$
declare item record; choice uuid; matches integer;
begin
 for item in select * from (values
  ('fountain_pen_specialist','Fountain Pen Specialist',10),
  ('stationery_store','Stationery Store',20),
  ('bookshop','Bookshop',30),
  ('art_supply_store','Art Supply Store',40),
  ('brand_boutique','Brand Boutique',50),
  ('luxury_shop','Luxury Shop',60),
  ('maker_workshop','Maker / Workshop',70),
  ('department_store','Department Store',80),
  ('distributor','Distributor',90)
 ) v(code,label,sort_order) loop
  select count(*) into matches from public.shop_types
   where code=item.code or lower(btrim(label))=lower(item.label);
  if matches>1 then raise exception 'Ambiguous main store type: %',item.code; end if;
  if matches=0 then
   insert into public.shop_types(code,label,sort_order) values(item.code,item.label,item.sort_order);
  else
   select id into choice from public.shop_types
    where code=item.code or lower(btrim(label))=lower(item.label);
   update public.shop_types set code=item.code,label=item.label,sort_order=item.sort_order where id=choice;
  end if;
 end loop;
 for choice in select id from public.shop_types where code in ('vintage_used','nib_repair_services') loop
  if exists(select 1 from public.shop_shop_types where shop_type_id=choice)
   or exists(select 1 from public.shop_working_copies where document::text like '%'||choice::text||'%')
   or exists(select 1 from public.import_operations where status not in ('imported','skipped')
     and patch::text like '%'||choice::text||'%') then
   raise exception 'Retired store type still in use: %. Reassign it deliberately before migration.',choice;
  end if;
  delete from public.shop_types where id=choice;
 end loop;
end $$;

create or replace function public.validate_shop_document(p_id uuid,d jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 if d is null or octet_length(d::text)>131072 then raise exception 'Invalid related shops' using errcode='22023'; end if;
 perform public.validate_shop_document_before_related(p_id,d-'related_shops');
 if jsonb_array_length(d->'types')>1 or exists(select 1 from jsonb_array_elements(d->'types') t where t->>'is_primary' is distinct from 'true') then
  raise exception 'Choose one main store type; use Experiences for secondary features' using errcode='22023'; end if;
 if not d ? 'related_shops' then return; end if;
 if jsonb_typeof(d->'related_shops') is distinct from 'array' or jsonb_array_length(d->'related_shops')>100 then
  raise exception 'Invalid related shops' using errcode='22023'; end if;
 for r in select value from jsonb_array_elements(d->'related_shops') loop
  perform public.check_edit_object(r,'{"shop_id":"uuid","kind":"text","show_public":"boolean"}',array['shop_id','kind','show_public']);
  if r->>'kind' not in ('branch','related') or (r->>'shop_id')::uuid=p_id
   or not exists(select 1 from public.shops where id=(r->>'shop_id')::uuid) then
   raise exception 'Invalid related shops' using errcode='22023'; end if;
 end loop;
 if (select count(*)<>count(distinct (value->>'shop_id')::uuid) from jsonb_array_elements(d->'related_shops')) then
  raise exception 'Invalid related shops' using errcode='22023'; end if;
end; $$;
revoke all on function public.validate_shop_document(uuid,jsonb) from public,anon,authenticated,service_role;


commit;
