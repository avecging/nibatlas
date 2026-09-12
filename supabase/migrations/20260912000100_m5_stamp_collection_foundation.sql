-- Milestone 5, work package 1: Atlas Stamp and immutable collection foundation.
-- Verification attempts, geofence policy and issuance RPCs follow in later work
-- packages. This migration deliberately creates no browser-writable collection
-- path and stores no user coordinates.

create type public.atlas_stamp_status as enum ('draft', 'active', 'retired');
create type public.stamp_artwork_kind as enum ('generated_template', 'commissioned');
create type public.stamp_artwork_approval_status as enum ('draft', 'approved');
create type public.stamp_ink as enum (
  'vermilion', 'navy', 'teal', 'indigo', 'plum', 'moss', 'ochre', 'brick'
);
create type public.stamp_verification_method as enum ('geofence');

create table public.stamps (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  name text not null check (
    name = btrim(name) and length(name) > 0 and char_length(name) <= 120
  ),
  stamp_type text not null default 'atlas' check (stamp_type = 'atlas'),
  status public.atlas_stamp_status not null default 'draft',
  current_design_version integer check (current_design_version > 0),
  availability_start timestamptz,
  availability_end timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint stamps_availability_order check (
    availability_start is null
    or availability_end is null
    or availability_start < availability_end
  ),
  constraint stamps_active_has_current_design check (
    status <> 'active' or current_design_version is not null
  ),
  unique (id, shop_id)
);

-- There is exactly one standard Atlas Stamp that can issue for a shop. Retired
-- designs remain addressable by historical collection snapshots.
create unique index stamps_one_active_atlas_per_shop_idx
  on public.stamps (shop_id)
  where status = 'active' and stamp_type = 'atlas';
create index stamps_shop_status_idx on public.stamps (shop_id, status);
create trigger stamps_set_updated_at
  before update on public.stamps
  for each row execute function public.set_updated_at();

create table public.stamp_artwork_versions (
  id uuid primary key default gen_random_uuid(),
  stamp_id uuid not null references public.stamps(id) on delete restrict,
  design_version integer not null check (design_version > 0),
  artwork_kind public.stamp_artwork_kind not null,
  approval_status public.stamp_artwork_approval_status not null default 'draft',
  template_data jsonb,
  editable_source_key text,
  editable_source_sha256 text,
  clean_svg_key text,
  clean_svg_sha256 text,
  outlined_svg_key text,
  outlined_svg_sha256 text,
  transparent_png_key text,
  transparent_png_sha256 text,
  canvas_width integer not null default 1200,
  canvas_height integer not null default 800,
  ink public.stamp_ink not null,
  palette_version integer not null check (palette_version > 0),
  illustrator_credit text,
  illustrator_credit_url text,
  maker_mark_confirmed boolean not null default false,
  rights_basis text,
  approved_at timestamptz,
  approval_evidence_ref text,
  created_at timestamptz not null default statement_timestamp(),
  constraint stamp_artwork_version_unique unique (stamp_id, design_version),
  constraint stamp_artwork_canvas_is_master check (
    canvas_width = 1200 and canvas_height = 800
  ),
  constraint stamp_artwork_template_shape check (
    (artwork_kind = 'generated_template'
      and template_data is not null
      and jsonb_typeof(template_data) = 'object')
    or (artwork_kind = 'commissioned' and template_data is null)
  ),
  constraint stamp_artwork_credit_url_http check (
    illustrator_credit_url is null or illustrator_credit_url ~* '^https?://'
  ),
  constraint stamp_artwork_approval_complete check (
    (approval_status = 'draft' and approved_at is null)
    or (
      approval_status = 'approved'
      and approved_at is not null
      and approval_evidence_ref is not null
      and length(btrim(approval_evidence_ref)) > 0
    )
  ),
  constraint commissioned_stamp_artwork_complete check (
    artwork_kind <> 'commissioned'
    or approval_status <> 'approved'
    or (
      editable_source_key is not null and length(btrim(editable_source_key)) > 0
      and editable_source_sha256 ~ '^[0-9a-f]{64}$'
      and clean_svg_key is not null and length(btrim(clean_svg_key)) > 0
      and clean_svg_sha256 ~ '^[0-9a-f]{64}$'
      and outlined_svg_key is not null and length(btrim(outlined_svg_key)) > 0
      and outlined_svg_sha256 ~ '^[0-9a-f]{64}$'
      and transparent_png_key is not null and length(btrim(transparent_png_key)) > 0
      and transparent_png_sha256 ~ '^[0-9a-f]{64}$'
      and illustrator_credit is not null
      and length(btrim(coalesce(illustrator_credit, ''))) > 0
      and maker_mark_confirmed
      and rights_basis is not null
      and length(btrim(coalesce(rights_basis, ''))) > 0
    )
  )
);

create index stamp_artwork_versions_stamp_idx
  on public.stamp_artwork_versions (stamp_id, design_version desc);

alter table public.stamps
  add constraint stamps_current_artwork_version_fk
  foreign key (id, current_design_version)
  references public.stamp_artwork_versions (stamp_id, design_version)
  deferrable initially immediate;

create function public.validate_active_stamp_artwork()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'active' and not exists (
    select 1
    from public.stamp_artwork_versions artwork
    where artwork.stamp_id = new.id
      and artwork.design_version = new.current_design_version
      and artwork.approval_status = 'approved'
  ) then
    raise exception 'Active stamp requires an approved current artwork version'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger stamps_validate_active_artwork
  before insert or update of status, current_design_version on public.stamps
  for each row execute function public.validate_active_stamp_artwork();

create function public.protect_approved_stamp_artwork()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.approval_status = 'approved' then
    raise exception 'Approved stamp artwork versions are immutable'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger stamp_artwork_versions_protect_approved
  before update or delete on public.stamp_artwork_versions
  for each row execute function public.protect_approved_stamp_artwork();

create function public.assert_published_shop_has_active_stamp()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  shop_ids uuid[];
  checked_shop_id uuid;
begin
  if tg_table_name = 'shops' then
    shop_ids := array[new.id];
  elsif tg_op = 'INSERT' then
    shop_ids := array[new.shop_id];
  elsif tg_op = 'DELETE' then
    shop_ids := array[old.shop_id];
  else
    shop_ids := array[old.shop_id, new.shop_id];
  end if;

  foreach checked_shop_id in array shop_ids loop
    if exists (
      select 1 from public.shops
      where id = checked_shop_id and publication_status = 'published'
    ) and (
      select count(*) from public.stamps
      where shop_id = checked_shop_id
        and status = 'active'
        and stamp_type = 'atlas'
    ) <> 1 then
      raise exception 'Published shop requires exactly one active Atlas Stamp'
        using errcode = '23514';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Deferred enforcement allows an admin transaction to create/approve/activate
-- a replacement before retiring the old design. The transaction still cannot
-- commit a published shop with zero active Atlas Stamps.
create constraint trigger shops_require_active_atlas_stamp
  after insert or update of publication_status on public.shops
  deferrable initially deferred
  for each row execute function public.assert_published_shop_has_active_stamp();
create constraint trigger stamps_keep_published_shop_collectable
  after insert or update or delete on public.stamps
  deferrable initially deferred
  for each row execute function public.assert_published_shop_has_active_stamp();

create table public.stamp_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stamp_id uuid not null,
  shop_id uuid not null,
  stamp_design_version integer not null check (stamp_design_version > 0),
  collected_at timestamptz not null default statement_timestamp(),
  shop_timezone text not null,
  verification_method public.stamp_verification_method not null,
  verification_version integer not null check (verification_version > 0),
  distance_m integer check (distance_m is null or distance_m >= 0),
  reported_accuracy_m integer check (
    reported_accuracy_m is null or reported_accuracy_m >= 0
  ),
  anomaly_flags text[] not null default '{}'::text[],
  shop_name_snapshot text not null check (length(btrim(shop_name_snapshot)) > 0),
  place_snapshot jsonb not null,
  stamp_snapshot jsonb not null,
  constraint stamp_collections_owner_stamp_unique unique (user_id, stamp_id),
  constraint stamp_collections_stamp_shop_fk
    foreign key (stamp_id, shop_id)
    references public.stamps (id, shop_id) on delete restrict,
  constraint stamp_collections_artwork_version_fk
    foreign key (stamp_id, stamp_design_version)
    references public.stamp_artwork_versions (stamp_id, design_version)
    on delete restrict,
  constraint stamp_collections_place_snapshot_valid check (
    jsonb_typeof(place_snapshot) = 'object'
    and place_snapshot ?& array[
      'countryCode', 'countryLabel', 'localityName', 'localitySlug'
    ]
    and coalesce(place_snapshot->>'countryCode', '') ~ '^[A-Z]{2}$'
    and length(btrim(coalesce(place_snapshot->>'countryLabel', ''))) > 0
    and length(btrim(coalesce(place_snapshot->>'localityName', ''))) > 0
    and coalesce(place_snapshot->>'localitySlug', '') ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint stamp_collections_stamp_snapshot_valid check (
    jsonb_typeof(stamp_snapshot) = 'object'
    and stamp_snapshot ?& array[
      'id', 'designVersion', 'artworkKind', 'ink', 'paletteVersion'
    ]
    and coalesce(stamp_snapshot->>'id', '') = stamp_id::text
    and coalesce(stamp_snapshot->>'designVersion', '') = stamp_design_version::text
    and coalesce(stamp_snapshot->>'artworkKind', '') in ('generated_template', 'commissioned')
    and coalesce(stamp_snapshot->>'ink', '') in (
      'vermilion', 'navy', 'teal', 'indigo', 'plum', 'moss', 'ochre', 'brick'
    )
    and coalesce(stamp_snapshot->>'paletteVersion', '') ~ '^[1-9][0-9]*$'
    and (
      stamp_snapshot->>'artworkKind' <> 'generated_template'
      or jsonb_typeof(stamp_snapshot->'templateData') = 'object'
    )
    and (
      stamp_snapshot->>'artworkKind' <> 'commissioned'
      or length(btrim(coalesce(stamp_snapshot->>'illustratorCredit', ''))) > 0
    )
  ),
  constraint stamp_collections_anomaly_flags_valid check (
    array_position(anomaly_flags, null) is null
  )
);

create index stamp_collections_user_collected_idx
  on public.stamp_collections (user_id, collected_at desc, id);
create index stamp_collections_shop_idx
  on public.stamp_collections (shop_id);

create function public.validate_collection_timezone()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.shop_timezone
  ) then
    raise exception 'Unknown IANA timezone: %', new.shop_timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create function public.validate_collection_stamp_snapshot()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  artwork public.stamp_artwork_versions%rowtype;
begin
  select versions.* into artwork
  from public.stamps stamp
  join public.stamp_artwork_versions versions
    on versions.stamp_id = stamp.id
    and versions.design_version = stamp.current_design_version
  where stamp.id = new.stamp_id
    and stamp.status = 'active'
    and stamp.current_design_version = new.stamp_design_version
    and versions.approval_status = 'approved';

  if not found then
    raise exception 'Collection requires the active approved stamp design'
      using errcode = '23514';
  end if;

  if new.stamp_snapshot->>'artworkKind' <> artwork.artwork_kind::text
    or new.stamp_snapshot->>'ink' <> artwork.ink::text
    or new.stamp_snapshot->>'paletteVersion' <> artwork.palette_version::text
    or (
      artwork.artwork_kind = 'generated_template'
      and new.stamp_snapshot->'templateData' is distinct from artwork.template_data
    )
    or (
      artwork.artwork_kind = 'commissioned'
      and new.stamp_snapshot->>'illustratorCredit'
        is distinct from artwork.illustrator_credit
    )
  then
    raise exception 'Collection stamp snapshot does not match approved artwork'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger stamp_collections_validate_timezone
  before insert on public.stamp_collections
  for each row execute function public.validate_collection_timezone();
create trigger stamp_collections_validate_stamp_snapshot
  before insert on public.stamp_collections
  for each row execute function public.validate_collection_stamp_snapshot();

alter table public.stamps enable row level security;
alter table public.stamps force row level security;
alter table public.stamp_artwork_versions enable row level security;
alter table public.stamp_artwork_versions force row level security;
alter table public.stamp_collections enable row level security;
alter table public.stamp_collections force row level security;

revoke all on table public.stamps, public.stamp_artwork_versions,
  public.stamp_collections from public, anon, authenticated, service_role;
grant all on table public.stamps, public.stamp_artwork_versions to service_role;
grant select, insert on table public.stamp_collections to service_role;
grant select on table public.stamp_collections to authenticated;

create policy stamp_collections_select_own
on public.stamp_collections
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on function public.validate_active_stamp_artwork() from public;
revoke all on function public.protect_approved_stamp_artwork() from public;
revoke all on function public.assert_published_shop_has_active_stamp() from public;
revoke all on function public.validate_collection_timezone() from public;
revoke all on function public.validate_collection_stamp_snapshot() from public;
