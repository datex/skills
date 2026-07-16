# File Format

A component's JSON body is its canonical shape. The platform generates TypeScript from it at import; the JSON schema is sacred and must not be restructured.

> **Source of truth = the branch, via the `dxs` CLI.** A component is identified by its **`referenceName` suffix** and **CLI type** (the table below), not by a local file path. You fetch a component with `dxs source explore config` / `dxs configuration get -O envelope.json` → `jq .json` and push it back with `dxs configuration upsert` (see `../datex-studio-shared/configuration-roundtrip.md`). The `src/<type>/…` paths shown below are the *conventional local-export layout* (e.g. what `dxs source document build` mirrors to disk) — handy for orientation, but never the system of record. Don't grep a local `src/` tree to discover or read components; query the branch.

## Component Types and Suffixes

(`src/<type>/` paths are the conventional export layout only — see the source-of-truth note above.)

- **Action**: `-footprintFlow` suffix, CLI type `footprintflow` (conventionally `src/actions/`) — JSON with code embedded as a string at `nodes[0].stepConfig.executeCodeConfig.code`. Components named `footprintFlow` are called **actions** (not functions). Functions are a separate, structurally different component type.
- **Function**: `-flow` suffix, CLI type `flow` (conventionally `src/functions/`) — same JSON structure but different component type.
- **Types**: `-customType` suffix, CLI type `customtype` (conventionally `src/types/`) — JSON definitions for interfaces and enums.
- **Datasources**: two component variants — `-datasource` / CLI type `datasource` (platform backend) and `-footprintDatasource` / CLI type `footprintdatasource` (Footprint server). Each variant can carry either query type (OData or flow). See [datasources.md](../datasource-creator/references/datasources.md) for the full taxonomy.
- **Selector**: `-selector` suffix, CLI type `selector` (conventionally `src/selectors/`) — datasource-backed dropdown/autocomplete controls.
- **Backend-test**: `-backendTest` suffix, CLI type `backendtest` (conventionally `src/backend-tests/`) — mocha test suites with four hook flows (`before_suite` / `after_suite` / `before_each` / `after_each`) and a `testCaseFlows` collection. See [backend-tests.md](../backend-test-creator/references/backend-tests.md).

## Editing Rules

- When editing the code string inside the JSON, preserve existing escaping conventions (e.g. `\r\n` for newlines, `\"` for quotes). Inspect the file to confirm the escaping style before editing.
- **Preferred editing method**: Use `json.load` / `json.dump` in Python to safely read and modify the code string, rather than raw string replacement on the file. The decoded code string uses `\r\n` (CR+LF) line endings — build replacement strings with `\r\n` joins. Raw file manipulation is fragile because the JSON escaping layer (`\\r\\n` in the file vs `\r\n` in the decoded string) makes it easy to corrupt the file.
- **Never restructure the JSON schema** — only modify the `code` string value within the existing structure.
- **`description` length limit**: The Footprint platform stores component `description` values in a SQL column capped at 100 characters. This applies to all component types (actions, functions, interfaces/customTypes, etc.). Imports fail with a SQL truncation error if exceeded. Keep descriptions ≤ 100 characters.

## `configurationTypeId` Reference

Every component JSON carries a numeric `configurationTypeId` identifying its component kind. The observed values:

| ID | Component | File suffix |
|---|---|---|
| 2 | Hub | `-hub.json` |
| 3 | Grid | `-grid.json` |
| 4 | Editor | `-editor.json` |
| 5 | Form | `-form.json` |
| 6 | Datasource | `-datasource.json` |
| 7 | Selector | `-selector.json` |
| 9 | Function (top-level) **or** embedded flow step node | `-flow.json` (top-level); n/a (embedded) |
| 17 | Storage | `-storage.json` |
| 18 | Action (top-level) | `-footprintFlow.json` |
| 19 | Footprint-datasource | `-footprintDatasource.json` |
| 20 | Embed | `-embed.json` |
| 22 | Custom type (interface or enum) | `-customType.json` |
| 23 | Footprint-workflow | `-footprintWorkflow.json` |
| 24 | Backend-test | `-backendTest.json` |

`configurationTypeId: 9` is shared between top-level function files and embedded step nodes inside any flow's `nodes[]` — the file suffix (`-flow.json` vs no file) is the distinguisher. Actions use a different top-level id (`18`), so action vs function top-level files are unambiguously identifiable by `configurationTypeId` alone.

**Wrong cti is a Validate-clean / Preview-broken failure mode.** A component file whose `configurationTypeId` doesn't match its suffix (e.g. a `*-form.json` carrying `cti: 1` instead of `5`) imports without error and passes Studio's `Validate` cleanly. But codegen reads `configurationTypeId` to decide which method stubs to emit on the package-level service classes (`$shell.<Pkg>.openXxxFormDialog`, etc.). The wrong cti produces malformed stubs, which then cause TS1128 / "Cannot find name" cascades in every editor / hub / flow that calls the component. Symptom: Validate green, Preview red with the cascade rooted in code that NEVER touched the malformed file. Mitigation: when adding new component files, always copy the cti from another working component of the same type — don't guess, and don't trust Studio's import to coerce it.

## Declarative String Values Are TypeScript Expressions

Many JSON string fields across component files (forms, grids, selectors, datasources, hubs, editors) aren't plain text — they're **raw TypeScript expressions** the code generator inlines into generated component classes. The JSON string value is emitted verbatim into TS. This applies to fields like `controlConfig.*.value`, `controlConfig.*.tooltip`, `controlConfig.*.placeholder`, `dateBoxConfig.format`, `textConfig.value`, **fieldset `info`** (the help text rendered above a fieldset), filter and expand expression `value`s, and similar "display/runtime" string slots.

Three encodings, applied inside the JSON value:

| You want to produce in TS | Write in JSON |
|---|---|
| A plain string literal (e.g. `'MM/DD/YYYY'`) | `"'MM/DD/YYYY'"` — include the TS quotes inside the JSON string |
| A template literal for display text (e.g. `` `Start date` ``) | `` "`Start date`" `` — wrap in backticks inside the JSON string |
| A raw expression (e.g. `$form.inParams.foo?.bar`) | `"$form.inParams.foo?.bar"` — no extra wrapping; the JSON string *is* the expression |

An unwrapped plain-English tooltip like `"Opens the dialog."` compiles as bare TypeScript tokens (`Opens`, `the`, `dialog`) and breaks the build with "Cannot find name" errors. When in doubt, inspect a working component of the same type and match its escaping exactly.

**Specific tokens that break unwrapped text** (any one is enough to fail codegen):

- A semicolon `;` mid-sentence (`"…wins; tiebreak…"`) — terminates the expression early; everything after parses as orphan top-level statements.
- A bare-word followed by `:` near the start (`"v2: per-candidate score weights…"`) — parses as a labeled statement; the rest becomes loose identifiers.
- An unwrapped pipe `|` (`"include | exclude | demote"`) — parses as a union/OR at type or value level; runs into syntax errors when chained.
- A backtick at the value boundary with `|` inside (`` "`include | exclude | demote`" ``) — backticks open a template literal, but the `|` inside might still be misparsed downstream. Backtick-wrapped values are fine for plain `Display Text` but avoid them for delimiter-style listings.

**Symptom pattern**: when the broken value is in a component that's referenced from elsewhere (or compiled in a class with multiple methods), the FIRST error in the Preview Frontend console output is the root cause. The visible last-error line is usually the cascade endpoint — TS recovers from the parse failure many lines later. Always read the full error stream, not just the truncated tail.

**Recovery for plain-text content**: wrap the value in single quotes inside the JSON string — `"info": "'v2: per-candidate score weights. Higher final score wins, tiebreak on smaller delta.'"`. The leading `'` makes it a TS string literal, so semicolons / colons / pipes inside become inert text. Replace any unavoidable `;` with `,` or rephrase, and avoid unwrapped pipes — even inside a string, downstream interpolation (e.g. into UI templates) can re-tokenize them.

A `tooltip` field left `null` falls back to the element's display value (label, text, etc.). That's almost never what you want — the tooltip just repeats what's already on screen. When there's no useful tooltip, set it to the empty-string TS literal `"''"` to suppress the fallback. Same rule for any tooltip-capable field across forms, grids, editors, and selectors.

Fields that are treated as plain string metadata (not emitted as TS) — e.g. component `description`, `title`, `label`, field `label` — do **not** need this wrapping. The distinction: if a value ends up inside a generated method body or decorator argument that's expected to be evaluated, it's an expression; if it's stored as a string property on config objects, it's plain text. Component docs call this out on a per-field basis.

## Dynamic Tooltip Values Go Through a Var

Flow code **cannot set a field's `tooltip` directly**. Assignments like `$form.fields.x.control.tooltip = "…"` (or `$hub.filters.x.control.tooltip`, `$editor.fields.x.control.tooltip`, `$grid.headers.x.tooltip`, etc.) do not reach the rendered control — the `tooltip` slot is evaluated from the declarative expression in the component JSON, not from the runtime control surface.

To make a tooltip change at runtime:

1. **Declare a var** on the container — `$form.vars.<name>` / `$hub.vars.<name>` / `$editor.vars.<name>` / `$grid.vars.<name>` — typed `string`. Declaration goes in the component's top-level `vars` array per [`component-wiring.md` → Component Variables Must Be Declared](../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared).
2. **Bind the field's `tooltip` slot to the var** as a TS expression: `"tooltip": "$form.vars.enabled_tooltip"` (no backticks — it's a raw expression, not display text).
3. **Assign the var in flow code** (typically `on_init` or a validation flow): `$form.vars.enabled_tooltip = \`The engine was enabled from the "${appName}" app.\`;`. The declarative binding re-reads the var and the rendered tooltip updates.

This applies globally — forms, hubs, editors, grids, selectors, any tooltip-capable control. The same pattern covers other declarative slots that flow code can't write through directly (e.g. dynamic `placeholder`, dynamic field `label`): route through a var, bind the slot as a TS expression.

Static tooltips are unaffected — keep setting them in the JSON's `tooltip` slot per the encoding rule above.

## Flow `return;` Requires Outparams Be Undeclared

A flow's `executeCodeConfig.code` body is wrapped by codegen into an async method whose return type depends on the flow's top-level `outParams` declaration. The wrapping is silent: it doesn't appear in any JSON field.

| Flow shape | Valid early-exit in code | Invalid |
|---|---|---|
| `outParams: null` or `outParams: []` | `return;` — exits the void method | `return $flow.outParams;` — also OK but verbose |
| `outParams: [{id: "results", …}, …]` | `return $flow.outParams;` — exits and yields the accumulated outparams | `return;` — produces a syntactically broken function body; codegen emits a `return;` inside a non-void method ❌ |

The asymmetry is one-directional: bare `return;` is fatal **only** when outParams is declared. The reverse (`return $flow.outParams;` in a void-returning flow) merely returns an empty object, which is harmless.

**Where this bites:** actions and functions that accumulate results into `$flow.outParams.<field>` across nested logic and then need an early exit for "empty input" or "no work to do." The natural early-exit is `if (requests.length === 0) { return; }` — that breaks the build the moment outParams is declared, and Validate doesn't catch it (only Preview does).

**Recovery**: replace any bare `return;` inside an outparam-declaring flow with `return $flow.outParams;`. Implicit fall-through at the end of the function is fine — codegen handles that case; only explicit `return;` statements are problematic.

Arrow-function returns inside the flow body — `[1,2,3].filter(x => { if (x < 0) return false; return true; })` — are different mechanism (they exit the arrow body, not the outer flow method) and are unaffected by this rule. Only `return` statements at the flow's top scope matter.

## TypeScript Strictness Inside Flow Code

The platform compiles every `executeCodeConfig.code` body as TypeScript with stricter inference than typical browser TS. A few recurring patterns trip the operator type-check even though the same code passes in a normal `tsc` run:

**`new Map(...)` constructed from an `any`-typed source.** Example:

```ts
const pkgLookup = new Map(material.PackagingLookups.map(p => [p.PackagingId, p.BasePackagingQuantity]));
// ...later...
const total = q.packaged_amount * (pkgLookup.get(q.packaging_id) ?? 1);  // ❌ operator error
```

`material` is `any`, so each `p.BasePackagingQuantity` is `any`, but the platform's TS narrows the inferred Map value type beyond `any` and `pkgLookup.get(...)` returns something that doesn't satisfy `BinaryOperationOperand`. The fix is an explicit annotation:

```ts
const pkgLookup: Map<number, number> = new Map(material.PackagingLookups.map(p => [p.PackagingId, p.BasePackagingQuantity]));
```

**Helpers that wrap `any`-typed mock data.** When a test helper returns `any` and the caller does arithmetic on a property of the returned value, the same narrowing can bite — `Type X is not assignable to BinaryOperationOperand`. Annotate the helper's return type explicitly (e.g. `function buildMockX(...): any { ... }`) so the caller sees `any` and arithmetic is permitted.

**Generic principle.** When platform-flow code does arithmetic, the operand types must be unambiguously `any`, `number`, `bigint`, or an enum type. If you see "right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type" at import time, the culprit is almost always an `unknown`-narrowed value reaching a `+` / `-` / `*` / `/` operator — fix by annotating the source variable explicitly.

**Datasource result types declare every property as optional.** The platform's generated types for `$datasources.<Pkg>.<X>.get(...).result` mark every property as `T?`. When you bind a datasource result to a typed local variable, your annotation must mirror that — strict properties produce a TS error at upload time:

```ts
// ❌ TS error: result rows declare these properties as optional
let rows: { LocationId: number, MinAmount: number }[] = (await $datasources.X.foo.get(...)).result ?? [];

// ✅
let rows: { LocationId?: number, MinAmount?: number }[] = (await $datasources.X.foo.get(...)).result ?? [];
for (const row of rows) {
    if (row.LocationId == null) { continue; }  // guard before passing to non-nullable APIs
    ...
}
```

Same rule for inline reads: `(await ...).result[0].Foo` returns `Foo | undefined`, not `Foo`.

**`const` and `let` declarations are in TDZ at script scope.** The code body of an action or function is script-level — there's no enclosing function. `function foo() {}` declarations hoist; `const`/`let` declarations do not. If a hoisted function captures a `const` declared *later* in source order, and that function is *called* before execution reaches the declaration line, you get `ReferenceError: Cannot access 'X' before initialization` at runtime.

```ts
//#region ALLOCATE
doWork();   // ❌ calls planReplenishmentWithRule which reads CAP -> ReferenceError
//#endregion
//#region FUNCTIONS
function planReplenishmentWithRule() { if (depth >= CAP) return; ... }
const CAP = 10;  // TDZ: never initialized by the time ALLOCATE called the function
```

**Rule of thumb:** every `const`/`let` that runtime code outside the FUNCTIONS region depends on must be declared in INITIALIZE or PREPARE GLOBAL DATA (i.e., *before* the ALLOCATE region executes). The order of `function` declarations doesn't matter; the order of `const`/`let` declarations does. Watch for `//#region` markers that sit inside `/* ... */` block comments — code "inserted near a region marker" can land inside a comment and silently never declare.
