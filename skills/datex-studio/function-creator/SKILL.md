---
name: function-creator
description: |
  Use when creating or modifying Wavelength functions (configurationTypeId=9)
  on a Datex Studio branch. Covers the full lifecycle: requirements, intellisense,
  code authoring, validation, and upload. Trigger for: "create a function",
  "modify a function", "update fn_xxx", "write a function that does X",
  "add a parameter to fn_xxx", "change the function code".
---

# Function Creator

Create new Wavelength functions or modify existing ones on a Datex Studio branch.

## References

- [../shared/branch-setup.md](../shared/branch-setup.md) -- Branch & connection selection (shared across skills)
- [references/command-syntax.md](references/command-syntax.md) -- All `dxs function` commands with examples
- [references/flag-guide.md](references/flag-guide.md) -- When/why/how for each flag
- [references/code-patterns.md](references/code-patterns.md) -- Common patterns for function code

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`impact-analysis`** skill — invoked when modifying input/output parameters of an existing function

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]
  +-----+-----+
  |            |
 YES          NO
  |            |
 use it    invoke `requirements-gathering` skill
  |            |
  +-----+------+
        |
[determine intent: create or modify?]
        |
  +-----+-----+
  |             |
CREATE        MODIFY
  |             |
 determine    dxs function get <ref> --branch <id>
 ref name     extract code from stepConfig.executeCodeConfig.code
 + params     write to temp .ts file
  |             |
  +------+------+
         |
[Phase 2: Intellisense]
dxs function context <config.json> --branch <id>
         |
[Phase 3: Signature Safety -- modify only]
If input/output params are changing:
  invoke impact-analysis skill
  only continue if no callers or user approves
         |
[Phase 4: Code]
Write or update TypeScript code in temp .ts file
         |
[Phase 5: Generate + Validate + Upload]
dxs function generate ... --code-file <file.ts> -o <config.json>
dxs function validate <config.json> --branch <id>
dxs function upsert <config.json> --branch <id>
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [branch-setup.md](../shared/branch-setup.md) for branch/connection selection
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill)
   - **Requirements brief exists** — use it. The brief provides the intent, expected inputs/outputs, and business rules.
   - **No requirements brief exists** — invoke the `requirements-gathering` skill first. This ensures the agent understands what the function should do (create) or what changes are needed (modify) before touching code.
3. Determine intent: create new or modify existing?

**Create flow (continued):**
4. Determine reference name (valid JS identifier — convention: `fn_` prefix, e.g., `fn_sum`, `fn_process_order`)
5. Determine input/output parameters from the requirements brief

**Modify flow (continued):**
4. Fetch the existing function: `dxs function get <ref_name> --branch <id>`
5. Extract the current code from `stepConfig.executeCodeConfig.code` in the response JSON
6. Write the code to a temporary `.ts` file for editing
7. Note the current input/output parameters for signature change detection

### Phase 2: Intellisense

Run `dxs function context <config.json> --branch <id>` to get the full type system. This returns:

- **`flowContext`** — the function's own `$flow.inParams` and `$flow.outParams` types
- **`appContext`** — the full branch catalog with typed signatures for all available services:
  - `$flows.*` — other functions on the branch
  - `$datasources.*` — datasources with get/getList/getByKeys methods
  - `$reports.*` — reports with export methods
  - `$apis.*` — Footprint API actions
  - `$db.*` — storage service
  - `$services.*` (aliased from `$backendServices`) — email, analytics, jobs, xml, logging
  - `$shell.*` — UI navigation
  - `$settings.*` — app settings
  - `$operations.*` — operations
  - `$auth.*` — auth service
  - `$connectors.*` — SFTP, AMQP, TCP connectors
  - `$types.*` / `_types.*` — custom types and workflow types
  - `$context.*` — execution context (org, app, env)
  - `$global.*` — global reports and connectors
- **`globalContext`** — runtime utilities: `$utils` (http, date, odata, excel, blob), UI control interfaces, enums

**For create:** Run `dxs function generate --code-file <placeholder.ts> -r <name> -t "<title>" -d "<desc>" --in-param <params> --out-param <params> -o <config.json>` with a placeholder code file (e.g., containing just `// placeholder`), then run context on the resulting JSON to get the type system before writing actual code.

**For modify:** The fetched config JSON from `dxs function get` can be saved to a file and used directly with the context command.

### Phase 3: Signature Safety (modify only)

If the modification changes input or output parameters:
1. Invoke the **impact-analysis** skill with the function's reference name
2. If callers exist, present them and ask the user whether to proceed
3. If proceeding, the agent must update all affected callers after modifying the function

### Phase 4: Code

Write or update the TypeScript code in a temp `.ts` file. Use the intellisense data from Phase 2 to:
- Reference other functions, datasources, reports, etc. with correct types
- Use `$flow.inParams.*` and `$flow.outParams.*` correctly
- Access runtime services (`$utils`, `$services`, etc.)

See [code-patterns.md](references/code-patterns.md) for common patterns.

### Phase 5: Generate, Validate, Upload

```bash
# Generate the config
dxs function generate \
  --code-file <file.ts> \
  -r <reference_name> \
  -t "<title>" \
  -d "<description>" \
  --in-param <name>:<type> \
  --out-param <name>:<type> \
  -o <config.json> \
  --branch <id>

# Validate
dxs function validate <config.json> --branch <id>

# Upload
dxs function upsert <config.json> --branch <id>
```

## Naming Convention

- Reference names must be valid JS identifiers (start with letter/`_`/`$`, no spaces/hyphens)
- Convention (not enforced): `fn_` prefix for functions (e.g., `fn_sum`, `fn_validate_order`). The CLI accepts any valid JS identifier.
- Title (`-t`) is a human-readable display name — can differ from reference name

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `return` to set output | Assign to `$flow.outParams.*` instead — functions don't use return values |
| Wrong scoping on `$datasources` or `$flows` | Module code requires module prefix (`$datasources.ModuleName.ds_name`). App code referencing its own configs does not (`$datasources.ds_name`). Always check the `appContext` types from `dxs function context` to determine the correct path. |
| Changing params without checking callers | Always invoke impact-analysis skill first when modifying input/output params |
| Guessing available services from memory | Always run `dxs function context` — the type system varies by branch and app |
| Using `$item` instead of `$entity` | The expression variable is `$entity` in Wavelength |
| Code file exceeding 512 KB | Split logic into multiple functions or extract helpers |
