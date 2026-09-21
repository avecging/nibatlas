-- ONE-TIME OPERATOR TOOL, NOT A MIGRATION AND NEVER RUN BY DEPLOYMENT.
-- Founder-authorized disposable staging catalogue only. Read the runbook first.
-- Caller must BEGIN, create pg_temp.catalogue_reset_expected(snapshot jsonb),
-- insert a freshly saved snapshot, SET LOCAL the exact confirmation below,
-- include this file, and COMMIT. Snapshot/export must be retained beforehand.
-- No authentication account, role, RLS policy, grant or audit row is deleted.
DO $reset$
DECLARE
  expected jsonb;
  names text[] := ARRAY[
    'shops','shop_working_copies','shop_sources','shop_source_claims','shop_aliases',
    'shop_links','shop_shop_types','shop_services','shop_specialties','shop_brands',
    'shop_images','media_uploads','stamps','stamp_artwork_versions','stamp_collections',
    'saved_shops','verification_attempts','import_batches','import_operations'
  ];
  t text;
  actual text;
  ids uuid[];
  account_before text;
  audit_before bigint;
  import_audit_before bigint;
BEGIN
  IF current_setting('nibatlas.catalogue_reset_confirmation',true)
    IS DISTINCT FROM 'RESET DISPOSABLE NIBATLAS STAGING CATALOGUE' THEN
    RAISE EXCEPTION 'Missing explicit staging reset confirmation';
  END IF;
  IF (SELECT count(*) FROM pg_temp.catalogue_reset_expected) <> 1 THEN
    RAISE EXCEPTION 'Exactly one retained snapshot is required';
  END IF;
  SELECT snapshot INTO expected FROM pg_temp.catalogue_reset_expected;
  IF expected->>'project_ref' IS DISTINCT FROM 'xgyzsdrugtwqlpnkutfw'
    OR expected->>'project' IS DISTINCT FROM 'nibatlas-staging'
    OR NOT (expected->'fingerprints' ?& names) THEN
    RAISE EXCEPTION 'Unexpected project or incomplete snapshot';
  END IF;
  -- The operator must verify the dashboard/connection project independently.
  -- Matching exact row fingerprints also rejects a different database's data.
  FOREACH t IN ARRAY names LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
  END LOOP;
  LOCK TABLE stamp_private.shop_verification_policy,
    stamp_private.verification_nonces IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.profiles IN SHARE MODE;
  FOREACH t IN ARRAY names LOOP
    EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),''[]''::jsonb)::text) FROM public.%I r',t) INTO actual;
    IF actual IS DISTINCT FROM expected->'fingerprints'->>t THEN
      RAISE EXCEPTION 'Data changed in %; refresh and retain the backup before reset',t;
    END IF;
  END LOOP;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb)::text)
    INTO actual FROM stamp_private.shop_verification_policy r;
  IF actual IS DISTINCT FROM expected->'fingerprints'->>'stamp_private.shop_verification_policy' THEN
    RAISE EXCEPTION 'Verification policies changed; refresh backup';
  END IF;
  SELECT array_agg(id ORDER BY id) INTO ids FROM public.shops;
  IF coalesce(cardinality(ids),0)=0 OR cardinality(ids)>20 THEN
    RAISE EXCEPTION 'This reset only permits the small, inspected test catalogue (1–20 shops)';
  END IF;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb)::text)
    INTO account_before FROM public.profiles r;
  SELECT count(*) INTO audit_before FROM public.admin_audit_log;
  SELECT count(*) INTO import_audit_before FROM public.import_audit_events;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE (tgrelid,tgname) IN (
    ('public.shop_images'::regclass,'shop_media_immutable'),
    ('public.media_uploads'::regclass,'media_upload_immutable'),
    ('public.stamp_artwork_versions'::regclass,'stamp_artwork_versions_protect_approved'))
    AND tgenabled<>'O') OR (SELECT count(*) FROM pg_trigger WHERE (tgrelid,tgname) IN (
    ('public.shop_images'::regclass,'shop_media_immutable'),
    ('public.media_uploads'::regclass,'media_upload_immutable'),
    ('public.stamp_artwork_versions'::regclass,'stamp_artwork_versions_protect_approved')))<>3 THEN
    RAISE EXCEPTION 'Expected deletion protections are missing or not enabled';
  END IF;

  -- Exact one-transaction exception for disposable data. Audit and FK triggers
  -- remain active. A failure rolls back both data and trigger changes.
  ALTER TABLE public.shop_images DISABLE TRIGGER shop_media_immutable;
  ALTER TABLE public.media_uploads DISABLE TRIGGER media_upload_immutable;
  ALTER TABLE public.stamp_artwork_versions DISABLE TRIGGER stamp_artwork_versions_protect_approved;
  UPDATE public.shops SET publication_status='archived' WHERE id=ANY(ids);
  UPDATE public.stamps SET status='retired',current_design_version=NULL WHERE shop_id=ANY(ids);
  DELETE FROM public.stamp_collections WHERE shop_id=ANY(ids);
  DELETE FROM public.shop_images WHERE shop_id=ANY(ids);
  -- Unlink the artwork side of the circular reference. Manifest artwork IDs
  -- cannot be nulled: artwork_png requires them. Drafts may have no upload.
  UPDATE public.stamp_artwork_versions SET approval_status='draft',approved_at=NULL,upload_id=NULL
    WHERE stamp_id IN (SELECT id FROM public.stamps WHERE shop_id=ANY(ids));
  DELETE FROM public.media_uploads WHERE shop_id=ANY(ids);
  DELETE FROM public.stamp_artwork_versions WHERE stamp_id IN (SELECT id FROM public.stamps WHERE shop_id=ANY(ids));
  DELETE FROM public.stamps WHERE shop_id=ANY(ids);
  DELETE FROM public.shop_working_copies WHERE shop_id=ANY(ids);
  DELETE FROM public.shop_shop_types WHERE shop_id=ANY(ids);
  DELETE FROM public.shop_services WHERE shop_id=ANY(ids);
  DELETE FROM public.shop_specialties WHERE shop_id=ANY(ids);
  DELETE FROM public.shop_brands WHERE shop_id=ANY(ids);
  -- Remaining aliases/links/sources/saves/verification rows cascade normally.
  DELETE FROM public.shops WHERE id=ANY(ids);
  -- Keep import identity/outcome tombstones: old links cannot replay imports.
  UPDATE public.import_batches SET expires_at=least(expires_at,statement_timestamp());
  UPDATE public.import_operations SET patch=NULL,preview=NULL;
  SET CONSTRAINTS ALL IMMEDIATE;
  ALTER TABLE public.shop_images ENABLE TRIGGER shop_media_immutable;
  ALTER TABLE public.media_uploads ENABLE TRIGGER media_upload_immutable;
  ALTER TABLE public.stamp_artwork_versions ENABLE TRIGGER stamp_artwork_versions_protect_approved;

  IF EXISTS(SELECT 1 FROM public.shops) OR EXISTS(SELECT 1 FROM public.stamps)
    OR EXISTS(SELECT 1 FROM public.stamp_artwork_versions) OR EXISTS(SELECT 1 FROM public.media_uploads)
    OR EXISTS(SELECT 1 FROM public.shop_images) OR EXISTS(SELECT 1 FROM public.stamp_collections)
    OR EXISTS(SELECT 1 FROM public.saved_shops) THEN
    RAISE EXCEPTION 'Catalogue reset did not reach the expected empty state';
  END IF;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb)::text)
    INTO actual FROM public.profiles r;
  IF account_before IS DISTINCT FROM actual
    OR (SELECT count(*) FROM public.admin_audit_log)<audit_before
    OR (SELECT count(*) FROM public.import_audit_events)<>import_audit_before THEN
    RAISE EXCEPTION 'Account or audit preservation check failed';
  END IF;
END;
$reset$;
