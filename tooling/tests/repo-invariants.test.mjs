import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function* markdown(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && !name.startsWith('.')) yield* markdown(p); }
    else if (name.endsWith('.md')) yield p;
  }
}
const files = [...markdown('skills'), 'README.md', 'CLAUDE.md', ...markdown('docs')].filter(p => !p.includes(join('docs', 'superpowers')));

test('footprint-cli is gone and nothing links to it', () => {
  for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), /footprint-cli/, f);
});

test('no skill documents the retired fp CLI', () => {
  for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), /\bfp (use|commands|skills|status)\b|DXS-FP-|DXS_FP_/, f);
});
