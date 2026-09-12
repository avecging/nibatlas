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
