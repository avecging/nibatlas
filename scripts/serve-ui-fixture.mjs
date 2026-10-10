import { spawn } from 'node:child_process';
import { cp, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// These browser journeys stub first-party API responses. Build an isolated UI
// fixture without the admin request gate; the Worker suite tests the real gate.
const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'nibatlas-ui-'));
const excluded = new Set(['node_modules', 'test-results', 'playwright-report']);
let child;
let stopping = false;
const stop = () => {
  stopping = true;
  child?.kill('SIGTERM');
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
try {
  await cp(root, fixture, {
    recursive: true,
    filter(path) {
      const name = relative(root, path);
      const parts = name.split('/');
      return !parts.some(part => excluded.has(part) || part.startsWith('.')) && name !== 'middleware.ts';
    },
  });
  await access(join(fixture, 'middleware.ts')).then(
    () => { throw Error('UI fixture must exclude admin middleware'); },
    () => {},
  );
  const run = (args) => new Promise((resolve, reject) => {
    if (stopping) return reject(Error('Fixture stopped'));
    child = spawn('pnpm', args, { cwd: fixture, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(Error(`Fixture command exited: ${code ?? signal}`)));
  });
  await run(['install', '--frozen-lockfile']);
  await run(['build']);
  await run(['start', '--hostname', '127.0.0.1', '--port', '3000']);
} finally {
  process.off('SIGTERM', stop);
  process.off('SIGINT', stop);
  await rm(fixture, { recursive: true, force: true });
}
