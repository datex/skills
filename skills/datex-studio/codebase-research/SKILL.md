---
name: codebase-research
description: |
  Use when investigating the current state of a Datex Studio codebase
  with read-only inspection — answers questions about existing
  components, flow code, type definitions, datasource shapes, and
  configuration without modifying anything. Carries Datex Studio-
  specific patterns: extract flow code from
  `nodes[0].stepConfig.executeCodeConfig.code` (not from the JSON
  surface), delegate OData schema queries to `schema-explorer`, fetch
  enum values from `*-customType` configs on the branch via
  `dxs source explore`, return in `Answer / Sources / Caveats`
  format. Triggers: "research the codebase", "investigate how X works",
  "find where Y is defined", "answer questions about current code
  state". Consumed by impact-analysis, requirements-gathering,
  report-creator, and any skill needing grounded read-only inspection.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - schema-explorer
---

# Codebase Research

Read-only investigation of a Datex Studio branch to answer questions about the current state of the code — components, flow source, type definitions, datasources, and configuration — without changing anything.

This is a **utility skill**. It produces a grounded answer that other skills can consume. It does not create, modify, validate, or deploy anything.

## When to Use

Invoke this skill when a task needs facts about the current codebase before it can proceed. Typical consumers:

- **`impact-analysis`** — needs to understand what a config does before reverse-tracing callers.
- **`requirements-gathering`** — needs to inspect an existing report/flow/datasource to extract effective requirements.
- **`report-creator`** — needs to confirm field shapes, datasource output, or existing report patterns before authoring.
- Any future skill that needs grounded, source-of-truth inspection without mutating state.

Also invoke directly when the user asks questions like:

- "Research the codebase and tell me how X works."
- "Investigate where Y is defined."
- "Find all places that reference Z."
- "What does the `xxx_flow` function actually do?"
- "Which enum values does `OrderStatus` accept?"

## When NOT to Use

- **Not for OData schema lookups** — delegate to `schema-explorer`. Do not load raw OData metadata into the parent context.
- **Not for modifying files** — this skill is strictly read-only. If the answer leads to a change, hand off to the appropriate creator/editor skill.
- **Not for running queries against live data** — for that, use `odata-execution` or `db-query`.
- **Not for deep architecture reviews of an entire branch** — use `branch-code-reviewer` for that. This skill answers focused questions.

## Mode

This is a **read-only research task**. Do NOT edit, create, or modify any files. Do not run commands that mutate branch state (no `upsert`, no `validate --fix`, no writes of any kind). The branch — read through the `dxs` CLI — is the source of truth; never assume a local `src/` checkout is authoritative. Use only read-only commands such as `dxs source explore config <ref> --branch <id>` (full config), `dxs source explore configs` (list), `dxs source explore summary` / `trace` / `graph`, `dxs schema describe` / `search`, and `dxs odata execute` against read-only endpoints. If you need raw JSON, `dxs configuration get <type> <id> -b <id> -O envelope.json` then `jq .json envelope.json` — into a throwaway temp file, never a persistent source-of-truth copy.

## Available Sources

Inspect these sources, in roughly this order of preference:

- **Component configs on the branch** — actions (`*-footprintFlow`), functions (`*-flow`), and every other type. Each config is JSON with embedded TypeScript. Fetch via `dxs source explore config <referenceName> --branch <id>` (or `dxs configuration get <type> <id> -b <id> -O envelope.json` → `jq .json`). The branch is the source of truth — do not read a local checkout.
- **Type definitions** — the `customtype` configs (`*-customType`). Interfaces and enums live here. Fetch them from the branch and prefer them over summaries.
- **OData schema** — delegate to the `schema-explorer` skill for entity, property, key, and navigation lookups. Do not load raw schema documents into the parent.
- **Platform docs** — `datex-studio-shared`, `datex-studio-conventions`, `datex-studio-runtime` skills hold authoring specs, conventions, and runtime semantics. Consult them when the question is about *how things should work*, not *what currently exists*.
- **Project / feature context** — any `CLAUDE.md` files in the project. Domain knowledge and project-specific conventions. Useful but may be stale — treat as a hint, not a source of truth.

## Datex Studio-specific patterns

These are the patterns that make this skill non-generic. Apply them every time.

### 1. Flow code lives inside the JSON, not on top

When reading an action, function, or any flow-based component, the executable TypeScript is **not** the top-level JSON. The actual code is a string embedded at:

```
nodes[0].stepConfig.executeCodeConfig.code
```

To analyze the TypeScript, extract that string, then read/analyze it as TypeScript. Reading the surrounding JSON without drilling into this path will give you metadata only, not the implementation.

When inspecting multi-step flows, iterate `nodes[*].stepConfig.executeCodeConfig.code` — each step has its own code body.

### 2. Delegate OData schema queries to `schema-explorer`

When the question involves an entity, property, key, navigation, or any OData metadata:

- **Do** invoke the `schema-explorer` skill with a focused query.
- **Do not** load the raw schema document into the parent context. It is large, noisy, and pollutes the context window.
- `schema-explorer` returns concise structured answers (entity shape, property list, navigation chains) and handles the connection resolution and FootPrintApi special-cases.

If `schema-explorer` is unavailable for some reason, fall back to `dxs schema describe` / `dxs schema search` directly — but still never read the full schema dump into the parent.

### 3. Enum values live in `customType` configs

When the question is "what values does enum X accept?" or "what are the possible values of field Y?":

- **Fastest for "just the member names":** `dxs configuration nomenclature -b <id>` (optionally `--search <name>` or `--package <Pkg> --kind enum`) returns every `<Package>.<Type>` with its enum members in `constantValues`, in one compact call (no per-type fetch). See [../datex-studio-shared/context-navigation.md#discovering-custom-types-and-enum-members](../datex-studio-shared/context-navigation.md#discovering-custom-types-and-enum-members).
- **When you need the full definition** (descriptions, value mappings, interface field shapes): fetch the `*-customType` config from the branch — `dxs source explore config <enum_referenceName> --branch <id>` (or list candidates with `dxs source explore configs --type customtype --search <name>`).
- Look for the enum definition there — that is the source of truth.
- Do **not** rely solely on summaries in `CLAUDE.md` or skill references — those may be stale.
- If the type is referenced from a flow's parameter, trace the reference back to its `customType` config (`dxs source explore trace <flow_ref> --branch <id>` surfaces the type references).

### 4. Answer / Sources / Caveats response format

Always respond in this three-part structure (see "Response Format" below). It makes the answer auditable and makes ambiguities explicit, which is critical for downstream skills that consume this skill's output.

## Workflow

1. **Restate the question** in one line, so the consumer can verify intent.
2. **Pick sources** — for each fact needed, identify which of the Available Sources will answer it. Prefer code over docs, types over summaries, `schema-explorer` over raw schema.
3. **Inspect** — fetch configs from the branch via `dxs source explore` (or invoke `schema-explorer` for OData schema). Apply the four Datex Studio-specific patterns above. Keep your inspection focused — do not crawl the whole branch.
4. **Cross-reference** when the question spans code and schema, or code and types. If sources disagree, flag the disagreement; do not silently pick one.
5. **Compose the answer** in the Answer / Sources / Caveats format.

## Guidelines

- **Be concrete.** Quote the line, property, or value you found. Avoid summarizing if a quote is short enough to include.
- **Cite sources.** Every claim should be traceable to the config it came from (the `dxs source explore` command and `referenceName`) or to the `schema-explorer` query that produced it.
- **Flag ambiguity.** If two sources disagree, if a `CLAUDE.md` summary contradicts the code, or if the question can't be fully answered from available sources, say so in Caveats.
- **Stay focused.** A research request is not a license to crawl unrelated files. Answer the question, then stop.
- **No speculation.** If you can't find the answer, say "not found in <sources consulted>" rather than guessing.
- **Respect read-only.** If during inspection you notice a bug or improvement, mention it in Caveats but do not fix it. The consumer decides what to do with the finding.

## Response Format

Answer the question directly and concisely. Use this three-part structure:

```markdown
## Answer

<the direct response — concrete, quoted from sources where possible>

## Sources

- `<file path or skill call>` — <what this source contributed>
- `<file path or skill call>` — <what this source contributed>
- ...

## Caveats

- <any ambiguity, conflicting information, assumption, or "not found" note>
- <if none, write: "None.">
```

### Example

```markdown
## Answer

`update_shipment_status_flow` updates a shipment's `Status` field via the
Footprint API. It accepts `shipmentId: string` and `newStatus: ShipmentStatus`
and returns `{ success: boolean, message: string }`. The function calls
`PATCH /api/Shipments({shipmentId})` with `{ Status: newStatus }`.

## Sources

- `dxs source explore config update_shipment_status_flow --branch <id>` —
  extracted code from `nodes[0].stepConfig.executeCodeConfig.code`; parameter
  list and return shape on the top-level JSON.
- `dxs source explore config shipment-customType --branch <id>` —
  `ShipmentStatus` enum values: `Open`, `InProgress`, `Closed`, `Cancelled`.
- `schema-explorer` (entity `Shipments`) — confirmed `Status` is an
  enum-backed string property, not a navigation.

## Caveats

- The flow's JSDoc says it returns `void`, but the actual code returns
  `{ success, message }`. The JSDoc appears stale.
- `CLAUDE.md` lists a fifth status `Voided`; not present in
  `shipment-customType.json`. Type file wins.
```

## Output Contract

A single response containing the three sections above. No file writes, no state mutations, no follow-up commands run on behalf of the consumer.

The consuming skill is responsible for deciding what to do with the answer. This skill's only job is to make the current state of the codebase legible.
