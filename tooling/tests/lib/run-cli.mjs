// `<cli> <words> --help`, cached per command. Returns null when the CLI is not installed,
// so a machine without dxs or fpx skips these checks instead of failing them. Availability is
// decided by an explicit version probe (see `probeAvailable`), not by inspecting a --help run's
// exit status: with `shell: true`, spawning a missing executable on Windows still comes back
// with `status: 1` and no `r.error`, indistinguishable from "the CLI ran and refused the args".
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const cache = new Map();
const probeCache = new Map();
const DXS_CHECKOUT = process.env.DXS_CLI_CHECKOUT ?? resolve(process.cwd(), '..', 'datex-studio-cli');

// Overridable so a test can point this at a binary that does not exist and assert helpFor(...)
// degrades to null, without polluting this module's cache for every other test in the process.
const fpxBin = () => process.env.SKILLS_TEST_FPX_BIN ?? 'fpx';

function run(cli, args) {
  if (cli === 'dxs') {
    if (!existsSync(DXS_CHECKOUT)) return null;
    return spawnSync('uv', ['run', 'dxs', ...args], { cwd: DXS_CHECKOUT, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DXS_INTERNAL_COMMANDS: '1' } });
  }
  return spawnSync(fpxBin(), args, { encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, FPX_NO_UPDATE_CHECK: '1' } });
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
