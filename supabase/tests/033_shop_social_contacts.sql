begin;
select no_plan();
create or replace function pg_temp.legacy_edit_document(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object('shop', jsonb_build_object(
'feature_headline', s.feature_headline,
'field_note_heading', s.field_note_heading,
'field_note_body', s.field_note_body,
'local_address', s.local_address,
'unit_floor', s.unit_floor,
'nearest_station', s.nearest_station,
'station_exit', s.station_exit,
'walking_guidance', s.walking_guidance,
'entrance_notes', s.entrance_notes,
'editions_text', s.editions_text,
'payment_methods', s.payment_methods,
'languages', s.languages,
'holiday_note', s.holiday_note,
'internal_notes', s.internal_notes,
'reference_links', s.reference_links,
'slug', s.slug,
'name', s.name,
'short_description', s.short_description,
'address_line_1', s.address_line_1,
'address_line_2', s.address_line_2,
'postal_code', s.postal_code,
'country_code', s.country_code,
'admin_area_code', s.admin_area_code,
'admin_area_name', s.admin_area_name,
'locality_id', s.locality_id,
'city_display', s.city_display,
'neighbourhood', s.neighbourhood,
'timezone', s.timezone,
'phone', s.phone,
'website_url', s.website_url,
'appointment_required', s.appointment_required,
'accessibility_notes', s.accessibility_notes,
'operational_status', s.operational_status,
'source_quality', s.source_quality,
'last_verified_at', s.last_verified_at,
'position_precision', s.position_precision, 'latitude', extensions.st_y(s.location), 'longitude', extensions.st_x(s.location),
'opening_hours', s.opening_hours),
'experiences', s.editorial_experiences,
'aliases', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'alias', r.alias, 'language_tag', r.language_tag, 'alias_type', r.alias_type) order by to_jsonb(r)::text) from public.shop_aliases r where r.shop_id=s.id), '[]'::jsonb),
'links', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'link_type', r.link_type, 'url', r.url, 'label', r.label, 'is_official', r.is_official, 'sort_order', r.sort_order) order by to_jsonb(r)::text) from public.shop_links r where r.shop_id=s.id), '[]'::jsonb),
'sources', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'label', r.label, 'source_type', r.source_type, 'source_url', r.source_url, 'checked_at', r.checked_at, 'reliability', r.reliability, 'evidence_note', r.evidence_note, 'status', r.status, 'claims', coalesce((select jsonb_agg(c.claim_token order by c.claim_token) from public.shop_source_claims c where c.source_id=r.id), '[]'::jsonb)) order by to_jsonb(r)::text) from public.shop_sources r where r.shop_id=s.id), '[]'::jsonb),
'types', coalesce((select jsonb_agg(jsonb_build_object('shop_type_id', r.shop_type_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at, 'is_primary', r.is_primary) order by to_jsonb(r)::text) from public.shop_shop_types r where r.shop_id=s.id), '[]'::jsonb),
'services', coalesce((select jsonb_agg(jsonb_build_object('service_id', r.service_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_services r where r.shop_id=s.id), '[]'::jsonb),
'specialties', coalesce((select jsonb_agg(jsonb_build_object('specialty_id', r.specialty_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_specialties r where r.shop_id=s.id), '[]'::jsonb),
'brands', coalesce((select jsonb_agg(jsonb_build_object('brand_id', r.brand_id, 'note', r.note, 'source_id', r.source_id, 'last_verified_at', r.last_verified_at) order by to_jsonb(r)::text) from public.shop_brands r where r.shop_id=s.id), '[]'::jsonb)
) from public.shops s where s.id=p_id;
$$;
select ok(not exists(select 1 from public.shops where public.shop_edit_document(id) is distinct from pg_temp.legacy_edit_document(id)),
 'legacy canonical documents and fingerprints stay byte-identical after additive column');

insert into auth.users(id) values ('a1000000-0000-4000-8000-000000000001'),('a1000000-0000-4000-8000-000000000002');
select public.assign_profile_role('a1000000-0000-4000-8000-000000000001','editor');
create function pg_temp.read_channels() returns jsonb language sql as $$
 select public.admin_shop_read('a1000000-0000-4000-8000-000000000010');
$$;
create function pg_temp.save_channels(doc jsonb) returns jsonb language sql as $$
 select public.admin_shop_write('save','a1000000-0000-4000-8000-000000000010',pg_temp.read_channels()->>'revision',doc);
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_shop_write('create','a1000000-0000-4000-8000-000000000010',null,'{"name":"Synthetic social shop","slug":"synthetic-social-shop"}');
select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{links}','[
 {"id":"a1000000-0000-4000-8000-000000000011","link_type":"instagram","url":"https://instagram.com/synthetic","is_official":true,"sort_order":0},
 {"id":"a1000000-0000-4000-8000-000000000012","link_type":"wechat","account_value":"synthetic-id","is_official":true,"sort_order":1},
 {"id":"a1000000-0000-4000-8000-000000000013","link_type":"line","url":"https://lin.ee/token","is_official":true,"sort_order":2},
 {"id":"a1000000-0000-4000-8000-000000000014","link_type":"kakaotalk","account_value":"synthetic-id","is_official":false,"sort_order":3}
]'));
select is(pg_temp.read_channels()->'document'->'links'->1->>'account_value','synthetic-id','copy-only ID survives private save');
select is(public.shop_detail('synthetic-social-shop'),null,'private channels are not public');
select throws_ok($$select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{links,1,url}','"https://example.test"'))$$,'22023',null,'ID plus URL ambiguity rejected');
select throws_ok($$select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{links,1,link_type}','"instagram"'))$$,'22023',null,'copy-only social ID rejected');
select throws_ok($$select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{links,2,link_type}','"instagram"'))$$,'22023','One account per platform','duplicate platforms rejected at RPC boundary');
select throws_ok($$select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{links,0,url}','"javascript:alert(1)"'))$$,'22023',null,'unsafe URL rejected');
select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{shop}',(pg_temp.read_channels()->'document'->'shop') || '{"country_code":"SG","locality_id":"00000000-0000-4000-8000-000000000201","timezone":"Asia/Singapore","latitude":1.3,"longitude":103.8,"source_quality":"demo"}'));
select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{types}','[{"shop_type_id":"00000000-0000-4000-8000-000000000101","is_primary":true}]'));
select public.admin_shop_write('confirm_position','a1000000-0000-4000-8000-000000000010',pg_temp.read_channels()->>'revision');
select public.admin_shop_write('publish','a1000000-0000-4000-8000-000000000010',pg_temp.read_channels()->>'revision');
select is(jsonb_array_length(public.shop_detail('synthetic-social-shop')->'links'),3,'publication exposes only official channels');
select is(public.shop_detail('synthetic-social-shop')->'links'->1->>'accountValue','synthetic-id','public copy-only ID is not a fake URL');
select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{links,1,account_value}','"private-change"'));
select is(public.shop_detail('synthetic-social-shop')->'links'->1->>'accountValue','synthetic-id','later private change does not leak publicly');
select public.admin_shop_write('publish','a1000000-0000-4000-8000-000000000010',pg_temp.read_channels()->>'revision');
select is(public.shop_detail('synthetic-social-shop')->'links'->1->>'accountValue','private-change','ordinary existing publish updates the contact');
select pg_temp.save_channels(jsonb_set(pg_temp.read_channels()->'document','{links}','[]'));
select public.admin_shop_write('publish','a1000000-0000-4000-8000-000000000010',pg_temp.read_channels()->>'revision');
select is(jsonb_array_length(public.shop_detail('synthetic-social-shop')->'links'),0,'explicit removal uses the existing writer');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok('select pg_temp.read_channels()','42501','Admin access denied','ordinary account cannot read private contacts');
select throws_ok($$select public.admin_shop_write('save','a1000000-0000-4000-8000-000000000010',null,'{}')$$,'42501',null,'ordinary account cannot change contacts');
reset role;
select ok(exists(select 1 from public.admin_audit_log where entity_type='shop_links' and entity_id='a1000000-0000-4000-8000-000000000012'),'contact writes retain link audit');
select * from finish();
rollback;
