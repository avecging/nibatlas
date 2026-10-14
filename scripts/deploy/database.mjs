import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {configuredTarget} from './check-target.mjs';

export function sessionUrl(connection, target, password) {
  const parsed = new URL(connection.replace('[YOUR-PASSWORD]', 'placeholder'));
  if (!connection.includes('[YOUR-PASSWORD]') || !['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.username !== `postgres.${target.projectRef}` || !parsed.hostname.endsWith('.pooler.supabase.com') || !['5432', '6543'].includes(parsed.port) || parsed.pathname !== '/postgres') throw Error('Unrecognized project session pooler');
  parsed.port = '5432';
  parsed.password = encodeURIComponent(password);
  parsed.search = '';
  parsed.searchParams.set('sslmode', 'verify-full');
  parsed.searchParams.set('sslrootcert', fileURLToPath(new URL('./supabase-root-2021.crt', import.meta.url)));
  return parsed.href;
}

export function verifyMigrationList(output, versions) {
  const rows = output.split('\n').map(line => line.match(/^\s*(\d{14})?\s*\|\s*(\d{14})?\s*\|/)).filter(Boolean);
  const expected = [...versions].sort();
  if (!expected.length || rows.length !== expected.length || rows.some(row => !row[1] || row[1] !== row[2]) || rows.map(row => row[1]).sort().some((version, i) => version !== expected[i])) throw Error('Production migration history differs; review and apply migrations separately before release');
}

async function provider(path) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${path}`, {headers: {Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`}, redirect: 'error', signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw Error(`Supabase configuration read failed (HTTP ${response.status})`);
  return response.json();
}

function command(args) {
  const result = spawnSync('supabase', args, {encoding: 'utf8', timeout: 900000, env: {...process.env, NO_COLOR: '1'}});
  if (result.error || result.status !== 0) throw Error('Supabase command failed; private connection and SQL details withheld');
  return result.stdout;
}

async function main() {
  const environment = process.argv[2], target = configuredTarget(environment);
  if (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.SUPABASE_DB_PASSWORD) throw Error('Missing project-scoped migration credentials');
  const project = await provider(target.projectRef);
  if ((project.id ?? project.ref) !== target.projectRef || project.name !== target.projectName) throw Error('Supabase project identity differs from the registered target');
  const pools = await provider(`${target.projectRef}/config/database/pooler`);
  const primary = pools.find(pool => pool.database_type === 'PRIMARY');
  const url = sessionUrl(primary?.connection_string ?? primary?.connectionString ?? '', target, process.env.SUPABASE_DB_PASSWORD);
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::add-mask::${url}`);
  if (environment === 'staging') {
    command(['db', 'push', '--db-url', url, '--dry-run']);
    command(['db', 'push', '--db-url', url]);
    console.log('Isolated staging migrations completed; no seed or user data copied.');
  } else {
    const versions = readdirSync('supabase/migrations').filter(name => /^\d{14}_.+\.sql$/.test(name)).map(name => name.slice(0, 14));
    verifyMigrationList(command(['migration', 'list', '--db-url', url]), versions);
    console.log('Production migration history matches; no database writes performed.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {console.error('Database preflight failed; provider and credential details withheld.'); process.exitCode = 1;});
}
