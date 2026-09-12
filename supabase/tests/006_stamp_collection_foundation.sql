begin;
select plan(36);

select has_table('public', 'stamps', 'stamps table exists');
select has_table('public', 'stamp_artwork_versions', 'artwork versions table exists');
select has_table('public', 'stamp_collections', 'stamp collections table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.stamps'::regclass),
  'RLS is enabled on stamps'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.stamps'::regclass),
  'RLS is forced on stamps'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.stamp_artwork_versions'::regclass),
  'RLS is enabled on artwork versions'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.stamp_artwork_versions'::regclass),
  'RLS is forced on artwork versions'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.stamp_collections'::regclass),
  'RLS is enabled on collections'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.stamp_collections'::regclass),
  'RLS is forced on collections'
);

select ok(not has_table_privilege('anon', 'public.stamps', 'SELECT'),
  'anonymous users cannot read canonical stamps');
select ok(not has_table_privilege('authenticated', 'public.stamp_artwork_versions', 'SELECT'),
  'authenticated users cannot read artwork approval evidence directly');
select ok(has_table_privilege('authenticated', 'public.stamp_collections', 'SELECT'),
  'authenticated users may read collections through RLS');
select ok(not has_table_privilege('authenticated', 'public.stamp_collections', 'INSERT'),
  'authenticated users cannot issue collections directly');
select ok(not has_table_privilege('authenticated', 'public.stamp_collections', 'UPDATE'),
  'authenticated users cannot rewrite collection history');
select ok(not has_table_privilege('authenticated', 'public.stamp_collections', 'DELETE'),
  'authenticated users cannot delete collection history');
select ok(not has_table_privilege('service_role', 'public.stamp_collections', 'UPDATE'),
  'the server role cannot mutate issued collections');
select ok(not has_table_privilege('service_role', 'public.stamp_collections', 'DELETE'),
  'the server role cannot delete issued collections');

insert into auth.users (id, aud, role, email) values
  ('10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'collector-one@example.test'),
  ('10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'collector-two@example.test');

insert into public.stamps (id, shop_id, name) values
  ('00000000-0000-4000-8000-000000000611', '00000000-0000-4000-8000-000000000301', 'Singapore demo Atlas Stamp'),
  ('00000000-0000-4000-8000-000000000612', '00000000-0000-4000-8000-000000000302', 'Tokyo demo Atlas Stamp');

select throws_ok($activate_without_artwork$
  update public.stamps
  set status = 'active', current_design_version = 1
  where id = '00000000-0000-4000-8000-000000000611'
$activate_without_artwork$,
  '23514',
  'Active stamp requires an approved current artwork version',
  'a stamp cannot activate without approved artwork'
);

insert into public.stamp_artwork_versions (
  id, stamp_id, design_version, artwork_kind, approval_status,
  template_data, ink, palette_version, approved_at, approval_evidence_ref
) values
  (
    '00000000-0000-4000-8000-000000000711',
    '00000000-0000-4000-8000-000000000611', 1,
    'generated_template', 'approved',
    '{"tier":"shop","motif":"storefront"}', 'teal', 1,
    '2026-09-12 00:00:00+00', 'test-fixture-approval'
  ),
  (
    '00000000-0000-4000-8000-000000000712',
    '00000000-0000-4000-8000-000000000612', 1,
    'generated_template', 'approved',
    '{"tier":"shop","motif":"counter"}', 'indigo', 1,
    '2026-09-12 00:00:00+00', 'test-fixture-approval'
  );

select throws_ok($incomplete_commissioned_art$
  insert into public.stamp_artwork_versions (
    stamp_id, design_version, artwork_kind, approval_status,
    ink, palette_version, approved_at, approval_evidence_ref
  ) values (
    '00000000-0000-4000-8000-000000000611', 2,
    'commissioned', 'approved', 'plum', 1,
    '2026-09-12 00:00:00+00', 'missing-files'
  )
$incomplete_commissioned_art$,
  '23514',
  null,
  'commissioned artwork cannot be approved without files, checksums, credit, rights and maker mark'
);

select throws_ok($mutate_approved_artwork$
  update public.stamp_artwork_versions
  set ink = 'navy'
  where id = '00000000-0000-4000-8000-000000000711'
$mutate_approved_artwork$,
  '55000',
  'Approved stamp artwork versions are immutable',
  'approved artwork cannot be changed'
);

select throws_ok($delete_approved_artwork$
  delete from public.stamp_artwork_versions
  where id = '00000000-0000-4000-8000-000000000711'
$delete_approved_artwork$,
  '55000',
  'Approved stamp artwork versions are immutable',
  'approved artwork cannot be deleted'
);

update public.stamps
set status = 'active', current_design_version = 1
where id in (
  '00000000-0000-4000-8000-000000000611',
  '00000000-0000-4000-8000-000000000612'
);

select is(
  (select count(*)::integer from public.stamps where status = 'active'),
  2,
  'stamps activate against approved artwork versions'
);

insert into public.stamps (id, shop_id, name) values (
  '00000000-0000-4000-8000-000000000613',
  '00000000-0000-4000-8000-000000000301',
  'Conflicting active stamp'
);
insert into public.stamp_artwork_versions (
  stamp_id, design_version, artwork_kind, approval_status,
  template_data, ink, palette_version, approved_at, approval_evidence_ref
) values (
  '00000000-0000-4000-8000-000000000613', 1,
  'generated_template', 'approved', '{"tier":"shop","motif":"nib"}',
  'plum', 1, '2026-09-12 00:00:00+00', 'test-fixture-approval'
);
select throws_ok($second_active_shop_stamp$
  update public.stamps
  set status = 'active', current_design_version = 1
  where id = '00000000-0000-4000-8000-000000000613'
$second_active_shop_stamp$,
  '23505',
  null,
  'a shop cannot have two active Atlas Stamps'
);

insert into public.stamp_collections (
  id, user_id, stamp_id, shop_id, stamp_design_version, collected_at,
  shop_timezone, verification_method, verification_version,
  distance_m, reported_accuracy_m, shop_name_snapshot,
  place_snapshot, stamp_snapshot
) values (
  '00000000-0000-4000-8000-000000000801',
  '10000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000611',
  '00000000-0000-4000-8000-000000000301', 1,
  '2026-09-12 01:00:00+00', 'Asia/Singapore', 'geofence', 1,
  42, 18, 'Singapore demo fixture',
  '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
  '{"id":"00000000-0000-4000-8000-000000000611","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}'
);

select is((select count(*)::integer from public.stamp_collections), 1,
  'a server-issued collection is stored once');
select is(
  (select place_snapshot->>'countryCode' from public.stamp_collections),
  'SG',
  'collection preserves its place snapshot'
);
select is(
  (select stamp_snapshot->>'ink' from public.stamp_collections),
  'teal',
  'collection preserves its stamp design snapshot'
);

select throws_ok($duplicate_collection$
  insert into public.stamp_collections (
    user_id, stamp_id, shop_id, stamp_design_version, shop_timezone,
    verification_method, verification_version, shop_name_snapshot,
    place_snapshot, stamp_snapshot
  ) values (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000611',
    '00000000-0000-4000-8000-000000000301', 1, 'Asia/Singapore',
    'geofence', 1, 'Duplicate',
    '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
    '{"id":"00000000-0000-4000-8000-000000000611","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}'
  )
$duplicate_collection$,
  '23505',
  null,
  'one user cannot collect the same stamp twice'
);

select throws_ok($wrong_shop_for_stamp$
  insert into public.stamp_collections (
    user_id, stamp_id, shop_id, stamp_design_version, shop_timezone,
    verification_method, verification_version, shop_name_snapshot,
    place_snapshot, stamp_snapshot
  ) values (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000611',
    '00000000-0000-4000-8000-000000000302', 1, 'Asia/Singapore',
    'geofence', 1, 'Wrong shop',
    '{"countryCode":"SG","countryLabel":"Singapore","localityName":"Singapore","localitySlug":"singapore"}',
    '{"id":"00000000-0000-4000-8000-000000000611","designVersion":1,"artworkKind":"generated_template","ink":"teal","paletteVersion":1,"templateData":{"tier":"shop","motif":"storefront"}}'
  )
$wrong_shop_for_stamp$,
  '23503',
  null,
  'a collection cannot pair a stamp with another shop'
);

select throws_ok($wrong_artwork_snapshot_version$
  insert into public.stamp_collections (
    user_id, stamp_id, shop_id, stamp_design_version, shop_timezone,
    verification_method, verification_version, shop_name_snapshot,
    place_snapshot, stamp_snapshot
  ) values (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000612',
    '00000000-0000-4000-8000-000000000302', 1, 'Asia/Tokyo',
    'geofence', 1, 'Wrong version snapshot',
    '{"countryCode":"JP","countryLabel":"Japan","localityName":"Tokyo","localitySlug":"tokyo"}',
    '{"id":"00000000-0000-4000-8000-000000000612","designVersion":2,"artworkKind":"generated_template","ink":"indigo","paletteVersion":1,"templateData":{"tier":"shop","motif":"counter"}}'
  )
$wrong_artwork_snapshot_version$,
  '23514',
  null,
  'snapshot design version must match the referenced artwork version'
);

select throws_ok($snapshot_differs_from_artwork$
  insert into public.stamp_collections (
    user_id, stamp_id, shop_id, stamp_design_version, shop_timezone,
    verification_method, verification_version, shop_name_snapshot,
    place_snapshot, stamp_snapshot
  ) values (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000612',
    '00000000-0000-4000-8000-000000000302', 1, 'Asia/Tokyo',
    'geofence', 1, 'Altered snapshot',
    '{"countryCode":"JP","countryLabel":"Japan","localityName":"Tokyo","localitySlug":"tokyo"}',
    '{"id":"00000000-0000-4000-8000-000000000612","designVersion":1,"artworkKind":"generated_template","ink":"plum","paletteVersion":1,"templateData":{"tier":"shop","motif":"counter"}}'
  )
$snapshot_differs_from_artwork$,
  '23514',
  'Collection stamp snapshot does not match approved artwork',
  'a collection cannot alter the approved ink or artwork descriptor'
);

select throws_ok($raw_coordinates_are_not_columns$
  insert into public.stamp_collections (
    user_id, stamp_id, shop_id, stamp_design_version, shop_timezone,
    verification_method, verification_version, shop_name_snapshot,
    place_snapshot, stamp_snapshot, latitude, longitude
  ) values (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000612',
    '00000000-0000-4000-8000-000000000302', 1, 'Asia/Tokyo',
    'geofence', 1, 'Coordinates forbidden', '{}'::jsonb, '{}'::jsonb, 1, 2
  )
$raw_coordinates_are_not_columns$,
  '42703',
  null,
  'the collection schema has no raw coordinate columns'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);

select is((select count(*)::integer from public.stamp_collections), 1,
  'a signed-in user sees their own collection');

select throws_ok($direct_collection_insert$
  insert into public.stamp_collections (
    user_id, stamp_id, shop_id, stamp_design_version, shop_timezone,
    verification_method, verification_version, shop_name_snapshot,
    place_snapshot, stamp_snapshot
  ) values (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000612',
    '00000000-0000-4000-8000-000000000302', 1, 'Asia/Tokyo',
    'geofence', 1, 'Direct insert forbidden',
    '{"countryCode":"JP","countryLabel":"Japan","localityName":"Tokyo","localitySlug":"tokyo"}',
    '{"id":"00000000-0000-4000-8000-000000000612","designVersion":1,"artworkKind":"generated_template","ink":"indigo","paletteVersion":1,"templateData":{"tier":"shop","motif":"counter"}}'
  )
$direct_collection_insert$,
  '42501',
  'permission denied for table stamp_collections',
  'a browser session cannot issue a collection directly'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', true);
select is((select count(*)::integer from public.stamp_collections), 0,
  'another account cannot read someone else''s collection');

reset role;
select is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name = 'stamp_collections'
     and column_name in ('latitude', 'longitude', 'coordinates', 'location')),
  0,
  'no raw location column exists on collections'
);

select is(
  (select count(*)::integer from public.stamp_collections
   where user_id = '10000000-0000-4000-8000-000000000005'),
  1,
  'RLS testing did not alter immutable collection history'
);

select * from finish();
rollback;
