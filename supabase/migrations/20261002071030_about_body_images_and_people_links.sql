begin;
-- Additive: existing drafts/publications and image-free clients remain valid.
create table public.about_images (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.profiles(id),
 environment text not null check(environment in ('staging','production')),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer not null check(byte_size between 1 and 5242880),
 width integer not null check(width between 1 and 2048),
 height integer not null check(height between 1 and 2048),
 ready boolean not null default false,
 created_at timestamptz not null default statement_timestamp()
);
alter table public.about_images enable row level security;
alter table public.about_images force row level security;
revoke all on public.about_images from public,anon,authenticated,service_role;
create trigger no_truncate before truncate on public.about_images for each statement execute function public.reject_catalogue_truncate();

create function public.about_image_ids(body jsonb) returns setof uuid
language sql immutable set search_path='' as $$
 select (n->'attrs'->>'imageId')::uuid from jsonb_array_elements(coalesce(body->'content','[]')) n where n->>'type'='aboutImage'
$$;
revoke all on function public.about_image_ids(jsonb) from public,anon,authenticated,service_role;

create or replace function public.about_rich_node(n jsonb, parent text default 'root', depth integer default 0) returns integer
language plpgsql set search_path='' as $$
declare t text:=n->>'type'; c jsonb; m jsonb; count_nodes integer:=1; allowed text[]; a jsonb; mark_types text[]:='{}';
begin
 if depth>8 or jsonb_typeof(n) is distinct from 'object' or n-array['type','attrs','content','text','marks']<>'{}'::jsonb then raise exception 'Invalid About body' using errcode='22023';end if;
 allowed:=case when parent='root' then array['doc'] when parent in ('paragraph','heading') then array['text','hardBreak']
  when parent in ('bulletList','orderedList') then array['listItem'] when parent='listItem' then array['paragraph','bulletList','orderedList'] else array['paragraph','heading','bulletList','orderedList','aboutImage'] end;
 if t is null or not(t=any(allowed)) then raise exception 'Invalid About body' using errcode='22023';end if;
 if t='aboutImage' then
  if parent<>'doc' or n ?| array['content','text','marks'] then raise exception 'Invalid About image' using errcode='22023';end if;
  perform public.about_object(n->'attrs','{"imageId":"string","alt":"string","caption":"string","width":"number","height":"number"}');
  a:=n->'attrs';
  if a->>'imageId' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or not public.about_text(a->>'alt',500) or public.about_trim(a->>'alt')='' or not public.about_text(a->>'caption',1000)
   or a->>'width' !~ '^[0-9]{1,4}$' or a->>'height' !~ '^[0-9]{1,4}$' then raise exception 'Invalid About image' using errcode='22023';end if;
  if not exists(select 1 from public.about_images where id=(a->>'imageId')::uuid and ready and width=(a->>'width')::integer and height=(a->>'height')::integer) then raise exception 'Upload About image first' using errcode='22023';end if;
  return 1;
 end if;
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
create or replace function public.validate_about(d jsonb, publishing boolean default false) returns void
language plpgsql set search_path='' as $$
declare p jsonb; s jsonb; k text; limit_value integer; ids text[]:='{}';
begin
 if octet_length(d::text)>100000 then raise exception 'About too large' using errcode='22023';end if;
 perform public.about_object(d,'{"title":"string","introduction":"string","body":"object","teamHeading":"string","thanksHeading":"string","people":"array","support":"object"}');
 for k,limit_value in select * from (values ('title',160),('introduction',2000),('teamHeading',120),('thanksHeading',120)) x loop
  if not public.about_text(d->>k,limit_value) then raise exception 'About text too long' using errcode='22023';end if;
 end loop;
 perform public.about_rich_node(d->'body');
 if (select count(*) from public.about_image_ids(d->'body'))>20 then raise exception 'Too many About images' using errcode='22023';end if;
 if (with recursive nodes(n) as (select d->'body' union all select child from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]')) child)
  select coalesce(sum(length(n->>'text')),0)>60000 from nodes where n->>'type'='text') then raise exception 'About body too long' using errcode='22023';end if;
 if jsonb_array_length(d->'people')>100 then raise exception 'Too many About entries' using errcode='22023';end if;
 for p in select * from jsonb_array_elements(d->'people') loop
  perform public.about_object(p-array['linkedin','instagram'],'{"id":"string","group":"string","name":"string","description":"string","url":"string"}');
  if p->>'id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then raise exception 'Invalid About entry' using errcode='22023';end if;
  if lower(p->>'id')=any(ids) or p->>'group' not in ('team','thanks') or not public.about_text(p->>'name',120) or not public.about_text(p->>'description',500) or not public.about_url(p->>'url',true) then raise exception 'Invalid About entry' using errcode='22023';end if;
  foreach k in array array['linkedin','instagram'] loop
   if p ? k and (jsonb_typeof(p->k) is distinct from 'string' or not public.about_url(p->>k,true) or
    ((p->>k)<>'' and (p->>k) !~* ('^https?://([a-z0-9.-]+\.)?'||k||'\.com(:[0-9]{1,5})?([/?#].*)?$'))) then raise exception 'Invalid About social link' using errcode='22023';end if;
  end loop;
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
alter table public.admin_audit_log drop constraint audit_event_shape;
alter table public.admin_audit_log add constraint audit_event_shape check (
  (action='profile_role_changed' and entity_type='profile'
   and before_summary ? 'role' and after_summary ? 'role'
   and before_summary - 'role'='{}'::jsonb and after_summary - 'role'='{}'::jsonb
   and before_summary->>'role' in ('user','editor','admin') and after_summary->>'role' in ('user','editor','admin'))
  or (action in ('catalogue_insert','catalogue_update','catalogue_delete')
    and entity_type in ('shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases','shop_links',
      'shop_shop_types','shop_services','shop_specialties','shop_brands','media_uploads','shop_images','stamps','stamp_artwork_versions','brands','specialties','localities','shop_types','shop_relationships','geographic_seals','geographic_seal_versions','geographic_seal_assets','about_page','about_images')
    and jsonb_typeof(before_summary)='object' and jsonb_typeof(after_summary)='object'
    and before_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb
    and after_summary - array['fingerprint','publicationStatus','operationalStatus']='{}'::jsonb)
);


-- Only trusted server code can attest to sanitized, stored bytes. Never grant this to browser roles.
create function public.about_image_operation(p_actor uuid,p_environment text,p_action text,p_id uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.about_images; before_value jsonb;
begin
 perform 1 from public.profiles where id=p_actor and role='admin' for share;
 if not found then raise exception 'Admin access denied' using errcode='42501';end if;
 if p_environment not in ('staging','production') or p_environment is null then raise exception 'Invalid environment' using errcode='22023';end if;
 perform pg_advisory_xact_lock(17017018);
 if p_action='reserve' then
  perform public.about_object(p_payload,'{"sha256":"string","byteSize":"number","width":"number","height":"number"}');
  if (select count(*) from public.about_images where actor_id=p_actor and created_at>statement_timestamp()-interval '1 day')>=50
   or (select count(*) from public.about_images)>=500 then raise exception 'Image limit' using errcode='54000';end if;
  insert into public.about_images(actor_id,environment,sha256,byte_size,width,height) values(p_actor,p_environment,p_payload->>'sha256',(p_payload->>'byteSize')::integer,(p_payload->>'width')::integer,(p_payload->>'height')::integer) returning * into a;
 elsif p_action='finalize' then
  select * into a from public.about_images where id=p_id and actor_id=p_actor and environment=p_environment for update;
  if not found then raise exception 'Image not found' using errcode='P0002';end if;
  if not a.ready then
   before_value:=to_jsonb(a);
   update public.about_images set ready=true where id=a.id returning * into a;
  end if;
 else raise exception 'Invalid image action' using errcode='22023';end if;
 if p_action='reserve' or before_value is not null then
  insert into public.admin_audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,before_summary,after_summary,request_id)
  values(p_actor,'account',case when p_action='reserve' then 'catalogue_insert' else 'catalogue_update' end,'about_images',a.id,
   case when before_value is null then '{}'::jsonb else jsonb_build_object('fingerprint',md5(before_value::text)) end,
   jsonb_build_object('fingerprint',md5(to_jsonb(a)::text)),gen_random_uuid());
 end if;
 return jsonb_build_object('id',a.id,'environment',a.environment,'sha256',a.sha256,'byteSize',a.byte_size,'width',a.width,'height',a.height,'ready',a.ready);
end $$;
revoke all on function public.about_image_operation(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.about_image_operation(uuid,text,text,uuid,jsonb) to service_role;

create function public.read_about_image(p_id uuid,p_private boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.about_images;
begin
 if p_private then
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access denied' using errcode='42501';end if;
 elsif not exists(select 1 from public.about_page, lateral public.about_image_ids(published->'body') i where i=p_id) then
  return null;
 end if;
 select * into a from public.about_images where id=p_id and ready;
 if not found then return null;end if;
 return jsonb_build_object('id',a.id,'environment',a.environment,'sha256',a.sha256,'byteSize',a.byte_size,'width',a.width,'height',a.height,'ready',a.ready);
end $$;
revoke all on function public.read_about_image(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.read_about_image(uuid,boolean) to anon,authenticated;
commit;
