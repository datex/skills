import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCommandLines, splitCommand, frontmatter } from './lib/cli-lines.mjs';

const md = [
  'Prose mentions `fpx status` inline - not a fenced line, ignored.',
  '```bash',
  '# a comment',
  'fpx use https://app.example --app-scope api://x/.default \\',
  '  --account ann@corp.com',
  'fpx pick-history -D p.json --all --out picks.jsonl && node analyse.mjs .',
  'dxs source repo create --type agent --name "ABC agent" --org 1347',
  'export FPX_HOME=/tmp/x',
  '```',
  '```text',
  'fpx not-a-command-in-a-text-fence',
  '```',
].join('\n');

test('only fenced bash/sh/shell lines are extracted, continuations joined', () => {
  assert.deepEqual(extractCommandLines(md, 'fpx'), [
    'fpx use https://app.example --app-scope api://x/.default --account ann@corp.com',
    'fpx pick-history -D p.json --all --out picks.jsonl',
  ]);
  assert.deepEqual(extractCommandLines(md, 'dxs'), ['dxs source repo create --type agent --name "ABC agent" --org 1347']);
});

test('command words stop at the first flag, placeholder, quote, path or value', () => {
  assert.deepEqual(splitCommand('dxs source repo create --type agent --name "ABC agent" --org 1347'),
    { words: ['source', 'repo', 'create'], flags: ['--type', '--name', '--org'] });
  assert.deepEqual(splitCommand('fpx use <url> --app-scope <scope>'), { words: ['use'], flags: ['--app-scope'] });
  assert.deepEqual(splitCommand('fpx <alias> --all --out rows.jsonl'), { words: [], flags: ['--all', '--out'] });
  assert.deepEqual(splitCommand('dxs configuration get agent agent -b 73444 -O env.json'),
    { words: ['configuration', 'get', 'agent', 'agent'], flags: ['-b', '-O'] });
});

test('frontmatter parses name, description and a depends list', () => {
  const fm = frontmatter('---\nname: fpx\ndescription: |\n  Use when x.\ndepends:\n  - a\n  - b\n---\n# body');
  assert.equal(fm.name, 'fpx');
  assert.match(fm.description, /Use when x/);
  assert.deepEqual(fm.depends, ['a', 'b']);
});
