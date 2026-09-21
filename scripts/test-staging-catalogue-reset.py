"""Exercise the operator reset only in the disposable local CI Docker database."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PSQL = ['docker', 'exec', '-i', 'supabase_db_nibatlas', 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres']
SNAPSHOT = (ROOT / 'scripts/maintenance/snapshot-staging-catalogue.sql').read_text()
RESET = (ROOT / 'scripts/maintenance/reset-staging-catalogue.sql').read_text()
CONFIRM = "SET LOCAL nibatlas.catalogue_reset_confirmation='RESET DISPOSABLE NIBATLAS STAGING CATALOGUE';\n"

def run(sql, failure=None):
    result = subprocess.run(PSQL, input=sql, text=True, capture_output=True)
    if failure:
        assert result.returncode and failure in result.stderr, result.stderr
    else:
        assert result.returncode == 0, result.stderr
    return result.stdout

before = json.loads(run(SNAPSHOT))['fingerprints']
run(RESET, 'Missing explicit staging reset confirmation')
setup = """
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id) VALUES ('99000000-0000-4000-8000-000000000001');
SELECT public.assign_profile_role('99000000-0000-4000-8000-000000000001','admin');
CREATE TEMP TABLE reset_art AS SELECT
 (public.stamp_artwork_draft_operation('99000000-0000-4000-8000-000000000001','staging',
 '00000000-0000-4000-8000-000000000301','create',
 '{"origin":"founder_created","creatorName":"Disposable reset test","ink":"teal"}')->0->>'id')::uuid id;
SELECT public.media_upload_operation('99000000-0000-4000-8000-000000000001','staging','initiate',
 '99000000-0000-4000-8000-000000000010',jsonb_build_object(
 'shopId','00000000-0000-4000-8000-000000000301','artworkVersionId',(SELECT id FROM reset_art),
 'purpose','artwork_png','sha256',repeat('a',64),'byteSize',100,'contentType','image/png'));
SELECT public.media_upload_operation('99000000-0000-4000-8000-000000000001','staging','finalize',
 '99000000-0000-4000-8000-000000000010',jsonb_build_object('sha256',repeat('a',64),
 'byteSize',100,'width',1200,'height',800));
SELECT public.stamp_artwork_draft_operation('99000000-0000-4000-8000-000000000001','staging',
 '00000000-0000-4000-8000-000000000301','attach',jsonb_build_object(
 'versionId',(SELECT id FROM reset_art),'uploadId','99000000-0000-4000-8000-000000000010'));
UPDATE public.stamp_artwork_versions SET approval_status='approved',approved_at=now()
 WHERE id=(SELECT id FROM reset_art);
INSERT INTO public.saved_shops(user_id,shop_id)
 VALUES('99000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000301');
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
CREATE TEMP TABLE catalogue_reset_expected(snapshot jsonb);
INSERT INTO catalogue_reset_expected(snapshot)
""" + SNAPSHOT
stale = "UPDATE public.shops SET name=name||' changed after backup' WHERE id='00000000-0000-4000-8000-000000000301';\n"
run(setup + CONFIRM + stale + RESET, 'Data changed in shops')
# Failure after the three guards have been suspended must restore all state.
injected = """
CREATE FUNCTION pg_temp.fail_reset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'injected reset failure'; END; $$;
CREATE TRIGGER test_reset_failure AFTER DELETE ON public.stamps
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_reset();
"""
run(setup + CONFIRM + injected + RESET, 'injected reset failure')
post = """
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE (tgrelid,tgname) IN (
 ('public.shop_images'::regclass,'shop_media_immutable'),
 ('public.media_uploads'::regclass,'media_upload_immutable'),
 ('public.stamp_artwork_versions'::regclass,'stamp_artwork_versions_protect_approved')) AND tgenabled='O')<>3
 THEN RAISE EXCEPTION 'Guards not restored'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='99000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Account was removed'; END IF;
END $$;
ROLLBACK;
"""
run(setup + CONFIRM + RESET + post)
after = json.loads(run(SNAPSHOT))['fingerprints']
assert before == after, 'Rollback changed the seeded database'
print('Staging reset: missing confirmation, stale snapshot, injected failure, uploaded-art cycle, accounts, guards and rollback passed.')
