# Platform — OpenAI model client behind a neutral ModelClient — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An Agent app whose AiApi connection has provider OpenAI runs the same agent loop (command tools, `run_script`, budgets, audit record, caching) on OpenAI's Responses API. An Anthropic app sends byte-identical requests and returns byte-identical transcripts to today.

**Architecture:** `session.ts` stops speaking Anthropic's wire format. It talks to a provider-neutral `ModelClient` (`createTurn`, `toolResultMessages`, `checkTranscript`), and all wire specifics live in two adapters: `anthropic-client.ts` (today's behaviour moved, unchanged) and `openai-client.ts` (Responses API, stateless). The transcript stays in the provider's own format. Each provider gets a built-in default model; `AGENT_MODEL` is deleted.

**Tech Stack:** codegen Node/TS runtime (CommonJS, node10 resolution), `@anthropic-ai/sdk` 0.125.0 (unchanged), `openai` npm SDK (latest 7.x at the time of writing: 7.28.0), mocha harness; dxs (Python) docs.

**Spec:** `D:\Git\248960_agent\docs\superpowers\specs\2026-09-25-agent-application-type-design.md` §4.4b "Model client is vendor-abstracted" (the OpenAI follow-up).

## Decisions (Parvan, 2026-10-06)

1. **Transcript in the provider's own format.** Anthropic history stays exactly as today (content blocks, thinking blocks replayed verbatim). An OpenAI app's history is a list of Responses API input items (`{role, content}` messages, `reasoning`, `function_call`, `function_call_output`). A history from the other provider is refused with `400 { code: 'ConversationProviderMismatch' }` and the message "this conversation was started with another model provider; start a new conversation".
2. **OpenAI uses the Responses API, stateless:** `store: false`, `include: ['reasoning.encrypted_content']`, and every output item is appended to the history verbatim, so reasoning carries between tool steps without OpenAI keeping any state.
3. **One default model per provider; `AGENT_MODEL` is deleted.** Anthropic `claude-opus-5`, OpenAI `gpt-6-astra` (OpenAI's documented default for complex reasoning and coding, checked 2026-10-06). `AGENT_MODEL` never shipped, so it is removed, not deprecated. `profile.model`/`modelClass` stay unread, as today.
4. **Anthropic must not change.** Same request parameters (explicit system-prompt cache marker + top-level automatic caching, tools, `max_tokens`), same transcript, same usage numbers, same 409/503 bodies. Pinned by the existing specs (unchanged except for how the fake client is wrapped) plus a golden request captured before the refactor.

## Contract — produced by Task 1, consumed by Task 2

```ts
// agent/model-client.ts
export type ModelProvider = 'anthropic' | 'openai';

/** Tool definitions keep today's shape; the OpenAI adapter maps them. */
export interface ToolDefinition { name: string; description: string; input_schema: any }

export interface ModelTurnRequest {
  model: string;
  system: string;
  tools: ToolDefinition[];
  messages: any[];          // the provider-native transcript so far
  maxTokens: number;
  cacheKey?: string;        // stable per agent (e.g. `agent:<referenceName>`); OpenAI prompt_cache_key, ignored by Anthropic
}
export interface ToolUse { id: string; name: string; input: any }
export interface ModelUsage {
  inputTokens: number;            // uncached input only (Anthropic semantics)
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}
export interface ModelTurnReply {
  text: string;                   // concatenated answer text ('' when only tool calls)
  toolUses: ToolUse[];
  assistantMessages: any[];       // provider-native items to append to the transcript verbatim
  usage: ModelUsage;
}
export interface ToolResultInput { id: string; content: string; isError: boolean }

export interface ModelClient {
  readonly provider: ModelProvider;
  createTurn(request: ModelTurnRequest): Promise<ModelTurnReply>;
  /** Provider-native transcript entries carrying these tool results, in order. */
  toolResultMessages(results: ToolResultInput[]): any[];
  /** null when the transcript is this provider's shape; otherwise a reason (ConversationProviderMismatch). */
  checkTranscript(messages: any[]): string | null;
}
export const DEFAULT_MODELS: Record<ModelProvider, string> = { anthropic: 'claude-opus-5', openai: 'gpt-6-astra' };
```

`session.ts` keeps everything that is not wire format: budgets, deadline, truncation of tool results (`MAX_TOOL_RESULT_CHARS`, the `exemptFromCut` rule), run record, spans, `run_script`, dispatch. `tagModelError` wraps whatever `createTurn` throws.

## Global Constraints

- Platform repo `D:\Git\248960_agent`, branch `feature/248960_agent_applications`; dxs `D:\Git\datex-studio-cli` and skills `D:\Git\skills` for docs (Task 3). Commit locally, never push, never `git stash`; never stage the modified spec or untracked files.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- The user's DatexApplicationApi.exe and a generated app on :3000 run here: never stop/kill/restart a process you did not start; never write into `codegen/dist/app`; never `npm run build` in codegen (its clean deletes `dist/app`).
- `npm install` only in `codegen` (after `npm install --dry-run` shows it adds only `openai` and its own dependencies — stop and report otherwise); `codegen/src/backendapp/package.json` gets the dependency with `npm install --package-lock-only` there (no node_modules), as for `@datex/fpx`. Never inside `dist/`.
- Harness: from codegen `npm run build:noclean && npm run start:test`, then in `dist/testapp/backendapp` `npm run test:build && npm run test:run`; check `test:build` exits 0 (a failed compile leaves stale JS and mocha still passes).
- The OpenAI SDK is required lazily, like the Anthropic one: an app that never runs a turn never loads it.

## Review Focus

1. An Anthropic turn after the refactor — request params, transcript returned, usage and run record identical to before (golden).
2. An OpenAI turn with two tool calls in one response, then a `run_script`, then an answer — all `function_call_output`s answer the right `call_id`s, reasoning items are carried forward, budgets count tool calls the same way.
3. A history from the wrong provider (Anthropic blocks sent to an OpenAI app, and the reverse) — 400 ConversationProviderMismatch, no model call.
4. OpenAI usage — `input_tokens` includes cached tokens; `inputTokens` must be `input_tokens − cached_tokens`, `cacheReadInputTokens = cached_tokens`, `cacheCreationInputTokens = 0`, so the token budget means the same thing on both providers.
5. An OpenAI response with `status: 'incomplete'` (max_output_tokens) or a refusal — surfaces as a model error with a clear message, never as an empty "answer".

---

### Task 1: Neutral ModelClient + Anthropic adapter (behaviour-preserving) + per-provider default model

**Files:** new `agent/model-client.ts`, new `agent/anthropic-client.ts`; `agent/session.ts`, `agent/client.ts`, `agent/config.ts`, `agent/router.ts`, `agent/request.ts`; specs in `codegen/src/tests/backend/agent/`.

- [ ] **Step 1: Golden first.** Before changing code, add a spec that runs a fixed two-iteration Anthropic turn (one tool call, then an answer; one thinking block in the first reply) through today's `runTurn` with the scripted SDK fake, and records both SDK requests and the returned transcript/usage into a JSON fixture. Commit it with the code as it is (green).
- [ ] **Step 2:** Create `model-client.ts` with the contract above. Move into `anthropic-client.ts`: `cachedSystem`/`CACHE_BREAKPOINT`, the top-level `cache_control`, `max_tokens`, content-block parsing (text, tool_use), verbatim assistant replay, `tool_result` block building (`is_error`), usage mapping (`addUsage` input), and the transcript check (first entry `role: 'user'`; an entry whose content contains OpenAI-only item types → mismatch). `anthropicModelClient(sdk)` wraps an SDK-shaped `{ messages: { create } }`.
- [ ] **Step 3:** `session.ts` uses only `ModelClient`. The existing specs keep their scripted SDK fake; the shared `base()` helper wraps it with `anthropicModelClient`, and every existing assertion on `client.requests[...]` (system blocks, cache_control, messages) stays as it is. Golden spec green.
- [ ] **Step 4:** `config.ts`: delete `DEFAULT_MODEL`, `MODEL` and the `AGENT_MODEL` read; `router.ts` takes the model from `DEFAULT_MODELS[credentials.provider]`. `request.ts` keeps the generic checks; the provider-specific first-entry check moves to `checkTranscript`, called by the router before the turn, mapping a non-null reason to `400 { error, code: 'ConversationProviderMismatch' }`. `client.ts` returns `anthropicModelClient(new Anthropic({ apiKey }))` for anthropic; openai still throws `ModelProviderNotSupported` until Task 2.
- [ ] **Step 5:** Harness green, Web-shape generation unchanged. Commit — `refactor(agent): provider-neutral ModelClient; Anthropic wire format moves into its adapter unchanged; per-provider default model, AGENT_MODEL removed`.

### Task 2: OpenAI adapter on the Responses API

**Files:** new `agent/openai-client.ts`; `agent/client.ts`; `codegen/package.json` + lock, `codegen/src/backendapp/package.json` + lock; specs.

- [ ] **Step 1: Failing specs** with a scripted OpenAI SDK fake (`{ responses: { create } }`) for Review Focus 2–5, plus: request shape (`model`, `instructions` = system, `input` = transcript, `tools` mapped to `{ type: 'function', name, description, parameters: input_schema, strict: false }`, `max_output_tokens`, `store: false`, `include: ['reasoning.encrypted_content']`, `prompt_cache_key` = cacheKey), `function_call.arguments` parsed from JSON (malformed JSON → an is_error tool result, not a crash), `call_id` used as the tool-use id, `function_call_output.output` as the string content, answer text from `output_text` items of `message` outputs.
- [ ] **Step 2: Dependency.** `npm install --dry-run openai@^7` in codegen, check it adds only `openai` (+ its own deps), then install; add the same range to `codegen/src/backendapp/package.json` with `--package-lock-only`. Lazy `require('openai')`.
- [ ] **Step 3: Implement** `openAiModelClient(sdk)`; `client.ts` builds it for provider openai (cache by provider + key, like Anthropic); `ModelProviderNotSupported` stays for any other provider value. `checkTranscript`: Anthropic content-block arrays (`tool_use`/`tool_result`/`thinking` blocks) → mismatch.
- [ ] **Step 4:** One router-level spec: an OpenAI-bound app (fake SDK) completes a turn with a `run_script` and writes one audit line whose `model` is `gpt-6-astra`.
- [ ] **Step 5:** Harness green. Commit — `feat(agent): OpenAI model client on the Responses API (stateless, encrypted reasoning carried in the transcript)`.

### Task 3: dxs, docs and skills

**Files:** `D:\Git\datex-studio-cli\src\dxs\commands\agent.py`, `tests/test_agent_commands.py`, `docs/agent-cli.md`; `D:\Git\skills` agent-creator (model/provider wording); platform runbook only if tracked.

- [ ] dxs: a 400 with `code: ConversationProviderMismatch` → `DXS-AGENT-0xx` (next free) with the suggestion "start a new conversation (drop --history)"; existing 400 handling unchanged otherwise. Tests, ruff, mypy; commit in dxs.
- [ ] Docs: `docs/agent-cli.md` — OpenAI supported, per-provider default models, `AGENT_MODEL` gone, the new 400. agent-creator: a model connection may be Anthropic or OpenAI. `npm test` in skills; commit there.

### Task 4: Live check (user-assisted)

1. Anthropic app (branch 73444, unchanged connection): regenerate, run the slotting question — same answer, cache numbers as before.
2. OpenAI: bind an AiApi connection with provider OpenAI and a real key to the same app (or a copy), regenerate, run the slotting question — an answer produced through `run_script` + `fpx`; the audit line shows `model: gpt-6-astra` and `cacheReadInputTokens` on later requests.
3. Send the Anthropic history file to the OpenAI app — `ConversationProviderMismatch`.
