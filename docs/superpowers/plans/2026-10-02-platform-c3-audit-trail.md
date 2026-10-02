# Platform C3 — the agent audit trail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every agent turn — completed or stopped — leaves one `AgentRunRecord` (who, which model, how long, every tool call, every script and the `fpx` calls each script made, usage, why it stopped) as a structured log line and as a span tree, correlated by a `runId` the client also receives.

**Architecture:** `runTurn` builds the record as it goes and attaches the partial record to any error it throws. The loopback grant gains an observer, so the middleware records each `fpx` call (path, method, status, duration) against the script that made it and tags the request's own span with the `runId`. Spans use the existing `TelemetryService.span` (fans out to OpenTelemetry and Datadog). The router writes the record through an audit channel that does not depend on `LOGGING_LEVEL`.

**Tech Stack:** codegen Node/TS runtime (Bunyan `LoggingService`, `TelemetryService`, dd-trace + Azure Monitor OTel already wired), mocha harness; dxs (Python).

**Spec:** `D:\Git\248960_agent\docs\superpowers\specs\2026-09-25-agent-application-type-design.md` §4.5 "Audit trail, two layers".

## Decisions

1. **Persistence (`agent_runs`) and `GET /api/$agent/runs[/{id}]` move to the async-turns plan**, which you deferred: a stored run without a way to start a run asynchronously is half a feature, and both need the same run store. C3 is log + spans + correlation. (Persisting would also require every Agent app to declare a MongoDb connection.)
2. **The audit line does not depend on `LOGGING_LEVEL`.** `LoggingService` defaults to `error`, so today's `agent turn completed` info line is silently dropped in a default deployment. C3 adds `LoggingService.audit(message, properties)` — a Bunyan child logger fixed at `info` that writes the same JSON-on-stdout records (so Datadog and App Insights pick them up exactly like other lines) — and uses it for agent run records only.
3. **Record shape, flattened for the logger.** `LoggingService` stringifies nested objects and cuts each value at 8 KB. The record is logged as top-level scalars (`runId, conversationId, agent, callerId, model, startedAt, durationMs, iterations, toolCallCount, scriptCount, fpxCallCount, inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, modelRequests, stopReason, error`) plus two compact arrays as JSON strings capped at 8 KB with a `…truncated` marker: `toolCalls` = `[{name, argsDigest, durationMs, resultBytes, error}]`, `scripts` = `[{exitCode, timedOut, durationMs, stdoutBytes, stderrBytes, truncated, fpxCalls: [{alias, status, durationMs}]}]`.
4. **Never logged:** script stdout/stderr (bytes only), tool arguments (a `sha256` digest, first 16 hex chars), the loopback token, the model key, message text.
5. **`stopReason`**: `completed | iterationLimit | deadline | budget:tokens | budget:toolCalls | budget:scriptSeconds | modelError | clientAborted | error`.
6. **`runId`** = a fresh UUID per turn, returned at the top level of the 200 and 409 bodies and in the 503 body when one exists (503s are decided before a run starts — they get no `runId`).
7. **`fpx` call alias**: resolved by matching the request path against the manifest's `target.path` (datasources: path + `/<verb>`); unmatched paths are recorded with `alias: null` and the path.
8. **Spans**: `agent.turn` (attributes: runId, agent, model, callerId) → `agent.iteration` (n, tokens) → `agent.tool` (name) / `agent.script` (exitCode, durationMs, fpxCallCount); each loopback request's own auto-instrumented span gets two correlation tags, `agent.run_id` and `agent.script_index` (never the token or its jti). Script `fpx` calls are separate HTTP requests, so they are correlated by tag, not parented (propagating `traceparent` through `fpx` is out of scope).

## Global Constraints

- Platform repo `D:\Git\248960_agent` (Tasks 1–4), CLI `D:\Git\datex-studio-cli` (Task 5). Commit locally, never push, never `git stash`; never stage untracked spike/docs files or the modified spec.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- The user's Studio API and a generated app run here: never stop/kill/restart a process you did not start; never write into `codegen/dist/app`; edit `codegen/src` only. Harness as in C2.
- The token never appears in a log line or span attribute (existing tests pin the middleware; new tests pin the record).

## Review Focus

1. A turn that throws (turn limit, deadline, budget, model error, client abort) — still produces exactly one record with the right `stopReason` and the usage so far.
2. A script whose stdout contains the token or customer data — none of it in the record; only byte counts.
3. A turn with dozens of tool calls — the arrays truncate with a marker; the scalar counts stay exact; the line stays valid JSON.
4. Two concurrent turns — each record holds only its own scripts' `fpx` calls.
5. A deployment with `LOGGING_LEVEL=error` (the default) — the audit line is still written.

---

### Task 1: The record (session)

**Files:** `CG/backendapp/src/agent/session.ts`, new `CG/backendapp/src/agent/run-record.ts`, specs `CG/tests/backend/agent/run-record.test.ts`, `session.test.ts`. (`CG` = `src/Wavelength/DatexApplicationApi/codegen/src`.)

**Interfaces — produces:** `AgentRunRecord` (Decision 3 fields, arrays unflattened), `RunRecorder` (`startIteration()`, `toolCall({name, args, durationMs, resultBytes, error})`, `script({…, fpxCalls})`, `finish(stopReason, error?)`, `record()`), `argsDigest(args)`, `flattenForLog(record): Record<string, string|number|null>`; `TurnResult.runRecord`; every error `runTurn` throws carries `runRecord`.

- [ ] Failing specs: completed turn → `stopReason: completed`, iterations = model requests, one toolCall per dispatch with digest not args; each thrown class → its `stopReason` and the partial usage; `flattenForLog` caps arrays at 8 KB with the marker and keeps valid JSON; Review Focus 2 (a script result whose stdout holds a token-like string and `secret-row-data` → absent from the record).
- [ ] Implement; `runId` generated in `runTurn` options (router passes it) so the router knows it before the turn starts.
- [ ] Green, commit — `feat(agent): AgentRunRecord built through the turn, attached to every outcome`.

### Task 2: `fpx` call attribution (loopback grant)

**Files:** `CG/backendapp/src/agent/loopback-auth.ts` (`StoredGrant`, `mintLoopbackToken` opts, success path), `router.ts` (`buildScriptSession().mint`), `session.ts` (`ScriptSessionGrant` gains `calls()`), specs `loopback-auth.test.ts`, `router.test.ts`.

- [ ] Failing specs: a grant minted with `onCall` receives `{path, method, status, durationMs}` once per authenticated request after `res` finishes (also for a call still in flight when the grant is revoked); refused requests (403 restricted, 401 budget) are recorded with their status; the script record lists the calls with aliases resolved from manifest targets (Decision 7); Review Focus 4 — two concurrent scripts' grants record separately.
- [ ] Implement: `res.on('finish')` in the success path; refused paths record before returning; `res.locals.agentRunId` / script index set for Task 3's span tag.
- [ ] Green, commit — `feat(agent): record each fpx call against the script that made it`.

### Task 3: Spans

**Files:** `session.ts`, `router.ts`, `loopback-auth.ts`; the injected `TelemetryService` (`CG/backendapp/src/logs/telemetry.service.ts`, `span(name, fn)` + `setTag`).

- [ ] Failing specs with a fake `TelemetryService` (override the token in `createTestInjector`): span names and nesting order per Decision 8 for a two-iteration, one-script turn; attributes present; no attribute value contains the token or stdout.
- [ ] Implement: wrap the turn, each iteration, each tool/script in `telemetry.span` (awaited in sequence — the helper nests through the active context); the loopback success path calls `setTag('agent.run_id', …)` on the request's active span.
- [ ] Green, commit — `feat(agent): turn → iteration → tool/script spans; loopback requests tagged with the run id`.

### Task 4: The audit line and `runId` in responses

**Files:** `CG/backendapp/src/logs/logging.service.ts` (`audit`), `router.ts` (all outcomes), specs `router.test.ts`, a `logging.service` spec.

- [ ] Failing specs: `audit` writes at `info` even with `LOGGING_LEVEL=error` (Review Focus 5); the router writes exactly one `agent run` audit line per turn for 200, each 409 code, model error (500) and client abort, with the flattened record; 200/409 bodies carry `runId`; the existing `agent turn completed` info line is replaced (not duplicated).
- [ ] Implement; Web-shape generation unchanged except `logging.service.ts` (it is shared — confirm the Web app's behaviour is unchanged apart from the new method).
- [ ] Green, commit — `feat(agent): one audit line per turn, independent of LOGGING_LEVEL; runId in turn responses`.

### Task 5: dxs prints the run id

**Files:** `D:\Git\datex-studio-cli\src\dxs\commands\agent.py`, `tests/test_agent_commands.py`, `docs/agent-cli.md`.

- [ ] `agent chat` output gains `run_id` (200) and `details.run_id` (409); docs say where to find the record (search the log for the run id). pytest, ruff, mypy; commit.

### Task 6: Live check (user-assisted)

Run the slotting turn; find the `agent run` line in the app's stdout (or Datadog/App Insights if enabled) by the printed `run_id`; confirm: one script, three `fpx` calls with aliases `pick-history`, `locations`, `inventory`, status 200, no stdout text.
