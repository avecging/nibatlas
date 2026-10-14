import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const LIVE_PROJECT = 'xgyzsdrugtwqlpnkutfw';
export function readTargets() {
  return JSON.parse(readFileSync(new URL('./targets.json', import.meta.url), 'utf8'));
}

// Physical projects and buckets provide isolation. Production deliberately
// retains its existing staging/ media keys so historical artwork still resolves.
export function checkTarget(environment, env, targets, wrangler) {
  if (!['staging', 'production'].includes(environment)) throw Error('Unknown deployment environment');
  const target = targets[environment];
  if (environment === 'production' && target?.releaseReady !== true) throw Error('Production release is blocked pending reviewed legacy media policy compatibility');
  if (!target || !/^[a-z]{20}$/.test(target.projectRef ?? '')) throw Error('Register the isolated staging project before enabling deployment');
  if (targets.production.projectRef !== LIVE_PROJECT) throw Error('The live production project must be preserved');
  if (environment === 'staging' && target.projectRef === LIVE_PROJECT) throw Error('Staging cannot target the live production database');
  if (targets.staging.projectRef === LIVE_PROJECT || targets.staging.bucket === targets.production.bucket || targets.staging.worker === targets.production.worker) throw Error('Staging and production targets must be separate');
  if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${target.projectRef}.supabase.co` || env.NEXT_PUBLIC_CATALOGUE_MODE !== target.catalogueMode) throw Error('Build configuration does not match the fixed deployment target');
  const binding = wrangler.env?.[environment];
  if (binding?.name !== target.worker || binding.vars?.MEDIA_ENV !== target.mediaEnvironment || binding.r2_buckets?.length !== 1 || binding.r2_buckets[0]?.binding !== 'MEDIA_BUCKET' || binding.r2_buckets[0]?.bucket_name !== target.bucket) throw Error('Worker or storage binding does not match the fixed deployment target');
  if (environment === 'staging' && (target.worker === 'nibatlas-staging' || target.bucket === 'nibatlas-staging-images')) throw Error('Legacy staging resources are live production');
  if (env.GITHUB_ACTIONS === 'true') {
    if (environment === 'staging' && !['refs/heads/main', 'refs/heads/staging'].includes(env.GITHUB_REF)) throw Error('Staging requires a reviewed main or staging branch');
  }
  if (environment === 'production' && (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.PRODUCTION_RELEASE_ENABLED !== 'true' || env.RELEASE_CONFIRMATION !== 'RELEASE')) throw Error('Production requires an enabled, explicitly confirmed manual main release');
  return target;
}

export function configuredTarget(environment, env = process.env) {
  return checkTarget(environment, env, readTargets(), JSON.parse(readFileSync('wrangler.jsonc', 'utf8')));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {configuredTarget(process.argv[2]); console.log('Deployment target verified.');}
  catch (error) {console.error(error.message); process.exitCode = 1;}
}
