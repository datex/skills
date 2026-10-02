# Agent run limits — one source of truth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The run-limit numbers (built-in defaults, hard caps, save minimums) are written down once; .NET validation, the Studio Profile page (placeholders + min/max) and the generated app runtime all read that one copy, and the runtime keeps only its `AGENT_MAX_*` environment override on top.

**Architecture:** The one copy is `codegen/src/handlebars/backend/agent-limits.json`. .NET embeds it into the Domain assembly as a linked `EmbeddedResource`; `AgentLimitsPolicy` (Domain) loads it, drives `AgentDesignerConfig.validate`, and `GET api/agentlimits` serves it to Studio. Codegen reads it at generation time and bakes it into the generated `agent.manifest.ts` as `AGENT_LIMITS_POLICY` (next to `AGENT_MODEL_SETTING`); the runtime resolves `ceiling = clamp(env ?? default, cap)`, `effective = min(profile ?? ceiling, ceiling)` — semantics unchanged from C2.

**Ruling (2026-10-02):** Parvan chose ".NET owns them; codegen bakes them with the manifest". Codegen cannot read C#, and on publish it runs in a DevOps pipeline that reads the DB with no .NET process to hand it values. A runtime HTTP fetch would add a production dependency the generated app does not have today (production settings come from shared-data files; HTTP is only a fallback). So the numbers live in one JSON file inside codegen's own asset folder: codegen reads its own file, Studio reads them through .NET as approved, and only the Domain csproj links one file from outside its folder. Cost if wrong: moving the file is a one-line csproj change plus one path in codegen.

**Contract** (the file's content and the endpoint's body):

```json
{ "maxIterations":    { "default": 12,      "cap": 50,      "min": 1 },
  "maxRunTokens":     { "default": 2000000, "cap": 5000000, "min": 10000 },
  "maxToolCalls":     { "default": 50,      "cap": 500,     "min": 1 },
  "maxScriptSeconds": { "default": 180,     "cap": 3600,    "min": 10 } }
```

Save range = `min`..`cap`. Out of scope: the per-script timeout (180), turn deadline (210), per-request `max_tokens` (16000).

**Global constraints:** repo `D:\Git\248960_agent`, branch `feature/248960_agent_applications`; commit locally, never push, never `git stash`; never stage untracked spike/docs files or the modified spec; trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. The user's Studio API (DatexApplicationApi.exe) and a generated app on :3000 run here — never stop/kill/restart a process you did not start, never write into `codegen/dist/app`; build/test .NET with `-c Release`. Never `npm install` inside `dist/`.

### Task 1: The JSON file, `AgentLimitsPolicy`, `GET api/agentlimits` (.NET)
- Create `src/Wavelength/DatexApplicationApi/codegen/src/handlebars/backend/agent-limits.json` with exactly the contract above. Link it into `DatexApplicationApi.Domain.csproj` as `<EmbeddedResource Include="..\DatexApplicationApi\codegen\src\handlebars\backend\agent-limits.json" LogicalName="agent-limits.json" />` (adjust the relative path to the real layout).
- Failing xUnit first: `AgentLimitsPolicy` exposes the four fields with the file's values; `GET api/agentlimits` returns exactly the contract (camelCase keys `default`/`cap`/`min`); `validate` range errors are built from the policy and keep today's wording (e.g. `"profile.limits.maxToolCalls must be between 1 and 500"`); the existing range tests keep passing. Tests may name the numbers; production C# may not.
- Implement `AgentLimitsPolicy` (static, loaded once from the embedded resource; a missing or invalid resource throws at load), replace the literals in `validate` (`AgentDesignerConfig.cs` ~:215-229), add `AgentLimitsController` (`[Route("api/[controller]")]`, `[HttpGet]`, same auth attributes as `ConfigurationTypesController`).
- `dotnet test -c Release --filter "FullyQualifiedName~Agent"`, then the full suite. Commit — `feat(agent): run-limit defaults, caps and save minimums in one file; served at api/agentlimits`.

### Task 2: Studio Profile page
- A service call to `api/agentlimits` when the agent designer loads (follow how the ClientApp calls other plain `api/...` metadata endpoints); each Run limits input (`agent-designer.component.html` ~:261-298) gets `placeholder="Default: <n>"` (thousands separators), `[min]`/`[max]` bound to `min`/`cap`; the hard-coded min/max attributes are removed. Before the limits arrive the inputs simply show no placeholder; a failed call leaves them without placeholders and logs nothing user-facing.
- Hint text: `Empty uses the default. Values above the environment's limit are capped to it.` Datex design system rules apply (tokens, existing class names).
- `npm run build` in the ClientApp; no `.spec.ts`. Commit — `feat(studio): run limits show their defaults from api/agentlimits`.

### Task 3: Codegen bake + runtime
- The agent manifest generator (`codegen/src/generators/backend/agent/agent.manifest.generator.ts`) reads `handlebars/backend/agent-limits.json`, resolved the way `template.service.ts` resolves templates so it works from `dist`; `agent.manifest.hbs` emits `export const AGENT_LIMITS_POLICY = {...}` for every app (emitted for non-agent apps too, like `AGENT_MANIFEST = null`, so `agent/*` compiles everywhere).
- Runtime: `config.ts`/`session.ts` drop the `MAX_TURNS`, `HARD_MAX_TURNS`, `MAX_RUN_TOKENS`, `HARD_MAX_RUN_TOKENS`, `MAX_RUN_TOOL_CALLS`, `HARD_MAX_RUN_TOOL_CALLS`, `MAX_RUN_SCRIPT_SECONDS`, `HARD_MAX_RUN_SCRIPT_SECONDS` literals; ceilings come from `AGENT_LIMITS_POLICY` plus `AGENT_MAX_TURNS`/`AGENT_MAX_RUN_TOKENS`/`AGENT_MAX_RUN_TOOL_CALLS`/`AGENT_MAX_RUN_SCRIPT_SECONDS` (clamped to cap). `resolveLimits` takes the policy as an argument so specs inject one. Unchanged: `AGENT_MAX_TOKENS` (16000), script timeout, turn deadline.
- Specs: the generator bakes the file's values; `resolveLimits` with an injected policy (absent profile → env-or-default; profile above ceiling → ceiling; env above cap → cap); existing budget/turn-limit specs pass with the policy injected. Harness green (`npm run build:noclean && npm run start:test`, then `cd dist/testapp/backendapp && npm run test:build && npm run test:run`); Web-shape output unchanged except the new constant in `agent.manifest.ts`. Commit — `feat(agent): runtime limits come from the baked AGENT_LIMITS_POLICY`.

### Final check (controller)
`grep` shows none of the limit numbers as literals in Studio, the agent runtime or production C#.
