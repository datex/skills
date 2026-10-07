---
name: code-editor-creator
description: |
  Use when authoring or modifying a Datex Studio code editor (configurationTypeId=21,
  *-codeEditor.json suffix, CLI type `codeeditor`) on a branch — a standalone dialog
  or view whose whole surface is one syntax-highlighted JSON or XML editor plus a
  toolbar. Owns the code-editor-vs-codeBox-vs-embed decision, the `mode` enum
  (`json` | `xml`), the `value` TS-expression binding, the beautify-on-init idiom,
  save-through-a-function, the `// @ts-ignore $codeEditor.close()` workaround for the
  missing typing, read-only-by-omitting-save, and the package-qualified
  `$shell.<Package>.open<ref>Dialog` opener (the same referenceName exists in several
  packages with divergent inParams). Triggers: "create a code editor", "view the JSON
  payload in a dialog", "show the raw XML", "payload viewer", "$codeEditor",
  "Property 'close' does not exist on type 'ICodeEditor'", "Mode is required",
  "Missing 'Click flow'", "the editor opens empty".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - form-creator
  - embed-creator
  - function-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Code Editor Creator

Author or modify a Datex Studio code editor (configurationTypeId=21) on a branch — a UI component whose entire surface is **one syntax-highlighted text editor** (`mode: "json"` or `"xml"`) with an optional toolbar. It is opened as a dialog (`$shell.<Package>.open<referenceName>Dialog(...)`) or as a view (`$shell.<Package>.open<referenceName>(...)`) to show, beautify, export, or edit a payload; edits are persisted by a toolbar flow that calls a function, never by an outParam round-trip.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/code-editors.md](references/code-editors.md) — Authoritative code-editor authoring reference: body shape, minimal-valid skeleton, `mode` enum, toolbar shape, `ICodeEditor` runtime surface, opener signatures, save/export/paging patterns, pre-flight checklist, failure modes
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule (applies to the top-level `value`)
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — type-indicator rule (`_code_editor`), filename-stem matching, display-name rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — UI-tier globals available in code-editor flows (`$shell`, `$flows`, `$utils`, ...) and `$shell` package scoping
- [../datex-studio-runtime/control-types.md](../datex-studio-runtime/control-types.md#codebox) — the `codeBox` field control, the in-form alternative
- [../form-creator/references/forms.md](../form-creator/references/forms.md) — pick a form (with a `codeBox` field) when the payload is one input among others or the caller needs values back
- [../embed-creator/references/embeds.md](../embed-creator/references/embeds.md) — pick an embed to render (not edit) HTML or an external page
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — opener contract, target-module rule, vars-must-be-declared rule

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`form-creator`** skill — invoked when the requirement is really a form: the payload is one field among others, or the caller needs typed values back from the dialog
- **`embed-creator`** skill — invoked when the requirement is to render HTML or an external page rather than show editable JSON/XML text
- **`function-creator`** skill — invoked to author the function the Save button calls (the code editor persists nothing itself)
- **`component-wiring-check`** skill — invoked to audit the opener's inParam contract and target package before push

## CLI Lifecycle

Code-editor authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs codeeditor` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`codeeditor`** (lowercase), mapping to `configurationTypeId: 21`.

**Create a new code editor:**

```bash
# 1. Build body.json from scratch (see references/code-editors.md → Minimal Valid Skeleton)
# 2. Validate — gates the push; exit 1 = errors found, not a broken CLI. Catches "Mode is required",
#    a bad mode value, and toolbar/init flowIds that name no flow
dxs configuration validate codeeditor -b <branchId> -D body.json
# 3. Create (upsert creates or updates by referenceName)
dxs configuration upsert codeeditor -b <branchId> -D body.json
```

**Edit an existing code editor:**

```bash
# 1. Fetch by NUMERIC id — note the envelope wrapper
dxs configuration get codeeditor <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate codeeditor -b <branchId> -D body.json
# 5. Push
dxs configuration upsert codeeditor -b <branchId> -D body.json
```

To see the generated `ICodeEditor` interface for a body (toolbar ids, flow methods, typed `inParams`/`vars`), run `dxs -O json configuration contexts codeeditor -b <branchId> -D body.json` and project `.configuration_contexts.designerContexts[] | select(.id=="codeEditorContext") | .text` — never print the multi-megabyte `appContext` entry.

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. Always `jq .json envelope.json > body.json` before editing. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Code editor vs codeBox vs embed]
Consult references/code-editors.md → "Purpose & When to Use":
  - view / beautify / export / edit ONE JSON or XML payload,
    in its own dialog or view                         -> code editor
  - the payload is one field among other inputs, or
    the caller needs typed values back                -> form + codeBox field (`form-creator`)
  - render HTML or an external page (read-only)       -> embed (`embed-creator`)
        |
[Phase 3: Find before you build]
Same referenceName may already exist in several packages with DIFFERENT inParams
(dxs source explore configs --branch <id> --type codeeditor). Reuse only after
reading the target package's opener signature.
        |
[Phase 4: Author the body]
  - mode: "json" | "xml"        (REQUIRED)
  - value: "$codeEditor.inParams.payload"  (raw TS expression) or "" when on_init sets it
  - toolbar[]: Beautify / Save / Export buttons; separators
  - flows[]: on_init (beautify + title) and one flow per clickFlowConfig.flowId
  - inParams[] / vars[]
  - Save? -> on_save awaits a $flows function with $codeEditor.value, then
             // @ts-ignore + $codeEditor.close()   (author the function via `function-creator`)
  - Read-only? -> no Save button (there is no readOnly key)
        |
[Phase 5: Validate + push]
dxs configuration validate codeeditor -b <branchId> -D body.json
dxs configuration upsert  codeeditor -b <branchId> -D body.json
        |
[Phase 6: Wire the opener + verify]
await $shell.<Package>.open<referenceName>Dialog({ payload, title }, 'flyout', EModalSize.Large)  // Promise<void>
Verify in Studio Preview: payload renders beautified; Save persists and closes
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Code editor vs codeBox vs embed

A code editor is a **whole component** dedicated to one text payload: it gets its own dialog or view, a toolbar, and the built-in `beautify()` / `minify()` helpers. Choose it for "show me the raw request", "let me fix this JSON config and save it", "download this payload". If the payload is **one field among others** (a form with a JSON settings field next to a name and a date), or the caller needs **typed values back** from the dialog, use a form with a `codeBox` field ([../datex-studio-runtime/control-types.md → codeBox](../datex-studio-runtime/control-types.md#codebox)) — no production code editor declares `outParams`, and their openers resolve `Promise<void>`. If the content is **HTML to render** or an external page, use an embed ([../embed-creator/references/embeds.md](../embed-creator/references/embeds.md)).

### Phase 3: Find before you build

Generic payload viewers are copied per package: the same `referenceName` (`view_json_payload`, `view_xml_payload`) exists in six or more packages, and the copies have **different inParam signatures** — one package's copy adds `id`, `application_name`, `storage` and saves through that package's message/log functions; another adds `id` and `disable_save`. Before reusing one, read the opener signature **in the package you will call**; never assume one copy's contract from another. Those legacy names also lack the `_code_editor` type indicator — call it out, don't replicate it (see [references/code-editors.md → File Location & Naming](references/code-editors.md#file-location--naming)).

### Phase 4: Author the body

Build `body.json` from [references/code-editors.md → Minimal Valid Skeleton](references/code-editors.md#minimal-valid-skeleton). Key points:

1. **File basics.** `configurationTypeId: 21`, conventional file name `<referenceName>-codeEditor.json`, `referenceName` ends `_code_editor` and matches the filename stem, `title` a distinct sentence-case display name. Plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — `description` non-null and ≤100 chars (validate does **not** enforce it).
2. **`mode` is required** — `"json"` or `"xml"` (server enum `ECodeEditorMode`). Omitting it fails `Mode is required`; `plaintext`, `text`, `javascript`, `html`, `sql`, `yaml` and similar are rejected. The member list is exactly `json` and `xml` (the designer's Mode dropdown lists JSON and XML; `typescript` fails `Error converting value ... ECodeEditorMode` in validate); captured from the Studio designer (option lists), dxs 0.5.8. The `codeBox` control is a separate component; its modes are documented with the control (its designer dropdown also lists JSON and XML).
3. **`value` is a TypeScript expression.** Bind it raw (`"$codeEditor.inParams.payload"`) or leave it `""` and assign `$codeEditor.value` in `on_init`. A literal must be TS-quoted. Validate does **not** compile `value` — a mis-encoded string passes validate and breaks at build. See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).
4. **Every `flowId` must name a flow in `flows[]`** — `onInitFlowConfig.flowId` and each toolbar `clickFlowConfig.flowId` (`Missing 'Init flow' on_init` / `Missing 'Click flow' on_save` otherwise).
5. **`on_init` beautifies and titles.** `$codeEditor.beautify();` then set `$codeEditor.title` from a `title` inParam (with a default). The runtime title overrides the static `title`.
6. **Declare every `$codeEditor.vars.<id>`** you read or write in top-level `vars[]` — same rule as forms/editors.

### Save and close

The code editor has no save mechanism of its own. A Save button's flow reads the edited text from **`$codeEditor.value`** (a string — never from the inParam, which still holds the original), awaits a function that persists it, then closes:

```ts
await $flows.<Package>.save_rule_content_flow({
    rule_id: $codeEditor.inParams.rule_id,
    content: $codeEditor.value
});

// @ts-ignore — ICodeEditor's generated typing omits close(); the method exists at runtime
$codeEditor.close();
```

The generated `ICodeEditor` interface has no `close()` member, so the call needs `// @ts-ignore` on the line directly above it to compile. Production code editors ship exactly this pattern; its runtime behaviour has not been re-verified here — `_TODO_ (runtime unverified)`; confirm in Preview. Author the persisting function with `function-creator` (UI tier calls functions, not actions — [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md)).

### Phase 6: Wire the opener + verify

Every code editor generates two openers on its package's `$shell`:

```ts
// dialog — resolves when the dialog closes; no outParams come back
await $shell.<Package>.open<referenceName>Dialog(inParams, 'flyout' /* | 'modal' */, EModalSize.Large);
// view — opens in the shell; second arg replaceCurrentView?: boolean
$shell.<Package>.open<referenceName>(inParams, false);
```

`<Package>` is the **code editor's own** package (drop the segment only for a top-level application component). Because the same referenceName lives in several packages with divergent signatures, **always package-qualify and read the target package's signature**. The opener awaits close but returns nothing; after a Save dialog, the caller refreshes its own data. Hosts that embed the opener in a declarative contract mirror every inParam — audit with `component-wiring-check`.

## Pre-Flight Checklist

Walk the full checklist in [references/code-editors.md → Pre-Flight Checklist](references/code-editors.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 21`, file `<referenceName>-codeEditor.json`, `referenceName` ends in `_code_editor`, `title` a distinct sentence-case display name — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)); `description` non-empty ≤100 chars.
2. **`mode`** present and `json` or `xml`.
3. **`value`** a correctly-encoded TS expression (raw `$codeEditor.inParams.<id>`, `""`, or a TS-quoted literal).
4. **Every `flowId`** (init + toolbar clicks) names a flow in `flows[]`; every toolbar `id` is unique and snake_case.
5. **Save flows** read `$codeEditor.value`, await a `$flows` function, then `// @ts-ignore` + `$codeEditor.close()`.
6. **Read-only** viewers carry no Save button; no `readOnly` key is authored.
7. **Opener** is package-qualified to the code editor's own package and matches that package's inParam signature; callers do not expect a return value.
8. **Validate clean** — `dxs configuration validate codeeditor -b <branchId> -D body.json`.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/code-editors.md → Common Failure Modes](references/code-editors.md#common-failure-modes). The gotchas that bite most often when authoring:

- **Calling `$codeEditor.close()` without `// @ts-ignore`** — fails to compile (`close` is missing from `ICodeEditor`); add the directive on the line directly above.
- **Saving `$codeEditor.inParams.payload`** instead of `$codeEditor.value` — persists the original, discarding the user's edits.
- **Copying a legacy `view_json_payload` / `view_xml_payload`** — no `_code_editor` indicator, `title` equal to `referenceName`, and an orphan `on_beautify_clicked` flow with no button; author a properly named one instead.
- **Opening `$shell.open<ref>Dialog` without the package, or with the wrong package's signature** — the copies diverge; qualify with the target's package and read its inParams.
- **Expecting outParams from the dialog** — the opener resolves `Promise<void>`; persist through a function, or use a form if values must come back.
- **Inventing a `readOnly` key or `mode: "plaintext"`** — validate silently drops the former and rejects the latter.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content; `jq .json envelope.json > body.json` first.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
