# Agent application skills + fpx skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the skills repo's agent tooling for Agent applications: `agent-creator` teaches the dxs 0.6.0 authoring loop, a new `fpx` skill replaces the never-released `footprint-cli`, and the ABC/Pareto slotting agent ships as the worked example whose owned skill aggregates through an `fpx` export script.

**Architecture:** Three skill documents plus one example folder under `agent-creator/references/examples/abc-slotting/`. The example's analysis script lives once, as a fenced block inside the owned skill markdown (the manifest carries only markdown, so the script must travel inside it). A small `node --test` suite under `tooling/tests/` extracts that block and runs it on in-memory fixtures, checks that every `dxs`/`fpx` command a skill names exists with the options it uses, and pins the repo-wide forbidden strings. The owned skill is then pushed to the live singleton on branch 73444 and checked with `dxs agent check`.

**Tech Stack:** Markdown skills (skills.sh format: `SKILL.md` + frontmatter `name`/`description`/`depends`), Node 20+ built-in test runner (`node --test`, no new dependencies), `dxs` 0.6.0 (Python, run from `D:\Git\datex-studio-cli` with `uv run`), `@datex/fpx` 0.1.0 (global link to `D:\Git\fpx`).

**Spec:** `D:\Git\248960_agent\docs\superpowers\specs\2026-09-25-agent-application-type-design.md` — §6 (skills repo), §4.9 and review-round item 3b (one best-in-line slotting example that demonstrates script usage through the CLI), review-round item 6(b)/(c) (paging with `--all --out`, output discipline), item 7 (fpx calls the Agent application only).

## Global Constraints

- Repo: `D:\Git\skills`, branch `feature/248960_agent_applications`. Commit locally; **never push**. Never stage `.github/` or `.vs/`.
- Every commit message ends with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- "Datex Studio", never "Wavelength" (repo invariant; `wavelength<org>.onmicrosoft.com` as a literal tenant-name pattern is the one allowed exception, because that is the tenant's real name).
- `dxs` is the source of truth for authoring; skills never treat local files as authoritative.
- Never assume a branch id. Branch 73444 is used in Task 5 only after the user confirms it in that session.
- Skill frontmatter carries exactly `name`, `description`, and `depends` (a list; omit it only when empty).
- The `fp` Python CLI never shipped: no skill may mention `fp use`, `fp commands`, `fp skills`, `fp status`, `DXS-FP-*`, `DXS_FP_*` or `fp-contracts`. It is deleted, not deprecated.
- Owned (manifest) skills never name Studio internals: no `$datasources`, `$flows`, `dxs `, config reference names or file paths from Studio. They name command **aliases**, their **parameters** (exact camelCase/snake_case as the target declares), and, for aggregation, `fpx` scripts.
- The compat table (`compat.yaml`, on main) gets **no new row**: `agent-creator`/`footprint-cli` never reached main, so the 0.5 line loses nothing and 0.6 resolves to `default: main`.
- Verified versions recorded in each new/rewritten skill's body: `dxs 0.6.0`, `fpx 0.1.0`.

## Review Focus

1. **A Windows user pastes a `--params '{"…"}'` line into PowerShell 5.1 or Git Bash with `\"`** — expectation: the skills never rely on inline JSON for anything longer than one key; they write a params file and pass `-D <file>`. Pinned in Task 2 (fpx skill test asserts `-D` appears in the script section) and Task 3 (the export script uses `-D` only).
2. **A machine with Node but no `jq` or Python** (this repo's dev machine is one) — expectation: the worked example runs anyway, because its aggregation step is a Node script and fpx itself requires Node. Pinned in Task 3 (the analysis test runs the extracted block with `node`).
3. **An export interrupted mid-way (`FPX-051`, a network drop, a 5xx after retries)** — expectation: the skill says the JSONL file is partial, deletes it, and reruns; the analysis never runs on a partial file. Pinned in Task 3 (script section uses `&&` between exports and the analysis; test asserts the skill text names `FPX-051` and "partial").
4. **A 401/403 on the first `fpx use` against a freshly deployed Agent app** — expectation: the skills map 401 to sign-in/tenant and consent, 403 to the missing app role assignment, and name the three tenant prerequisites. Pinned in Task 2 and Task 4 (tests assert both skills name `403` next to "app role").
5. **A window with no picks (new warehouse, wrong warehouse id, window too short)** — expectation: the analysis prints a summary with `picks: 0` and a note to widen the window, not a crash or an empty proposal list presented as "well slotted". Pinned in Task 3 (empty-picks test).

---

## File Structure

| Path | Responsibility | Task |
|---|---|---|
| `tooling/tests/lib/cli-lines.mjs` | Extract `dxs`/`fpx` command lines from markdown fences; split them into command words and flags | 2 |
| `tooling/tests/lib/run-cli.mjs` | Run `dxs … --help` (via `uv run` in the CLI checkout) and `fpx … --help`, cached; skip when unavailable | 2 |
| `tooling/tests/cli-lines.test.mjs` | Unit tests for the extractor | 2 |
| `tooling/tests/fpx-skill.test.mjs` | `fpx` skill: frontmatter, forbidden strings, surface check, Review Focus 1/4 pins | 2 |
| `tooling/tests/repo-invariants.test.mjs` | Repo-wide: no `footprint-cli` link, no retired `fp` commands | 2 |
| `package.json` | `"test": "node --test tooling/tests/"` | 2 |
| `skills/datex-studio/fpx/SKILL.md` | Operating a deployed Agent app with `fpx` | 2 |
| `skills/datex-studio/fpx/references/error-codes.md` | FPX code table, regenerated from `fpx` `docs/contracts.md` | 2 |
| `skills/datex-studio/footprint-cli/` | **Deleted** | 2 |
| `skills/datex-studio/agent-creator/references/examples/abc-slotting/abc-slotting.md` | The owned skill (with the embedded `analyse.mjs`) | 3 |
| `skills/datex-studio/agent-creator/references/examples/abc-slotting/agent.json` | The upsert body for the singleton; its skill `content` equals `abc-slotting.md` | 3 |
| `skills/datex-studio/agent-creator/references/examples/abc-slotting/README.md` | Walkthrough: what each command is, why the script, how it was verified | 3 |
| `tooling/tests/abc-slotting.test.mjs` | Runs the embedded script on in-memory fixtures; `agent.json` ↔ markdown sync; Review Focus 1/2/3/5 pins | 3 |
| `skills/datex-studio/agent-creator/SKILL.md` | Rewritten for Agent applications | 4 |
| `tooling/tests/agent-creator.test.mjs` | Frontmatter, surface check, forbidden sections, Review Focus 4 pin | 4 |
| `README.md`, `CLAUDE.md`, `docs/cli-release-checklist.md` | Catalog rows, "two CLIs", fpx release section | 6 |

---

### Task 1: Bring the feature branch up to date with main

The feature branch is 32 commits behind `origin/main` and 5 ahead. Main carries `compat.yaml` and newer skill edits; later tasks must build on it.

**Files:**
- Modify: whatever the merge touches; expected conflict only in `README.md`.

**Interfaces:**
- Produces: a branch that contains `origin/main` (`git merge-base --is-ancestor origin/main HEAD` exits 0), and `compat.yaml` present at the repo root.

- [ ] **Step 1: Record the state and fetch**

```bash
cd /d/Git/skills
git status --short            # expect only ?? .github/ and ?? .vs/
git fetch origin
git log --oneline HEAD..origin/main | wc -l    # expect 32 (or more)
```

- [ ] **Step 2: Merge main (no fast-forward, no push)**

```bash
git merge --no-ff origin/main -m "Merge origin/main into feature/248960_agent_applications

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

If `README.md` conflicts: keep **both** sides' rows. The feature branch adds the `agent-creator` and `footprint-cli` rows; main adds whatever rows it added. Tasks 2 and 6 rewrite the agent rows later, so keep them verbatim for now. Then `git add README.md && git commit --no-edit`.

- [ ] **Step 3: Verify**

```bash
git merge-base --is-ancestor origin/main HEAD && echo "contains main"
test -f compat.yaml && echo "compat.yaml present"
git log --oneline -1
```

Then run the link check from `docs/cli-release-checklist.md` §4 (copy the block exactly). Expected: no `BROKEN:` lines. A `BROKEN:` line that exists on `origin/main` too is pre-existing: list it in the report, do not fix it here.

---

### Task 2: The `fpx` skill, the test harness, and the deletion of `footprint-cli`

**Files:**
- Create: `package.json` script, `tooling/tests/lib/cli-lines.mjs`, `tooling/tests/lib/run-cli.mjs`, `tooling/tests/cli-lines.test.mjs`, `tooling/tests/fpx-skill.test.mjs`, `tooling/tests/repo-invariants.test.mjs`, `skills/datex-studio/fpx/SKILL.md`, `skills/datex-studio/fpx/references/error-codes.md`
- Delete: `skills/datex-studio/footprint-cli/` (whole directory)
- Modify: `README.md` (replace the `footprint-cli` row), `skills/datex-studio/agent-creator/SKILL.md` frontmatter only (`depends:` drops nothing yet; it does not depend on `footprint-cli` today — verify)

**Interfaces:**
- Produces: `extractCommandLines(markdown: string, cli: 'dxs'|'fpx'): string[]`, `splitCommand(line: string): { words: string[], flags: string[] }`, `helpFor(cli: 'dxs'|'fpx', words: string[]): { ok: boolean, text: string } | null` (null = CLI unavailable, test skips), and `frontmatter(markdown: string): Record<string, unknown>`. Tasks 3 and 4 import them from `tooling/tests/lib/`.

- [ ] **Step 1: Add the test script**

In `package.json`, change `"scripts"` to:

```json
  "scripts": {
    "test": "node --test tooling/tests/",
    "deploy": "rimraf ../datex-studio-cli/.claude/skills && copyfiles -u 2 \"skills/datex-studio/**/*\" ../datex-studio-cli/.claude/skills",
    "collect": "rimraf skills/datex-studio && copyfiles -u 4 \"../datex-studio-cli/.claude/skills/**/*\" skills/datex-studio"
  },
```

- [ ] **Step 2: Write the extractor's failing tests**

`tooling/tests/cli-lines.test.mjs`:

```js
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
```

- [ ] **Step 3: Run to see it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '…/tooling/tests/lib/cli-lines.mjs'`.

- [ ] **Step 4: Implement the extractor**

`tooling/tests/lib/cli-lines.mjs`:

```js
// Command lines named by a skill, so tests can check they exist in the CLI they document.
const FENCE = /^```(\w*)/;
const SHELL_FENCES = new Set(['bash', 'sh', 'shell', 'console']);

export function extractCommandLines(markdown, cli) {
  const out = [];
  let inShell = false;
  let pending = '';
  for (const raw of markdown.split(/\r?\n/)) {
    const fence = FENCE.exec(raw.trim());
    if (fence) { inShell = !inShell && SHELL_FENCES.has(fence[1]); pending = ''; continue; }
    if (!inShell) continue;
    const line = pending + raw.trim();
    if (line.endsWith('\\')) { pending = line.slice(0, -1).trimEnd() + ' '; continue; }
    pending = '';
    if (line === '' || line.startsWith('#')) continue;
    for (const segment of line.split(/\s*(?:&&|\|\||;|\|)\s*/)) {
      const cmd = segment.replace(/\s+[12]?>.*$/, '').trim();
      if (cmd.startsWith(`${cli} `) || cmd === cli) out.push(cmd);
    }
  }
  return out;
}

const tokens = line => line.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];

export function splitCommand(line) {
  const [, ...rest] = tokens(line);
  const words = [];
  let wordsDone = false;
  const flags = [];
  for (const t of rest) {
    if (t.startsWith('-')) { wordsDone = true; flags.push(t.split('=')[0]); continue; }
    if (wordsDone) continue;
    if (/^[a-z][a-z0-9-]*$/.test(t)) words.push(t); else wordsDone = true;
  }
  return { words, flags: [...new Set(flags)] };
}

export function frontmatter(markdown) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!m) return {};
  const out = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const top = /^([a-z][a-z-]*):\s*(.*)$/.exec(line);
    if (top) {
      key = top[1];
      out[key] = top[2] === '|' || top[2] === '' ? (top[2] === '|' ? '' : []) : top[2];
      continue;
    }
    if (key && Array.isArray(out[key]) && /^\s+-\s+/.test(line)) out[key].push(line.replace(/^\s+-\s+/, '').trim());
    else if (key && typeof out[key] === 'string') out[key] += (out[key] ? '\n' : '') + line.trim();
  }
  return out;
}
```

Note: `splitCommand('dxs configuration get agent agent …')` returns four words because `agent agent` are the positional type and reference. That is fine: Click's `--help` is eager, so `dxs configuration get agent agent --help` exits 0, while a misspelled subcommand (`dxs configuraton …`) exits 2.

- [ ] **Step 5: Run the extractor tests**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the CLI runner**

`tooling/tests/lib/run-cli.mjs`:

```js
// `<cli> <words> --help`, cached per command. Returns null when the CLI is not installed,
// so a machine without dxs or fpx skips these checks instead of failing them.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const cache = new Map();
const DXS_CHECKOUT = process.env.DXS_CLI_CHECKOUT ?? resolve(process.cwd(), '..', 'datex-studio-cli');

function run(cli, args) {
  if (cli === 'dxs') {
    if (!existsSync(DXS_CHECKOUT)) return null;
    return spawnSync('uv', ['run', 'dxs', ...args], { cwd: DXS_CHECKOUT, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DXS_INTERNAL_COMMANDS: '1' } });
  }
  return spawnSync('fpx', args, { encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, FPX_NO_UPDATE_CHECK: '1' } });
}

export function helpFor(cli, words) {
  const key = `${cli} ${words.join(' ')}`;
  if (cache.has(key)) return cache.get(key);
  const r = run(cli, [...words, '--help']);
  const result = !r || r.error || (r.status === null) ? null : { ok: r.status === 0, text: `${r.stdout}\n${r.stderr}` };
  cache.set(key, result);
  return result;
}

/** Flags accepted by every agent alias (a datasource or function command materialised from the manifest). */
export const ALIAS_FLAGS = new Set(['-p', '--params', '-D', '--data-file', '--top', '--skip', '--select', '--all', '--out', '--verb', '-h', '--help']);
```

- [ ] **Step 7: Write the fpx skill's failing tests**

`tooling/tests/fpx-skill.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { extractCommandLines, splitCommand, frontmatter } from './lib/cli-lines.mjs';
import { helpFor, ALIAS_FLAGS } from './lib/run-cli.mjs';

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
      for (const f of flags) assert.ok(ALIAS_FLAGS.has(f) || root.text.includes(f), `alias flag ${f} in: ${line}`);
      continue;
    }
    const h = helpFor('fpx', words);
    assert.ok(h.ok, `fpx ${words.join(' ')} --help failed`);
    for (const f of flags) assert.ok(h.text.includes(f) || root.text.includes(f), `flag ${f} not in fpx ${words.join(' ')} --help`);
  }
});
```

`tooling/tests/repo-invariants.test.mjs`:

```js
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
```

The `docs/superpowers` exclusion is deliberate: plans and specs are history and may name what they replaced.

- [ ] **Step 8: Run to see them fail**

Run: `npm test`
Expected: FAIL — `fpx-skill.test.mjs` frontmatter test (file missing), `repo-invariants.test.mjs` both tests (the `footprint-cli` skill and the `agent-creator` skill still name `fp use`/`footprint-cli`). The agent-creator failure stays red until Task 4; that is expected and the Task 2 report must say so.

- [ ] **Step 9: Generate the error-code reference**

```bash
{
  echo '# fpx error codes'
  echo
  echo 'Generated from `docs/contracts.md` ("Error registry") in the fpx repository, fpx 0.1.0.'
  echo 'Regenerate at every fpx release; never hand-edit a row:'
  echo
  echo '```bash'
  echo "sed -n '/^## Error registry/,/^## \`fpx\\/lib\`/p' <fpx checkout>/docs/contracts.md | grep '^|'"
  echo '```'
  echo
  sed -n '/^## Error registry/,/^## `fpx\/lib`/p' /d/Git/fpx/docs/contracts.md | grep '^|'
} > skills/datex-studio/fpx/references/error-codes.md
grep -c '^| `FPX' skills/datex-studio/fpx/references/error-codes.md   # expect 44
```

- [ ] **Step 10: Write `skills/datex-studio/fpx/SKILL.md`**

Write this content (verified against dxs 0.6.0 and fpx 0.1.0; adjust nothing without re-running `fpx --help`):

````markdown
---
name: fpx
description: |
  Use when RUNNING commands against a deployed Datex Agent application with the fpx CLI —
  pointing fpx at the app (`fpx use`), signing in (Datex, dedicated External ID, or customer
  tenant), listing and calling its commands, exporting large datasources to a file and
  aggregating them in a script, and diagnosing 401/403/404/500 or FPX-* errors. Triggers:
  "fpx use", "fpx commands", "call the agent app", "export all rows", "script against the
  agent", "fpx returns 401", "FPX-061", "sign in to the agent app". For AUTHORING the agent
  (its commands, skills and profile in Datex Studio), use `agent-creator`.
---

# fpx — operating a deployed Agent application

Verified against **fpx 0.1.0** and **dxs 0.6.0**. Run `fpx --version` first; a newer fpx may
have moved an option this skill names.

`fpx` (`@datex/fpx` on npm) is one generic CLI. It reads the **manifest** a deployed Agent
application serves at `GET /api/$agent/manifest` and turns every command in it into an `fpx`
subcommand named by the command's alias. It talks to the Agent application only: that app
compiled in exactly the functions and datasources it exposes, so what `fpx commands` lists is
what the app can execute.

## Install

```bash
npm i -g @datex/fpx      # or run without installing: npx @datex/fpx --help
fpx --version
```

## Point fpx at the app

`dxs agent url -b <branch> --env <environment>` prints the app URL, the backend scope, the
tenant, and a ready `fpx_use` line. Paste that line:

```bash
fpx use <url> --app-scope <scope>                                  # Datex-tenant users
fpx use <url> --app-scope <scope> --account you@customer.com       # customer-tenant users
fpx use <url> --app-scope <scope> --account you@customer.com --tenant-id <tenant>
fpx commands
```

- `--account` sends your address as the login hint and discovers the tenant from its domain.
  `--tenant-id` is the explicit form.
- The first `use` opens the browser once. Later commands mint tokens from the stored refresh
  token; no browser opens again.
- Without a terminal (CI, a script) and nobody signed in, `use` refuses with `FPX-AUTH-002` and
  prints both ways forward. Sign in once from a terminal, then scripts work.
- Headless machines: add `--use-device-code`, or set `FPX_NO_BROWSER=1`.

## Call one command

```bash
fpx <alias> --help                         # the alias's parameters, from the manifest and the app
fpx <alias> --params '{"warehouseId": 12}' --top 20
```

One call is fine for a lookup. For anything that counts, joins, ranks or reads more than a
page, export and script instead (next section). Never page rows through a conversation.

## Scripts: export, then aggregate locally

`--all --out <file>` pages the whole result to a JSONL file (5000 rows a page, retried on
429/5xx/network errors) and prints only the counts. Write parameters to a file and pass
`-D <file>`: it avoids shell quoting entirely, in bash, Git Bash and PowerShell alike.

```bash
printf '{"warehouseId": %s, "skip": 0}' 12 > params.json
fpx <alias> -D params.json --all --out rows.jsonl && node summarise.mjs rows.jsonl
```

- Keep each script's stdout to the final summary. Intermediate data stays in files.
- `&&` matters: if an export fails, the file is **partial** (`FPX-051` says how many rows of the
  total arrived). Delete it and rerun the export; never aggregate a partial file.
- Node is always present where fpx is installed, so a `.mjs` aggregation step works on every
  machine. `jq` or Python are fine where they exist.
- A stable order across pages is the datasource's job. A datasource that declares `$orderby`
  takes it through the params file; `$top`/`$skip` belong to `--all` and are refused inside it.
- `fpx run script.sh` checks that fpx is ready (URL, identity or token, manifest) before
  running the script, and refuses with `FPX-070` listing every failed check.

Inline JSON (`--params '{"a": 1}'`) is fine in bash for one short key. In PowerShell 5.1 the
inner quotes must be escaped as `\"`; in Git Bash they must **not** be. When in doubt, use `-D`.

## When a call fails

| You see | It means | Do |
|---|---|---|
| `FPX-AUTH-002` | Nobody signed in, or no terminal to sign in at | `fpx use … --login` from a terminal |
| `FPX-061` with `401` | Signed in against the wrong tenant, or the tenant has not consented | Re-run `fpx use` with `--account`/`--tenant-id`; `fpx auth consent --tenant-id <tenant>` for the admin URL |
| `FPX-061` with `403` | Signed in, but your account has no **app role** assignment on the app's backend registration | An admin assigns you a role in Entra; nothing to change in fpx |
| `FPX-061` with `500` on the manifest | The app failed before routing — typically its roles lookup could not reach the Datex Studio API | Check the app's own log and the API it depends on |
| `FPX-AUTH-030` | The sign-in reached the corporate tenant, not the provisioned `wavelength<org>.onmicrosoft.com` one | `fpx login --tenant-id <tenant>` with the tenant `dxs agent url` printed |
| `FPX-021` | No app scope for this app | Pass `--app-scope` on `fpx use` |
| `FPX-023` | The manifest lists the command but the app did not generate it | Fix the agent's command in Studio and redeploy |
| `FPX-051` | An export stopped short of the total | Delete the file, rerun |

The full list is [references/error-codes.md](references/error-codes.md).

## The three tenant prerequisites

A freshly deployed Agent application answers `401`/`403` until all three hold. They are
one-time, per application, and done by admins, not by fpx:

1. The fpx client is **pre-authorized** on the app's backend registration ("Expose an API →
   Add a client application", `access_as_user` ticked).
2. **Admin consent** in the organization's own tenant (the Manager's "Consent (admin only)",
   or the URL `fpx auth consent --tenant-id <tenant>` prints).
3. An **app role assignment** for every caller. A `403` from `GET /api/$agent/manifest` means
   this one is missing.

## Identities

```bash
fpx auth status              # the active identity, its tenant and token expiry
fpx auth list                # every stored identity
fpx auth switch <tenant id, domain or identity key>
fpx auth logout --all
```

Each identity is stored under its tenant, so a Datex identity and a customer identity coexist.
fpx keeps state in `~/.fpx` (`FPX_HOME` moves it; use a throwaway one for experiments).

## Hosted use (a parent process hands fpx a token)

`FPX_TOKEN` (fixed) or `FPX_TOKEN_FILE` (re-read per call) supply the bearer; fpx checks its
audience and expiry and mints nothing. `FPX_APP_URL`, `FPX_APP_SCOPE` and `FPX_MANIFEST_FILE`
replace what `fpx use` would store. Only hand fpx a token inside a process tree you control.
````

- [ ] **Step 11: Delete `footprint-cli` and update the catalog row**

```bash
git rm -rq skills/datex-studio/footprint-cli
grep -n "footprint-cli" README.md
```

Replace the README row

`| [`footprint-cli`](skills/datex-studio/footprint-cli/SKILL.md) | Run `fp` against a deployed agent app: auth, verb discovery, 401/404 diagnosis |`

with

`| [`fpx`](skills/datex-studio/fpx/SKILL.md) | Run a deployed Agent application's commands with `fpx`: sign-in, `--all --out` exports, scripts, 401/403 diagnosis |`

- [ ] **Step 12: Run the tests**

Run: `npm test`
Expected: `cli-lines` 3 pass, `fpx-skill` 5 pass. `repo-invariants` still fails **only** on `skills/datex-studio/agent-creator/SKILL.md` (Task 4 rewrites it). If any `fpx-skill` surface assertion fails, the skill named an option fpx does not have: fix the skill, not the test.

- [ ] **Step 13: Commit**

```bash
git add package.json tooling/tests skills/datex-studio/fpx README.md
git commit -m "fpx skill replaces the never-released footprint-cli; node --test harness for skill/CLI drift

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The ABC/Pareto slotting example

**Files:**
- Create: `skills/datex-studio/agent-creator/references/examples/abc-slotting/abc-slotting.md`, `…/agent.json`, `…/README.md`, `tooling/tests/abc-slotting.test.mjs`
- Source for `agent.json`: `C:\Users\pgyoshev\AppData\Local\Temp\claude\D--Git-datex-studio-cli-253347\8a9b6761-fd0b-402d-9283-35c323eef84f\scratchpad\slotting\agent\agent.json` (the body upserted to branch 73444 on 2026-09-28). If that file is gone, get the live body with `uv run dxs configuration get agent agent -b 73444 -O env.json` from the CLI checkout and take its `.json` field — only after the user confirms branch 73444.

**Interfaces:**
- Consumes: `extractCommandLines`, `splitCommand` from Task 2.
- Produces: the owned-skill markdown whose fenced block with info string `js analyse.mjs` is the analysis script; `agent.json` whose `skills[0].content` is byte-identical to `abc-slotting.md`. Task 5 upserts that `agent.json`.

- [ ] **Step 1: Write the failing tests**

`tooling/tests/abc-slotting.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractCommandLines } from './lib/cli-lines.mjs';

const DIR = 'skills/datex-studio/agent-creator/references/examples/abc-slotting';
const md = existsSync(join(DIR, 'abc-slotting.md')) ? readFileSync(join(DIR, 'abc-slotting.md'), 'utf8') : '';

function script() {
  const m = /```js analyse\.mjs\r?\n([\s\S]*?)```/.exec(md);
  assert.ok(m, 'abc-slotting.md carries a ```js analyse.mjs block');
  return m[1];
}
const jsonl = rows => rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');

function run(fixture, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'abc-'));
  writeFileSync(join(dir, 'analyse.mjs'), script());
  for (const [name, rows] of Object.entries(fixture)) writeFileSync(join(dir, name), jsonl(rows));
  const r = spawnSync(process.execPath, [join(dir, 'analyse.mjs'), dir, ...extra], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// 20 picks: M1 x12 (A), M2 x4 (A, picked from 3 locations), M3 x2 (B), M4 x1 (B), M5 x1 (C).
const pick = (MaterialId, loc) => ({ MaterialId, Material: { LookupCode: `M${MaterialId}` }, ActualSourceLocationId: loc, ActualPackagedAmount: 1 });
const picks = [
  ...Array.from({ length: 12 }, () => pick(1, 1)),
  pick(2, 4), pick(2, 4), pick(2, 5), pick(2, 1),
  pick(3, 5), pick(3, 5), pick(4, 4), pick(5, 4),
];
const loc = (Id, IsPrimaryPick, PickSequence, Enabled = true) => ({ Id, Name: `L${Id}`, IsPrimaryPick, PickSequence, Enabled, EligibleForAllocation: true });
const locations = [loc(1, true, 1), loc(2, true, 2), loc(3, true, 3, false), loc(4, false, 10), loc(5, false, 11)];
const inv = (LocationId, MaterialId, LotId, TotalPackagedAmount) => ({ LocationId, MaterialId, Material: { LookupCode: `M${MaterialId}` }, LotId, TotalPackagedAmount });
const inventory = [inv(1, 1, 10, 50), inv(4, 2, 100, 5), inv(4, 2, 101, 7), inv(2, 6, 60, 9), inv(5, 3, 30, 4)];

test('classes by cumulative share before each material; unpicked stock is C', () => {
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  assert.equal(s.picks, 20);
  assert.equal(s.materialsPicked, 5);
  assert.equal(s.sourceLocations, 3);
  assert.deepEqual(s.classes.A, { materials: 2, pickShare: 80 });
  assert.deepEqual(s.classes.B, { materials: 2, pickShare: 15 });
  assert.deepEqual(s.classes.C, { materials: 2, pickShare: 5, neverPicked: 1 });
});

test('golden zone occupancy, a disabled empty slot is never a target, one move proposed', () => {
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  assert.deepEqual(s.goldenZone, { basis: 'IsPrimaryPick', locations: 3, holdingA: 1, onlyC: 1, empty: 1 });
  assert.equal(s.aWithoutPrimarySlot, 1);
  assert.equal(s.moves.length, 1);
  assert.deepEqual({ ...s.moves[0], reason: undefined }, { rank: 1, material: 'M2', target: 'L2', picks: 4, lots: 2, reason: undefined });
  assert.equal(s.unplaced, 0);
  assert.deepEqual(s.fragmented, [{ material: 'M2', sourceLocations: 3, picks: 4 }]);
});

test('without IsPrimaryPick the lowest PickSequence slots form the golden zone, one per A material', () => {
  const noFlag = locations.map(l => ({ ...l, IsPrimaryPick: false }));
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': noFlag, 'inventory.jsonl': inventory });
  assert.deepEqual(s.goldenZone, { basis: 'lowest PickSequence', locations: 2, holdingA: 1, onlyC: 1, empty: 0 });
  assert.equal(s.moves[0].target, 'L2');
});

test('Review Focus 5: an empty window is a summary with a note, not a crash', () => {
  const s = run({ 'picks.jsonl': [], 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  assert.equal(s.picks, 0);
  assert.deepEqual(s.moves, []);
  assert.match(s.notes.join(' '), /widen the window/);
});

test('custom cut-offs and --top are honoured', () => {
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': locations, 'inventory.jsonl': inventory }, ['--a', '0.5', '--top', '0']);
  assert.equal(s.classes.A.materials, 1);
  assert.equal(s.moves.length, 0);
});

test('Review Focus 1/3: exports use -D files and are chained with &&; partial files are named', () => {
  const exports = extractCommandLines(md, 'fpx').filter(l => l.includes('--all'));
  assert.equal(exports.length, 3, 'pick-history, locations, inventory');
  for (const l of exports) assert.match(l, /\s-D\s/);
  assert.match(md, /--out inventory\.jsonl[\s\\]*&&\s*node analyse\.mjs/);
  assert.match(md, /FPX-051/);
  assert.match(md, /partial/i);
});

test('owned-skill rules: no Studio internals, aliases only', () => {
  for (const bad of [/\$datasources/, /\$flows/, /\bdxs /, /ds_slot_/, /FootprintManager\//]) assert.doesNotMatch(md, bad, `found ${bad}`);
});

test('agent.json carries this markdown verbatim and the aliases the skill uses', () => {
  const agent = JSON.parse(readFileSync(join(DIR, 'agent.json'), 'utf8'));
  assert.equal(agent.configurationTypeId, 38);
  assert.equal(agent.skills.length, 1);
  assert.equal(agent.skills[0].source, 'owned');
  assert.equal(agent.skills[0].content, md);
  const aliases = new Set(agent.commands.map(c => c.alias));
  for (const a of ['warehouses', 'pick-history', 'locations', 'inventory', 'empty-locations']) assert.ok(aliases.has(a), a);
  assert.match(agent.profile.systemPrompt, /abc-slotting/);
  assert.doesNotMatch(agent.profile.systemPrompt, /start at skip 0/);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tooling/tests/abc-slotting.test.mjs`
Expected: FAIL — "abc-slotting.md carries a ```js analyse.mjs block" and `ENOENT … agent.json`.

- [ ] **Step 3: Write `abc-slotting.md`**

Write exactly this file (it is also the skill's manifest content, so every word reaches the agent):

````markdown
---
name: abc-slotting
description: Use when asked to analyse pick velocity, classify materials A/B/C (Pareto), review how well a warehouse is slotted, or propose re-slotting moves that bring fast movers to primary pick locations.
---

# ABC / Pareto slotting analysis

You rank every material of one warehouse by how often it was picked over a recent window,
split the ranking into A, B and C classes by cumulative share of picks, and compare each
class with where its inventory sits. The output is a short report and a ranked list of
proposed moves. Nothing is moved: proposals are for a human to apply.

The pick history of a warehouse runs to tens of thousands of rows. Never read those rows
yourself. Export them to files with the script below and let it compute the answer; you read
only its summary.

## Inputs to settle first

1. **Warehouse.** Run `warehouses` with `full_text_filter` set to the name the user gives. If
   the user names none, run it with an empty `full_text_filter` and ask which one.
2. **Window.** Default to the last 6 months (`dateFrom` = today minus 6 months, `dateTo` =
   today, ISO dates). Use 12 months when the user asks for a seasonal view.
3. **Cut-offs.** Default A = first 80% of cumulative picks, B = up to 95%, C = the rest. Use
   the user's cut-offs when given (`--a` and `--b` below, as fractions).

## Run the analysis

In a fresh working directory, write the three parameter files, export the three lists, and
run the analysis. Replace `12` and the dates with the settled inputs.

```bash
mkdir -p slotting && cd slotting
printf '{"warehouseId": %s, "skip": 0}' 12 > warehouse.json
printf '{"warehouseId": %s, "dateFrom": "%s", "dateTo": "%s", "skip": 0}' 12 2026-04-01 2026-09-30 > picks.json
fpx pick-history -D picks.json --all --out picks.jsonl \
  && fpx locations -D warehouse.json --all --out locations.jsonl \
  && fpx inventory -D warehouse.json --all --out inventory.jsonl \
  && node analyse.mjs .
```

Before the first run, write the script below to `analyse.mjs` in that directory. Add
`--a 0.7 --b 0.9` for other cut-offs and `--top 50` for a longer move list.

If any export fails, its file is **partial**: `FPX-051` reports how many of the total rows
arrived before a short page. Delete the `.jsonl` files and rerun the whole block; never
analyse a partial export. Each export prints only a row count, so the conversation stays small.

```js analyse.mjs
// analyse.mjs - ABC/Pareto slotting from three fpx exports in one directory.
// Usage: node analyse.mjs <dir> [--a 0.8] [--b 0.95] [--top 20]
// Reads <dir>/picks.jsonl, locations.jsonl, inventory.jsonl and prints one JSON summary.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const dir = argv[0] && !argv[0].startsWith('--') ? argv[0] : '.';
const num = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = Number(argv[i + 1]);
  if (!Number.isFinite(v)) { console.error(`--${name} needs a number`); process.exit(2); }
  return v;
};
const A_CUT = num('a', 0.8);
const B_CUT = num('b', 0.95);
const TOP = num('top', 20);

function read(name) {
  const path = join(dir, name);
  if (!existsSync(path)) { console.error(`missing ${path}: export it with fpx first`); process.exit(2); }
  const text = readFileSync(path, 'utf8').trim();
  return text === '' ? [] : text.split(/\r?\n/).map(line => JSON.parse(line));
}
const picks = read('picks.jsonl');
const locations = read('locations.jsonl');
const inventory = read('inventory.jsonl');
const pct = (n, d) => (d === 0 ? 0 : Math.round((1000 * n) / d) / 10);

// Velocity: pick task count per material; quantity only breaks ties.
const byMaterial = new Map();
for (const p of picks) {
  let m = byMaterial.get(p.MaterialId);
  if (!m) {
    m = { id: p.MaterialId, code: p.Material?.LookupCode ?? String(p.MaterialId), picks: 0, qty: 0, sources: new Set() };
    byMaterial.set(p.MaterialId, m);
  }
  m.picks += 1;
  m.qty += Number(p.ActualPackagedAmount ?? 0);
  m.sources.add(p.ActualSourceLocationId);
}
const ranked = [...byMaterial.values()].sort((x, y) => y.picks - x.picks || y.qty - x.qty);
let before = 0;
for (const m of ranked) {
  const share = picks.length === 0 ? 1 : before / picks.length;
  m.cls = share < A_CUT ? 'A' : share < B_CUT ? 'B' : 'C';
  before += m.picks;
}
const classOf = id => byMaterial.get(id)?.cls ?? 'C'; // never picked in the window

// Stock per location and material; lots per material.
const stock = new Map();
const lots = new Map();
for (const r of inventory) {
  const amount = Number(r.TotalPackagedAmount ?? 0);
  if (amount <= 0) continue;
  if (!stock.has(r.LocationId)) stock.set(r.LocationId, new Map());
  const held = stock.get(r.LocationId);
  held.set(r.MaterialId, (held.get(r.MaterialId) ?? 0) + amount);
  if (!lots.has(r.MaterialId)) lots.set(r.MaterialId, new Set());
  if (r.LotId != null) lots.get(r.MaterialId).add(r.LotId);
}

// Golden zone: IsPrimaryPick; without the flag, the lowest PickSequence slots, one per A material.
const aMaterials = ranked.filter(m => m.cls === 'A');
const flagged = locations.filter(l => l.IsPrimaryPick === true);
const golden = flagged.length > 0
  ? flagged
  : locations.filter(l => l.PickSequence != null).sort((x, y) => x.PickSequence - y.PickSequence).slice(0, aMaterials.length);
const goldenIds = new Set(golden.map(l => l.Id));
const usable = l => l.Enabled !== false && l.EligibleForAllocation !== false;

let holdingA = 0;
let onlyC = 0;
let empty = 0;
const targets = [];
for (const l of golden) {
  const held = stock.get(l.Id);
  if (!held || held.size === 0) {
    empty += 1;
    if (usable(l)) targets.push({ l, why: 'empty primary-pick location', order: 0 });
    continue;
  }
  const classes = [...held.keys()].map(classOf);
  if (classes.includes('A')) holdingA += 1;
  if (classes.every(c => c === 'C')) {
    onlyC += 1;
    if (usable(l)) targets.push({ l, why: 'primary-pick location holding only C stock', order: 1 });
  }
}
targets.sort((x, y) => x.order - y.order || (x.l.PickSequence ?? Infinity) - (y.l.PickSequence ?? Infinity));

const inGolden = id => [...stock].some(([locationId, held]) => goldenIds.has(locationId) && held.has(id));
const lacking = aMaterials.filter(m => !inGolden(m.id));
const moves = lacking.slice(0, Math.min(TOP, targets.length)).map((m, i) => ({
  rank: i + 1,
  material: m.code,
  target: targets[i].l.Name,
  picks: m.picks,
  lots: lots.get(m.id)?.size ?? 0,
  reason: `A material with no primary-pick slot; target: ${targets[i].why}`,
}));

const neverPicked = [...lots.keys()].filter(id => !byMaterial.has(id)).length;
const inClass = c => ranked.filter(m => m.cls === c);
const shareOf = c => pct(inClass(c).reduce((s, m) => s + m.picks, 0), picks.length);
console.log(JSON.stringify({
  picks: picks.length,
  materialsPicked: ranked.length,
  sourceLocations: new Set(picks.map(p => p.ActualSourceLocationId)).size,
  classes: {
    A: { materials: inClass('A').length, pickShare: shareOf('A') },
    B: { materials: inClass('B').length, pickShare: shareOf('B') },
    C: { materials: inClass('C').length + neverPicked, pickShare: shareOf('C'), neverPicked },
  },
  goldenZone: { basis: flagged.length > 0 ? 'IsPrimaryPick' : 'lowest PickSequence', locations: golden.length, holdingA, onlyC, empty },
  aWithoutPrimarySlot: lacking.length,
  moves,
  unplaced: lacking.length - moves.length,
  fragmented: ranked.filter(m => m.sources.size >= 3).slice(0, 10)
    .map(m => ({ material: m.code, sourceLocations: m.sources.size, picks: m.picks })),
  notes: picks.length === 0 ? ['no picks in the window: widen the window or check the warehouse'] : [],
}, null, 2));
```

## Read the summary

- `classes`: how many materials fall in A, B and C and their share of picks. Materials with
  stock but no picks in the window are C (`neverPicked`).
- `goldenZone`: the primary-pick locations and what they hold. `basis: lowest PickSequence`
  means no location carries the primary-pick flag; say so in the report.
- `moves`: A materials with no stock in the golden zone, each paired with an enabled,
  allocatable golden-zone slot that is empty or holds only C stock. Ranked by picks.
- `unplaced`: A materials that still lack a slot after every free target was used.
- `fragmented`: materials picked from three or more locations.
- `notes`: anything that makes the numbers unreliable, such as an empty window.

## Decision rules

- Rank by pick **task count**, never by quantity. One task is one trip.
- A move whose material has `lots` above 1 moves stock split across lots: name the lot count
  in the proposal.
- Before recommending a target, you may run `empty-locations` with `warehouseId` and the
  target's `locationId` to offer free bins nearby as alternatives.
- Include the material lookup code and the target location name in every proposal.
- Do not create tasks or move stock. You analyse and propose.

## Report format

```
Warehouse: <name> (<id>)   Window: <from> .. <to>
Picks analysed: <picks> tasks over <materialsPicked> materials, <sourceLocations> source locations
Classes: A = <n> materials (<share>% of picks), B = <n> (<share>%), C = <n> (<share>%, <neverPicked> never picked)
Golden zone (<basis>): <locations> locations; <holdingA> hold A stock, <onlyC> hold only C stock, <empty> empty

Top proposed moves (material -> target location, picks in window):
 1. <material> -> <target> (<picks>)   <reason>
 2. ...

Unplaced A materials: <unplaced>
Notes: <fragmented materials, notes, assumptions>
```
````

- [ ] **Step 4: Write `agent.json`**

Start from the source `agent.json` named under **Files**, keep `configurationTypeId`, `referenceName`, `title`, `description`, `commands` and `trigger` exactly as they are, and set:

- `skills` to `[{ "name": "abc-slotting", "source": "owned", "content": <the full text of abc-slotting.md> }]`
- `profile.systemPrompt` to: `You are the ABC slotting analyst for a Datex Footprint warehouse. Settle the warehouse, window and cut-offs, then follow the abc-slotting skill: export the pick history, locations and inventory to files with its script and read only the script's summary. Never page rows through the conversation. You analyse and propose; you never move stock or create tasks. End every run with the skill's report format.`
- `profile.modelClass` stays `frontier`, `profile.model` stays `null`.

Generate it with Node so the content is byte-identical and nobody hand-escapes markdown into JSON:

```bash
SRC="C:/Users/pgyoshev/AppData/Local/Temp/claude/D--Git-datex-studio-cli-253347/8a9b6761-fd0b-402d-9283-35c323eef84f/scratchpad/slotting/agent/agent.json"
EX=skills/datex-studio/agent-creator/references/examples/abc-slotting
node -e '
const fs = require("fs"); const [src, ex] = process.argv.slice(1);
const a = JSON.parse(fs.readFileSync(src, "utf8"));
a.skills = [{ name: "abc-slotting", source: "owned", content: fs.readFileSync(ex + "/abc-slotting.md", "utf8") }];
a.profile.systemPrompt = "You are the ABC slotting analyst for a Datex Footprint warehouse. Settle the warehouse, window and cut-offs, then follow the abc-slotting skill: export the pick history, locations and inventory to files with its script and read only the script'"'"'s summary. Never page rows through the conversation. You analyse and propose; you never move stock or create tasks. End every run with the skill'"'"'s report format.";
fs.writeFileSync(ex + "/agent.json", JSON.stringify(a, null, 2) + "\n");
' "$SRC" "$EX"
```

Keep this command in the example `README.md` (Step 5) as the way to rebuild `agent.json` after editing the markdown.

- [ ] **Step 5: Write the example `README.md`**

Content, in this order:

1. One paragraph: what the agent does and that it is the reference agent for Agent applications (spec §4.9).
2. A table of its six commands: alias, what one row is, required parameters (copy from `agent.json` `paramsDoc`).
3. "Why a script": the pick history of one warehouse over six months is tens of thousands of rows; the export-then-aggregate pattern keeps them out of the model's context, and `--all --out` handles the 5000-row page cap.
4. "Rebuild `agent.json`": the Node command from Step 4, with `SRC=agent.json` (rebuilding in place).
5. "Verified": `npm test` (offline, runs the embedded script on fixtures) and the live run recorded in Step 7, with its date, fpx/dxs versions, the warehouse id, and the summary's `picks`, `classes` and `moves.length`.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: every `abc-slotting` test passes. Only the Task 4 `repo-invariants` failure on `agent-creator/SKILL.md` remains.

- [ ] **Step 7: Live run against the local Agent app**

Needs the local Agent app on `http://localhost:3000` and the Datex Studio API on `https://localhost:5101` running, and a signed-in fpx identity (`fpx auth status` → `authenticated: true`). If either is down, record "live run not done: <which service was down>" in the README and the report, and continue; do not fake numbers.

```bash
fpx --version                       # 0.1.0
fpx use http://localhost:3000 --app-scope api://2e069781-2a39-45cb-b04f-d35a5b12ac4e/.default
# find a warehouse with picks in the last 12 months:
for w in $(fpx warehouses --params '{"full_text_filter": ""}' --top 100 --output json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).rows.forEach(r=>console.log(r.Id)))'); do
  printf '{"warehouseId": %s, "dateFrom": "2025-10-01", "dateTo": "2026-09-30", "skip": 0}' "$w" > /tmp/p.json
  n=$(fpx pick-history -D /tmp/p.json --top 1 --output json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).metadata.total_count ?? 0))')
  [ "$n" -gt 0 ] && echo "$w $n"
done | sort -k2 -n -r | head -3
```

Then, in a scratch directory, extract the script from the markdown and run the skill's block with the chosen warehouse and a 12-month window:

```bash
cd "$(mktemp -d)"
node -e 'const m=/```js analyse\.mjs\r?\n([\s\S]*?)```/.exec(require("fs").readFileSync(process.argv[1],"utf8"));require("fs").writeFileSync("analyse.mjs",m[1])' /d/Git/skills/skills/datex-studio/agent-creator/references/examples/abc-slotting/abc-slotting.md
W=<chosen id>
printf '{"warehouseId": %s, "skip": 0}' "$W" > warehouse.json
printf '{"warehouseId": %s, "dateFrom": "%s", "dateTo": "%s", "skip": 0}' "$W" 2025-10-01 2026-09-30 > picks.json
fpx pick-history -D picks.json --all --out picks.jsonl \
  && fpx locations -D warehouse.json --all --out locations.jsonl \
  && fpx inventory -D warehouse.json --all --out inventory.jsonl \
  && node analyse.mjs .
```

Expected: three `rows_exported` envelopes and one JSON summary with `picks` equal to the `total_count` found above. Record the numbers in the README's "Verified" section.

- [ ] **Step 8: Commit**

```bash
git add skills/datex-studio/agent-creator/references/examples tooling/tests/abc-slotting.test.mjs
git commit -m "agent-creator: ABC/Pareto slotting reference agent — export with fpx, aggregate with an embedded script

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rewrite `agent-creator` for Agent applications

**Files:**
- Modify (full rewrite): `skills/datex-studio/agent-creator/SKILL.md`
- Create: `tooling/tests/agent-creator.test.mjs`

**Interfaces:**
- Consumes: `extractCommandLines`, `splitCommand`, `frontmatter`, `helpFor` (Task 2); the example folder (Task 3); the `fpx` skill (Task 2) as a `depends:` entry.

- [ ] **Step 1: Write the failing tests**

`tooling/tests/agent-creator.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractCommandLines, splitCommand, frontmatter } from './lib/cli-lines.mjs';
import { helpFor } from './lib/run-cli.mjs';

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

test('Review Focus 4: tenant prerequisites and 403 = app role', () => {
  assert.match(md, /pre-authori[sz]e/i);
  assert.match(md, /admin consent/i);
  assert.match(md, /403[^\n]*app role/i);
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
    for (const f of flags) assert.ok(h.text.includes(f) || root.text.includes(f), `flag ${f} not in dxs ${words.join(' ')} --help`);
  }
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tooling/tests/agent-creator.test.mjs`
Expected: FAIL on depends, order, dropped sections, prerequisites and links (the current file teaches `fp`).

- [ ] **Step 3: Rewrite `skills/datex-studio/agent-creator/SKILL.md`**

Keep from the current file, rewritten where noted: the *manifest is the runtime's only source* rule (owned skills only, full markdown inline), *CLI-first — no workarounds*, *say what a row is*, *commands target the cloud tier only* (functions → flow type 9, datasources → datasource type 6; server-tier types report `resolved: false`), and *modify an existing agent*. Replace everything else. Write this content:

````markdown
---
name: agent-creator
description: |
  Use when AUTHORING a Datex Agent application — creating the Agent application, referencing
  the packages whose functions and datasources become its commands, writing the singleton
  agent configuration (commands, owned skills, profile), checking it with `dxs agent check`,
  and handing the deployed app to `fpx`. Triggers: "create an agent", "new agent app",
  "add a command to the agent", "write the agent's skill", "agent check fails",
  "resolved: false", "agent manifest". For RUNNING a deployed agent's commands, use `fpx`.
depends:
  - fpx
  - datex-studio-shared
  - package-cascade
---

# Agent creator

Verified against **dxs 0.6.0** and **fpx 0.1.0**.

An **Agent application** is its own application type in Datex Studio. One Agent application
is one agent: it carries exactly one agent configuration, the singleton `agent` (configuration
type 38), with three parts:

| Part | What it is | Who reads it |
|---|---|---|
| Commands | aliases pointing at functions and datasources of the app and its referenced packages | `fpx` (one subcommand per alias) and, later, the app's own agent loop |
| Skills | owned markdown, carried whole inside the manifest | the agent at run time |
| Profile | system prompt, model class, optional model pin | the harness at run time |

The deployed app serves this as its manifest at `GET /api/$agent/manifest`. The manifest is
the runtime's **only** source: a hosted agent has no access to this repo, your workspace, or
Datex Studio.

Follow [branch-setup.md](../datex-studio-shared/branch-setup.md) for picking a branch. Never
assume a branch id.

## The loop

### 1. Create the Agent application

```bash
dxs source repo create --type agent --name "ABC Slotting Agent" --org <organization id>
```

The output names `main_branch_id`; use it (or a feature branch cut from it) from here on. The
platform seeds the singleton with reference name `agent`. `DXS-REPO-001` means the derived
identifier is not `[a-z][a-z0-9-]*` (pass `--unique-identifier`); `DXS-REPO-002` means the name
is taken for that organization.

### 2. Reference the packages the commands come from

An agent is only as capable as the packages it references. Pin each package whose functions
or datasources the agent will call:

```bash
dxs source deps -b <branch>
dxs source reference set -b <branch> -p <package uniqueIdentifier> -v <version>
```

When a referenced package is republished later, re-pin its consumers with the
[`package-cascade`](../package-cascade/SKILL.md) skill.

### 3. Discover what can become a command

```bash
dxs configuration list datasource -b <branch>
dxs configuration list flow -b <branch>
```

A command's `ref` is bare for the app's own configs (`ds_open_orders`) and module-qualified
for a referenced package's (`FootprintManager/ds_warehouses_dd`). Only the cloud tier is
callable: `function` → a flow (type 9), `datasource` → a datasource (type 6). A
`footprintflow` or `footprintdatasource` reports `resolved: false`; wrap it in a cloud flow
and point the command at the flow. If nothing on the branch does what the agent needs, say
so and agree on creating it; never point a command at an approximate target.

Pick the fewest commands that cover the process.

### 4. Author the singleton

```bash
dxs configuration get agent agent -b <branch> -O envelope.json
```

Take the `json` field of the envelope as the body, edit it, then:

```bash
dxs configuration upsert agent -D body.json -b <branch>
```

`Warning (DXS-AGENT-030)` means the branch is not an Agent application: the config will be
refused at validate/publish. Move it to an Agent application instead.

Body shape:

```jsonc
{
  "configurationTypeId": 38,
  "referenceName": "agent",
  "title": "ABC slotting agent",
  "description": "…",
  "commands": [
    {
      "type": "datasource",                     // "datasource" | "function"
      "ref": "ds_slot_pick_history",            // bare = own app; "Module/ref" = referenced package
      "alias": "pick-history",                  // kebab-case, unique; becomes `fpx pick-history`
      "description": "Completed pick tasks … One row per pick task (not per order or line) …",
      "paramsDoc": "warehouseId: number (required). dateFrom: date (required, ISO) …"
    }
  ],
  "skills": [{ "name": "abc-slotting", "source": "owned", "content": "---\nname: abc-slotting\n…" }],
  "profile": { "systemPrompt": "…", "modelClass": "frontier", "model": null },
  "trigger": { "type": "onDemand", "schedule": null }
}
```

Rules for each part:

- **Aliases** are kebab-case and unique. `fpx` reserves `use`, `status`, `commands`,
  `manifest`, `skills`, `profile`, `login`, `auth`, `run`, `update`, `help`; `dxs agent check`
  reports a command that shadows one as `dropped`.
- **Description** is what the agent reads when it chooses the command. Say what one row *is*
  when it is not what the alias suggests, and say "Paged: 5000 rows per call" when it is.
  Retargeting a command's `ref` in the designer resets its description and clears its
  `paramsDoc`: rewrite both after any retarget.
- **paramsDoc** names every parameter exactly as the target declares it (camelCase or
  snake_case included) with type and required/optional.
- **Skills** are `source: "owned"` with the full markdown in `content`. A `referenced` skill
  installs nothing.
- **Skill content** names commands by alias and parameters by name. For aggregation over more
  than one page it carries an `fpx` export-and-script recipe: export with
  `fpx <alias> -D params.json --all --out rows.jsonl`, then compute in a script that prints only
  the summary. It never names Studio internals: no `$datasources`, `$flows`, `dxs`, Studio
  reference names or file paths.
- **systemPrompt** says who the agent is, names its skill, tells it never to page rows through
  the conversation, and names the report it ends with.

The worked example is [the ABC/Pareto slotting agent](references/examples/abc-slotting/README.md):
six commands, one owned skill whose embedded script turns three exports into a Pareto
classification and a ranked move list.

### 5. Check the manifest

```bash
dxs agent check -b <branch>
```

Every command must be `ok`. The other verdicts:

| Verdict | Means | Fix |
|---|---|---|
| `unresolved` | the ref does not exist on the branch, or is server-tier | fix the ref or its module prefix; wrap server-tier configs in a cloud flow |
| `not_exposed` | the config exists but the app exposes no endpoint for it | fix the app's endpoints and republish |
| `dropped` | a duplicate alias, or an alias shadowing an `fpx` command | rename the alias |

`DXS-AGENT-020` carries each command's verdict under `details.commands`. `DXS-AGENT-001` means
the branch is not an Agent application or has no manifest. `dxs agent manifest -b <branch>`
prints the whole manifest.

### 6. Deploy, then the tenant prerequisites

Deploy through the Manager as for any application. A freshly deployed Agent application
answers `401`/`403` until an admin has done three one-time steps:

1. **Pre-authorize** the CLI client `9640be1f-31b2-4970-85a1-2fc78fab9731` on the app's backend
   registration: "Expose an API → Add a client application", tick `access_as_user`.
2. **Admin consent** for the backend registration in the organization's own tenant: the
   Manager's "Consent (admin only)", run by an admin of that tenant.
3. An **app role assignment** for every caller. A `403` from `GET /api/$agent/manifest` means
   the app role assignment is missing.

### 7. Hand the app to fpx and try one turn

```bash
dxs agent url -b <branch> --env <environment>
```

It prints `app_url`, `app_scope`, `tenant_id` and an `fpx_use` line (`DXS-AGENT-010`: the
deployed component has no backend registration yet; `DXS-AGENT-011`: the deployment cannot be
found). Paste the `fpx_use` line, adding `--account you@customer.com` for customer tenants:

```bash
fpx use <app_url> --app-scope <app_scope> --tenant-id <tenant_id>
fpx commands
```

The [`fpx`](../fpx/SKILL.md) skill covers everything from here: calls, exports, scripts and
errors. To smoke-test the app's own agent loop:

```bash
dxs agent chat --app-url <app_url> --app-scope <app_scope> -m "Which materials are class A in warehouse 12?"
```

`DXS-AGENT-040` covers every failed turn: a `409` is the turn limit, a non-JSON `200` is the
web shell answering a wrong URL.

## CLI-first — no workarounds

`dxs` is the only sanctioned authoring surface. When it falls short, report the gap as a CLI
or platform bug. Never hand-edit platform artifacts, never sidestep a validation error, and
never leave an unexplained `unresolved` for the runtime to discover.

## Modify an existing agent

```bash
dxs configuration get agent agent -b <branch> -O envelope.json
```

Take the `json` field, edit, upsert it back with `dxs configuration upsert agent -D body.json
-b <branch>`, and run `dxs agent check -b <branch>` again: a renamed function or datasource
silently turns its command `unresolved`.

## Checklist

- [ ] `dxs agent check` reports every command `ok`
- [ ] aliases are kebab-case, unique, and shadow no `fpx` command
- [ ] every command has a description; every command with inputs has a `paramsDoc`
- [ ] every skill is owned, self-contained, and names aliases, not Studio internals
- [ ] multi-page work is an `fpx` export plus a script that prints only the summary
- [ ] the systemPrompt names the skill and the final report
- [ ] after deploy: the three tenant prerequisites are done, and `fpx commands` lists the aliases
````

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: every test passes, including `repo-invariants` (no `fp use`/`footprint-cli` anywhere now) and the `dxs` surface check. If a `dxs` flag assertion fails, the skill named an option dxs 0.6.0 does not have: fix the skill.

- [ ] **Step 5: Commit**

```bash
git add skills/datex-studio/agent-creator/SKILL.md tooling/tests/agent-creator.test.mjs
git commit -m "agent-creator: the Agent application loop (dxs 0.6.0) and the fpx hand-off

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Push the rewritten slotting agent to its live singleton

Live write to Datex Studio. **Ask the user to confirm branch 73444 before Step 2**, per the
Branch ID Policy. Needs the Datex Studio API on `https://localhost:5101`.

**Files:**
- None changed in the repo unless the check finds drift (then `agent.json`).

**Interfaces:**
- Consumes: `skills/datex-studio/agent-creator/references/examples/abc-slotting/agent.json` (Task 3).

- [ ] **Step 1: Read the live body and diff it against the example**

```bash
cd /d/Git/datex-studio-cli
uv run dxs configuration get agent agent -b 73444 -O /tmp/env.json
node -e 'const e=require("/tmp/env.json");const live=typeof e.json==="string"?JSON.parse(e.json):e.json;const ex=require("D:/Git/skills/skills/datex-studio/agent-creator/references/examples/abc-slotting/agent.json");for(const k of ["referenceName","title","description","trigger"])console.log(k, JSON.stringify(live[k])===JSON.stringify(ex[k])?"same":"DIFFERENT");console.log("commands", JSON.stringify(live.commands)===JSON.stringify(ex.commands)?"same":"DIFFERENT")'
```

Expected: every line `same`. A `DIFFERENT` line means the branch moved since 2026-09-28: take the live value into `agent.json` (rebuild with the README command), rerun `npm test`, and commit that before upserting. Only `skills` and `profile` may differ.

- [ ] **Step 2: Upsert (after the user confirmed the branch)**

```bash
uv run dxs configuration upsert agent -D D:/Git/skills/skills/datex-studio/agent-creator/references/examples/abc-slotting/agent.json -b 73444
uv run dxs agent check -b 73444
```

Expected: upsert succeeds with no `DXS-AGENT-030` warning; `check` reports 6 commands `ok`.

- [ ] **Step 3: The deployed app still serves the old skill until it is regenerated**

The local app bakes its manifest at generation time. Regenerating and restarting it is the
user's step (Studio generate → `npm run build_server_only && npm run start`). After it:

```bash
fpx use http://localhost:3000 --app-scope api://2e069781-2a39-45cb-b04f-d35a5b12ac4e/.default --refresh
fpx skills list
```

Record in the report whether the regenerated app now serves the new skill, or that regeneration was left to the user.

---

### Task 6: Catalog, CLAUDE.md, release checklist, deploy

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `docs/cli-release-checklist.md`
- Deploy copy: `../datex-studio-cli/.claude/skills` (via `npm run deploy`; untracked in that repo)

- [ ] **Step 1: README catalog**

Replace the `agent-creator` row with:

`| [`agent-creator`](skills/datex-studio/agent-creator/SKILL.md) | Agent applications: create, reference packages, author the singleton (commands, owned skills, profile), `dxs agent check`, hand off to `fpx` | 38 |`

Confirm the `fpx` row from Task 2 sits in the same table as before, and leave the `slotting` stub row under Footprint unchanged (it is on main and out of scope).

- [ ] **Step 2: CLAUDE.md — two CLIs**

Add after "Repository invariants":

```markdown
## Two CLIs

Skills document two CLIs, and each skill names the one it drives:

- **`dxs`** (Python, PyPI `datex-studio-cli`) authors Datex Studio configurations. Almost every skill here.
- **`fpx`** (TypeScript, npm `@datex/fpx`) runs a *deployed* Agent application's commands. The `fpx` skill, and the owned skills inside Agent configurations.

A skill states the version it was verified against in its body (`Verified against dxs 0.6.0 and fpx 0.1.0`).
```

- [ ] **Step 3: Release checklist**

In `docs/cli-release-checklist.md`, change the title to `# CLI Release Checklist (dxs and fpx)`, and add a section before "Done means":

```markdown
## 5. fpx releases

`fpx` ships from its own repository on its own schedule. At each fpx release:

1. Regenerate [`fpx/references/error-codes.md`](../skills/datex-studio/fpx/references/error-codes.md) with the command at its top.
2. Run `npm test` in this repo with the new fpx installed: the surface tests fail on any command or option a skill names that the new fpx dropped.
3. Bump the "Verified against" line in the `fpx` skill and in `agent-creator`.

`npm test` does the same for dxs when `DXS_CLI_CHECKOUT` points at the CLI checkout (default `../datex-studio-cli`). Run it at every dxs release too.

The compat table (`compat.yaml`) needs a new row only when a CLI release breaks skills that are already on main. dxs 0.6.0 needed none: `agent-creator` and `fpx` first reach main with it.
```

and add to "Done means": `- npm test passes against the released CLI versions.`

- [ ] **Step 4: Verify and deploy**

```bash
npm test
# link check, docs/cli-release-checklist.md §4 — expect no BROKEN lines
npm run deploy
ls ../datex-studio-cli/.claude/skills | grep -E "^(fpx|agent-creator)$"; ls ../datex-studio-cli/.claude/skills | grep -c footprint-cli   # expect 0
```

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md docs/cli-release-checklist.md
git commit -m "docs: two CLIs, fpx release steps, catalog rows for agent-creator and fpx

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
