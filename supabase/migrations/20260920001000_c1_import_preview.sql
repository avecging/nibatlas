-- Package C1: read-only context and authoritative validation, never an import writer.
-- Existing validators/publication helpers remain the only catalogue authority.
begin;
create function public.admin_import_preview(p_mode text, p_rows jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; result jsonb := '[]'; matches jsonb; rec jsonb; target uuid;
  d jsonb; issues jsonb; requirements jsonb; conflicted boolean; lookup_slug text; shop_name text;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_mode not in ('context','validate') or p_mode is null or p_rows is null
    or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 25
    or octet_length(p_rows::text)>2097152 then
    raise exception 'Invalid import preview' using errcode='22023'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    rec := null; matches := '[]'; issues := '[]'; requirements := '[]'; conflicted := false;
    if p_mode='context' then
      perform public.check_edit_object(r,'{"rowId":"text","id":"uuid","name":"text","slug":"text","country":"text"}',array['rowId']);
      target := (r->>'id')::uuid;
      if target is not null and exists(select 1 from public.shops where id=target) then
        rec := public.admin_shop_read(target);
        conflicted := exists(select 1 from public.shop_working_copies w where w.shop_id=target and w.base_fingerprint<>md5(public.shop_edit_document(target)::text));
      end if;
      lookup_slug := nullif(btrim(r->>'slug'),''); shop_name := nullif(btrim(r->>'name'),'');
      select coalesce(jsonb_agg(x.item order by x.priority,x.id),'[]') into matches from (
        select s.id, case when lookup_slug=s.slug or lookup_slug=w.document->'shop'->>'slug' then 0 else 1 end priority,
          jsonb_build_object('id',s.id,'name',coalesce(w.document->'shop'->>'name',s.name),'slug',s.slug,
            'reason',case when lookup_slug=s.slug or lookup_slug=w.document->'shop'->>'slug' then 'same URL name' else 'similar name; inspect before importing' end) item
        from public.shops s left join public.shop_working_copies w on w.shop_id=s.id
        where s.id is distinct from target and (
          (lookup_slug is not null and (s.slug=lookup_slug or w.document->'shop'->>'slug'=lookup_slug)) or
          (shop_name is not null and (nullif(r->>'country','') is null or s.country_code=r->>'country' or w.document->'shop'->>'country_code'=r->>'country') and
            (lower(s.name)=lower(shop_name) or lower(w.document->'shop'->>'name')=lower(shop_name)
              or extensions.similarity(lower(s.name),lower(shop_name))>=0.5
              or extensions.similarity(lower(w.document->'shop'->>'name'),lower(shop_name))>=0.5)))
        order by priority,s.id limit 11
      ) x;
      result := result || jsonb_build_array(jsonb_build_object('rowId',r->>'rowId','record',rec,
        'candidates',(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(matches) with ordinality a(value,n) where n<=10),
        'truncated',jsonb_array_length(matches)>10,'conflict',conflicted));
    else
      perform public.check_edit_object(r,'{"rowId":"text","id":"uuid","revision":"text","document":"object"}',array['rowId','id','document']);
      target := (r->>'id')::uuid; d := r->'document';
      if r->>'revision' is not null then
        if not exists(select 1 from public.shops where id=target) then
          issues := '[{"path":"shop_id","message":"The target no longer exists. Preview again."}]';
        else
          rec := public.admin_shop_read(target);
          if rec->>'revision'<>r->>'revision' or exists(select 1 from public.shop_working_copies w where w.shop_id=target and w.base_fingerprint<>md5(public.shop_edit_document(target)::text)) then
            issues := '[{"path":"shop_id","message":"The private or public revision changed. Preview again."}]';
          elsif rec->>'publicationStatus'='archived' then
            issues := '[{"path":"shop_id","message":"Archived shops cannot be updated."}]';
          elsif d->'shop'->>'slug' is distinct from rec->'document'->'shop'->>'slug' then
            issues := '[{"path":"slug","message":"Existing public URLs must be preserved."}]';
          end if;
        end if;
      elsif exists(select 1 from public.shops where id=target) then
        issues := '[{"path":"shop_id","message":"This proposed identity already exists. Review the target explicitly."}]';
      end if;
      if issues='[]'::jsonb then
        begin
          perform public.validate_shop_document(target,d);
          requirements := public.shop_publication_errors(target,d);
          if exists(select 1 from public.shops where slug=d->'shop'->>'slug' and id<>target) or
             exists(select 1 from public.shop_working_copies where document->'shop'->>'slug'=d->'shop'->>'slug' and shop_id<>target) then
            issues := '[{"path":"slug","message":"This URL name is already in use or reserved in a private copy. Review the duplicate."}]';
          end if;
        exception when sqlstate '22023' or sqlstate '23514' or sqlstate '23503' or sqlstate '22P02' or sqlstate '22007' or sqlstate '22008' then
          -- Fixed guidance only; SQL/provider text and supplied values stay private.
          issues := jsonb_build_array(jsonb_build_object('path',case sqlerrm
            when 'Locality must match country' then 'locality'
            when 'Invalid opening hours' then 'opening_hours'
            when 'Invalid source' then 'sources'
            when 'Invalid alias' then 'aliases'
            when 'Unknown catalogue vocabulary' then 'mapping'
            else 'document' end,
            'message',case sqlerrm when 'Demo identity is permanent' then 'Demo classification must be preserved.'
            when 'Test venues must remain demo' then 'Test venue types cannot be used for real shops.'
            else 'The catalogue rejected this value or relationship. Check the mapped fields and existing private record, then preview again.' end));
        end;
      end if;
      result := result || jsonb_build_array(jsonb_build_object('rowId',r->>'rowId','issues',issues,'publicationErrors',requirements));
    end if;
  end loop;
  return result;
end; $$;
revoke all on function public.admin_import_preview(text,jsonb) from public,anon,service_role;
grant execute on function public.admin_import_preview(text,jsonb) to authenticated;
commit;
