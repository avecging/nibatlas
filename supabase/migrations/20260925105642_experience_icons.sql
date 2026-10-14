-- Optional curated experience icons. No existing catalogue or draft bytes change.
-- Replace only the validator; existing owner, grants, search path and write boundaries remain.
begin;
create or replace function public.validate_shop_document(p_id uuid, d jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare s jsonb := d->'shop'; r jsonb; k text; schema jsonb; required text[]; identity_key text; target_table text; exists_id boolean;
begin
  if d is null or octet_length(d::text)>131072 then raise exception 'Invalid catalogue data' using errcode='22023'; end if;
  perform public.check_edit_object(d,'{"experiences":"array","shop":"object","sources":"array","aliases":"array","links":"array","types":"array","services":"array","specialties":"array","brands":"array"}',array['shop','sources','aliases','links','types','services','specialties','brands']);
  perform public.check_edit_object(s,'{"feature_headline":"text","field_note_heading":"text","field_note_body":"text","local_address":"text","unit_floor":"text","nearest_station":"text","station_exit":"text","walking_guidance":"text","entrance_notes":"text","editions_text":"text","payment_methods":"text","languages":"text","holiday_note":"text","internal_notes":"text","reference_links":"text","slug":"text","name":"text","short_description":"text","address_line_1":"text","address_line_2":"text","postal_code":"text","country_code":"text","admin_area_code":"text","admin_area_name":"text","locality_id":"uuid","city_display":"text","neighbourhood":"text","timezone":"text","phone":"text","website_url":"url","opening_hours":"object","appointment_required":"boolean","accessibility_notes":"text","operational_status":"text","source_quality":"text","last_verified_at":"date","position_precision":"text","latitude":"number","longitude":"number"}',array['slug','name','operational_status','source_quality','position_precision']);
  for r in select value from jsonb_array_elements(coalesce(d->'experiences','[]')) loop
    perform public.check_edit_object(r,'{"id":"uuid","category":"text","title":"text","description":"text","icon":"text"}',array['id','category','title']);
    if r->>'category' not in ('fountain_pens','inks_paper','nib_testing','gifts','repairs','other') then
      raise exception 'Invalid experience category' using errcode='22023'; end if;
    if r->>'icon' is not null and r->>'icon' not in ('pen','nib','ink','swatch','paper','book','tools','gift','workshop','chat') then
      raise exception 'Invalid experience icon' using errcode='22023'; end if;
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(coalesce(d->'experiences','[]'))) then
    raise exception 'Duplicate catalogue item' using errcode='22023'; end if;
  if s->>'reference_links' is not null then
    for k in select regexp_split_to_table(s->>'reference_links', E'\n') loop
      if btrim(k)<>'' then perform public.check_edit_object(jsonb_build_object('url',btrim(k)),'{"url":"url"}'); end if;
    end loop;
  end if;
  if s->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(s->>'slug')>120 or length(s->>'name')>300
    or (s->>'country_code' is not null and s->>'country_code' !~ '^[A-Z]{2}$')
    or (s->>'timezone' is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=s->>'timezone'))
    or (s->>'latitude' is null) <> (s->>'longitude' is null)
    or (s->>'latitude')::numeric not between -90 and 90 or (s->>'longitude')::numeric not between -180 and 180
    or s->>'operational_status' not in ('open','temporarily_closed','permanently_closed','unknown')
    or s->>'source_quality' not in ('verified','sourced','community_unverified','demo')
    or s->>'position_precision' not in ('street','locality') then
    raise exception 'Invalid catalogue data' using errcode='22023';
  end if;
  if s->>'locality_id' is not null and not exists(select 1 from public.localities where id=(s->>'locality_id')::uuid and country_code=s->>'country_code') then
    raise exception 'Locality must match country' using errcode='22023';
  end if;
  -- Demo and test-venue identity cannot be laundered into a real catalogue.
  if exists(select 1 from public.shops where id=p_id and source_quality='demo') and s->>'source_quality'<>'demo' then
    raise exception 'Demo identity is permanent' using errcode='22023';
  end if;
  if s->'opening_hours' is not null and s->'opening_hours'<>'null'::jsonb then
    perform public.check_edit_object(s->'opening_hours','{"entries":"array","note":"text","exceptions":"array"}');
    for r in select value from jsonb_array_elements(coalesce(s->'opening_hours'->'entries','[]'::jsonb)) loop
      perform public.check_edit_object(r,'{"day":"text","opens":"text","closes":"text","closed":"boolean","note":"text"}',array['day']);
      if r->>'day' not in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')
        or (r->>'opens' is null)<>(r->>'closes' is null)
        or (r->>'opens' is not null and (r->>'opens' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or r->>'closes' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
        or (r->>'closed'='true' and r->>'opens' is not null) then
        raise exception 'Invalid opening hours' using errcode='22023';
      end if;
    end loop;
    if jsonb_array_length(coalesce(s->'opening_hours'->'exceptions','[]'::jsonb))>100 then
      raise exception 'Invalid opening hours' using errcode='22023';
    end if;
    for r in select value from jsonb_array_elements(coalesce(s->'opening_hours'->'exceptions','[]'::jsonb)) loop
      perform public.check_edit_object(r,'{"date":"text","opens":"text","closes":"text","closed":"boolean","note":"text"}',array['date']);
      if not coalesce(public.valid_shop_exception_date(r->>'date'),false)
        or (r->>'opens' is null)<>(r->>'closes' is null)
        or (r->>'opens' is not null and (r->>'opens' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or r->>'closes' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
        or (r->>'closed'='true' and r->>'opens' is not null) then
        raise exception 'Invalid opening hours' using errcode='22023';
      end if;
    end loop;
    if exists (select 1 from jsonb_array_elements(coalesce(s->'opening_hours'->'exceptions','[]'::jsonb)) a
      where a.value->>'closed'='true' and (select count(*) from jsonb_array_elements(s->'opening_hours'->'exceptions') b where b.value->>'date'=a.value->>'date')>1) then
      raise exception 'Invalid opening hours' using errcode='22023';
    end if;
  end if;
  foreach k in array array['sources','aliases','links','types','services','specialties','brands'] loop
    identity_key := 'id'; target_table := null;
    if k='sources' then
      schema := '{"id":"uuid","label":"text","source_type":"text","source_url":"url","checked_at":"date","reliability":"text","evidence_note":"text","status":"text","claims":"array"}';
      required := array['id','label','source_type','checked_at','reliability','status','claims'];
    elsif k='aliases' then
      schema := '{"id":"uuid","alias":"text","language_tag":"text","alias_type":"text"}'; required:=array['id','alias','language_tag','alias_type'];
    elsif k='links' then
      schema := '{"id":"uuid","link_type":"text","url":"url","label":"text","is_official":"boolean","sort_order":"number"}'; required:=array['id','link_type','url','is_official','sort_order'];
    else
      identity_key := case k when 'types' then 'shop_type_id' when 'services' then 'service_id' when 'specialties' then 'specialty_id' else 'brand_id' end;
      target_table := case k when 'types' then 'shop_types' else k end;
      schema := jsonb_build_object(identity_key,'uuid','source_id','uuid','note','text','last_verified_at','date');
      required := array[identity_key];
      if k='types' then schema:=schema || '{"is_primary":"boolean"}'; required:=required || 'is_primary'::text; end if;
    end if;
    if (select count(*) <> count(distinct value->>identity_key) from jsonb_array_elements(d->k)) then
      raise exception 'Duplicate catalogue item' using errcode='22023';
    end if;
    for r in select value from jsonb_array_elements(d->k) loop
      perform public.check_edit_object(r,schema,required);
      if target_table is not null then
        execute format('select exists(select 1 from public.%I where id=$1)',target_table) into exists_id using (r->>identity_key)::uuid;
        if not exists_id then raise exception 'Unknown catalogue vocabulary' using errcode='22023'; end if;
        if r->>'source_id' is not null and not exists(select 1 from jsonb_array_elements(d->'sources') a where a->>'id'=r->>'source_id') then
          raise exception 'Source must belong to this shop' using errcode='22023';
        end if;
      elsif k='sources' then
        if r->>'source_type' not in ('official','brand_dealer_list','community_list','founder_visit','demo_fixture')
          or r->>'reliability' not in ('primary','secondary','direct','unknown') or r->>'status' not in ('active','stale','unavailable')
          or (r->>'source_type'='demo_fixture' and s->>'source_quality'<>'demo')
          or exists(select 1 from public.shop_sources where id=(r->>'id')::uuid and shop_id<>p_id)
          or exists(select 1 from jsonb_array_elements(r->'claims') c where jsonb_typeof(c)<>'string' or length(btrim(c#>>'{}')) not between 1 and 200)
          or (select count(*)<>count(distinct value) from jsonb_array_elements(r->'claims')) then
          raise exception 'Invalid source' using errcode='22023';
        end if;
      elsif k='aliases' then
        if r->>'language_tag' !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
          or r->>'alias_type' not in ('local_name','romanization','former_name','search_synonym')
          or exists(select 1 from public.shop_aliases where id=(r->>'id')::uuid and shop_id<>p_id) then
          raise exception 'Invalid alias' using errcode='22023';
        end if;
      elsif k='links' then
        if r->>'link_type' not in ('website','instagram','facebook','x','line','directions','contact')
          or exists(select 1 from public.shop_links where id=(r->>'id')::uuid and shop_id<>p_id)
          or (r->>'sort_order')::numeric not between 0 and 1000 or trunc((r->>'sort_order')::numeric)<>(r->>'sort_order')::numeric then
          raise exception 'Invalid link' using errcode='22023';
        end if;
      end if;
    end loop;
  end loop;
  if (select count(*) from jsonb_array_elements(d->'types') where value->>'is_primary'='true')>1
    or (select count(*)<>count(distinct lower(value->>'alias')) from jsonb_array_elements(d->'aliases'))
    or (select count(*)<>count(distinct value->>'url') from jsonb_array_elements(d->'links')) then
    raise exception 'Duplicate catalogue item' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(d->'types') t join public.shop_types st on st.id=(t->>'shop_type_id')::uuid where st.code='test_venue') and s->>'source_quality'<>'demo' then
    raise exception 'Test venues must remain demo' using errcode='22023';
  end if;
end; $$;


commit;
