import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {X509Certificate} from 'node:crypto';
import {checkTarget, readTargets, LIVE_PROJECT} from './check-target.mjs';
import {sessionUrl, verifyMigrationList} from './database.mjs';

const fixtures = () => {
  const targets = structuredClone(readTargets());
  targets.staging.projectRef = 'abcdefghijklmnopqrst';
  targets.production.releaseReady = true;
  const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const env = {GITHUB_ACTIONS:'true', GITHUB_REF:'refs/heads/staging', NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co', NEXT_PUBLIC_CATALOGUE_MODE:'api-demo'};
  return {targets, wrangler, env};
};

test('unregistered staging stays disabled', () => {
  const {env, wrangler} = fixtures();
  const targets = readTargets(); targets.staging.projectRef = null;
  assert.throws(() => checkTarget('staging', env, targets, wrangler));
});
test('isolated staging accepts only its registered project', () => {
  const {targets, wrangler, env} = fixtures();
  assert.equal(checkTarget('staging', env, targets, wrangler).projectRef, targets.staging.projectRef);
  for (const url of [`https://${LIVE_PROJECT}.supabase.co`, env.NEXT_PUBLIC_SUPABASE_URL+'/', 'https://other.invalid']) {
    assert.throws(() => checkTarget('staging', {...env, NEXT_PUBLIC_SUPABASE_URL:url}, targets, wrangler));
  }
  targets.staging.projectRef = LIVE_PROJECT;
  assert.throws(() => checkTarget('staging', env, targets, wrangler));
});
test('separate bucket and Worker identities are required', () => {
  for (const field of ['worker', 'bucket']) {
    const {targets, wrangler, env} = fixtures();
    targets.staging[field] = targets.production[field];
    assert.throws(() => checkTarget('staging', env, targets, wrangler));
  }
  const {targets, wrangler, env} = fixtures();
  wrangler.env.staging.r2_buckets[0].bucket_name = 'nibatlas-staging-images';
  assert.throws(() => checkTarget('staging', env, targets, wrangler));
  assert.throws(() => checkTarget('staging', {...env, GITHUB_REF:'refs/heads/unreviewed'}, targets, wrangler));
});
test('production requires an explicit manual main release and preserves media', () => {
  const {targets, wrangler} = fixtures();
  const env = {GITHUB_ACTIONS:'true', GITHUB_REF:'refs/heads/main', GITHUB_EVENT_NAME:'workflow_dispatch', PRODUCTION_RELEASE_ENABLED:'true', RELEASE_CONFIRMATION:'RELEASE', NEXT_PUBLIC_SUPABASE_URL:`https://${LIVE_PROJECT}.supabase.co`, NEXT_PUBLIC_CATALOGUE_MODE:'api'};
  assert.equal(checkTarget('production', env, targets, wrangler).mediaEnvironment, 'staging');
  for (const key of ['GITHUB_ACTIONS','GITHUB_REF','GITHUB_EVENT_NAME','PRODUCTION_RELEASE_ENABLED','RELEASE_CONFIRMATION']) {
    assert.throws(() => checkTarget('production', {...env, [key]:'wrong'}, targets, wrangler));
  }
  assert.throws(() => checkTarget('production', {...env, NEXT_PUBLIC_CATALOGUE_MODE:'api-demo'}, targets, wrangler));
  wrangler.env.production.vars.MEDIA_ENV = 'production';
  assert.throws(() => checkTarget('production', env, targets, wrangler));
});
test('session migration connections retain verified TLS and percent-encoded passwords', () => {
  const {targets} = fixtures(), target=targets.staging;
  const url = new URL(sessionUrl(`postgresql://postgres.${target.projectRef}:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`,target,'spaces &/%$'));
  assert.equal(url.port,'5432');
  assert.equal(decodeURIComponent(url.password),'spaces &/%$');
  assert.equal(url.searchParams.get('sslmode'),'verify-full');
  assert.ok(url.searchParams.get('sslrootcert').endsWith('supabase-root-2021.crt'));
  for (const host of ['evil.invalid','pooler.supabase.com.evil.invalid']) assert.throws(() => sessionUrl(`postgresql://postgres.${target.projectRef}:[YOUR-PASSWORD]@${host}:5432/postgres`, target,'password'));
});
test('production refuses pending, extra or incomplete migration history', () => {
  const versions=['20260818000000','20261007080000'];
  verifyMigrationList(' Local | Remote | Time\n20260818000000 | 20260818000000 | time\n20261007080000 | 20261007080000 | time',versions);
  for (const output of ['20260818000000 | 20260818000000 | time','20260818000000 | 20260818000000 | time\n20261007080000 | | time','not a recognized CLI table']) assert.throws(() => verifyMigrationList(output,versions));
});
test('trusted public CA has no private identity and matches the supplied Supabase root', () => {
  const pem=readFileSync(new URL('./supabase-root-2021.crt',import.meta.url),'utf8');
  assert.ok(!pem.includes('PRIVATE KEY'));
  const cert=new X509Certificate(pem);
  assert.equal(cert.ca,true);
  assert.equal(cert.fingerprint256,'80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
});

test('repository production release stays code-blocked even when workflow flags are enabled', () => {
  const {targets, wrangler} = fixtures();
  const env = {GITHUB_ACTIONS:'true', GITHUB_REF:'refs/heads/main', GITHUB_EVENT_NAME:'workflow_dispatch', PRODUCTION_RELEASE_ENABLED:'true', RELEASE_CONFIRMATION:'RELEASE', NEXT_PUBLIC_SUPABASE_URL:`https://${LIVE_PROJECT}.supabase.co`, NEXT_PUBLIC_CATALOGUE_MODE:'api'};
  assert.equal(readTargets().production.releaseReady, false);
  targets.production.releaseReady = false;
  assert.throws(() => checkTarget('production', env, targets, wrangler), /legacy media policy compatibility/);
});

test('Access credentials are attached only to the exact staging origin without following redirects', async () => {
  const {authorizeStagingPage} = await import('../../tests/staging/access.ts');
  let handler;
  await authorizeStagingPage({route:async (_pattern, callback) => {handler=callback;}}, 'https://staging.example.test', {'CF-Access-Client-Id':'fake-id','CF-Access-Client-Secret':'fake-secret'});
  let continued=false, fetched;
  const makeRoute=url => ({request:()=>({url:()=>url,headers:()=>({'other':'header'})}),continue:async()=>{continued=true;},fetch:async options=>{fetched=options;return {};},fulfill:async()=>{}});
  await handler(makeRoute('https://api.maptiler.com/style'));
  assert.equal(continued,true); assert.equal(fetched,undefined);
  continued=false;
  await handler(makeRoute('https://staging.example.test/api/v1/shops'));
  assert.equal(continued,false); assert.equal(fetched.maxRedirects,0);
  assert.equal(fetched.headers['CF-Access-Client-Secret'],'fake-secret');
  fetched=undefined;
  await handler(makeRoute('https://staging.example.test.evil.invalid/'));
  assert.equal(fetched,undefined);
});

test('staging API helper refuses external paths and does not follow login redirects', async () => {
  const {stagingRequestOptions} = await import('../../tests/staging/access.ts');
  const previous={id:process.env.CF_ACCESS_CLIENT_ID,secret:process.env.CF_ACCESS_CLIENT_SECRET};
  process.env.CF_ACCESS_CLIENT_ID='fake-id';process.env.CF_ACCESS_CLIENT_SECRET='fake-secret';
  try {
    assert.equal(stagingRequestOptions('/api/v1/shops').maxRedirects,0);
    assert.throws(()=>stagingRequestOptions('//external.invalid/'));
    assert.throws(()=>stagingRequestOptions('https://external.invalid/'));
  } finally {
    for (const [key,value] of [['CF_ACCESS_CLIENT_ID',previous.id],['CF_ACCESS_CLIENT_SECRET',previous.secret]]) {
      if(value===undefined) delete process.env[key]; else process.env[key]=value;
    }
  }
});
