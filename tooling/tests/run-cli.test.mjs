import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { hasFlag } from './lib/run-cli.mjs';

test('hasFlag matches a whole flag token, never a prefix of a longer one', () => {
  assert.equal(hasFlag('  --app-scope <s>', '--app-scope'), true);
  assert.equal(hasFlag('  --app-scope <s>', '--app-scop'), false);
  assert.equal(hasFlag('  -b, --branch INTEGER', '-b'), true);
  assert.equal(hasFlag('  -b, --branch INTEGER', '--branch'), true);
  assert.equal(hasFlag('--top <n>', '--to'), false);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const runCliUrl = pathToFileURL(join(__dirname, 'lib', 'run-cli.mjs')).href;

test('helpFor returns null (not {ok:false}) when the CLI binary does not exist, on any platform', () => {
  // Runs in a throwaway child process (its own module cache) so the SKILLS_TEST_FPX_BIN
  // override cannot leak into this test file's own import of run-cli.mjs.
  const script = `import(${JSON.stringify(runCliUrl)}).then(m => { process.stdout.write(JSON.stringify(m.helpFor('fpx', []))); });`;
  const r = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    env: { ...process.env, SKILLS_TEST_FPX_BIN: 'fpx-does-not-exist' },
  });
  assert.equal(r.status, 0, `child process failed: ${r.stderr}`);
  assert.equal(r.stdout.trim(), 'null', `expected null, got: ${r.stdout}`);
});
