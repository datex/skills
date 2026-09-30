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
