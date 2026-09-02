-- Deterministic local/test fixtures only. These invented records are explicitly
-- source_quality='demo' and must never enter the production import path.

insert into public.shop_types (id, code, label, sort_order) values
  ('00000000-0000-4000-8000-000000000101', 'fountain_pen_specialist', 'Fountain Pen Specialist', 10),
  ('00000000-0000-4000-8000-000000000102', 'stationery_store', 'Stationery Store', 20),
  ('00000000-0000-4000-8000-000000000103', 'vintage_used', 'Vintage / Used', 30),
  ('00000000-0000-4000-8000-000000000104', 'nib_repair_services', 'Nib / Repair Services', 40);

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
  );

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
  );

insert into public.shop_aliases (id, shop_id, alias, language_tag, alias_type) values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000302',
  '第二期東京デモ店舗', 'ja-JP', 'local_name'
);

insert into public.shop_sources (
  id, shop_id, source_type, checked_at, reliability, evidence_note, status
) values
  (
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000301', 'demo_fixture',
    '2026-09-02 00:00:00+00', 'unknown',
    'Invented deterministic fixture; not a real business.', 'active'
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000302', 'demo_fixture',
    '2026-09-02 00:00:00+00', 'unknown',
    'Invented deterministic fixture; not a real business.', 'active'
  ),
  (
    '00000000-0000-4000-8000-000000000503',
    '00000000-0000-4000-8000-000000000303', 'demo_fixture',
    '2026-09-02 00:00:00+00', 'unknown',
    'Invented deterministic fixture; not a real business.', 'active'
  );

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
  );
