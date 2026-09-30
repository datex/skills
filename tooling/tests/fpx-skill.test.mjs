import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { extractCommandLines, splitCommand, frontmatter } from './lib/cli-lines.mjs';
import { helpFor, ALIAS_FLAGS, hasFlag } from './lib/run-cli.mjs';

const PATH = 'skills/datex-studio/fpx/SKILL.md';
const md = existsSync(PATH) ? readFileSync(PATH, 'utf8') : '';

test('frontmatter: name fpx, a when-to-use description', () => {
  const fm = frontmatter(md);
  assert.equal(fm.name, 'fpx');
  assert.match(fm.description ?? '', /^Use when/);
});

test('names no retired fp surface and no Studio internals', () => {
  for (const bad of [/\bfp (use|commands|skills|status|manifest|profile)\b/, /DXS-FP/, /DXS_FP/, /fp-contracts/, /\$datasources/, /\$flows/, /Wavelength(?!<org>)/]) {
    assert.doesNotMatch(md, bad, `found ${bad}`);
  }
});

test('Review Focus 1: scripts pass parameters with -D <file>, and quoting is explained', () => {
  const lines = extractCommandLines(md, 'fpx').filter(l => l.includes('--out'));
  assert.ok(lines.length > 0, 'at least one --all --out export example');
  for (const l of lines) assert.match(l, /\s-D\s/, `export without -D: ${l}`);
  assert.match(md, /PowerShell/);
});

test('Review Focus 4: 401 and 403 are told apart, 403 = app role assignment', () => {
  assert.match(md, /403[^\n]*app role/i);
  assert.match(md, /401/);
});

test('every static fpx command and flag named exists in the installed fpx', t => {
  if (helpFor('fpx', []) === null) { t.skip('fpx not installed'); return; }
  const root = helpFor('fpx', []);
  const statics = new Set([...root.text.matchAll(/^\s{2}([a-z][a-z-]*)\s/gm)].map(m => m[1]));
  for (const line of extractCommandLines(md, 'fpx')) {
    const { words, flags } = splitCommand(line);
    if (words.length === 0 || !statics.has(words[0])) {
      for (const f of flags) assert.ok(ALIAS_FLAGS.has(f) || hasFlag(root.text, f), `alias flag ${f} in: ${line}`);
      continue;
    }
    const h = helpFor('fpx', words);
    assert.ok(h.ok, `fpx ${words.join(' ')} --help failed`);
    for (const f of flags) assert.ok(hasFlag(h.text, f) || hasFlag(root.text, f), `flag ${f} not in fpx ${words.join(' ')} --help`);
  }
});
