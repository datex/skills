import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractCommandLines, splitCommand, frontmatter } from './lib/cli-lines.mjs';
import { helpFor, hasFlag } from './lib/run-cli.mjs';

const md = readFileSync('skills/datex-studio/agent-creator/SKILL.md', 'utf8');

test('frontmatter depends on fpx and the shared library', () => {
  const fm = frontmatter(md);
  assert.equal(fm.name, 'agent-creator');
  assert.match(fm.description, /^Use when/);
  for (const d of ['fpx', 'datex-studio-shared']) assert.ok(fm.depends.includes(d), d);
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

test('Review Focus 4: tenant prerequisites link to the fpx skill, not restated here', () => {
  assert.match(md, /\]\(\.\.\/fpx\/SKILL\.md#the-three-tenant-prerequisites\)/);
  assert.doesNotMatch(md, /Pre-authorize/);
});

test('links the worked example and the fpx skill', () => {
  assert.match(md, /\]\(references\/examples\/abc-slotting\/README\.md\)/);
  assert.match(md, /\]\(\.\.\/fpx\/SKILL\.md\)/);
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
