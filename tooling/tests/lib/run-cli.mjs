// `<cli> <words> --help`, cached per command. Returns null when the CLI is not installed,
// so a machine without dxs or fpx skips these checks instead of failing them. Availability is
// decided by an explicit version probe (see `probeAvailable`), not by inspecting a --help run's
// exit status: with `shell: true`, spawning a missing executable on Windows still comes back
// with `status: 1` and no `r.error`, indistinguishable from "the CLI ran and refused the args".
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cache = new Map();
const probeCache = new Map();
const DXS_CHECKOUT = process.env.DXS_CLI_CHECKOUT ?? resolve(process.cwd(), '..', 'datex-studio-cli');

// Overridable so a test can point this at a binary that does not exist and assert helpFor(...)
// degrades to null, without polluting this module's cache for every other test in the process.
const fpxBin = () => process.env.SKILLS_TEST_FPX_BIN ?? 'fpx';

// A throwaway `FPX_HOME` shared by every `fpx` spawn in this process. Without it, `fpx` reads the
// real `~/.fpx/state.yaml` on the machine running the tests — if a real Agent app is selected
// there, its own aliases and manifest leak into `fpx --help` / `fpx commands`, so root-statics
// checks ("this alias/flag is a genuine fpx built-in") would pass for reasons that have nothing
// to do with the installed fpx itself. Lazy + memoized: one directory per test run, no manifest
// ever written into it, so `fpx --help` always reports "No Agent application selected".
let fpxHome;
function fpxHomeDir() {
  if (!fpxHome) fpxHome = mkdtempSync(join(tmpdir(), 'fpx-home-'));
  return fpxHome;
}

function run(cli, args) {
  if (cli === 'dxs') {
    if (!existsSync(DXS_CHECKOUT)) return null;
    return spawnSync('uv', ['run', 'dxs', ...args], { cwd: DXS_CHECKOUT, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DXS_INTERNAL_COMMANDS: '1' } });
  }
  return spawnSync(fpxBin(), args, { encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, FPX_HOME: fpxHomeDir(), FPX_NO_UPDATE_CHECK: '1' } });
}

function probeAvailable(cli) {
  if (probeCache.has(cli)) return probeCache.get(cli);
  let available;
  if (cli === 'dxs') {
    if (!existsSync(DXS_CHECKOUT)) {
      available = false;
    } else {
      const r = spawnSync('uv', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
      available = !!r && !r.error && r.status === 0;
    }
  } else {
    const r = spawnSync(fpxBin(), ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
    available = !!r && !r.error && r.status === 0;
  }
  probeCache.set(cli, available);
  return available;
}

export function helpFor(cli, words) {
  const key = `${cli} ${words.join(' ')}`;
  if (cache.has(key)) return cache.get(key);
  if (!probeAvailable(cli)) { cache.set(key, null); return null; }
  const r = run(cli, [...words, '--help']);
  const result = !r || r.error || (r.status === null) ? null : { ok: r.status === 0, text: `${r.stdout}\n${r.stderr}` };
  cache.set(key, result);
  return result;
}

/** Flags accepted by every agent alias (a datasource or function command materialised from the manifest). */
export const ALIAS_FLAGS = new Set(['-p', '--params', '-D', '--data-file', '--top', '--skip', '--select', '--all', '--out', '--verb', '-h', '--help']);

// One fixture manifest with one datasource command, resolved against a throwaway FPX_HOME and an
// unreachable FPX_APP_URL so `fpx <alias> --help` never touches the network: the manifest file
// alone is enough for `fpx` to build the alias's Commander command and print its --help. Shape
// copied from D:\Git\fpx\fixtures\manifest.agent-app.json (the `target` shape contract 02 expects).
const ALIAS_HELP_MANIFEST = {
  application: { id: 1, type: 8 },
  ownModule: 'app',
  commands: [{
    type: 'datasource', ref: 'ds_fixture', alias: 'fixture-rows', resolved: true,
    target: { path: '/api/app/datasources/ds_fixture', appendVerb: true }
  }]
};

let aliasHelpCache; // undefined = not yet computed; null = fpx unavailable or can't produce it offline

/**
 * `fpx <alias> --help` text for a fixture manifest's one alias, so a flag claimed on an alias line
 * can be checked against a real `fpx` run instead of only the static `ALIAS_FLAGS` allow-list.
 * Returns null (never throws) when fpx is not installed, or if it cannot produce alias help from a
 * manifest file with no network reachable — callers fall back to `ALIAS_FLAGS` in that case.
 */
export function aliasHelp() {
  if (aliasHelpCache !== undefined) return aliasHelpCache;
  if (!probeAvailable('fpx')) { aliasHelpCache = null; return aliasHelpCache; }
  const home = mkdtempSync(join(tmpdir(), 'fpx-alias-'));
  const manifestPath = join(home, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(ALIAS_HELP_MANIFEST));
  const r = spawnSync(fpxBin(), ['fixture-rows', '--help'], {
    encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, FPX_HOME: home, FPX_MANIFEST_FILE: manifestPath, FPX_APP_URL: 'http://127.0.0.1:9', FPX_NO_UPDATE_CHECK: '1' }
  });
  aliasHelpCache = (!r || r.error || r.status !== 0) ? null : `${r.stdout}\n${r.stderr}`;
  return aliasHelpCache;
}

/**
 * True when `flag` appears in `text` as a whole flag token — preceded by the start of the
 * string, whitespace, a comma or `[`, and not followed by another flag-name character. Guards
 * against a truncated flag (`--app-scop`) matching because it is a substring of a real one
 * (`--app-scope`).
 */
export function hasFlag(text, flag) {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s,[])${escaped}(?![A-Za-z0-9-])`).test(text);
}
