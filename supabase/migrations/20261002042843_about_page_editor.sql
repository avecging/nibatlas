-- About-only content. No hosted seed, layout builder, media, or account permissions.
begin;
create table public.about_page (
 id uuid primary key default gen_random_uuid(),
 singleton boolean not null default true unique check(singleton),
 draft jsonb not null,
 revision uuid not null default gen_random_uuid(),
 published jsonb,
 published_revision uuid,
 published_at timestamptz,
 check ((published is null) = (published_revision is null)),
 check ((published is null) = (published_at is null))
);
alter table public.about_page enable row level security;
alter table public.about_page force row level security;
revoke all on public.about_page from public,anon,authenticated,service_role;
create trigger no_truncate before truncate on public.about_page for each statement execute function public.reject_catalogue_truncate();

-- Narrow validators are also applied to direct authenticated RPC calls.
create function public.about_object(v jsonb, shape jsonb) returns void
language plpgsql set search_path='' as $$
declare k text; t text;
begin
 if jsonb_typeof(v) is distinct from 'object' or v - array(select jsonb_object_keys(shape)) <> '{}'::jsonb then
  raise exception 'Invalid About content' using errcode='22023';
 end if;
 for k,t in select key,value #>> '{}' from jsonb_each(shape) loop
  if jsonb_typeof(v->k) is distinct from t then raise exception 'Invalid About content' using errcode='22023';end if;
 end loop;
end $$;
create function public.about_text(v text, max_chars integer) returns boolean
language sql immutable set search_path='' as $$
 select v is not null and length(v)<=max_chars and v !~ U&'[\0001-\0008\000B\000C\000E-\001F\007F]'
$$;
create function public.about_trim(v text) returns text
language sql immutable set search_path='' as $$
 select regexp_replace(v,U&'^[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+|[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+$','','g')
$$;
create function public.about_url(v text, external_only boolean default false) returns boolean
language plpgsql immutable set search_path='' as $$
declare parts text[]; host_value text; last_label text;
begin
 if not public.about_text(v,2000) or v ~ U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]' or strpos(v,chr(92))>0 then return false;end if;
 if v='' then return true;end if;
 if not external_only and v ~ '^/([^/]|$)' then return true;end if;
 parts:=regexp_match(v,'^https?://([a-z0-9.-]+)(:([0-9]{1,5}))?([/?#].*)?$','i');
 if parts is null then return false;end if;
 if parts[3] is not null and parts[3]::integer>65535 then return false;end if;
 host_value:=parts[1]; last_label:=regexp_replace(rtrim(lower(host_value),'.'),'^.*\.','');
 if last_label ~ '^(0x[0-9a-f]*|[0-9]+)$' then
  if host_value !~ '^((0|[1-9][0-9]{0,2})\.){3}(0|[1-9][0-9]{0,2})$' then return false;end if;
  begin perform host_value::inet;exception when others then return false;end;
 end if;
 return true;
end $$;
create function public.about_rich_node(n jsonb, parent text default 'root', depth integer default 0) returns integer
language plpgsql set search_path='' as $$
declare t text:=n->>'type'; c jsonb; m jsonb; count_nodes integer:=1; allowed text[]; a jsonb; mark_types text[]:='{}';
begin
 if depth>8 or jsonb_typeof(n) is distinct from 'object' or n-array['type','attrs','content','text','marks']<>'{}'::jsonb then raise exception 'Invalid About body' using errcode='22023';end if;
 allowed:=case when parent='root' then array['doc'] when parent in ('paragraph','heading') then array['text','hardBreak']
  when parent in ('bulletList','orderedList') then array['listItem'] when parent='listItem' then array['paragraph','bulletList','orderedList'] else array['paragraph','heading','bulletList','orderedList'] end;
 if t is null or not(t=any(allowed)) then raise exception 'Invalid About body' using errcode='22023';end if;
 if t='text' then
  if jsonb_typeof(n->'text') is distinct from 'string' or (not public.about_text(n->>'text',60000) or length(n->>'text')=0) or n ?| array['content','attrs'] then raise exception 'Invalid About body' using errcode='22023';end if;
 elsif n ? 'text' then raise exception 'Invalid About body' using errcode='22023';end if;
 if n ? 'marks' then
  if t<>'text' or jsonb_typeof(n->'marks') is distinct from 'array' or jsonb_array_length(n->'marks')>2 then raise exception 'Invalid About body' using errcode='22023';end if;
  for m in select * from jsonb_array_elements(n->'marks') loop
   if m->>'type'=any(mark_types) then raise exception 'Invalid About body' using errcode='22023';end if;
   mark_types:=array_append(mark_types,m->>'type');
   if m->>'type'='bold' then perform public.about_object(m,'{"type":"string"}');
   elsif m->>'type'='link' then
    perform public.about_object(m,'{"type":"string","attrs":"object"}');
    perform public.about_object(m->'attrs','{"href":"string"}');
    if not public.about_url(m->'attrs'->>'href') or m->'attrs'->>'href'='' then raise exception 'Invalid About link' using errcode='22023';end if;
   else raise exception 'Invalid About body' using errcode='22023';end if;
  end loop;
 end if;
 if n ? 'attrs' then
  a:=n->'attrs';
  if t='heading' then
   perform public.about_object(a,'{"level":"number"}');
   if a->>'level' not in ('2','3') then raise exception 'Invalid About body' using errcode='22023';end if;
  elsif t='orderedList' then
   perform public.about_object(a,'{"start":"number"}');
   if (a->>'start') !~ '^[0-9]{1,3}$' or (a->>'start')::integer<1 then raise exception 'Invalid About body' using errcode='22023';end if;
  else raise exception 'Invalid About body' using errcode='22023';end if;
 elsif t='heading' then raise exception 'Invalid About body' using errcode='22023';end if;
 if t in ('text','hardBreak') then
  if n ? 'content' then raise exception 'Invalid About body' using errcode='22023';end if;
 else
  if jsonb_typeof(n->'content') is distinct from 'array' or jsonb_array_length(n->'content')>2000 then raise exception 'Invalid About body' using errcode='22023';end if;
  if t in ('doc','bulletList','orderedList','listItem') and jsonb_array_length(n->'content')=0 then raise exception 'Invalid About body' using errcode='22023';end if;
  if t='listItem' and n->'content'->0->>'type' is distinct from 'paragraph' then raise exception 'Invalid About body' using errcode='22023';end if;
  for c in select * from jsonb_array_elements(n->'content') loop
   count_nodes:=count_nodes+public.about_rich_node(c,t,depth+1);
   if count_nodes>2000 then raise exception 'Invalid About body' using errcode='22023';end if;
  end loop;
 end if;
 return count_nodes;
end $$;
create function public.validate_about(d jsonb, publishing boolean default false) returns void
language plpgsql set search_path='' as $$
declare p jsonb; s jsonb; k text; limit_value integer; ids text[]:='{}';
begin
 if octet_length(d::text)>100000 then raise exception 'About too large' using errcode='22023';end if;
 perform public.about_object(d,'{"title":"string","introduction":"string","body":"object","teamHeading":"string","thanksHeading":"string","people":"array","support":"object"}');
 for k,limit_value in select * from (values ('title',160),('introduction',2000),('teamHeading',120),('thanksHeading',120)) x loop
  if not public.about_text(d->>k,limit_value) then raise exception 'About text too long' using errcode='22023';end if;
 end loop;
 perform public.about_rich_node(d->'body');
 if (with recursive nodes(n) as (select d->'body' union all select child from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]')) child)
  select coalesce(sum(length(n->>'text')),0)>60000 from nodes where n->>'type'='text') then raise exception 'About body too long' using errcode='22023';end if;
 if jsonb_array_length(d->'people')>100 then raise exception 'Too many About entries' using errcode='22023';end if;
 for p in select * from jsonb_array_elements(d->'people') loop
  perform public.about_object(p,'{"id":"string","group":"string","name":"string","description":"string","url":"string"}');
  if p->>'id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then raise exception 'Invalid About entry' using errcode='22023';end if;
  if lower(p->>'id')=any(ids) or p->>'group' not in ('team','thanks') or not public.about_text(p->>'name',120) or not public.about_text(p->>'description',500) or not public.about_url(p->>'url',true) then raise exception 'Invalid About entry' using errcode='22023';end if;
  ids:=array_append(ids,lower(p->>'id'));
  if publishing and (public.about_trim(p->>'name')='' or public.about_trim(p->>'description')='' or public.about_trim(d->>(case when p->>'group'='team' then 'teamHeading' else 'thanksHeading' end))='') then raise exception 'Incomplete About entry' using errcode='22023';end if;
 end loop;
 s:=d->'support';
 perform public.about_object(s,'{"enabled":"boolean","heading":"string","description":"string","buttonLabel":"string","url":"string"}');
 if not public.about_text(s->>'heading',120) or not public.about_text(s->>'description',600) or not public.about_text(s->>'buttonLabel',80) or not public.about_url(s->>'url',true) then raise exception 'Invalid About support' using errcode='22023';end if;
 if publishing then
  if public.about_trim(d->>'title')='' then raise exception 'About title required' using errcode='22023';end if;
  if (s->>'enabled')::boolean then
   foreach k in array array['heading','description','buttonLabel','url'] loop
    if public.about_trim(s->>k)='' then raise exception 'Incomplete About support' using errcode='22023';end if;
   end loop;
  end if;
 end if;
end $$;
revoke all on function public.about_text(text,integer),public.about_trim(text),public.about_object(jsonb,jsonb),public.about_url(text,boolean),public.about_rich_node(jsonb,text,integer),public.validate_about(jsonb,boolean) from public,anon,authenticated,service_role;

create function public.admin_about_page(p_action text, p_revision uuid default null, p_document jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.about_page;
begin
 -- Lock the current role through the write transaction, including direct RPC callers.
 perform 1 from public.profiles where id=auth.uid() and role='admin' for share;
 if not found then raise exception 'Admin access denied' using errcode='42501';end if;
 if p_action='read' then
  select * into d from public.about_page;
  if not found then return null;end if;
 elsif p_action in ('save','publish') then
  -- Serializes even the first save, before a singleton row exists.
  perform pg_advisory_xact_lock(17017017);
  select * into d from public.about_page for update;
  if d.revision is distinct from p_revision then raise exception 'About changed' using errcode='40001';end if;
  if p_action='save' then
   perform public.validate_about(p_document);
   if d.id is null then insert into public.about_page(draft) values(p_document) returning * into d;
   elsif d.draft is distinct from p_document then
    update public.about_page set draft=p_document,revision=gen_random_uuid() where id=d.id returning * into d;
   end if;
  else
   if d.id is null or p_document is not null then raise exception 'Save About first' using errcode='22023';end if;
   perform public.validate_about(d.draft,true);
   if d.published_revision is distinct from d.revision then
    update public.about_page set published=d.draft,published_revision=d.revision,published_at=statement_timestamp() where id=d.id returning * into d;
   end if;
  end if;
 else raise exception 'Invalid About action' using errcode='22023';end if;
 return jsonb_build_object('revision',d.revision,'publishedRevision',d.published_revision,'publishedAt',d.published_at,'draft',d.draft);
end $$;
revoke all on function public.admin_about_page(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_about_page(text,uuid,jsonb) to authenticated;

-- Public reads have no parameter that could select the draft; disabled support fields stay private.
create function public.read_published_about() returns jsonb
language sql stable security definer set search_path='' as $$
 select case when published is null then null
  when (published->'support'->>'enabled')::boolean then published
  else jsonb_set(published,'{support}','{"enabled":false,"heading":"","description":"","buttonLabel":"","url":""}') end
 from public.about_page
$$;
revoke all on function public.read_published_about() from public,anon,authenticated,service_role;
grant execute on function public.read_published_about() to anon,authenticated;

alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links',
      'shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads','shop_images','stamps','stamp_artwork_versions','brands','specialties','localities','shop_types','shop_relationships','geographic_seals','geographic_seal_versions','geographic_seal_assets','about_page')
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
  target := case when TG_TABLE_NAME in ('shops','brands','specialties','localities','shop_types','geographic_seals','geographic_seal_versions','about_page') then coalesce(a,b)->>'id' else coalesce(a,b)->>'shop_id' end;
  req := coalesce(nullif(current_setting('nibatlas.admin_request_id',true),'')::uuid,gen_random_uuid());
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary,request_id)
  values(auth.uid(),case when auth.uid() is null then 'database_operator' else 'account' end,
    'catalogue_'||lower(TG_OP),TG_TABLE_NAME,target,
    jsonb_strip_nulls(jsonb_build_object('fingerprint',case when b is not null then md5(b::text) end,'publicationStatus',b->>'publication_status','operationalStatus',b->>'operational_status')),
    jsonb_strip_nulls(jsonb_build_object('fingerprint',case when a is not null then md5(a::text) end,'publicationStatus',a->>'publication_status','operationalStatus',a->>'operational_status')),req);
  return null;
end; $$;
revoke all on function public.audit_catalogue_change() from public, anon, authenticated, service_role;
create trigger catalogue_audit after insert or update or delete on public.about_page for each row execute function public.audit_catalogue_change();
commit;
