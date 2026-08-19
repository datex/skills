---
name: footprint-workflows
description: |
  Use when authoring or modifying a Datex Studio footprint-workflow
  (configurationTypeId=23, CLI type `footprintworkflow`, conventional
  -footprintWorkflow.json suffix) on a branch — a low-code TypeScript
  implementation that plugs into a named Footprint platform workflow
  extension point (Cartonization, Entity Status Change (Before Commit),
  Allocation Strategy, Recommend License Plate Location, Barcode Parser, …).
  Owns the platform-fixed signature contract (single `Input:
  FootPrintWorkflow.<Slot>InputBaseWL`, slot-dictated out-params), the slot
  binding (workflowDefinitionId/Name discovered via the workflowsMetadata API;
  workflowGUID is the code callers pass: generate fresh for a new workflow,
  preserve on edits, reuse the legacy value for a drop-in replacement),
  the action-tier calling rules, and the thin-dispatcher pattern. Triggers:
  "create/edit a footprint workflow", "implement the Cartonization workflow",
  "customize entity status change before commit", "allocation strategy
  workflow", "recommend location workflow", "what dxs commands manipulate
  Footprint workflows", "replace the legacy XAML Datex Workflow with
  TypeScript".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - action-creator
  - function-creator
  - datasource-creator
  - type-definition-creator
  - impact-analysis
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Footprint Workflows

Author or modify a Datex Studio footprint-workflow (`configurationTypeId: 23`) on a branch — a low-code TypeScript implementation that the **Footprint platform invokes at a named extension point** in its own processing (before an entity status commits, while cartonizing, while planning allocation, while recommending a location, …). It is the modern replacement for the legacy XAML "Datex Workflow" activities. The platform owns the slot, the GUID, and the input/output contract; **you own the body**.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/footprint-workflows.md](references/footprint-workflows.md) — Authoritative reference: body shape, the slot binding + workflowsMetadata discovery, the fixed param contract, per-slot field breakdowns, the extension-point catalog, code patterns, CLI lifecycle, pre-flight checklist
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — The `get -O envelope → jq .json → upsert -D` round-trip and the silent-wipe bug it avoids
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table, code-string editing rules, the `return;`-with-outParams rule
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_workflow` suffix preference; backend types are not bound by the display-name rule
- [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md) — cross-cutting checks every component must pass
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — execution-tier rules; workflow runs action-tier (calls actions via `$flows`, reads `fpds`, no `$db`, no functions)
- [../datex-studio-shared/flow-code-patterns.md](../datex-studio-shared/flow-code-patterns.md) — `$utils.isDefined`, date defaulting, and other flow-code idioms
- [../action-creator/references/actions.md](../action-creator/references/actions.md) — actions are the dispatch target the workflow body calls; same Footprint-server tier
- [../datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) — `fpds_*` footprint-datasources the workflow reads (action-tier)

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in context (which slot, what the custom behavior is, what it dispatches to, which package).
- **`action-creator`** skill — invoked to author the **package actions** the workflow body dispatches to. Keep the workflow node a thin dispatcher; real logic lives in actions (same Footprint-server tier).
- **`function-creator`** skill — invoked when the dispatched logic is better expressed as a function wrapped behind an action (workflows can't call functions directly).
- **`datasource-creator`** skill — invoked when the workflow reads configuration/state through a `fpds_*` footprint-datasource.
- **`type-definition-creator`** skill — invoked when the dispatch targets need package interfaces/enums (the `FootPrintWorkflow.*` input/result types are platform-owned and read from `contexts`, not authored).
- **`impact-analysis`** skill — invoked before changing a workflow that other code depends on, or before renaming the actions/datasources it dispatches to; trace `$flows.<Package>.<action>` call sites rather than grepping inline.

## CLI Lifecycle

Workflow authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. **There is no `dxs workflow` subcommand** and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The CLI type identifier is **`footprintworkflow`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), mapping to `configurationTypeId: 23`. PublishedMain configs are `readonly: true` — author on a **feature branch**.

**New workflow — discover the slot from the metadata API, assign a fresh GUID** (replacing a legacy
workflow instead? reuse its GUID — see step 2):

```bash
# 1. Discover the slot: id (= workflowDefinitionId), name, exact inParams/outParams
dxs api GET "/footPrintApiConnections/byName/<connectionName>/workflowsMetadata?applicationId=<branchId>" --raw -O meta.json
jq '.workflowsMetadataJson.workflowDefinitions[] | select(.name=="Cartonization")' meta.json
# 2. Generate a fresh workflowGUID for this new config (new capability; you point callers at it).
#    Superseding a legacy workflow on this slot? Reuse ITS GUID instead so existing callers keep working.
python3 -c "import uuid; print(uuid.uuid4())"
# 3. Build body.json: apiSettingName + workflowDefinitionId/Name (step 1) + your fresh GUID,
#    the slot's inParams/outParams verbatim, configurationTypeId:23, id:0, your referenceName/title/description/code
# 4. (Optional) read Input/result field shapes — contexts OR meta.json `types`
dxs configuration contexts footprintworkflow -b <branchId> -D body.json
# 5. Validate + upsert
dxs configuration validate footprintworkflow -b <branchId> -D body.json
dxs configuration upsert  footprintworkflow -b <branchId> -D body.json
```

**Edit an existing workflow (round-trip — never skip the jq extract):**

```bash
dxs configuration get footprintworkflow <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json          # EXTRACT THE INNER BODY (round-trip footgun guard)
# ... edit nodes[0].stepConfig.executeCodeConfig.code ...
dxs configuration validate footprintworkflow -b <branchId> -D body.json
dxs configuration upsert  footprintworkflow -b <branchId> -D body.json
```

### Round-trip rule (critical)

Never pipe `envelope.json` directly into `dxs configuration upsert` — it silently destroys config content (the envelope carries `id`/`jsonString`/`version`/… that `upsert -D` doesn't expect). Always `jq .json envelope.json > body.json` first. The envelope also carries **Azure app-registration secrets** in `application.applicationDefinition` — the `jq .json` extract drops them; never commit `envelope.json`. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md).

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection (feature branch — main is readonly)
        |
[requirements brief in context?]
  YES -> use it     NO -> invoke `requirements-gathering`
        |
[Phase 2: Identify the platform slot]
Pick the extension point (Cartonization, Entity Status Change (Before Commit),
Allocation Strategy, Recommend* , Barcode Parser, ...). Consult
references/footprint-workflows.md -> Extension-Point Catalog.
If nothing in the platform *calls* the slot -> a workflow config is inert; stop.
        |
[Phase 3: Bind to the slot]
Pull the workflowsMetadata API for the connection/branch -> copy the slot's
id (=workflowDefinitionId), name, and inParams/outParams VERBATIM. Never
invent the id/name. workflowGUID is NOT in the metadata — it is the code callers
pass: generate fresh for a NEW workflow, preserve it on edits, and reuse the
legacy GUID when shipping a drop-in replacement for an existing workflow.
        |
[Phase 4: Author the body]
Build body.json:
  - Slot binding (Phase 3): apiSettingName + workflowDefinitionId/Name +
    your workflowGUID + configurationTypeId:23 + start:"step1"
  - Fixed param contract: single Input: FootPrintWorkflow.<Slot>InputBaseWL;
    out-params exactly as the slot dictates (or [] for before-commit mutation)
  - Single ExecuteCodeActivity node; code is a THIN DISPATCHER to package
    actions ($flows.<Pkg>.<action>) and fpds reads; map results into
    $flow.outParams; action-tier rules (no $db, no functions)
  - id:0, accessModifier:public, description <=100 chars, vars/events null
        |
[Phase 5: Discover types + validate]
dxs configuration contexts footprintworkflow -b <branchId> -D body.json
  -> confirm $types.FootPrintWorkflow.<X>InputBaseWL + result fields you use
dxs configuration validate footprintworkflow -b <branchId> -D body.json
        |
[Phase 6: Push]
   CREATE -> dxs configuration upsert footprintworkflow -b <branchId> -D body.json
   MODIFY -> get -O envelope -> jq .json -> edit -> upsert (round-trip)
        |
[Phase 7: Verify (optional)]
Exercise the slot in the running platform; confirm the workflow is invoked and
the result/mutation lands. Re-fetch (jq .json) and diff against body.json.
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md). **Never assume a branch id** — confirm with the user, or run `dxs source branch list --all-repos --status feature` for selection. Author on a **feature branch**; PublishedMain workflow configs are `readonly: true`.
2. Check for a **requirements brief** in context. The brief should establish: which platform slot, the custom behavior, what package actions/datasources it dispatches to, and the target package. No brief → invoke `requirements-gathering`.

### Phase 2: Identify the platform slot

A footprint-workflow only runs if the Footprint platform *calls* its slot. Consult [references/footprint-workflows.md → Purpose & When to Use](references/footprint-workflows.md#purpose--when-to-use) and the [Extension-Point Catalog](references/footprint-workflows.md#extension-point-catalog). If the desired behavior isn't triggered by one of the named workflow slots, this is the wrong component type — a plain action/function/datasource is what's needed. If the signature should be *yours* to design, it's a function/action, not a workflow.

### Phase 3: Bind to the slot

The slot binding has two independent parts:

1. **Slot identity + signature (from the platform).** Pull the [workflowsMetadata API](references/footprint-workflows.md#discovering-the-slot-catalog-authoritative-source) for the Footprint connection and branch:
   ```bash
   dxs api GET "/footPrintApiConnections/byName/<connectionName>/workflowsMetadata?applicationId=<branchId>" --raw -O meta.json
   jq '.workflowsMetadataJson.workflowDefinitions[] | {id, name, inParams, outParams}' meta.json
   ```
   Copy the slot's `id` → `workflowDefinitionId`, `name` → `workflowDefinitionName`, and its `inParams`/`outParams` **verbatim**. `<connectionName>` is a real Footprint connection (e.g. `DSV`), not the `apiSettingName` value. Set `apiSettingName` from the branch's Footprint setting. **Never invent the id/name.**
2. **`workflowGUID` (the code callers pass).** It is **not** in the metadata, so nothing in the catalog dictates it — but callers do: the value reaches the server as `ProcessingStrategyWorkflowCode` / `AllocationStrategyWorkflowId` and selects which implementation of the slot runs. **Generate a fresh v4 UUID** for a genuinely new workflow (`python3 -c "import uuid; print(uuid.uuid4())"`) and then point the callers at it; **preserve the existing GUID unchanged** when editing (the `jq .json` round-trip keeps it); **reuse the legacy GUID** when your config is a drop-in replacement for an existing implementation whose callers must not change. Never regenerate on an edit.

### Phase 4: Author the body

Build `body.json` from [references/footprint-workflows.md → Minimal Valid Skeleton](references/footprint-workflows.md#minimal-valid-skeleton). Key points:

1. **File basics** per the **Pre-Flight Checklist** below + [universal checklist](../datex-studio-conventions/universal-checklist.md): `configurationTypeId: 23`, `id: 0`, `description` ≤ 100 chars, `accessModifier` set, package matches the feature.
2. **Param contract is the platform's, not yours.** Single `Input` in-param typed `FootPrintWorkflow.<Slot>InputBaseWL`; out-params exactly as the slot dictates (one object, a collection, or `[]` for before-commit mutation). Don't rename `Input`, add params, or change the out-param shape.
3. **Single `ExecuteCodeActivity` node.** `start: "step1"`, node `id: "step1"`, `decisionConfig: null`. Multi-node graphs are possible but unused in the library — single step unless you have a concrete reason.
4. **Code is a thin dispatcher.** Translate `$flow.inParams.Input` into `$flows.<Package>.<action>` calls and `fpds` reads; map results onto `$flow.outParams.<Name>`. Action-tier rules: no `$db`, no direct function calls, `fpds` (not cloud `-datasource.json`). Declared-`outParams` slots use `return $flow.outParams;`, never bare `return;`. See [references/footprint-workflows.md → Code Patterns](references/footprint-workflows.md#code-patterns--the-body-is-a-thin-dispatcher).
5. **`vars` / `events` / `fromBaseConfiguration` stay `null`.**

### Phase 5: Discover types + validate

```bash
dxs configuration contexts footprintworkflow -b <branchId> -D body.json
dxs configuration validate footprintworkflow -b <branchId> -D body.json
```

`contexts` returns the `$types.FootPrintWorkflow.*` IntelliSense surface, and its `flowContext` echoes your declared signature as a typed `IFlow` — a quick check that `$flow.inParams.Input` / `$flow.outParams.*` resolve to the slot's types. Confirm every field you reference exists (don't hand-roll the platform types). Three discovery sources, by need (see [references → Discovering the type surface](references/footprint-workflows.md#discovering-the-type-surface)):

- **`FootPrintWorkflow.*` platform types** (the `Input`/result shapes) — `contexts`, or the `workflowsMetadata` API's `types` array (structured JSON, easier to query).
- **`$types.<Package>.*` package types** your dispatch code uses (e.g. `$types.Utilities.e_awi_scopes.Cartonization`) — `dxs configuration nomenclature -b <branchId>` (filter with `--package`/`--kind enum`/`--search`; enums list members in `constantValues`).

`validate` catches structural/required-field errors but **not** a wrong slot binding (`workflowDefinitionId`/name), a signature that doesn't match the slot, or action-tier violations — walk the Pre-Flight Checklist for those.

### Phase 6: Push

```bash
# New
dxs configuration upsert footprintworkflow -b <branchId> -D body.json
# Modify-existing (round-trip — never skip the jq extract)
dxs configuration get footprintworkflow <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit ...
dxs configuration upsert footprintworkflow -b <branchId> -D body.json
```

### Phase 7: Verify (optional)

Exercise the slot in the running platform — trigger the entity status change / cartonization / allocation / location-recommendation and confirm the workflow is invoked and the result or before-commit mutation lands as intended. If the app isn't available, re-fetch the config (`jq .json` extract) and diff against `body.json` to confirm the push landed.

## Pre-Flight Checklist

Walk the full list in [references/footprint-workflows.md → Pre-Flight Checklist](references/footprint-workflows.md#pre-flight-checklist). Fast version:

1. **`configurationTypeId: 23`**; conventional suffix `-footprintWorkflow.json`.
2. **Slot binding real** — `workflowDefinitionId` + `workflowDefinitionName` copied from the workflowsMetadata catalog; `apiSettingName` matches the branch's Footprint setting.
3. **`workflowGUID` correct** — fresh v4 UUID (new workflow, callers repointed), the unchanged existing value (edit), or the legacy workflow's GUID (deliberate drop-in replacement). Never regenerated on an edit.
4. **Param contract matches the slot** — single `Input` typed with the slot's input type (usually `FootPrintWorkflow.<Slot>InputBaseWL`); out-params exactly as the slot dictates (or `[]`).
5. **`description` ≤ 100 chars, non-empty;** `accessModifier` set; `id: 0` for net-new.
6. **Single `ExecuteCodeActivity` node;** `start` points at its `id`; `vars`/`events`/`fromBaseConfiguration` `null`.
7. **Action-tier compliant code** — `$flows.<Pkg>.<action>` (no functions, no `$db`), `fpds` reads, `$types.FootPrintWorkflow.*`, `$utils.isDefined`; declared-`outParams` → `return $flow.outParams;`.
8. **Types verified** against `contexts` or the metadata `types`.
9. **Validated** against the branch.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Invented or mismatched `workflowDefinitionId` / `workflowDefinitionName` | Pull the slot's `id`/`name` + `inParams`/`outParams` from the `workflowsMetadata` API and copy verbatim. A wrong/mixed id+name validates clean but never wires. |
| Regenerated `workflowGUID` on an edit, or cloned one from an unrelated config | The GUID is what callers pass to select this workflow (not part of the slot binding). Fresh v4 UUID for a new workflow (`python3 -c "import uuid; print(uuid.uuid4())"`); preserve unchanged on edits. Copying a GUID is correct in exactly one case — a drop-in replacement for the workflow that owns it. |
| Renamed `Input`, added in-params, or changed the out-param shape | The slot owns the signature. Keep single `Input: FootPrintWorkflow.<Slot>InputBaseWL` + the slot's exact out-params (or `[]`). Mismatch validates clean, breaks the invoke. |
| Hand-wrote interfaces for the `Input`/result | Read real shapes from `dxs configuration contexts footprintworkflow -D body.json`; reference `$types.FootPrintWorkflow.*`. |
| Called a function or used `$db` from the workflow | Action-tier: call actions via `$flows.<Pkg>.<action>`; wrap function/`$db` logic behind an action; use `fpds`, not cloud datasources. |
| Bare `return;` in a slot that declares `outParams` | Use `return $flow.outParams;` — bare `return;` breaks the generated body; Validate misses it, Preview catches it. |
| Piped `get -O envelope.json` straight into `upsert -D` | `jq .json envelope.json > body.json` first — the envelope wipes content and carries secrets. |
| Raw find/replace on the minified `code` string | Edit via Python `json.load`/`json.dump`; build with `\r\n` joins; never restructure surrounding JSON. |
| Deep business logic inline in the node | Keep the node a thin dispatcher to package actions; matches the library, stays maintainable. |
| Authored against PublishedMain | Main is `readonly: true`. Author on a confirmed feature branch (never guess the id). |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
