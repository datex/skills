# Forms

Forms are input-collection components used to gather user data and hand it back to callers via `outParams`. They commonly host action-invocation workflows (validate fields → call an action → close) and are frequently opened as modal or flyout dialogs from grids, hubs, and other forms. For peers, see [`selectors.md`](../../selector-creator/references/selectors.md) (dropdown fields mount selectors) and [`grids.md`](../../grid-creator/references/grids.md) (grids frequently open forms as dialogs from row actions).

## Purpose & When to Use

Choose a form when you need the user to review, enter, or confirm data before an action runs:

- Gather inputs for a backend action and call it on confirm (`on_click_confirm` → `$flows.<Package>.<action>`).
- Present a configuration dialog from a grid row action or hub button.
- Prompt for a structured value (a schedule, a set of options) and return it to the caller.

Avoid forms for read-only data display — a grid or a simple label in a hub is usually cheaper. Avoid forms for long-running workflows that span multiple screens — compose multiple forms with dialog chaining instead.

## File Location & Naming

- File name: `<name>-form.json` (`referenceName` stem + suffix). The component lives on the branch — this is the naming convention, not a local `src/` path.
- Suffix: `-form.json`
- `referenceName` is snake_case and matches the filename stem.
- The dialog-open shell method is derived from the `referenceName`: `$shell.<Package>.open<referenceName>Dialog(...)` (lower-snake_case preserved; no camelCasing of the name itself).

## Minimal Valid Skeleton

```json
{
  "icon": null,
  "toolbar": [
    {
      "id": "confirm",
      "type": "button",
      "buttonConfig": {
        "label": "Confirm",
        "buttonDefaultStyleClass": "primary",
        "clickFlowConfig": { "flowId": "on_click_confirm", "flowParameters": null }
      }
    }
  ],
  "fieldsets": [
    {
      "id": "main",
      "label": "Main",
      "hideTitle": false, "collapsible": false, "expanded": true,
      "fields": [
        {
          "id": "example_field",
          "label": "Example",
          "required": false,
          "controlConfig": {
            "type": "textBox",
            "textBoxConfig": {
              "multiline": false, "readOnly": false, "disabled": false,
              "placeholder": null, "value": "", "tooltip": "",
              "uiValueChangeFlowConfig": null
            }
          },
          "widthType": "full",
          "defaultStyleClass": null,
          "onValidationFlowConfig": null
        }
      ]
    }
  ],
  "flows": [
    {
      "start": "step1",
      "nodes": [{
        "id": "step1", "type": "step",
        "stepConfig": {
          "type": "ExecuteCodeActivity",
          "executeCodeConfig": { "code": "$form.outParams.value = $form.fields.example_field.control.value;\r\n$form.close();" }
        }
      }],
      "referenceName": "on_click_confirm",
      "title": "on_click_confirm",
      "description": "Emit outParams and close.",
      "accessModifier": "public"
    }
  ],
  "onInitFlowConfig": null,
  "onFormValidateFlowConfig": null,
  "configurationTypeId": 5,
  "id": null,
  "referenceName": "example_form",
  "title": "Example form",
  "description": "≤100 chars description.",
  "inParams": [],
  "outParams": [
    { "id": "value", "type": "string", "required": false, "isCollection": false, "isSecured": false }
  ],
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

Unused config slots on a `controlConfig` (e.g. `buttonConfig` on a `textBox` field) are explicitly `null` in existing component files. Match that convention when authoring new forms — keep all sibling `*Config` keys present and null to aid structural diffing.

**Many string fields in `controlConfig` are TypeScript expressions, not plain text.** `value`, `tooltip`, `placeholder`, `format`, and similar slots get inlined into generated component code verbatim. Wrap display text in backticks (e.g. `` "`Set schedule…`" ``), wrap plain-string literals in TS quotes (e.g. `"'MM/DD/YYYY'"`), and leave raw expressions unwrapped (e.g. `"$form.inParams.foo"`). See [`file-format.md` → Declarative String Values Are TypeScript Expressions](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions) for the full rule.

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `id` | Component identity | `null` at author time; assigned on import |
| `referenceName` | Code-facing handle | Snake_case; matches filename stem; drives the dialog-open shell method name |
| `title` | User-visible form title | Shown in the dialog header when opened as a dialog |
| `description` | Searchable description | ≤ 100 chars (SQL column limit) — enforced at import |
| `accessModifier` | Visibility | Default `public`; see [`defaults.md`](../../datex-studio-conventions/defaults.md) |
| `toolbar` | Toolbar buttons (e.g. confirm, cancel) | Array of toolbar items; each item's `buttonConfig.clickFlowConfig.flowId` references an entry in `flows` |
| `fieldsets` | Field groupings | Each has `fields`; a field's `controlConfig.type` selects which sub-config is active. Per-control-type schema and authoring notes: [`control-types.md`](../../datex-studio-runtime/control-types.md) |
| `flows` | Code flows referenced by field/toolbar click handlers, `onInitFlowConfig`, `onFormValidateFlowConfig`, field `uiValueChangeFlowConfig` / `onValidationFlowConfig` | Each flow has a `referenceName` used by the handler references |
| `inParams` | Optional caller-provided inputs | Shape mirrored in caller's dialog-open call |
| `outParams` | Values returned to caller on close | Populated via `$form.outParams.<id> = ...` before `$form.close()` |
| `vars` | Form-local state | Typed; accessible as `$form.vars.<id>` in flow code. Every var written in flow code must be declared here — see [`component-wiring.md` → Component Variables Must Be Declared](../../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared) |
| `onInitFlowConfig` | Flow to run on form load | Typical place to seed fields from `inParams` |
| `onFormValidateFlowConfig` | Flow to run on validation pass | Typical place to gate toolbar `confirm.control.readOnly` |

## Runtime Globals

Inside any `executeCodeConfig.code` string on a form flow:

| Global | Purpose |
|---|---|
| `$form.inParams.<id>` | Read caller-provided inputs |
| `$form.outParams.<id>` | Write values to return to the caller |
| `$form.vars.<id>` | Read/write form-local state |
| `$form.fields.<id>.control.{value,readOnly,hidden,disabled,...}` | Read/write field state |
| `$form.fields.<id>.hidden` | Hide/show a field |
| `$form.fieldsets.<id>.hidden` | Hide/show an entire fieldset |
| `$form.toolbar.<id>.control.{readOnly,disabled,...}` | Manage toolbar button state (e.g. gate confirm) |
| `$form.close()` | Close the form; caller's `await openXxxDialog(...)` resolves to current `outParams` |
| `$form.<flow_referenceName>()` | Call another flow on this same form |
| `$validation.fieldErrors.<id>.push(message)` | Push an error onto a field inside a `formValidationFlows` / `onFormValidateFlowConfig` handler |

Plus the platform-wide globals from [`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md): `$flows`, `$apis`, `$api`, `$datasources`, `$types`, `$utils`.

The dialog-opening shell global — `$shell.<Package>.open<referenceName>Dialog(...)` — is available inside form/grid/hub flow code.

## Invocation Contract

### Opening a form as a dialog

```ts
const result = await $shell.<Package>.open<referenceName>Dialog(
    inParams,       // object matching the target form's inParams shape
    'modal',        // or 'flyout'
    EModalSize.Large // or .Xlarge, etc.
);
```

- `<Package>` must match the package the target form was imported into — not the feature folder, not the caller's package. See [`component-wiring.md` → Cross-Component References Use the Target's Module](../../component-wiring-check/references/component-wiring.md#cross-component-references-use-the-targets-module).
- `<referenceName>` is the target form's `referenceName`, snake_case preserved.
- The resolved value is the target form's `outParams` object (populated when the target calls `$form.close()`).
- If the user cancels without `$form.close()`ing with populated outParams, the resolved value's outParam fields are `undefined`. Target forms that need to distinguish confirm from cancel typically emit an explicit `is_confirmed: boolean` outParam.

### Receiving inParams inside a form

Two complementary idioms:

- **Declarative binding** on a control's `value` field (e.g. `"$form.inParams.foo"`). The expression is evaluated at render time and drives the field's initial value. Prefer this for one-shot initialization.
- **Imperative assignment** inside `onInitFlowConfig` (`$form.fields.foo.control.value = $form.inParams.foo`). Prefer this when initialization is conditional or requires async work.

⚠ Do not mix: a declarative binding and an imperative assignment that read from different inParam paths will conflict — the declarative binding wins on render, and the imperative assignment looks correct but silently has no effect. This was the root cause of a real bug in `schedule_frequency_form`; see the pre-flight checklist.

## Common Patterns

### Dialog host (open another form, capture result, update display)

```ts
// Button click handler on the host form.
const result = await $shell.Utilities.openchild_formDialog(
    { prefill: $form.vars.captured }, 'modal', EModalSize.Large);

if ($utils.isDefined(result?.value)) {
    $form.vars.captured = result.value;
    $form.fields.display.control.value = JSON.stringify(result.value, null, 2);
}
```

Typical shape: button → flow → `$shell...Dialog(...)` → copy result into `vars` → refresh display fields. The form's `vars` hold the captured payload across dialog invocations; the display fields just mirror the vars via their `displayControl.value` expressions.

### Validate-then-gate-confirm

A `formValidationFlows` entry (referenced by `onFormValidateFlowConfig`) runs on every field change. It reads the current field values, and sets `$form.toolbar.confirm.control.readOnly` based on whether the form is valid. Field-level errors are pushed onto `$validation.fieldErrors.<id>`.

```ts
let isReadOnly = false;
if (!$utils.isDefined($form.fields.required_one.control.value)) {
    isReadOnly = true;
}
if ($utils.isAllDefined($form.fields.start.control.value, $form.fields.end.control.value)
    && new Date($form.fields.start.control.value) > new Date($form.fields.end.control.value)) {
    isReadOnly = true;
    $validation.fieldErrors.start.push('Must be before the end');
    $validation.fieldErrors.end.push('Must be after the start');
}
$form.toolbar.confirm.control.readOnly = isReadOnly;
```

This is strictly preferable to per-field `onValidationFlowConfig` when the rule spans multiple fields.

### Pre-fill from inParams (composed)

```ts
// onInitFlowConfig handler
if ($utils.isDefined($form.inParams.entity)) {
    $form.fields.name.control.value = $form.inParams.entity.name;
    $form.fields.description.control.value = $form.inParams.entity.description;
}

if (!($form.inParams.allow_edit ?? true)) {
    $form.fields.name.control.readOnly = true;
    $form.fields.description.control.readOnly = true;
}

await $form.set_state();
```

### `$form.vars` Requires Declaration; `$form.<flow>()` Requires the Flow

Two related platform constraints often hit together:

- **`$form.vars.<name>` access requires `<name>` to be declared in the form's top-level `vars[]` array** — the same property descriptor shape as `inParams`/`outParams`. A leftover `"vars": null` plus `$form.vars.x = ...` in flow code fails on import with:

  ```
  Property 'vars' does not exist on type 'IForm'.
  ```

  Declaration template:

  ```json
  "vars": [
    {
      "id": "rules",
      "required": false,
      "description": "In-progress rules array.",
      "type": "object",
      "isCollection": true,
      "objectTypeDef": [ ...same shape used in inParams/outParams... ],
      "objectType": null,
      "isSecured": false,
      "oneOf": null,
      "fromBaseConfiguration": null,
      "isConstant": null,
      "constantValue": null
    }
  ]
  ```

- **`$form.<flowName>()` works only if a flow with `referenceName: flowName` exists in `flows[]`.** The platform auto-generates a method on `$form` for every flow's `referenceName`; calling a non-existent flow fails with:

  ```
  Property 'set_state' does not exist on type 'IForm'.
  ```

  A common variant of this bug: `formValidationFlows` contains a flow whose body says `await $form.set_state();` but the form never defines a `set_state` flow. Either define `set_state` as a real flow, or drop `formValidationFlows`/`onFormValidateFlowConfig` entirely when no validation hook is needed.

Both rules apply identically to editor flows — `$editor.vars.<name>` must be declared in the editor's top-level `vars[]`, and `$editor.<flowName>()` requires a flow with that referenceName.

## Pre-Flight Checklist

1. `description` is non-empty and ≤ 100 characters.
2. `accessModifier` is set (default `public`).
3. `referenceName` is snake_case and matches the filename stem.
4. `onInitFlowConfig.flowId` (if set) names a flow that actually exists in `flows`. Same for every `clickFlowConfig.flowId`, `uiValueChangeFlowConfig.flowId`, `onValidationFlowConfig.flowId`, and the `onFormValidateFlowConfig.flowId`.
5. **All `controlConfig` string slots (`value`, `tooltip`, `placeholder`, `format`) are wrapped correctly as TypeScript.** Display text in backticks, plain-string literals in `'...'`, raw expressions unwrapped. An unwrapped tooltip like `"Opens the dialog."` compiles to bare tokens and breaks the build. See [`file-format.md` → Declarative String Values Are TypeScript Expressions](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).
6. **Every declarative field `value` binding reads from the inParam path actually populated by callers.** Mixing declarative bindings (`"$form.inParams.a.b"`) with imperative assignments (`$form.fields.x.control.value = $form.inParams.c.d`) that point at different paths is a silent bug: the declarative binding wins at render, and the imperative assignment looks correct but has no effect.
7. If the form has a Confirm button that must be gated on validity, the gating lives in `formValidationFlows` (referenced by `onFormValidateFlowConfig`) — not in one-shot assignments inside `onInitFlowConfig` that go stale after user interaction.
8. Dialog-open calls use the target form's package for `<Package>`, not the caller's feature folder name.
9. If the caller needs to distinguish confirm from cancel, the target form emits an explicit `is_confirmed: boolean` outParam.
10. `inParams` / `outParams` shapes are documented on each entry's `description` so consumers see the contract.
11. No `value.required: true` outParam is written only conditionally — the type contract must match what every close path actually emits.

## Cross-References

- [`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md) — platform-wide globals available inside form code.
- [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules.
- [`component-wiring.md`](../../component-wiring-check/references/component-wiring.md) — host reference contracts and var declarations.
- [`defaults.md`](../../datex-studio-conventions/defaults.md) — default package, access modifier, description length cap.
- [`control-types.md`](../../datex-studio-runtime/control-types.md) — Per-`controlConfig.type` schema and authoring notes (codeBox detailed; other types stubbed).
- [`selectors.md`](../../selector-creator/references/selectors.md) — selector-backed fields (dropdowns, autocomplete) are a common form control.
- [`grids.md`](../../grid-creator/references/grids.md) — grids frequently open forms as dialogs from row actions and toolbar buttons.
