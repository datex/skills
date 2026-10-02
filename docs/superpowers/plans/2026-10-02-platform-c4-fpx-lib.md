# Platform C4 — one source of truth: `fpx` as the agent runtime's library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The generated Agent app's runtime stops carrying its own copy of the manifest rules, parameter renaming and spec reader, and imports them from the vendored `@datex/fpx` — so the CLI that scripts call and the loop that offers tools can never disagree about which commands exist or how parameters are named.

**Architecture:** `fpx` 0.1.1 gains one option (extra reserved names) and is re-vendored. The runtime's `manifest.ts`, `params.ts` and the parsing half of `spec.ts` become thin re-exports or disappear; callers import from `@datex/fpx`. Host-specific pieces stay local: reading the swagger file from disk, the generator's target builder. A contract test proves the manifest codegen bakes is a manifest `fpx` accepts.

**Tech Stack:** `@datex/fpx` (TypeScript, vitest, tsup) in `D:\Git\fpx`; codegen Node/TS runtime (tsc → CommonJS, node10 resolution), mocha harness.

**Spec:** `D:\Git\248960_agent\docs\superpowers\specs\2026-09-25-agent-application-type-design.md` §4.5 "`fpx` in the loop, twice" (the library half).

## Decisions

1. **Import from `@datex/fpx` (the package root), not `@datex/fpx/lib`.** The codegen tsconfigs use `module: commonjs` with node10 resolution, which ignores `exports`; the root resolves through `types`/`main` and is already used by `fpx-spec-cache.ts`. Switching codegen to node16 resolution is out of scope.
2. **Reserved aliases become the union.** `fpx` 0.1.1 adds an option `{ extraReserved?: readonly string[] }` to `selectCommandEntries` and `invocableCommands`; the runtime passes `['run_script']`. The runtime therefore also starts dropping `login`, `auth`, `run`, `update`, `help` (fpx's own commands) — correct, because a command with one of those aliases can never be called through `fpx` either. The drop note now says `fpx <alias>` instead of the stale `fp <alias>`.
3. **`selectFields` adopts `fpx`'s semantics** (a missing field is `null`, array rows pass through) instead of the runtime's private copy (missing field omitted). The model then sees the same shape a script sees from `fpx --select`.
4. **Spec parsing uses `fpx`'s `parseSpec`/`AppSpec`;** the runtime keeps `defaultSpecPath`, `loadRawSpecDocument`, `loadAppSpec` as a ~10-line local wrapper (file I/O, `undefined` on failure).
5. **The generator** (`agent.manifest.generator.ts`) imports `splitRef` and the manifest types from `@datex/fpx` (codegen's own `package.json` has the dependency); `commandTarget` stays local (it produces targets; `fpx` only consumes them).
6. **Tests:** the runtime's pure-rule specs that `fpx`'s vitest suite already covers are deleted (`manifest.test.ts`, `params.test.ts`, the synthetic half of `spec.test.ts`); integration specs stay; two are added — an import smoke test against the compiled CommonJS, and a contract test that the baked `agent.manifest.ts` passes `fpx`'s `parseManifestJson`.
7. **Versioning:** `fpx` 0.1.1 is a local version on `feat/fpx-0.1.0` (still unpublished); both vendored tarballs (`codegen/vendor/` and `codegen/src/backendapp/vendor/`) are replaced together and must be byte-identical.

## Global Constraints

- Repos: `D:\Git\fpx` (Task 1), `D:\Git\248960_agent` (Tasks 2–4). Commit locally, never push, never `git stash`; never stage untracked spike/docs files or the modified spec in the platform repo.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- The user's Studio API and a generated app run here: never stop/kill/restart a process you did not start; never write into `codegen/dist/app`; edit `codegen/src` only. `npm install` in `codegen` only after a `--dry-run` shows it replaces only `@datex/fpx` (stop and report otherwise); never inside `dist/`.
- `fpx`: `npm test`, `npm run lint`, `npm run build` all green before packing.

## Review Focus

1. A manifest command aliased `run`, `help` or `login` — dropped by the runtime now, with a note, exactly as `fpx` drops it (no tool the CLI could not call).
2. A command aliased `run_script` — still dropped (the extra reserved name reaches `fpx`'s rule).
3. The compiled generated backend at runtime — `require('@datex/fpx')` resolves from `codegen/node_modules` locally and from `backendapp/node_modules` in the container; nothing imports `@datex/fpx/lib`.
4. `select` on a datasource tool — returns `null` for a requested field the row lacks (Decision 3), in both the tool result and `fpx --select`.
5. A swagger file missing or malformed — `loadAppSpec` still returns `undefined` and tools fall back to open schemas, as today.

---

### Task 1: `fpx` 0.1.1 — extra reserved names

**Files:** `D:\Git\fpx\src\lib\manifest.ts` (`selectCommandEntries`, `invocableCommands`), `test/lib/manifest.test.ts`, `package.json`/`src/version.ts` (0.1.1), `CHANGELOG.md`.

- [ ] Failing vitest: `invocableCommands(manifest, { extraReserved: ['run_script'] })` drops a `run_script` command with the reserved-alias note; without the option nothing changes (existing tests stay green).
- [ ] Implement (options object, default `{}`; the drop reason text unchanged in form).
- [ ] Bump to 0.1.1 in every place the version lives (check the repo's version-agreement test), changelog entry; `npm test && npm run lint && npm run build`; commit.

### Task 2: Re-vendor and switch the manifest + params rules

**Files:** `codegen/vendor/datex-fpx-0.1.1.tgz`, `codegen/src/backendapp/vendor/datex-fpx-0.1.1.tgz` (remove the 0.1.0 files), both `package.json` + lockfiles; runtime `agent/manifest.ts`, `agent/params.ts`, `agent/tools.ts`, `agent/dispatch.ts`, `agent/session.ts`; specs.

- [ ] Pack once (`npm pack` in `D:\Git\fpx`), copy to both vendor folders, `cmp` them; update both `file:` references; `npm install --package-lock-only` where the repo does; `npm install --dry-run` then `npm install` in `codegen` (Global Constraints).
- [ ] Failing specs first for Review Focus 1, 2 and 4, then: delete the runtime's `RESERVED_ALIASES`, `splitRef`, `selectCommandEntries`, `invocableCommands`, `toolParams`, `toolNamesFor`, `toWireParams`, `SHAPING`, `SELECT_PARAM`, `TOP_PARAM` and dispatch's private `selectFields`; import them from `@datex/fpx`; keep `manifest.ts` only if a local type alias is still needed (prefer importing `AgentManifest` & co. from `@datex/fpx`).
- [ ] Update `fpx-vendored.test.ts` to expect 0.1.1. Harness green; commit — `refactor(agent): manifest rules and param renaming come from @datex/fpx 0.1.1`.

### Task 3: Spec parsing from `fpx`

**Files:** runtime `agent/spec.ts`, callers (`tools.ts`, `dispatch.ts`, `router.ts`, `session.ts`), `fpx-spec-cache.ts`, specs.

- [ ] Replace the local `parseSpec`/`ParsedAppSpec` with `fpx`'s `parseSpec`/`AppSpec`; keep the three file-I/O helpers (Decision 4); adapt method calls to `fpx`'s `AppSpec` (it implements the same `AppSpecLike` the param helpers take).
- [ ] Keep `spec.test.ts`'s real-swagger cases and the "never throws" case; delete the synthetic-shape cases `fpx` covers. Review Focus 5 spec. Harness green; commit — `refactor(agent): app spec parsed by @datex/fpx; local wrapper keeps the file I/O`.

### Task 4: Generator + contract test + import smoke

**Files:** `codegen/src/generators/backend/agent/agent.manifest.generator.ts`, new spec(s) in `codegen/src/tests/backend/agent/`.

- [ ] The generator imports `splitRef` and manifest types from `@datex/fpx`; `commandTarget` stays.
- [ ] Contract spec: the baked `AGENT_MANIFEST` of the generated test app, serialised, passes `fpx`'s `parseManifestJson` and yields the same usable aliases the runtime's tools use. Import smoke: the compiled backend's `require('@datex/fpx')` exposes `invocableCommands` and `parseSpec`; `grep` proves no `@datex/fpx/lib` import exists (Review Focus 3).
- [ ] Delete `manifest.test.ts`, `params.test.ts` (covered by `fpx`). Harness green; Web-shape generation unchanged; commit — `test(agent): baked manifest is a manifest fpx accepts; import smoke for @datex/fpx`.

### Task 5: Live check

Regenerate the 73444 app, restart, run the slotting turn: same answer as Proof 2; `fpx commands` inside a script and the tool list agree (one turn in `script` mode via `AGENT_TOOL_MODE=script` on a local run).
