"""Run against the disposable local Supabase CI database, never staging/production."""
import concurrent.futures
import json
import subprocess
import uuid

DB = 'supabase_db_nibatlas'
USER = str(uuid.uuid4())
SHOP = '00000000-0000-4000-8000-000000000301'
IDS = [str(uuid.uuid4()) for _ in range(8)]


def sql(source):
    result = subprocess.run(['docker', 'exec', '-i', DB, 'psql', '-XAtq', '-v',
                             'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
                            input=source, text=True, capture_output=True, check=True)
    return result.stdout.strip()


def call(request, action, payload="'{}'::jsonb"):
    return (f"public.stamp_verification_action('{action}','{USER}','{SHOP}',"
            f"'{request}',encode(extensions.digest('{request}','sha256'),'hex'),{payload})")


try:
    sql(f"insert into auth.users(id,aud,role,email) values('{USER}','authenticated','authenticated','concurrency-{USER}@example.test');")
    # Create independent valid proofs through the real nonce and geofence path.
    for request in IDS:
        sql(f"select {call(request, 'nonce')};")
        verified = sql(f"""
        with n as (select * from stamp_private.verification_nonces where request_id='{request}'),
        bits as (select n.*, extensions.gen_random_bytes(16) iv,
          convert_to(jsonb_build_object('latitude',extensions.st_y(s.location),
            'longitude',extensions.st_x(s.location),'accuracy',10)::text,'UTF8') plaintext
          from n join public.shops s on s.id=n.shop_id),
        encrypted as (select *,extensions.encrypt_iv(plaintext,substring(encryption_key from 1 for 32),iv,'aes-cbc/pad:pkcs') ct from bits)
        select {call(request, 'verify', "jsonb_build_object('iv',encode(iv,'hex'),'ciphertext',encode(ct,'hex'),'mac',encode(extensions.hmac(iv||ct,substring(encryption_key from 33 for 32),'sha256'),'hex'))")} from encrypted;
        """)
        assert json.loads(verified)['code'] == 'confirmation_required', verified
    payload = "'{\"confirmedAtShop\":true,\"countryLabel\":\"Singapore\"}'::jsonb"
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        responses = list(executor.map(lambda request: json.loads(sql(f"select {call(request, 'collect', payload)};")), IDS))
    codes = [response['code'] for response in responses]
    assert codes.count('success') == 1 and codes.count('duplicate') == 7, codes
    assert len({response['collection']['id'] for response in responses}) == 1
    assert sql(f"select count(*) from public.stamp_collections where user_id='{USER}';") == '1'
    assert sql(f"select count(*) from stamp_private.verification_nonces where user_id='{USER}' and state='consumed';") == '8'
    print('PASS: eight concurrent independent proofs issue exactly one immutable collection.')
finally:
    sql(f"delete from auth.users where id='{USER}';")

# Package B1: different operators race to prepare the same older draft. Different
# actor rows ensure the shop lock, not only the per-actor lock, protects identity.
default_shop = str(uuid.uuid4())
default_actors = [str(uuid.uuid4()) for _ in range(8)]
try:
    for actor in default_actors:
        sql(f"insert into auth.users(id) values('{actor}'); select public.assign_profile_role('{actor}','editor');")
    sql(f"insert into public.shops(id,name,slug) values('{default_shop}','Synthetic concurrent default','concurrent-default-{default_shop}');")

    def prepare_default(actor):
        return json.loads(sql(f"select public.stamp_artwork_draft_operation('{actor}','staging','{default_shop}','ensure_default');"))

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        defaults = list(executor.map(prepare_default, default_actors))
    assert all(len(rows) == 1 and rows[0]['active'] and rows[0]['kind'] == 'generated_template' for rows in defaults), defaults
    assert len({rows[0]['stampId'] for rows in defaults}) == 1
    assert len({rows[0]['id'] for rows in defaults}) == 1
    assert sql(f"select count(*) from public.stamps where shop_id='{default_shop}';") == '1'
    assert sql(f"select count(*) from public.admin_audit_log where entity_id in (select id from public.stamps where shop_id='{default_shop}' union all select av.id from public.stamp_artwork_versions av join public.stamps st on st.id=av.stamp_id where st.shop_id='{default_shop}');") == '3'
    print('PASS: eight concurrent operators prepare exactly one default and one audited lifecycle.')
finally:
    for actor in default_actors:
        sql(f"delete from auth.users where id='{actor}';")

# Package C2: eight HTTP-equivalent execution transactions replay one durable row.
# These rows deliberately remain in this disposable CI database until teardown;
# import identity/audit tombstones are not bypassed for cleanup.
import_actor, import_batch, import_op, import_shop = [str(uuid.uuid4()) for _ in range(4)]
sql(f"insert into auth.users(id) values('{import_actor}'); select public.assign_profile_role('{import_actor}','admin');")

def import_sql(source):
    prefix = ("begin; set local role authenticated; "
              f"select set_config('request.jwt.claims','{{\"sub\":\"{import_actor}\",\"role\":\"authenticated\"}}',true);")
    return sql(prefix + source + '; commit;').splitlines()[-1]

import_doc = {'shop': {'name': str(uuid.uuid4()), 'slug': 'synthetic-import-' + import_shop,
                      'operational_status': 'unknown', 'source_quality': 'community_unverified',
                      'position_precision': 'locality'},
              **{key: [] for key in ['sources', 'aliases', 'links', 'types', 'services', 'specialties', 'brands', 'experiences']}}

def literal(value):
    return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"

preview = json.loads(import_sql("select public.admin_import_preview('validate'," + literal([
    {'rowId': 'concurrent', 'id': import_shop, 'revision': None, 'document': import_doc}]) + ")"))[0]
assert not preview['issues'], preview
review_payload = {'row': {'rowId': 'concurrent', 'line': 2, 'cells': {'name': import_doc['shop']['name']},
                          'issues': [], 'fileDuplicates': []},
                  'preview': {'action': 'new_private_draft'}, 'targetId': import_shop,
                  'revision': None, 'document': import_doc, 'reviewKey': preview['reviewKey']}
import_sql(f"select public.admin_import_operation('review','{import_batch}','{import_op}',{literal(review_payload)})")
execute_payload = literal({'document': import_doc, 'reviewKey': preview['reviewKey']})

def execute_import(_):
    return json.loads(import_sql(f"select public.admin_import_operation('execute','{import_batch}','{import_op}',{execute_payload})"))

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    outcomes = list(executor.map(execute_import, range(8)))
assert all(x['status'] == 'imported' and x['targetId'] == import_shop for x in outcomes), outcomes
assert sql(f"select count(*) from public.shops where id='{import_shop}';") == '1'
assert sql(f"select count(*) from public.stamps where shop_id='{import_shop}';") == '1'
assert sql(f"select count(*) from public.import_audit_events where operation_id='{import_op}' and status='imported';") == '1'
assert sql(f"select count(*) from public.admin_audit_log where entity_id='{import_shop}' and entity_type='shop_working_copies';") == '1'
print('PASS: eight concurrent import submissions create one private shop/default/save and one completed operation.')
