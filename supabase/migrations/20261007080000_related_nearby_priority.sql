-- Public relationship selections take precedence over generated Nearby suggestions.
-- Keep the existing guarded writer, reciprocal drafts and audited publication.
begin;
create or replace function public.apply_shop_document(p_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; next_row jsonb; before_rows jsonb; after_rows jsonb; base jsonb; w public.shop_working_copies; items jsonb;
begin
 before_rows:=public.shop_related_document(p_id);
 after_rows:=coalesce(p_document->'related_shops',before_rows);
 perform public.apply_shop_document_before_related(p_id,p_document-'related_shops');
 for target in select (value->>'shop_id')::uuid from jsonb_array_elements(before_rows||after_rows)
  union select key::uuid from public.shop_working_copies wc,lateral jsonb_each(wc.related_removed) where wc.shop_id=p_id order by 1 loop
  perform 1 from public.shops where id=target for update;
  base:=public.shop_edit_document(target);
  select * into w from public.shop_working_copies where shop_id=target for update;
  if w.shop_id is not null and w.base_fingerprint<>md5(base::text) then raise exception 'Revision conflict' using errcode='PT409'; end if;
  select value into next_row from jsonb_array_elements(after_rows) where (value->>'shop_id')::uuid=target;
  if next_row is null then
   delete from public.shop_relationships where (shop_id=p_id and related_shop_id=target) or (shop_id=target and related_shop_id=p_id);
  else
   insert into public.shop_relationships(shop_id,related_shop_id,kind,show_public)
    values(p_id,target,next_row->>'kind',(next_row->>'show_public')::boolean)
    on conflict(shop_id,related_shop_id) do update set kind=excluded.kind,show_public=excluded.show_public;
   insert into public.shop_relationships(shop_id,related_shop_id,kind,show_public)
    values(target,p_id,next_row->>'kind',false)
    on conflict(shop_id,related_shop_id) do update set kind=excluded.kind;
  end if;
  -- Publishing one side may update the shared label/remove the canonical pair.
  -- Rebase ONLY this known relationship delta; never absorb an existing conflict.
  if w.shop_id is not null then
   select coalesce(jsonb_agg(value order by value->>'shop_id'),'[]') into items
    from jsonb_array_elements(coalesce(w.document->'related_shops','[]')) where value->>'shop_id'<>p_id::text;
   if next_row is not null then
    items:=items||jsonb_build_array(jsonb_build_object('shop_id',p_id,'kind',next_row->>'kind','show_public',coalesce((
     select value->>'show_public' from jsonb_array_elements(coalesce(w.document->'related_shops','[]')) where value->>'shop_id'=p_id::text)::boolean,false)));
   end if;
   select coalesce(jsonb_agg(value order by value->>'shop_id'),'[]') into items from jsonb_array_elements(items);
   update public.shop_working_copies set document=jsonb_set(document,'{related_shops}',items),
    related_removed=case when next_row is null then related_removed-p_id::text else related_removed end,
    base_fingerprint=md5(public.shop_edit_document(target)::text),revision=gen_random_uuid(),updated_at=statement_timestamp() where shop_id=target;
   perform public.prune_reconciled_related_copy(target);
  end if;
 end loop;
end; $$;

-- The older catalogue trigger still calls this helper. It no longer clears
-- explicit editor choices when coordinates, status or types change.
create or replace function public.suppress_nearby_relationships()
returns void language plpgsql security definer set search_path='' as $$
begin
 return;
end; $$;
create or replace function public.shop_detail(p_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
 select d||jsonb_build_object('relatedShops',coalesce((
  select jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name',s.name,'countryCode',s.country_code,
   'localityName',coalesce(l.name,s.city_display,s.country_code),'kind',r.kind) order by s.name,s.id)
  from public.shop_relationships r join public.shops s on s.id=r.related_shop_id
  left join public.localities l on l.id=s.locality_id
  where r.shop_id=(d->>'id')::uuid and r.show_public and s.publication_status='published'
 ),'[]'::jsonb)) from (select public.shop_detail_before_related(p_slug) d) q where d is not null;
$$;
commit;
