-- Read-only data recovery export; excludes auth credentials and ephemeral nonces.
-- Media bytes remain in R2; this snapshot includes their manifests/references.
-- Project labels below are descriptive, not database identity verification.
-- Before snapshot AND reset, independently verify the actual dashboard URL/ref
-- and project name, or authenticated connection project, as the runbook requires.
with backup as (select jsonb_build_object(
  'shops',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shops r),
  'shop_working_copies',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_working_copies r),
  'shop_sources',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_sources r),
  'shop_source_claims',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_source_claims r),
  'shop_aliases',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_aliases r),
  'shop_links',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_links r),
  'shop_shop_types',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_shop_types r),
  'shop_services',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_services r),
  'shop_specialties',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_specialties r),
  'shop_brands',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_brands r),
  'shop_images',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_images r),
  'media_uploads',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.media_uploads r),
  'stamps',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.stamps r),
  'stamp_artwork_versions',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.stamp_artwork_versions r),
  'stamp_collections',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.stamp_collections r),
  'saved_shops',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.saved_shops r),
  'verification_attempts',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.verification_attempts r),
  'import_batches',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.import_batches r),
  'import_operations',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.import_operations r),
  'import_audit_events',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.import_audit_events r),
  'admin_audit_log',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.admin_audit_log r),
  'brands',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.brands r),
  'services',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.services r),
  'specialties',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.specialties r),
  'shop_types',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.shop_types r),
  'localities',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from public.localities r),
  'stamp_private.shop_verification_policy',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from stamp_private.shop_verification_policy r)
) as tables)
select jsonb_build_object(
 'project','nibatlas-staging','project_ref','xgyzsdrugtwqlpnkutfw',
 'exported_at',clock_timestamp(),'tables',tables,
 'fingerprints',(select jsonb_object_agg(key,md5(value::text)) from jsonb_each(tables))
) as recovery_backup from backup;
