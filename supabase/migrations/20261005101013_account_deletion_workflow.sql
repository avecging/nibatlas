begin;

-- Account deletion removes private, owner-scoped working state. Import rows
-- contain source documents and previews; durable shop reviews contain the
-- editor's selected unpublished media/artwork choices. Neither belongs after
-- its owning profile is deleted.
alter table public.import_operations
  drop constraint import_operations_batch_id_fkey,
  add constraint import_operations_batch_id_fkey
    foreign key (batch_id) references public.import_batches(id) on delete cascade;

alter table public.import_batches
  drop constraint import_batches_owner_id_fkey,
  add constraint import_batches_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.shop_reviews
  drop constraint shop_reviews_actor_id_fkey,
  add constraint shop_reviews_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete cascade;

-- Catalogue contributions (including unpublished media submissions) and audit
-- history survive an editor/admin deleting their account. The UUIDs below are
-- deliberately retained without identity foreign keys: once auth.users/profiles
-- is gone they are opaque, unresolvable actor identifiers, not a route back to
-- an account. This also prevents a catalogue/history row from blocking deletion
-- after every session has already been revoked.
alter table public.shops
  drop constraint shops_reviewed_by_fkey;

alter table public.media_uploads
  drop constraint media_uploads_created_by_fkey;

alter table public.import_audit_events
  drop constraint import_audit_events_actor_id_fkey;

alter table public.shop_publications
  drop constraint shop_publications_actor_id_fkey;

alter table public.about_images
  drop constraint about_images_actor_id_fkey;

alter table stamp_private.shop_verification_policy
  drop constraint shop_verification_policy_updated_by_fkey;

-- getUser() proves that the token belongs to a real Auth user. This additional
-- check proves that the token's session has not already been revoked: access
-- JWTs can otherwise remain cryptographically valid until their short expiry.
-- No caller supplies either identifier.
create function public.account_deletion_session()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  session_id uuid;
begin
  begin
    session_id := nullif(auth.jwt()->>'session_id','')::uuid;
  exception when invalid_text_representation then
    session_id := null;
  end;

  if actor is null or session_id is null or not exists (
    select 1 from auth.sessions s where s.id=session_id and s.user_id=actor
  ) then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  return actor;
end;
$$;
revoke all on function public.account_deletion_session() from public,anon,service_role;
grant execute on function public.account_deletion_session() to authenticated;

commit;
