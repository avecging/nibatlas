-- Founder mobile acceptance: empty canonical choices must have a usable recovery.
-- Existing names/identities are reused; no shop relationship/publication is inferred.
alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links',
      'shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads','shop_images','stamps','stamp_artwork_versions','brands','specialties')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);
create or replace function public.audit_catalogue_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare b jsonb; a jsonb; target uuid; req uuid;
begin
  if TG_OP <> 'INSERT' then b:=to_jsonb(old)-array['created_at','updated_at']; end if;
  if TG_OP <> 'DELETE' then a:=to_jsonb(new)-array['created_at','updated_at']; end if;
  if a is not distinct from b then return null; end if;
  target := case when TG_TABLE_NAME in ('shops','brands','specialties') then coalesce(a,b)->>'id' else coalesce(a,b)->>'shop_id' end;
  req := coalesce(nullif(current_setting('nibatlas.admin_request_id',true),'')::uuid,gen_random_uuid());
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary,request_id)
  values(auth.uid(),case when auth.uid() is null then 'database_operator' else 'account' end,
    'catalogue_'||lower(TG_OP),TG_TABLE_NAME,target,
    jsonb_strip_nulls(jsonb_build_object('fingerprint',case when b is not null then md5(b::text) end,'publicationStatus',b->>'publication_status','operationalStatus',b->>'operational_status')),
    jsonb_strip_nulls(jsonb_build_object('fingerprint',case when a is not null then md5(a::text) end,'publicationStatus',a->>'publication_status','operationalStatus',a->>'operational_status')),req);
  return null;
end; $$;
revoke all on function public.audit_catalogue_change() from public, anon, authenticated, service_role;

create trigger catalogue_choice_audit after insert or update or delete on public.brands
  for each row execute function public.audit_catalogue_change();
create trigger catalogue_choice_audit after insert or update or delete on public.specialties
  for each row execute function public.audit_catalogue_change();

create function public.admin_catalogue_choice(p_kind text, p_label text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare choice_label text; found_id uuid; new_id uuid;
begin
  perform 1 from public.profiles where id=auth.uid() and role in ('editor','admin') for share;
  if not found then raise exception 'Admin access denied' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('brands','specialties') or p_label is null or length(p_label)>300 then
    raise exception 'Invalid choice' using errcode='22023';
  end if;
  choice_label := btrim(regexp_replace(p_label,'[[:space:]]+',' ','g'));
  if choice_label='' then raise exception 'Invalid choice' using errcode='22023'; end if;
  -- Serialize create/reuse, including trusted direct writes, without merging old duplicates.
  if p_kind='brands' then
    lock table public.brands in share row exclusive mode;
    select id into found_id from public.brands where lower(btrim(regexp_replace(name,'[[:space:]]+',' ','g')))=lower(choice_label) order by id limit 1;
    if found_id is null then
      if (select count(*) from public.brands)>=10000 then raise exception 'Choice limit reached' using errcode='22023'; end if;
      new_id:=gen_random_uuid();
      insert into public.brands(id,slug,name) values(new_id,'brand-'||new_id::text,choice_label) returning id into found_id;
    end if;
  else
    lock table public.specialties in share row exclusive mode;
    select id into found_id from public.specialties where lower(btrim(regexp_replace(public.specialties.label,'[[:space:]]+',' ','g')))=lower(choice_label) order by id limit 1;
    if found_id is null then
      if (select count(*) from public.specialties)>=10000 then raise exception 'Choice limit reached' using errcode='22023'; end if;
      new_id:=gen_random_uuid();
      insert into public.specialties(id,code,label) values(new_id,'specialty_'||replace(new_id::text,'-','_'),choice_label) returning id into found_id;
    end if;
  end if;
  return jsonb_build_object('id',found_id);
end; $$;
revoke all on function public.admin_catalogue_choice(text,text) from public,anon,service_role;
grant execute on function public.admin_catalogue_choice(text,text) to authenticated;
