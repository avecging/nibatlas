-- Deterministic local/test/staging fixtures only. These invented records are
-- explicitly source_quality='demo' and must never enter the production import
-- path. Inserts are idempotent so CI can safely re-run the staging seed.

begin;

insert into public.localities (
  id, country_code, name, name_local, name_local_language_tag,
  locality_type, slug, centroid
) values
  (
    '00000000-0000-4000-8000-000000000201', 'SG', 'Singapore', null, null,
    'city', 'singapore', extensions.st_setsrid(extensions.st_makepoint(103.8198, 1.3521), 4326)
  ),
  (
    '00000000-0000-4000-8000-000000000202', 'JP', 'Tokyo', '東京都', 'ja-JP',
    'region', 'tokyo', extensions.st_setsrid(extensions.st_makepoint(139.6917, 35.6895), 4326)
  )
on conflict do nothing;

insert into public.shops (
  id, slug, name, short_description, country_code, locality_id, city_display,
  timezone, location, operational_status, publication_status, source_quality,
  last_verified_at, published_at
) values
  (
    '00000000-0000-4000-8000-000000000301', 'm2-singapore-demo-fixture',
    'M2 Singapore Demo Fixture',
    'Invented local-only record for database contract tests.',
    'SG', '00000000-0000-4000-8000-000000000201', 'Singapore',
    'Asia/Singapore',
    extensions.st_setsrid(extensions.st_makepoint(103.851959, 1.290270), 4326),
    'unknown', 'published', 'demo', '2026-09-02 00:00:00+00', '2026-09-02 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000302', 'm2-tokyo-demo-fixture',
    'M2 Tokyo Demo Fixture',
    'Invented local-only multilingual search fixture.',
    'JP', '00000000-0000-4000-8000-000000000202', 'Tokyo',
    'Asia/Tokyo',
    extensions.st_setsrid(extensions.st_makepoint(139.767125, 35.681236), 4326),
    'unknown', 'published', 'demo', '2026-09-02 00:00:00+00', '2026-09-02 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000303', 'm2-draft-fixture',
    'M2 Draft Fixture', null,
    'SG', '00000000-0000-4000-8000-000000000201', 'Singapore',
    'Asia/Singapore',
    extensions.st_setsrid(extensions.st_makepoint(103.860000, 1.300000), 4326),
    'unknown', 'draft', 'demo', null, null
  )
on conflict do nothing;

insert into public.shop_aliases (id, shop_id, alias, language_tag, alias_type) values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000302',
  '第二期東京デモ店舗', 'ja-JP', 'local_name'
)
on conflict do nothing;

insert into public.shop_sources (
  id, shop_id, label, source_type, checked_at, reliability, evidence_note, status
) values
  (
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000301', 'Demo fixture', 'demo_fixture',
    '2026-09-02 00:00:00+00', 'unknown',
    'Invented deterministic fixture; not a real business.', 'active'
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000302', 'Demo fixture', 'demo_fixture',
    '2026-09-02 00:00:00+00', 'unknown',
    'Invented deterministic fixture; not a real business.', 'active'
  ),
  (
    '00000000-0000-4000-8000-000000000503',
    '00000000-0000-4000-8000-000000000303', 'Demo fixture', 'demo_fixture',
    '2026-09-02 00:00:00+00', 'unknown',
    'Invented deterministic fixture; not a real business.', 'active'
  )
on conflict do nothing;

insert into public.shop_source_claims (shop_id, source_id, claim_token) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000501', 'Name'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000501', 'Short description'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000501', 'Shop type: Fountain Pen Specialist'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000502', 'Name'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000502', 'Local-script name'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000502', 'Shop type: Stationery Store'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000503', 'Name')
on conflict do nothing;

insert into public.shop_shop_types (shop_id, shop_type_id, source_id, is_primary) values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000501', true
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000502', true
  )
on conflict do nothing;

-- Milestone 5 generated-template Atlas Stamps. These remain visibly tied to
-- demo shops and provide deterministic staging data until commissioned artwork
-- has completed its separate approval workflow.
insert into public.stamps (id, shop_id, name) values
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000301',
    'M2 Singapore Demo Atlas Stamp'
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000302',
    'M2 Tokyo Demo Atlas Stamp'
  )
on conflict (id) do nothing;

insert into public.stamp_artwork_versions (
  id, stamp_id, design_version, artwork_kind, approval_status, template_data,
  ink, palette_version, approved_at, approval_evidence_ref
) values
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000601', 1,
    'generated_template', 'approved',
    '{"tier":"shop","motif":"storefront"}',
    'teal', 1, '2026-09-12 00:00:00+00', 'deterministic-demo-fixture'
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    '00000000-0000-4000-8000-000000000602', 1,
    'generated_template', 'approved',
    '{"tier":"shop","motif":"counter"}',
    'indigo', 1, '2026-09-12 00:00:00+00', 'deterministic-demo-fixture'
  )
on conflict (id) do nothing;

update public.stamps
set status = 'active', current_design_version = 1
where id in (
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000602'
);

commit;
