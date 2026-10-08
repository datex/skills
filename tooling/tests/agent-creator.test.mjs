import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractCommandLines, splitCommand, frontmatter } from './lib/cli-lines.mjs';
import { helpFor, hasFlag } from './lib/run-cli.mjs';

const md = readFileSync('skills/datex-studio/agent-creator/SKILL.md', 'utf8');

test('frontmatter depends on the shared library, not fpx (fpx ships its own skill now)', () => {
  const fm = frontmatter(md);
  assert.equal(fm.name, 'agent-creator');
  assert.match(fm.description, /^Use when/);
  for (const d of ['datex-studio-shared', 'package-cascade']) assert.ok(fm.depends.includes(d), d);
  assert.ok(!fm.depends.includes('fpx'), 'fpx is not a skill in this repo anymore');
});

test('teaches the Agent application loop in order', () => {
  const body = md.replace(/^---[\s\S]*?\n---/, ''); // the description names some steps too
  const order = ['dxs source repo create', 'dxs source reference set', 'dxs configuration list', 'dxs configuration upsert agent', 'dxs agent check', 'dxs agent url', 'fpx use', 'dxs agent chat'];
  let at = -1;
  for (const step of order) { const i = body.indexOf(step); assert.ok(i > at, `${step} out of order or missing`); at = i; }
});

test('drops the sections that described pre-Agent-application hosting', () => {
  for (const gone of [/Two manifests/, /A bare ref is not always/, /agentconfigurations\/referenceName/, /in-process host/i, /\bfp\b(?!x)/]) assert.doesNotMatch(md, gone, `${gone}`);
});

// fpx now ships its own CLI skill from the fpx repo (bundled in the npm package, installed via
// `fpx skills install`) — there is no `skills/datex-studio/fpx` in this repo to link to anymore,
// so these checks no longer assert a relative markdown link into it. Retargeted to the admin
// prerequisites this skill now states directly: the manual pre-authorize step is gone (the
// platform does it automatically), and the content names "fpx skills install" and the
// app-identity hand-off by name instead of by path.
test('Review Focus 4: admin prerequisites are shortened — no manual pre-authorize step', () => {
  assert.doesNotMatch(md, /Pre-authorize/);
  assert.match(md, /pre-authorizes[\s\S]{0,80}automatically/i);
});

test('hand-off: install fpx, fpx use, then fpx skills install, then the app-identity paragraph', () => {
  assert.match(md, /fpx skills install/);
  assert.match(md, /fpx use /);
  assert.match(md, /app identity/i);
  assert.match(md, /access_as_daemon/);
});

test('links the worked example', () => {
  assert.match(md, /\]\(references\/examples\/abc-slotting\/README\.md\)/);
});

test('every dxs command and flag named exists in dxs 0.6.0', t => {
  if (helpFor('dxs', []) === null) { t.skip('dxs checkout not found (set DXS_CLI_CHECKOUT)'); return; }
  const root = helpFor('dxs', []);
  for (const line of extractCommandLines(md, 'dxs')) {
    const { words, flags } = splitCommand(line);
    const h = helpFor('dxs', words);
    assert.ok(h.ok, `dxs ${words.join(' ')} --help failed:\n${h.text.slice(0, 300)}`);
    for (const f of flags) assert.ok(hasFlag(h.text, f) || hasFlag(root.text, f), `flag ${f} not in dxs ${words.join(' ')} --help`);
  }
});
