begin;

-- Catalogue saves hold a shared live-role lock. Media used an exclusive role
-- lock even for listing, causing unrelated shop saves to disable the uploader.
-- SHARE still blocks role revocation until the operation finishes. Keep all
-- existing shop/receipt locks, permissions, validation and audit unchanged.
do $locks$
declare signature text; definition text; marker text;
begin
 foreach signature in array array[
  'public.shop_media_operation(uuid,text,uuid,text,uuid,text)',
  'public.shop_media_arrange(uuid,text,uuid,jsonb)',
  'public.media_upload_operation(uuid,text,text,uuid,jsonb)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  marker:=case when signature like 'public.shop_media_arrange(%'
   then 'from public.profiles where id=p_actor and role=''admin'' for update;'
   else 'from public.profiles where id=p_actor and role in (''editor'',''admin'') for update;' end;
  if length(definition)-length(replace(definition,marker,''))<>length(marker) then
   raise exception 'Unexpected media role-lock definition: %',signature;
  end if;
  definition:=replace(definition,marker,replace(marker,'for update;','for share;'));
  if signature like 'public.media_upload_operation(%' then
   marker:='if p_action=''initiate'' then';
   if length(definition)-length(replace(definition,marker,''))<>length(marker) then
    raise exception 'Unexpected upload initiation definition';
   end if;
   -- Serialize the rolling 100-manifest quota independently of the role row.
   -- Same actor across both environments shares one quota. Hash collisions
   -- only serialize extra actors; they cannot admit extra manifests.
   definition:=replace(definition,marker,marker||E'\n    perform pg_catalog.pg_advisory_xact_lock(62001,pg_catalog.hashtext(p_actor::text));');
  end if;
  execute definition;
 end loop;
end; $locks$;

commit;
