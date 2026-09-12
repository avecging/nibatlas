-- Run atomically with psql --single-transaction, only after verifying the remote
-- project's identity is nibatlas-staging. Not part of seed.sql or migrations.
-- Tests set the same opt-in inside a rolled-back local transaction.
do $$ begin
  if current_setting('nibatlas.fixture_environment', true) is distinct from 'staging' then
    raise exception 'Staging fixture requires explicit staging environment' using errcode = '42501';
  end if;
  if exists (select 1 from public.shops where id = '00000000-0000-4000-8000-000000000304'
    and (source_quality <> 'demo' or slug <> 'location-test-fairprice-compassvale-link')) then
    raise exception 'Reserved staging fixture identity collision';
  end if;
end $$;

insert into public.shops (
  id, slug, name, short_description, address_line_1, address_line_2, postal_code,
  country_code, locality_id, city_display, timezone, location, position_precision,
  operational_status, publication_status, source_quality, published_at
) values (
  '00000000-0000-4000-8000-000000000304', 'location-test-fairprice-compassvale-link',
  'Location test — FairPrice Compassvale Link',
  'Staging GPS test at a real supermarket inside Aspella. Not a fountain pen shop, partner or endorsement. Generated test stamp. Approximate venue pin; entrance, floor and unit position are not verified.',
  '277C Compassvale Link', '#01-13 Aspella, Singapore 543277', '543277',
  'SG', '00000000-0000-4000-8000-000000000201', 'Singapore', 'Asia/Singapore',
  extensions.st_setsrid(extensions.st_makepoint(103.8938611, 1.3824209), 4326), 'street',
  'unknown', 'published', 'demo', '2026-09-12 00:00:00+00'
) on conflict (id) do nothing;

insert into public.shop_sources (
  id, shop_id, label, source_type, source_url, checked_at, reliability, evidence_note
) values (
  '00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000304',
  'Staging test — Maps venue pin and public address sources', 'demo_fixture',
  'https://maps.app.goo.gl/Yju14sxNkKPj64RQ7', '2026-09-12 00:00:00+00', 'unknown',
  'Pin extracted from resolved Maps place !3d/!4d fields; Waze navigation destination agrees. Not a surveyed entrance or floor/unit. Postcode 543277 agrees with Maps, FairPrice store locator and Fish Soup Paradise. FairPrice service-counter page gives conflicting 544277. See docs/runbooks/staging-phone-test.md for provenance and limitations.'
) on conflict (id) do nothing;
insert into public.shop_source_claims (shop_id, source_id, claim_token) values
('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000504', 'Name'),
('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000504', 'Address')
on conflict do nothing;
insert into public.shop_shop_types (shop_id, shop_type_id, source_id, is_primary) values
('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000105',
 '00000000-0000-4000-8000-000000000504', true) on conflict do nothing;
insert into public.stamps (id, shop_id, name) values
('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000304',
 'Generated staging location test stamp') on conflict (id) do nothing;
insert into public.stamp_artwork_versions (
  id, stamp_id, design_version, artwork_kind, approval_status, template_data,
  ink, palette_version, approved_at, approval_evidence_ref
) values (
  '00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000604',
  1, 'generated_template', 'approved', '{"tier":"shop","motif":"storefront"}',
  'indigo', 1, '2026-09-12 00:00:00+00', 'generated-staging-test-not-commissioned'
) on conflict (id) do nothing;
update public.stamps set status = 'active', current_design_version = 1
where id = '00000000-0000-4000-8000-000000000604' and status = 'draft' and current_design_version is null;
-- No verification-policy override, photo upload, collection reset or GPS bypass.
