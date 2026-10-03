"""Media lock regressions on the disposable local CI database only."""
import concurrent.futures
from contextlib import contextmanager
import json
import select
import subprocess
import uuid

COMMAND = ['docker', 'exec', '-i', 'supabase_db_nibatlas', 'psql', '-XAtq',
           '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres']
ACTOR, SHOP = str(uuid.uuid4()), str(uuid.uuid4())
SAVING_SHOP = str(uuid.uuid4())


def sql(source):
    return subprocess.run(COMMAND, input=source, text=True, capture_output=True,
                          check=True, timeout=20).stdout.strip()


def literal(value):
    return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"


def upload(action, identity, payload=None, actor=ACTOR, environment='staging'):
    return (f"public.media_upload_operation('{actor}','{environment}','{action}',"
            f"'{identity}',{literal(payload or {})})")


def manifest(purpose='shop_photo', content_type='image/png'):
    return {'shopId': SHOP, 'purpose': purpose, 'sha256': 'a' * 64,
            'byteSize': 100, 'contentType': content_type}


def media(action, identity=None, revision=None):
    return (f"public.shop_media_operation('{ACTOR}','staging','{SHOP}','{action}',"
            + (f"'{identity}'" if identity else 'null') + ','
            + (f"'{revision}'" if revision else 'null') + ')')


def service(expression):
    return json.loads(sql("begin; set local role service_role; set local lock_timeout='750ms'; "
                          f"select {expression}; commit;"))


@contextmanager
def held_role(statement):
    """Handshake after the lock is held; no sleep-based race assumptions."""
    process = subprocess.Popen(COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True)
    try:
        process.stdin.write(f"begin; {statement};\n\\echo locked\n")
        process.stdin.flush()
        assert select.select([process.stdout], [], [], 10)[0], 'role lock holder did not start'
        assert process.stdout.readline().strip() == 'locked', 'role lock holder failed'
        yield
    finally:
        try:
            _, error = process.communicate("rollback;\n\\q\n", timeout=10)
            assert process.returncode == 0, error
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()
            raise


sql(f"insert into auth.users(id) values('{ACTOR}'); select public.assign_profile_role('{ACTOR}','admin');"
    f"insert into public.shops(id,name,slug,source_quality) values('{SHOP}','Synthetic media lock test','media-lock-{SHOP}','community_unverified');")
claims = json.dumps({'sub': ACTOR, 'role': 'authenticated'})
sql("begin; set local role authenticated; "
    f"select set_config('request.jwt.claims','{claims}',true);"
    f"select public.admin_shop_write('create','{SAVING_SHOP}',null,"
    f"jsonb_build_object('name','Synthetic concurrent save','slug','media-save-{SAVING_SHOP}')); commit;")

# Hold a real catalogue save open on another shop, including all wrapper locks.
# Photo/logo operations must finish before the save transaction is released.
with held_role("set local role authenticated; do $$begin "
               f"perform set_config('request.jwt.claims','{claims}',true);"
               f"perform public.admin_shop_write('save','{SAVING_SHOP}',"
               f"public.admin_shop_read('{SAVING_SHOP}')->>'revision',"
               f"public.admin_shop_read('{SAVING_SHOP}')->'document'); end$$"):
    assert service(media('list')) == []
    for purpose in ['shop_photo', 'shop_logo']:
        identity = str(uuid.uuid4())
        assert service(upload('initiate', identity, manifest(purpose, 'image/jpeg')))['status'] == 'pending'
        assert service(upload('read', identity))['status'] == 'pending'
        checked = {'sha256': 'b' * 64, 'byteSize': 90, 'width': 2, 'height': 2}
        service(upload('prepare', identity, checked))
        assert service(upload('finalize', identity, checked))['status'] == 'validated'
        rows = service(media('attach', identity))
        assert len(rows) == 1 and rows[0]['status'] == 'draft'
        image = rows[0]
        assert service(media('preview', image['id']))['storageKey']
        arranged = service(f"public.shop_media_arrange('{ACTOR}','staging','{SHOP}',"
                          + literal({'order': [image['id']], 'captions': {image['id']: 'Synthetic'},
                                     'revisions': {image['id']: image['revision']}}) + ')')
        image = arranged[0]
        image = service(media('publish', image['id'], image['revision']))[0]
        assert image['status'] == 'approved'
        image = service(media('hide', image['id'], image['revision']))[0]
        assert image['status'] == 'draft'
        assert service(media('remove', image['id'], image['revision'])) == []
print('PASS: photo/logo transport, attachment and gallery operations complete during an open catalogue save.')

# A pending role change must still block access; removing the role lock entirely
# would incorrectly let these calls proceed using the old committed admin role.
with held_role(f"update public.profiles set role='user' where id='{ACTOR}'"):
    for expression in [media('list'), upload('read', identity)]:
        try:
            service(expression)
            raise AssertionError('media bypassed a pending role revocation')
        except subprocess.CalledProcessError as error:
            assert 'lock timeout' in error.stderr, error.stderr
sql(f"select public.assign_profile_role('{ACTOR}','user');")
for expression in [media('list'), upload('read', identity)]:
    try:
        service(expression)
        raise AssertionError('media accepted a revoked actor')
    except subprocess.CalledProcessError as error:
        assert 'Admin access denied' in error.stderr, error.stderr
print('PASS: pending and committed role revocation still guard media access.')

# Race PNG/JPEG initiations in both environments at 99/100. The actor quota must
# remain atomic after moving serialization off the shared role row.
quota_actor = str(uuid.uuid4())
sql(f"insert into auth.users(id) values('{quota_actor}'); select public.assign_profile_role('{quota_actor}','editor');")
sql('\n'.join(f"select {upload('initiate', str(uuid.uuid4()), manifest(), quota_actor)};" for _ in range(99)))


def last_slot(index):
    expression = upload('initiate', str(uuid.uuid4()),
                        manifest('shop_logo' if index % 2 else 'shop_photo',
                                 'image/jpeg' if index % 2 else 'image/png'),
                        quota_actor, 'production' if index % 2 else 'staging')
    return sql("begin; set local statement_timeout='10s'; "
               "create function pg_temp.attempt() returns text language plpgsql as $$begin "
               f"perform {expression}; perform pg_sleep(0.15); return 'accepted'; "
               "exception when sqlstate '54000' then return 'limited'; end;$$; "
               "set local role service_role; select pg_temp.attempt(); commit;")


with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    outcomes = list(executor.map(last_slot, range(8)))
assert outcomes.count('accepted') == 1 and outcomes.count('limited') == 7, outcomes
assert sql(f"select count(*) from public.media_uploads where created_by='{quota_actor}';") == '100'
assert sql(f"select count(*) from public.admin_audit_log where entity_type='media_uploads' and actor_user_id='{quota_actor}';") == '100'
print('PASS: concurrent cross-environment initiations preserve the 100-manifest quota and audit count.')
# Leave immutable receipts/audit in this disposable database until CI teardown.
