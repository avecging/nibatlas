-- Milestone 2, work package 1: production-shaped catalogue foundation.
-- User/auth state and stamp issuance deliberately remain for later milestones.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.locality_kind as enum ('city', 'ward', 'district', 'municipality', 'region', 'other');
create type public.shop_operational_status as enum ('open', 'temporarily_closed', 'permanently_closed', 'unknown');
create type public.shop_publication_status as enum ('draft', 'published', 'archived');
create type public.source_quality as enum ('verified', 'sourced', 'community_unverified', 'demo');
create type public.source_status as enum ('active', 'stale', 'unavailable');
create type public.image_moderation_status as enum ('draft', 'approved', 'rejected');

create function public.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create function public.validate_iana_timezone()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown IANA timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create table public.localities (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  admin_area_code text,
  admin_area_name text,
  name text not null check (length(btrim(name)) > 0),
  name_local text,
  name_local_language_tag text,
  locality_type public.locality_kind not null,
  parent_locality_id uuid references public.localities(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  centroid extensions.geometry(Point, 4326),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint localities_local_name_pair check (
    (name_local is null and name_local_language_tag is null)
    or (name_local is not null and length(btrim(name_local)) > 0
      and name_local_language_tag ~ '^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$')
  ),
  constraint localities_parent_not_self check (parent_locality_id is distinct from id),
  constraint localities_centroid_longitude check (centroid is null or extensions.st_x(centroid) between -180 and 180),
  constraint localities_centroid_latitude check (centroid is null or extensions.st_y(centroid) between -90 and 90),
  unique nulls not distinct (country_code, parent_locality_id, slug)
);

create index localities_country_idx on public.localities (country_code);
create index localities_parent_idx on public.localities (parent_locality_id);
create index localities_centroid_gist_idx on public.localities using gist (centroid);
create index localities_name_trgm_idx on public.localities using gin (lower(name) extensions.gin_trgm_ops);
create trigger localities_set_updated_at before update on public.localities
  for each row execute function public.set_updated_at();

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) > 0),
  short_description text,
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  admin_area_code text,
  admin_area_name text,
  locality_id uuid references public.localities(id) on delete restrict,
  city_display text,
  neighbourhood text,
  timezone text not null,
  location extensions.geometry(Point, 4326) not null,
  phone text,
  website_url text,
  opening_hours jsonb,
  appointment_required boolean not null default false,
  accessibility_notes text,
  operational_status public.shop_operational_status not null default 'unknown',
  publication_status public.shop_publication_status not null default 'draft',
  source_quality public.source_quality not null default 'community_unverified',
  last_verified_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint shops_description_not_blank check (short_description is null or length(btrim(short_description)) > 0),
  constraint shops_website_url_http check (website_url is null or website_url ~* '^https?://'),
  constraint shops_opening_hours_object check (opening_hours is null or jsonb_typeof(opening_hours) = 'object'),
  constraint shops_location_longitude check (extensions.st_x(location) between -180 and 180),
  constraint shops_location_latitude check (extensions.st_y(location) between -90 and 90),
  constraint shops_publication_timestamp check (
    (publication_status = 'published' and published_at is not null) or publication_status <> 'published'
  )
);

create index shops_location_gist_idx on public.shops using gist (location);
create index shops_publication_operation_idx on public.shops (publication_status, operational_status);
create index shops_country_locality_idx on public.shops (country_code, locality_id);
create index shops_name_trgm_idx on public.shops using gin (lower(name) extensions.gin_trgm_ops);
create trigger shops_set_updated_at before update on public.shops
  for each row execute function public.set_updated_at();
create trigger shops_validate_timezone before insert or update of timezone on public.shops
  for each row execute function public.validate_iana_timezone();

create table public.shop_aliases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  alias text not null check (length(btrim(alias)) > 0),
  language_tag text not null check (language_tag ~ '^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$'),
  alias_type text not null check (alias_type in ('local_name', 'romanization', 'former_name', 'search_synonym')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (shop_id, alias)
);
create unique index shop_aliases_normalized_unique_idx on public.shop_aliases (shop_id, lower(alias));
create index shop_aliases_search_trgm_idx on public.shop_aliases using gin (lower(alias) extensions.gin_trgm_ops);
create trigger shop_aliases_set_updated_at before update on public.shop_aliases
  for each row execute function public.set_updated_at();

create table public.shop_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  link_type text not null check (link_type in ('website', 'instagram', 'facebook', 'x', 'line', 'directions', 'contact')),
  url text not null check (url ~* '^https?://'),
  label text,
  is_official boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (shop_id, url)
);
create index shop_links_shop_sort_idx on public.shop_links (shop_id, sort_order, id);
create trigger shop_links_set_updated_at before update on public.shop_links
  for each row execute function public.set_updated_at();

create table public.shop_images (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  storage_key text not null unique check (length(btrim(storage_key)) > 0),
  alt_text text,
  credit_text text,
  source_url text,
  rights_basis text,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  sort_order integer not null default 0 check (sort_order >= 0),
  moderation_status public.image_moderation_status not null default 'draft',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint approved_image_metadata check (
    moderation_status <> 'approved' or (
      alt_text is not null and length(btrim(alt_text)) > 0
      and credit_text is not null and length(btrim(credit_text)) > 0
      and rights_basis is not null and length(btrim(rights_basis)) > 0)
  ),
  constraint shop_images_source_url_http check (source_url is null or source_url ~* '^https?://')
);
create index shop_images_shop_sort_idx on public.shop_images (shop_id, sort_order, id);
create trigger shop_images_set_updated_at before update on public.shop_images
  for each row execute function public.set_updated_at();

create table public.shop_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  label text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0)
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  label text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0)
);
create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  label text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0)
);
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create trigger brands_set_updated_at before update on public.brands
  for each row execute function public.set_updated_at();

create table public.shop_sources (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  source_type text not null check (length(btrim(source_type)) > 0),
  source_url text,
  checked_at timestamptz not null,
  reliability text not null check (reliability in ('primary', 'secondary', 'direct', 'unknown')),
  evidence_note text,
  status public.source_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint shop_sources_url_http check (source_url is null or source_url ~* '^https?://')
);
create index shop_sources_shop_checked_idx on public.shop_sources (shop_id, checked_at desc);
create trigger shop_sources_set_updated_at before update on public.shop_sources
  for each row execute function public.set_updated_at();

create table public.shop_shop_types (
  shop_id uuid not null references public.shops(id) on delete cascade,
  shop_type_id uuid not null references public.shop_types(id) on delete restrict,
  note text,
  source_id uuid references public.shop_sources(id) on delete set null,
  last_verified_at timestamptz,
  primary key (shop_id, shop_type_id)
);
create table public.shop_services (
  shop_id uuid not null references public.shops(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  note text,
  source_id uuid references public.shop_sources(id) on delete set null,
  last_verified_at timestamptz,
  primary key (shop_id, service_id)
);
create table public.shop_specialties (
  shop_id uuid not null references public.shops(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  note text,
  source_id uuid references public.shop_sources(id) on delete set null,
  last_verified_at timestamptz,
  primary key (shop_id, specialty_id)
);
create table public.shop_brands (
  shop_id uuid not null references public.shops(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete restrict,
  note text,
  source_id uuid references public.shop_sources(id) on delete set null,
  last_verified_at timestamptz,
  primary key (shop_id, brand_id)
);

-- Direct table access is reserved for trusted server/admin paths. Public views
-- below expose only fields safe for anonymous catalogue reads.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'localities', 'shops', 'shop_aliases', 'shop_links', 'shop_images',
    'shop_types', 'services', 'specialties', 'brands', 'shop_sources',
    'shop_shop_types', 'shop_services', 'shop_specialties', 'shop_brands'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end;
$$;

create view public.published_shop_markers with (security_barrier = true) as
select s.id, s.slug, s.name, s.country_code, s.locality_id, s.city_display,
  s.operational_status,
  extensions.st_x(s.location)::double precision as longitude,
  extensions.st_y(s.location)::double precision as latitude,
  s.last_verified_at, s.updated_at
from public.shops s
where s.publication_status = 'published';

create view public.published_shop_details with (security_barrier = true) as
select s.id, s.slug, s.name, s.short_description, s.address_line_1,
  s.address_line_2, s.postal_code, s.country_code, s.admin_area_name,
  s.locality_id, s.city_display, s.neighbourhood, s.timezone,
  extensions.st_x(s.location)::double precision as longitude,
  extensions.st_y(s.location)::double precision as latitude,
  s.phone, s.website_url, s.opening_hours, s.appointment_required,
  s.accessibility_notes, s.operational_status, s.source_quality,
  s.last_verified_at, s.updated_at
from public.shops s
where s.publication_status = 'published';

revoke all on public.published_shop_markers, public.published_shop_details from public;
grant select on public.published_shop_markers, public.published_shop_details to anon, authenticated, service_role;
comment on view public.published_shop_markers is 'Public marker projection. Viewport/filter RPCs supersede direct reads in M2 WP2.';
comment on view public.published_shop_details is 'Public detail projection; deliberately excludes publication controls and provenance evidence.';
revoke all on function public.set_updated_at() from public;
revoke all on function public.validate_iana_timezone() from public;
