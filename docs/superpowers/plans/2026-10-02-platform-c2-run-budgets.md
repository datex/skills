# Platform C2 — run budgets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every agent turn has a cumulative budget — model tokens, tool calls, script seconds, iterations — set per agent on the Studio Profile page within environment ceilings the profile cannot exceed; a turn that hits one stops with `409 BudgetExhausted` naming the budget.

**Architecture:** `profile.limits` is added to the type-38 configuration (.NET model + validation), edited on the Profile page, carried unchanged through the platform and baked manifests (both copy `profile` wholesale), and enforced in `runTurn` from `usage.ts` counters. Every 409 the turn route answers gains a machine-readable `code`; dxs shows it.

**Tech Stack:** .NET 9 / xUnit (DB-backed), Angular 20 ClientApp, codegen Node/TS runtime + mocha harness, dxs (Python).

**Spec:** `D:\Git\248960_agent\docs\superpowers\specs\2026-09-25-agent-application-type-design.md` §4.5 "Usage limits per run".

## Decisions

1. **Fields** (all optional; absent = the environment ceiling): `maxIterations` (model requests per turn), `maxRunTokens` (input + output tokens summed over the turn; cache tokens are not counted), `maxToolCalls` (tool calls per turn, `run_script` included), `maxScriptSeconds` (script wall time summed over the turn).
2. **Ceilings** (env, read with `intFromEnv`): `AGENT_MAX_TURNS` (exists; default 12, hard 50), `AGENT_MAX_RUN_TOKENS` (default 500 000, hard 5 000 000), `AGENT_MAX_RUN_TOOL_CALLS` (default 50, hard 500), `AGENT_MAX_RUN_SCRIPT_SECONDS` (default **180**, hard 3600). While turns are synchronous the C1 turn deadline (`AGENT_TURN_DEADLINE`, 210 s) and the per-script timeout (`AGENT_SCRIPT_TIMEOUT`, 180 s) already bound script time, so the default equals one full-length script (or several shorter ones adding up to it); the 3600 hard cap is for local runs with a raised deadline and for asynchronous turns later. The effective script time left is `min(maxScriptSeconds − used, AGENT_SCRIPT_TIMEOUT, deadline − now − 5)`. Effective value = `min(profile value ?? ceiling, ceiling)`.
3. **Validation ranges** (server, `AgentDesignerConfig.validate`): `maxIterations` 1–50, `maxRunTokens` 1 000–5 000 000, `maxToolCalls` 1–500, `maxScriptSeconds` 10–3600. Out of range is a `DesignerConfigError`. The UI shows the same ranges; the server is the authority (the Agent designer's save is not gated by form validity).
4. **When a budget is checked:** tokens — after each model response, before the next request; tool calls — before each dispatch; script seconds — the next script's timeout is clamped to what is left, and a script is refused when < 5 s remain; iterations — the existing loop bound. The turn deadline (C1) still applies on top.
5. **409 bodies gain `code`**: `TurnLimitReached`, `TurnDeadlineReached`, `BudgetExhausted` (plus `budget: 'tokens' | 'toolCalls' | 'scriptSeconds'`). All 409s carry `conversationId` and the turn's `usage` so far. Iterations keep `TurnLimitReached` (unchanged meaning).
6. **Scope:** no money, no per-command costs (Bryan's action budget stays parked; the error shape leaves room).

## Global Constraints

- Platform repo `D:\Git\248960_agent` (Tasks 1–3), CLI repo `D:\Git\datex-studio-cli` (Task 4); skills `D:\Git\skills` (Task 4 docs). Commit locally, never push, never `git stash`; never stage untracked spike/docs files or the modified spec in the platform repo.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- The user's Studio API and a generated app run on this machine: never stop/kill/restart a process you did not start; never write into `codegen/dist/app`; edit `codegen/src` only. .NET: build/test `-c Release` if Debug output is locked.
- Codegen harness: `npm run build:noclean && npm run start:test`, then `cd dist/testapp/backendapp && npm run test:build && npm run test:run`. No `npm install` inside `dist/`.

## Review Focus

1. A profile asking for more than the ceiling (`maxRunTokens: 9 000 000` with the env ceiling 500 000) — the ceiling wins silently at runtime; validation flags values outside the absolute range only.
2. A turn that crosses the token budget mid-way — no further model request is sent; the answer so far is not returned as if complete; the 409 names `tokens` and carries the usage.
3. A tool-call budget hit while the model asked for several tools in one response — the calls beyond the budget are not dispatched, and the turn stops before the next model request.
4. An existing agent with no `limits` — behaves exactly as before (env defaults), including 12 iterations.
5. A budget error and the C1 deadline racing — whichever trips first stops the turn with its own code; never both, never a 500.

---

### Task 1: `limits` in the agent configuration (.NET)

**Files:** `W/DatexApplicationApi.Domain/Entities/Configurations/Designer/AgentDesignerConfig.cs` (`AgentProfile` ~:54, `validate` ~:140), tests `W/DatexApplicationApi.Tests/CommonTests/AgentDesignerConfigAppTypeTests.cs` (or a new `AgentProfileLimitsTests.cs`), `W/DatexApplicationApi.Tests/Controllers/AgentConfigurationsControllerTests.cs` (manifest round trip). `W` = `src/Wavelength`.

- [ ] **Step 1: Failing tests** — `AgentProfile.limits` round-trips through upsert and both manifest routes; each field out of range yields one `DesignerConfigError` whose message names the field and the range (e.g. `"profile.limits.maxToolCalls must be between 1 and 500"`); `limits` null or all-null → no error; an existing config JSON without `limits` deserialises unchanged.
- [ ] **Step 2: Model** — `public class AgentLimits { public int? maxIterations; public int? maxRunTokens; public int? maxToolCalls; public int? maxScriptSeconds; }` (properties, camelCase like the rest), `public AgentLimits limits { get; set; }` on `AgentProfile`. The manifest DTO reuses `AgentProfile`, so nothing else changes on the server.
- [ ] **Step 3: Validation** — in `validate`, after the skills block, one range check per field with the Decision 3 ranges, null-guarded (`this.profile?.limits`).
- [ ] **Step 4: Green** — `dotnet test -c Release --filter "FullyQualifiedName~Agent"`, then the full suite; record counts. **Commit** — `feat(agent): profile.limits — per-turn run budgets in the agent configuration`.

### Task 2: Profile page fields (Studio)

**Files:** `UI/common/designer-config-service/agent/agent-designer-config.ts` (`IAgentProfile` ~:28), `UI/studio/agent/agent-designer/agent-designer.component.ts` (~:64 `onConfigLoaded`), `.html` (Profile form ~:214-258). `UI` = `src/Wavelength/DatexApplicationApi/ClientApp/projects/datexapplication/src/app`.

- [ ] **Step 1** — `IAgentLimits { maxIterations?: number | null; maxRunTokens?: number | null; maxToolCalls?: number | null; maxScriptSeconds?: number | null }`, `limits?: IAgentLimits` on `IAgentProfile`; `this.config.profile.limits ??= {}` in `onConfigLoaded`.
- [ ] **Step 2** — a "Run limits" group under the model fields: four `type="number"` inputs in `datex-common-form-field-shell`, `min`/`max` per Decision 3, `[disabled]="!canEdit"`, `updateOn: 'blur'`, empty = unset (bind so clearing the field stores `null`, not `0` or `""`). Labels: `Model requests per turn`, `Tokens per turn`, `Tool calls per turn`, `Script seconds per turn`; hint under the group: `Leave empty to use the environment's limit. The environment's limit always applies.` Sentence case, no trailing periods on labels. Follow the Datex design system (CLAUDE.md "Design system"): tokens, spacing scale, existing class names only.
- [ ] **Step 3** — `npm run build` in the ClientApp; no `.spec.ts`. **Commit** — `feat(studio): run limits on the agent Profile page`.

### Task 3: Enforcement in the agent loop (codegen runtime)

**Files:** `CG/backendapp/src/agent/manifest.ts` (profile type ~:90), `session.ts` (`runTurn` ~:398, new budget logic), `usage.ts` (helper `runTokens(usage)` = input + output), `router.ts` (~:313 runTurn call, ~:357 409 mapping), specs in `CG/tests/backend/agent/session.test.ts` and `router.test.ts`. `CG` = `src/Wavelength/DatexApplicationApi/codegen/src`.

**Interfaces — produces:** `export class BudgetExhausted extends Error { readonly code = 'BudgetExhausted'; constructor(readonly budget: 'tokens' | 'toolCalls' | 'scriptSeconds', readonly limit: number, readonly usage: TurnUsage) }`; `resolveLimits(profile?: { limits?: … }): { maxIterations; maxRunTokens; maxToolCalls; maxScriptSeconds }`; `TurnLimitReached` and `TurnDeadlineReached` gain `code` and carry `usage`.

- [ ] **Step 1: Failing specs** (ScriptedClient):
  - tokens: two responses of 600 tokens each with `maxRunTokens: 1000` → after the second response `BudgetExhausted('tokens')`, exactly 2 model requests, usage 1200 attached.
  - tool calls: one response with 3 tool_uses and `maxToolCalls: 2` → 2 dispatched, the third not; turn stops with `BudgetExhausted('toolCalls')` before another model request.
  - script seconds: `maxScriptSeconds: 20`, first script reports `durationMs: 18000` → the next script is refused (< 5 s left) as an is_error tool result, and a following script request stops the turn with `BudgetExhausted('scriptSeconds')` — pin which of the two happens and keep it consistent with the C1 deadline's "not enough time left" handling.
  - `resolveLimits`: profile above ceiling → ceiling; absent → ceiling; non-number/≤0 → ceiling.
  - Review Focus 4: no `limits` → 12 iterations, unlimited-but-ceilinged tokens/tool calls (the env defaults), identical to today's behaviour in an existing spec.
  - router: each of the three errors → 409 `{ error, code, budget?, conversationId, usage }`; `TurnLimitReached` → 409 with `code: 'TurnLimitReached'`.
- [ ] **Step 2: Implement** — env ceilings in `config.ts` with `intFromEnv` (Decision 2); `resolveLimits` from `AGENT_MANIFEST.profile`; `runTurn` options gain `limits`; checks per Decision 4; the existing per-tool catch rethrows `BudgetExhausted` like `TurnDeadlineReached`.
- [ ] **Step 3: Green**; Web-shape generation unchanged. **Commit** — `feat(agent): per-turn run budgets — tokens, tool calls, script seconds; 409 BudgetExhausted with code and usage`.

### Task 4: dxs and docs

**Files:** `D:\Git\datex-studio-cli\src\dxs\commands\agent.py` (409 mapping ~:311), `tests/test_agent_commands.py`, `docs/agent-cli.md`; `D:\Git\skills\skills\datex-studio\agent-creator\SKILL.md` (profile section).

- [ ] **Step 1: Failing tests** — a 409 with `code: BudgetExhausted, budget: tokens` → `DXS-AGENT-040` message `run budget exhausted (tokens): …`, suggestion "raise profile.limits on the agent's Profile page, within the environment's ceiling"; `TurnDeadlineReached` → `turn deadline reached: …`; a 409 without `code` keeps today's `turn limit reached` wording; `details.usage` carries the usage.
- [ ] **Step 2** — implement; `uv run pytest tests/test_agent_commands.py`, ruff, mypy; commit in dxs.
- [ ] **Step 3** — docs: `docs/agent-cli.md` (the 409 codes), agent-creator's body-shape example gains `"limits": { "maxToolCalls": 20 }` with one sentence on ceilings; `npm test` in skills; commit there.

### Task 5: Live check (user-assisted)

On branch 73444 set `maxToolCalls: 1` on the Profile page, regenerate, restart; the slotting question → `409 BudgetExhausted (toolCalls)` from dxs. Clear it, regenerate → the normal answer.
