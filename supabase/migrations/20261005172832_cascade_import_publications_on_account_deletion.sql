begin;

-- Import publication rows are private working ledgers tied to both the batch
-- and operation they publish. Both parents now cascade during account deletion,
-- so each dependent edge must cascade as well rather than blocking the profile
-- deletion after the account's sessions have already been revoked.
alter table public.import_publications
  drop constraint import_publications_import_id_fkey,
  add constraint import_publications_import_id_fkey
    foreign key (import_id) references public.import_operations(id) on delete cascade,
  drop constraint import_publications_batch_id_fkey,
  add constraint import_publications_batch_id_fkey
    foreign key (batch_id) references public.import_batches(id) on delete cascade;

commit;
