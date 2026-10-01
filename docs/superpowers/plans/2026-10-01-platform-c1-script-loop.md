# Platform C1 — the script loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The generated Agent application's own agent loop can run model-written bash scripts that call `fpx` against the app itself — so the ABC slotting agent answers "which materials are class A in warehouse 1" by exporting with `fpx --all --out` and running its analysis script inside the app.

**Architecture:** Three pieces inside the generated backend (`codegen/src/backendapp/src/agent/`), one in the app shell, and a wording fix in dxs. (1) `fpx` ships into the generated backend as a vendored npm tarball, the WavelengthUI pattern. (2) A **loopback token**: per script, the loop mints a short-lived HS256 JWT bound to the turn's `Caller`; a middleware composed before passport on `/api` accepts it only from `127.0.0.1`/`::1`. (3) A **`ScriptExecutor` interface** with a `SimpleExecutor` (a bash child process in a per-run directory, an explicit environment, output caps, a hard timeout) and a `run_script` tool in the loop next to the per-command tools. Turns stay synchronous (asynchronous turns are deferred — Decision 9), so script time is bounded to fit inside the 240 s ingress window.

**Tech Stack:** Node/TypeScript generated backend (Express 5, injection-js, mocha specs via the codegen backend harness), Node `crypto` (no new JWT dependency), `child_process`, Handlebars templates; `@datex/fpx` 0.1.0 (local repo `D:\Git\fpx`); dxs (Python, pytest).

**Spec:** `D:\Git\248960_agent\docs\superpowers\specs\2026-09-25-agent-application-type-design.md` §4.5 (the loop), §5 item 6, §7 Proof 2. This plan is **C1** of Platform C; C2 (run budgets / `profile.limits`), C3 (audit trail: run record, OTel spans, `agent_runs`, SSE events) and C4 (`fpx/lib` replacing codegen's own port) follow as separate plans.

## Decisions (Parvan 2026-10-01 + rulings with the code in front of us)

1. **C1 first**, C2–C4 later (Parvan).
2. **`fpx` is vendored as a tarball** in the generated backend, as WavelengthUI is in the Angular app (Parvan): `codegen/src/backendapp/vendor/datex-fpx-0.1.0.tgz`, `"@datex/fpx": "file:vendor/datex-fpx-0.1.0.tgz"`. When `@datex/fpx` is published, one line switches it.
3. **Script language: bash only** in v1. The image has bash and no python3 (`Dockerfile.hbs` deliberately avoids it); `node` is on the child `PATH` because `fpx` itself is a Node program, so scripts may call `node` (the slotting skill's analysis step does).
4. **No `jq`, no Dockerfile change** (Parvan). Scripts filter and aggregate with `node`, which is always present because `fpx` runs on it; every application image stays as it is.
5. **Shell resolution is explicit.** Linux/macOS: `/bin/bash`. Windows (local development): `C:\Program Files\Git\bin\bash.exe`, with Git's `usr\bin` on the child `PATH` for coreutils; a bare `bash` on Windows resolves to the WSL launcher and is never used. A missing shell fails the tool call with `ScriptShellUnavailable` — no fallback.
6. **The per-call `fpxCalls` capture moves to C3** (audit).
7. **Script time fits the ingress window.** With turns synchronous, Azure Container Apps cuts a request at 240 s and `dxs agent chat` waits 240 s, so `AGENT_SCRIPT_TIMEOUT` defaults to **180 s** (cap 3600 for local runs, which have no ingress): a slow script ends cleanly as `timedOut: true` inside the window, and the model can explain it.
8. **Spec deviations recorded:** `fpx` reads `FPX_APP_URL` (not the spec's `FPX_BASE_URL`) and has no `FPX_SPEC_FILE`; it fetches the spec from the app, and a missing spec is non-fatal. The app registration id is the build-time constant `AZ_CLIENT_ID` (`constants.hbs`), not an environment variable.
9. **Asynchronous turns, run polling, the runs routes and SSE are deferred** (Parvan) to a later plan; `POST /api/$agent/turn` stays the synchronous route it is today.

## Global Constraints

- Platform repo `D:\Git\248960_agent`, branch `feature/248960_agent_applications` (Tasks 1–4). CLI repo `D:\Git\datex-studio-cli`, branch `feature/248960_agent_applications` (Task 5). Commit locally; **never push**. Never stage untracked `agent-apps-spike-plan.md`, `docs/agent-apps/*`, `docs/superpowers/*` in the platform repo; the modified spec there stays unstaged.
- Every commit message ends with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- **The user's Datex Studio API and a generated app (`http://localhost:3000`, from `codegen/dist/app/backendapp`) run on this machine. Never stop, kill or restart a process you did not start; never write into `codegen/dist/app`; never edit anything under `codegen/dist` (edit `codegen/src`).** The executor may kill the child processes *it* spawned.
- Codegen specs: `cd src/Wavelength/DatexApplicationApi/codegen && npm run build:noclean && npm run start:test`, then `cd dist/testapp/backendapp && npm run test:build && npm run test:run` (run `npm install` there once after `package.json` gains a dependency). Web-shape check: `CODEGEN_TEST_BACKEND_APP_TYPE=1 npm run start:test`.
- Limits (env, with defaults and hard caps): `AGENT_SCRIPT_TIMEOUT` seconds 180, cap 3600; `AGENT_SCRIPT_OUTPUT_LIMIT` chars 20000 per stream, cap 60000; `AGENT_TOOL_MODE` `hybrid` (default) | `script` | `tools`. Read through the existing `intFromEnv` helper in `session.ts`.
- The loopback token never appears in logs, run results, error messages or tool results. The model key never enters a script's environment.
- No new npm dependencies beyond the vendored `@datex/fpx` (its own dependencies come with it).

## Review Focus

1. **A loopback token presented from outside the box** (a forwarded header, a non-loopback socket) — refused, and the request falls through to normal passport auth, which rejects an HS256 token. Pinned in Task 2. The security boundary is the signature (a per-process random secret no one outside the process holds) plus the server-side grant; the loopback-address check is defence in depth, so it stays correct even if an ingress proxy ever connects from 127.0.0.1.
2. **A script that never ends or floods its output** — killed with its whole process tree at the timeout, `timedOut: true`, and stdout/stderr cut to head + tail with `stdoutTruncated`. Pinned in Task 3.
3. **A script's environment** — contains `FPX_*`, `PATH`, `HOME`, `TMPDIR`, `AGENT_SKILLS_DIR` and nothing else: no `ANTHROPIC_*`, no connection strings, no `AZ_CLIENT_SECRET`, no inherited variables. Pinned in Task 3.
4. **A script slower than the ingress allows** — it is stopped at `AGENT_SCRIPT_TIMEOUT` (180 s by default) with `timedOut: true`, the model receives that as the tool result, and the turn still answers within the 240 s window. Pinned in Task 3 (timeout) and Task 4 (a timed-out script mid-turn).
5. **A token used after its script ended, or past its call budget** — rejected with 401. Pinned in Task 2 and Task 4.

---

## File Structure (G = `src/Wavelength/DatexApplicationApi/codegen/src`)

| Path | Responsibility | Task |
|---|---|---|
| `G/backendapp/vendor/datex-fpx-0.1.0.tgz`, `G/backendapp/package.json` | vendored fpx | 1 |
| `G/backendapp/src/agent/loopback-auth.ts` (new) | mint / verify / revoke loopback tokens | 2 |
| `G/handlebars/backend/app.hbs`, `G/generators/backend/backend.app.generator.ts` | compose loopback auth before passport for Agent apps | 2 |
| `G/backendapp/src/agent/executor.ts` (new) | `ScriptExecutor`, `SimpleExecutor`, shell resolution, env, caps, timeout | 3 |
| `G/backendapp/src/agent/session.ts`, `tools.ts`, `router.ts` | `run_script` tool, steering prompt, tool mode, skills dir | 4 |
| `G/tests/backend/agent/*.test.ts` | specs for each | 1–4 |
| `D:\Git\datex-studio-cli\src\dxs\commands\agent.py`, tests | 503 wording | 5 |

---

### Task 1: `fpx` in the Agent app

**Interfaces — produces:** the generated backend has `node_modules/@datex/fpx` and `node_modules/.bin/fpx`.

- [ ] **Step 1: Pack fpx** from `D:\Git\fpx` (branch `feat/fpx-0.1.0`, version 0.1.0):

```bash
cd /d/Git/fpx && npm run build && npm pack --pack-destination /d/Git/248960_agent/src/Wavelength/DatexApplicationApi/codegen/src/backendapp/vendor
ls /d/Git/248960_agent/src/Wavelength/DatexApplicationApi/codegen/src/backendapp/vendor   # datex-fpx-0.1.0.tgz
```

Record `git -C /d/Git/fpx rev-parse --short HEAD` in the commit message (the tarball's provenance). Check `codegen/copyAssets.js` and `.gitignore`/`.npmignore` rules so `vendor/*.tgz` is copied into the generated app and committed (mirror how `angularapp/wavelength-ui/*.tgz` is handled).

- [ ] **Step 2: Depend on it** — in `G/backendapp/package.json` dependencies: `"@datex/fpx": "file:vendor/datex-fpx-0.1.0.tgz"`. Update `G/backendapp/package-lock.json` the way the repo maintains it (run `npm install --package-lock-only` in `G/backendapp` if that is how other dependency bumps were done; check `git log -p --follow G/backendapp/package-lock.json | head` for the convention).

- [ ] **Step 3: Failing spec** — `G/tests/backend/agent/fpx-vendored.test.ts`:

```ts
import { expect } from 'chai';
import { existsSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

describe('vendored fpx', () => {
  // cwd is dist/testapp/backendapp when the suite runs.
  const bin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'fpx.cmd' : 'fpx');

  it('is installed with its bin shim', () => {
    expect(existsSync(bin), bin).to.equal(true);
  });

  it('runs offline and reports 0.1.0', () => {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, FPX_NO_UPDATE_CHECK: '1' } });
    expect(r.status, r.stderr).to.equal(0);
    expect(r.stdout.trim()).to.equal('0.1.0');
  });
});
```

Run the harness (with `npm install` in `dist/testapp/backendapp` after `start:test`): the spec fails before Steps 1–2 (no bin), passes after.

- [ ] **Step 4: Commit** — `feat(codegen): vendor @datex/fpx 0.1.0 into the generated backend` (+ fpx provenance sha, trailer).

---

### Task 2: Loopback tokens

**Interfaces — produces** (`G/backendapp/src/agent/loopback-auth.ts`):

```ts
export interface LoopbackGrant { token: string; jti: string; expiresAt: number }
export function mintLoopbackToken(caller: Caller, opts: { audience: string; ttlSeconds: number; maxCalls: number }): LoopbackGrant;
export function revokeLoopbackToken(jti: string): void;
/** Express middleware: if the bearer is a loopback token, authenticate it (loopback socket only) and set req.user; otherwise call `fallthrough`. */
export function loopbackOrElse(fallthrough: express.RequestHandler): express.RequestHandler;
export const LOOPBACK_ISSUER = 'datex-agent-loopback';
```

- [ ] **Step 1: Failing specs** — `G/tests/backend/agent/loopback-auth.test.ts`. Use `express()` + `listen(0)` + `fetch` like `router.test.ts`; the protected route echoes `req.user.id`; the fallthrough handler answers 401 `{via: 'passport'}`.

```ts
// cases (each its own it()):
// 1. a minted token from 127.0.0.1 → 200, req.user is the bound Caller (id, tenantId, isUser preserved)
// 2. a token minted for another audience → falls through (401 via passport), never authenticated
// 3. expired (ttlSeconds 1, wait 1.1s) → 401 {error:'loopback token expired'}, no fallthrough
// 4. revoked → 401
// 5. call budget: maxCalls 2 → third request 401
// 6. tampered signature (flip one char) → 401, no fallthrough
// 7. not a loopback token (any other bearer, or none) → fallthrough called, the loopback code did nothing
// 8. Review Focus 1: remote address not loopback → fallthrough (simulate by calling the middleware with a fake
//    req whose socket.remoteAddress is '10.0.0.5' and an X-Forwarded-For of 127.0.0.1 — X-Forwarded-For is ignored)
// 9. the token string never appears in anything the middleware logs (inject a capturing logger if the
//    middleware logs; otherwise assert it logs nothing)
```

- [ ] **Step 2: Implement** with Node `crypto` only:
  - Secret: `crypto.randomBytes(32)` once per process (module scope).
  - Token: base64url(`{"alg":"HS256","typ":"JWT"}`) . base64url(`{iss: LOOPBACK_ISSUER, aud: opts.audience, sub: caller.id, jti, iat, exp}`) . base64url(HMAC-SHA256). `aud` is `api://${AZ_CLIENT_ID}` so `fpx`'s audience preflight passes (fpx accepts `api://<id>` or the bare id).
  - Grants: `Map<jti, {caller, expiresAt, remaining}>`; the Caller object is stored server-side, never in the token.
  - Verify: split, recompute the HMAC, compare with `crypto.timingSafeEqual` (equal-length buffers), parse the payload; it is a loopback token only when `iss === LOOPBACK_ISSUER` — otherwise fall through untouched. Then: `req.socket.remoteAddress` must be `127.0.0.1`, `::1` or `::ffff:127.0.0.1` (headers never consulted) else fall through; `aud` must equal the app audience else fall through; grant present and not expired; decrement `remaining` (401 at 0); set `req.user = grant.caller` and `next()`.
  - Expired grants are deleted when seen and swept on mint.
- [ ] **Step 3: Compose before passport** — in `G/handlebars/backend/app.hbs` (~line 356), for Agent apps only:

```hbs
{{#if hasAgent}}
app.use('/api', loopbackOrElse(passport.authenticate('oauth-bearer', { session: false })), apiRouter);
{{else}}
app.use('/api', passport.authenticate('oauth-bearer', { session: false }), apiRouter);
{{/if}}
```

  with the import gated the same way. Pass `hasAgent` into the `app.hbs` template data in `backend.app.generator.ts` (it already computes it for `api.router.hbs`). Web shape: `app.ts` unchanged except nothing (check with the Web-shape generation and a diff against the base commit).
- [ ] **Step 4: Green** — harness passes; Web-shape `app.ts` byte-identical to base.
- [ ] **Step 5: Commit** — `feat(agent): loopback tokens for scripts, accepted only from 127.0.0.1 and composed before passport`.

---

### Task 3: The script executor

**Interfaces — produces** (`G/backendapp/src/agent/executor.ts`):

```ts
export interface ScriptInput { script: string; timeoutSeconds?: number }
export interface ScriptContext { runDir: string; env: Record<string, string>; signal?: AbortSignal }
export interface ScriptResult { exitCode: number | null; timedOut: boolean; durationMs: number; stdout: string; stderr: string; stdoutTruncated: boolean; stderrTruncated: boolean }
export interface ScriptExecutor { run(input: ScriptInput, ctx: ScriptContext): Promise<ScriptResult> }
export class SimpleExecutor implements ScriptExecutor { /* … */ }
export class ScriptShellUnavailable extends Error { readonly code = 'ScriptShellUnavailable' }
export function resolveShell(platform?: NodeJS.Platform, exists?: (p: string) => boolean): { shell: string; extraPath: string[] };
export function scriptEnv(base: { fpx: Record<string, string>; skillsDir: string; runDir: string }): Record<string, string>;
export function capOutput(text: string, limit: number): { text: string; truncated: boolean };
```

- [ ] **Step 1: Failing specs** — `G/tests/backend/agent/executor.test.ts` (real bash; on Windows the suite resolves Git Bash):
  - echoes stdout and the exit code; a non-zero exit is a result, not a throw.
  - `cd` is the run directory (`pwd` prints it; a file written with a relative path lands there).
  - **Review Focus 3:** `scriptEnv(...)` contains exactly `PATH, HOME, TMPDIR, AGENT_SKILLS_DIR` plus the `FPX_*` keys passed in; with `process.env.ANTHROPIC_API_KEY='x'`, `AZ_CLIENT_SECRET='y'`, `MONGO_URL='z'` set in the test process, the script's `env` output contains none of them.
  - **Review Focus 2:** `sleep 30` with `timeoutSeconds: 1` → `timedOut: true`, `durationMs` < 5000, and a grandchild (`(sleep 30 &) ; sleep 30`) is gone afterwards (on POSIX check `kill -0` on the recorded pid fails; on Windows that the process list no longer has it — use the pid the script echoes to a file).
  - output cap: printing 100 000 chars with limit 1000 → `stdoutTruncated: true`, the text keeps the first and last part and carries a `… N characters omitted …` marker; stderr capped independently.
  - `resolveShell('win32', exists)` returns `C:\Program Files\Git\bin\bash.exe` + `[C:\Program Files\Git\usr\bin]`; returns `/bin/bash` for `linux`; throws `ScriptShellUnavailable` when the path does not exist; never returns a bare `bash`.
  - `node` and `fpx` resolve inside a script (`command -v node`, `command -v fpx` with the vendored `.bin` on PATH).
- [ ] **Step 2: Implement**
  - `resolveShell`: as in Decision 5.
  - `scriptEnv`: `PATH` = [dir of `process.execPath`, `<backend root>/node_modules/.bin`, …`extraPath`, `/usr/local/bin:/usr/bin:/bin` on POSIX] joined with `path.delimiter`; `HOME` and `TMPDIR` = the run dir; `AGENT_SKILLS_DIR`; the given `FPX_*` map. Nothing copied from `process.env`. Resolve `<backend root>` from `__dirname` (the compiled `dist/agent` → `..`/`..`; check the layout in `dist/testapp/backendapp`).
  - `run`: `spawn(shell, ['-c', script], { cwd: runDir, env, detached: process.platform !== 'win32', windowsHide: true })`; collect stdout/stderr up to `2 × limit` chars each while streaming (keep head + a rolling tail, so memory stays bounded); timeout = `min(input.timeoutSeconds ?? AGENT_SCRIPT_TIMEOUT, cap)`; on timeout kill the tree: POSIX `process.kill(-child.pid, 'SIGKILL')`; Windows `spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'])` — only ever this child's pid. Resolve on `close`.
- [ ] **Step 3: Green**, **Step 4: Commit** — `feat(agent): ScriptExecutor and SimpleExecutor — bash in a run directory, explicit env, capped output, hard timeout`.

---

### Task 4: `run_script` in the loop

**Interfaces — consumes** Tasks 2–3. **Produces:** tool `run_script` with input `{ script: string, timeout_seconds?: number }`; `runTurn(...)` accepts `executor?: ScriptExecutor` and `scriptContext?: () => Promise<ScriptSession>`; `toolDefinitions(manifest, spec, mode)` where `mode: 'hybrid' | 'script' | 'tools'`.

- [ ] **Step 1: Failing specs** — extend `session.test.ts` (its `ScriptedClient`) and `tools.test.ts`:
  - `hybrid` (default): tools = the per-command tools + `run_script`; the system prompt contains the steering paragraph (below); `tools` mode: no `run_script`, no steering; `script` mode: only `run_script`.
  - a scripted `tool_use` of `run_script` reaches a fake executor with the script text, `cwd` = the run dir, and an env whose `FPX_TOKEN` is a freshly minted loopback token; the tool result given back to the model is the JSON of `ScriptResult` minus nothing — **but** the token string does not appear in it, nor in `TurnResult` (Review Focus 5 / constraint).
  - after the script returns, its token is revoked (a request with it → 401).
  - a `ScriptShellUnavailable` from the executor becomes an `is_error` tool result naming the shell, and the turn continues.
  - Review Focus 4: a fake executor returning `{ timedOut: true, exitCode: null }` reaches the model as a normal tool result, and the turn completes with the model's next answer.
  - skills are written to `<runDir>/skills/<name>/SKILL.md` before the first script runs, and `AGENT_SKILLS_DIR` points there.
- [ ] **Step 2: Implement**
  - Steering paragraph (appended to the system prompt in `hybrid`/`script`): `You can run bash scripts with run_script. One lookup: call the command's tool. Several calls, or anything you count, join, rank or filter: write a script that calls fpx <alias> (export large lists with fpx <alias> -D params.json --all --out file.jsonl), keeps intermediate data in files in the working directory, and prints only the final result. node is available inside scripts; jq is not. A script is stopped after <N> seconds. Never print raw rows.` — with `<N>` the effective `AGENT_SCRIPT_TIMEOUT`.
  - Per turn: `runDir = path.join(os.tmpdir(), 'agent', turnId)` (a fresh `randomUUID()` per turn) created at the first script, removed when the turn ends (success or failure).
  - Per script: `mintLoopbackToken(caller, { audience: `api://${AZ_CLIENT_ID}`, ttlSeconds: timeout + 60, maxCalls: 5000 })`; env `FPX_APP_URL=http://127.0.0.1:${PORT}` (the server's actual port — read how `server.hbs` stores it, or `process.env.PORT || '3000'`), `FPX_APP_SCOPE=api://${AZ_CLIENT_ID}/.default`, `FPX_TOKEN`, `FPX_MANIFEST_FILE=<dist>/agent-assets/manifest.json` (resolve the same way `assets.ts` does), `FPX_HOME=<runDir>/.fpx`, `FPX_NO_UPDATE_CHECK=1`; `revokeLoopbackToken` in `finally`.
  - `AGENT_TOOL_MODE` parsed once in `config.ts` at module load; an unknown value throws there, naming the allowed values (the app fails to start rather than silently picking a mode).
  - Router: build the `SimpleExecutor` once per process; pass the caller from the injector.
- [ ] **Step 3: Green**, **Step 4: Commit** — `feat(agent): run_script tool — bash scripts call fpx against the app with a per-script loopback token`.

---

### Task 5: dxs `agent chat` — a 503 reads "could not take the turn" (CLI repo)

Repo `D:\Git\datex-studio-cli`, branch `feature/248960_agent_applications`. Run `uv run pytest tests/test_agent_commands.py`, `uv run ruff check src tests`, `uv run mypy src/dxs`.

- [ ] **Step 1: Failing test** in `tests/test_agent_commands.py` (the `_transport()` seam): a 503 with body `{"error": "No model key: …", "code": "ModelNotConfigured"}` → `DXS-AGENT-040` whose message starts `the agent could not take the turn:` and whose `details.code` is `ModelNotConfigured`; a 4xx still reads `the agent refused the turn:`; a 5xx body that is not JSON still works (no `details.code`).
- [ ] **Step 2: Implement** in `src/dxs/commands/agent.py`: branch the wording on `status >= 500`, and copy a string `code` from a JSON body into `details.code`.
- [ ] **Step 3: Docs** — the `DXS-AGENT-040` row in `docs/agent-cli.md` names the 5xx wording.
- [ ] **Step 4: Green and commit** — `fix(agent): chat says 'could not take the turn' for a 5xx and surfaces the body's code`.

---

### Task 6: Proof 2, live (user-assisted)

Needs the bound Anthropic key from Platform B. After Tasks 1–5: regenerate the local app (branch 73444), `npm install` in it (fpx and its dependencies), restart it, then:

```bash
uv run dxs agent chat --app-url http://localhost:3000 --app-scope api://2e069781-2a39-45cb-b04f-d35a5b12ac4e/.default -m "Which materials are class A in warehouse 1?"
```

Expected: the agent runs `run_script` (the slotting skill's export + `node slotting/analyse.mjs`), and the answer contains the class counts and A materials (warehouse 1 has 75 picks in 2020–2025 data, so ask for a window that contains them, e.g. "…over 2020-01-01 to 2025-12-31"). Record: the turn's duration and the answer.
