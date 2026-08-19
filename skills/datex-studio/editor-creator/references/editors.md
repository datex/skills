# Editors

Editors are close cousins of forms and grids — see also [`forms.md`](../../form-creator/references/forms.md) and [`grids.md`](../../grid-creator/references/grids.md).

An **editor** is a UI component that presents a single entity record as a set of fields for viewing and/or editing. It hydrates one record from a datasource, binds each field to a property of that record, and mediates save/cancel flows. Editors are the platform's answer to "detail screen" — the natural host for CRUD on an individual row.

## Purpose & When to Use

Use an editor when:

- The user needs to view or modify **a single entity** identified by a key (typically an id).
- Field-level inputs map 1:1 to properties of that entity.
- The flow wants a distinct view-mode (read-only display) and edit-mode (inputs unlocked, save button active) toggle.

Don't use an editor for:

- **Multi-record lists** — that's a grid ([`grids.md`](../../grid-creator/references/grids.md)).
- **Transient input collection that doesn't correspond to a stored record** — that's a form ([`forms.md`](../../form-creator/references/forms.md)). Forms collect inputs and return a payload; editors bind to a live entity and persist changes against it.
- **Creating-only dialogs where no entity yet exists to hydrate** — forms are usually a better fit. Editors can handle create flows via `$editor.entity.isNew`, but only when the pattern is "this editor handles both create and edit modes for the same entity type."

## File Location & Naming

- File name: `<name>_editor-editor.json` (`referenceName` stem + suffix). The component lives on the branch — this is the naming convention, not a local `src/` path.
- Suffix: `-editor.json`
- `configurationTypeId`: `4`
- Naming: the component `referenceName` ends with `_editor`; the filename stem is the same (e.g. `auto_invoicing_rule_editor-editor.json` → referenceName `auto_invoicing_rule_editor`). See [`naming-conventions.md`](../../datex-studio-conventions/naming-conventions.md).
- Default package: `Utilities` unless otherwise specified ([`defaults.md`](../../datex-studio-conventions/defaults.md)).
- Default access modifier: `public` ([`defaults.md`](../../datex-studio-conventions/defaults.md)).

## Minimal Valid Skeleton

Editors are dense — the skeleton below shows the top-level shape only. A real editor populates `toolbar`, `fieldsets`, `flows`, `datasourceConfig`, and `datasources` substantially.

```json
{
  "configurationTypeId": 4,
  "id": 0,
  "referenceName": "<name>_editor",
  "title": "<Display title>",
  "description": "<≤100 chars>",
  "accessModifier": "public",
  "icon": null,
  "inParams": [
    {"id": "<entity_id>", "type": "number", "isCollection": false, "required": true, "description": null, "oneOf": null, "fromBaseConfiguration": null, "objectTypeDef": null, "objectType": null, "isSecured": null, "isConstant": null, "constantValue": null}
  ],
  "outParams": [],
  "vars": null,
  "events": [],

  "toolbar": ["<buttons: edit, save, cancel, etc.>"],
  "fieldsets": ["<one or more fieldset blocks holding the fields>"],
  "widgets": [],
  "tabs": [],

  "datasourceConfig": {
    "datasourceKeyDef": [{"id": "<entity_id>", "type": "number", "isSecured": null}],
    "dynamicOrderBys": null,
    "dynamicFilters": null,
    "configParameters": ["<one entry per inParam on the embedded datasource>"],
    "configOutParameters": {"result": {"objectTypeDef": ["<consumer copy of the entity shape>"]}},
    "configEvents": [],
    "outParamsChangeFlowConfig": null,
    "configId": 0,
    "moduleId": "<TargetPackage>",
    "isOwned": true
  },

  "datasources": [
    "<embedded single-result flow datasource (see below)>"
  ],
  "linkedDatasources": null,

  "flows": ["<local flows used by field events, buttons, etc.>"],
  "validationFlows": [],
  "formValidationFlows": ["<form-level validation flows>"],

  "onInitFlowConfig": {"flowId": "<flow reference>", "flowParameters": [...]},
  "onDataLoadedFlowConfig": {"flowId": "<flow reference>", "flowParameters": [...]},
  "onFormValidateFlowConfig": {"flowId": "<flow reference>", "flowParameters": [...]},
  "onIntervalFlowConfig": null,
  "intervalSeconds": null,

  "onCustomizationInitFlowConfig": null,
  "onCustomizationInitFlowConfigExecutionBehaviorType": null,
  "onCustomizationDataLoadedFlowConfig": null,
  "onCustomizationDataLoadedFlowConfigExecutionBehaviorType": null,
  "onCustomizationFormValidateFlowConfig": null,
  "onCustomizationFormValidateFlowConfigExecutionBehaviorType": null,

  "baseConfiguration": null
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `configurationTypeId` | Component kind identifier | Always `4` for editors |
| `id` | Component identity | Stable id; don't reuse across environments |
| `referenceName` | Code-facing handle | Snake_case with `_editor` suffix; matches filename stem |
| `title` | Display title | Shown in the editor chrome |
| `description` | Searchable description | ≤ 100 chars (SQL column limit) |
| `accessModifier` | Visibility | Default `public` |
| `inParams` | Declared inputs | Must include whatever the hosting grid/hub passes — typically the entity id |
| `outParams` | Declared outputs | Usually empty; editors persist via actions, not via returning values |
| `toolbar` | Ordered list of toolbar controls | Typically edit, save, cancel buttons plus `$editor.vars.edit_mode`-gated visibility |
| `fieldsets` | Grouped field definitions | At least one fieldset; each holds `fields[]` bound to `$editor.entity.*` |
| `datasourceConfig` | Binding to the entity shape | `datasourceKeyDef` must describe the key the embedded datasource expects; `configOutParameters.result.objectTypeDef` is the consumer-side entity copy |
| `datasources` | Embedded private datasources | Exactly one — the single-result flow datasource that hydrates the entity. See below. |
| `onDataLoadedFlowConfig` | Post-hydration init hook | Fires after `$editor.entity` is populated; use for defaulting non-stored derived state |
| `onInitFlowConfig` | Pre-hydration init hook | Fires before the datasource resolves — `$editor.entity` is **not yet populated** |
| `onFormValidateFlowConfig` | Validation gate for the save button | Sets a toolbar button's `readOnly` based on field validity |
| `vars` | Editor-scoped mutable state | Typically includes an `edit_mode` boolean toggled by the edit/save/cancel buttons. Every var written in flow code must be declared here — see [`component-wiring.md` → Component Variables Must Be Declared](../../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared) |

Keep all of the `onCustomization*` slots `null` unless customization hooks are explicitly needed — they're platform-extension points, not everyday editor wiring.

## Runtime Globals

Inside any `code` string owned by the editor (flows, validation flows, form-validation flows), the `$editor` global is available in addition to the platform-wide globals ([`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md)).

| Field | Shape | Purpose |
|---|---|---|
| `$editor.entity` | Hydrated entity record (single object, shape matches `datasources[0].outParams[0].objectTypeDef`) | The record being edited. Read fields via `$editor.entity.<field>`; mutate via the UI layer, not directly. |
| `$editor.entity.isNew` | Boolean | `true` when the editor is in create mode (no persisted row yet). Branch save logic on this — `crud_create_entity` vs `crud_update_entity`. |
| `$editor.fields` | Map of field controls, keyed by field id | Programmatic access to controls — e.g. `$editor.fields.<id>.control.readOnly = ...` to toggle edit-mode. |
| `$editor.toolbar` | Map of toolbar buttons, keyed by button id | Same access pattern as fields — e.g. `$editor.toolbar.save.control.readOnly = !is_valid`. |
| `$editor.vars` | Editor-scoped mutable state | Carries view/edit mode, staging values that aren't stored on the entity yet. |
| `$editor.inParams` | Inputs passed from the hosting component | Typically the entity id. |
| `$editor.outParams` | Declared outputs | Rarely populated — editors persist via actions, not return values. |

The `$flow`, `$flows`, `$apis`, `$api`, `$types`, `$datasources`, `$utils` globals are all available as usual.

## Invocation Contract

Editors are typically opened as dialogs from a hub or a grid row action. The host:

- References the editor by `moduleId` (must match the editor's owning package — see [`component-wiring.md` → Cross-Component References Use the Target's Module](../../component-wiring-check/references/component-wiring.md#cross-component-references-use-the-targets-module)).
- Supplies every `inParam` the editor declares in its `configParameters`, even if some are `null` ([`component-wiring.md` → Reference Contracts Include Every Target inParam](../../component-wiring-check/references/component-wiring.md#reference-contracts-include-every-target-inparam)).
- For create mode: passes a sentinel id (e.g. `0` or `null`) that the embedded datasource interprets as "no existing record" and returns a blank entity whose `isNew` is `true`.

The UI-tier calling rule applies: the editor itself, and any event flows it hosts, call **functions** via `$flows.<Package>.<name>` — to run actions (CRUD create/update/delete), the function wraps the action call via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`. See [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md).

## Common Patterns

### View / Edit Mode Toggle

Editors routinely serve both read-only display and editable forms in the same component. The pattern:

- A boolean in `$editor.vars` (commonly `edit_mode`).
- Toolbar buttons conditionally visible: an **Edit** button visible when `!edit_mode`; **Save** and **Cancel** visible when `edit_mode`.
- Every field's `readOnly` bound to `!edit_mode` (or computed per-field when some stay locked in edit mode).
- Entering edit mode flips `edit_mode = true` and toggles every field/toolbar control accordingly.
- Saving calls the appropriate CRUD action (branching on `$editor.entity.isNew`), then flips back to read-only on success.
- Canceling restores the original entity values (re-call the datasource, or stash pre-edit values in `$editor.vars`).

### onInitFlowConfig vs onDataLoadedFlowConfig

Both are init hooks, but they fire at different lifecycle points:

- **`onInitFlowConfig`** — fires **before** the embedded datasource resolves. `$editor.entity` is not yet populated. Use for setting up vars, defaulting `edit_mode` based on `isNew`, or any logic that shouldn't depend on entity data.
- **`onDataLoadedFlowConfig`** — fires **after** the entity hydrates. `$editor.entity` is populated with the loaded record (or a blank record with `isNew: true` for create mode). Use for derived defaults that depend on entity data, populating UI-only state from entity fields, etc.

Getting these flipped is a common bug: reading `$editor.entity` in an `onInit` flow yields undefined; stashing pre-edit snapshots in `onDataLoaded` works but stashing them in `onInit` does not.

### Save Button Gated by onFormValidateFlowConfig

The form-validation flow runs whenever any field changes. Typical pattern:

1. The flow computes `is_valid` based on field values (often via `$utils.isDefinedTrimmed` for required string fields).
2. Assigns `$editor.toolbar.save.control.readOnly = !is_valid`.
3. Optionally writes per-field validation messages via each field's `control.validationMessage`.

**The validation flow lives in `formValidationFlows[]`, NOT `flows[]`** — a separate top-level array that name-based scans of `flows[]` will miss. `onFormValidateFlowConfig.flowId` resolves against `formValidationFlows`. Two paid-for consequences (2026-07-20, Totes `totenization_configuration_editor`):

- **Never author a `flows[]` entry named `validate_form`** (or whatever name `onFormValidateFlowConfig` points at). Codegen emits a class member per flow from BOTH arrays; a name collision produces `Duplicate function implementation` plus `TS2345` (`Promise<void>` vs `Promise<{[field]: string[]}>` — the validation contract expects a field-errors return, wired to every control change via `validateFormOnControlChange`). `dxs configuration validate` passes; only the Preview build fails.
- **When cloning an editor, audit `formValidationFlows[]` too** — it carries live code (required-field gating, often a `set_config()` call) that inherits stale field references from the template invisibly.

### Embedded Private Datasource Keyed by the Entity Id

Each editor embeds exactly one private, single-result flow datasource in its `datasources[]` array. Properties:

- `configurationTypeId: 6`, `type: "flows"`, `accessModifier: "private"`.
- **Single-result shape** — `getFlow` populated, `getListFlow: null`, `getByKeysFlow: null`, `resultIsCollection: false`, `outParams[0].isCollection: false`. See [`flow-datasources.md` → Single-Result Shape](../../datasource-creator/references/flow-datasources.md#single-result-shape--getflow).
- `inParams` includes the entity id. The datasource's `getFlow` code fetches the record by id — or synthesizes a blank record with `isNew: true` when the id is the sentinel (e.g. `0` / `null`).
- Entity shape in `outParams[0].objectTypeDef` is mirrored into `datasourceConfig.configOutParameters.result.objectTypeDef` — the editor-side consumer copy. Both must stay in sync when the entity shape changes.

A collection-returning datasource breaks the editor reference — the editor's `datasourceConfig.get({...})` cannot hydrate `$editor.entity` from a list. See [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md).

### EditorFields Requires a Binding for Every Schema Field

The platform generates an `EditorFields` TypeScript type from the bound entity's interface. The editor must declare a `controlConfig`-bearing binding for **every** field on that interface — even fields without UX yet. Missing a binding fails import with:

```
Property 'foo__bar' is missing in type ... but required in type 'EditorFields'.
```

The field id flattens nested paths with `__`: `replenishments.rules` becomes the field id `replenishments__rules`. Top-level fields use the bare property name.

When adding a field to an existing entity interface, add the matching editor binding **in the same edit**. If proper UX isn't ready, use a stub binding with `removed: true` to satisfy the type without rendering the field — a follow-up edit replaces the stub with real UX.

Stub binding template for a complex field not yet authored:

```json
{
  "id": "complex_array_field",
  "label": "",
  "required": false,
  "removed": true,
  "controlConfig": {
    "type": "textBox",
    "textBoxConfig": {"value": "", "readOnly": true, "disabled": true, "placeholder": null, "tooltip": "''", "uiValueChangeFlowConfig": null, "showNullValue": null, "characterCasing": null, "maxLength": null, "multiline": false},
    "dateBoxConfig": null, "numberBoxConfig": null, "checkBoxConfig": null,
    "buttonConfig": null, "labelConfig": null, "textConfig": null,
    "selectBoxConfig": null, "imageConfig": null, "drawConfig": null,
    "codeBoxConfig": null, "progressBarConfig": null, "matrixConfig": null
  },
  "widthType": "standard",
  "defaultStyleClass": null,
  "onValidationFlowConfig": null
}
```

### Editors Whose Entity Holds Serialized Config JSON

A common platform pattern: the bound entity is a thin wrapper like `{config_id, config: string, config_source: string, priority, contexts}` where `config` is a serialized JSON string of the actual configuration object. `$editor.entity.config` is the JSON string — **not** the parsed configuration.

Direct mutation like `$editor.entity.replenishments.rules = ...` is a type error — `entity` doesn't expose the parsed shape.

Lifecycle:

1. **`set_state` parses the JSON** at the top: `const config: $types.<Package>.<interface> = JSON.parse($editor.entity.config);`, then populates each field from the parsed object.
2. **`set_config` reassembles** by iterating `$editor.fields`, splitting each field id on `__` to build a nested object, and storing the result in `$editor.vars.new_config`.
3. **`on_click_save` posts `$editor.vars.new_config`** through a CRUD action (`update_<entity>_action` or `create_<entity>_action`) that writes the new JSON back.

**Array-of-object fields don't fit the `id__path` flattening.** A field whose value is an `i_*[]` collection can't be represented as a normal text/select/checkbox binding. Two options:

**Button + `$editor.vars` + `set_config`-merge pattern (recommended for complex sub-trees):**

- Add a `<path__to__array_field>` **button binding** that launches a manager form. The button's presence satisfies the `EditorFields` requirement; the user clicks it to open the form.
- **Declare `$editor.vars.<array_var>`** for the in-progress array, with the same property descriptor shape the schema uses.
- **`set_state` populates the var** from the parsed config: `$editor.vars.<array_var> = config?.<path>?.<array_field> ?? [];`
- **The button's click flow opens the form**, captures `outParams.<array>`, writes back to `$editor.vars.<array_var>`, then calls `$editor.set_config()` to re-run reassembly:

  ```ts
  const current = $editor.vars.<array_var> ?? [];
  const result = await $shell.<Package>.open<form_referenceName>Dialog({ <array>: current });
  if (result?.is_confirmed) {
      $editor.vars.<array_var> = result.<array> ?? [];
      await $editor.set_config();
  }
  ```

- **`set_config` merges the var back** into `newContent` before the final assignment:

  ```ts
  // ... existing field-iteration code that builds newContent ...
  if ($utils.isDefined($editor.vars.<array_var>)) {
      (newContent as any).<path> ??= {};
      (newContent as any).<path>.<array_field> = $editor.vars.<array_var>;
  }
  $editor.vars.new_config = newContent;
  ```

**Code-box JSON for power-user editing (faster to ship, worse UX):** replace the binding with a `codeBox`-type field whose value is raw JSON; `set_config` reads the field value and assigns it to the path. The user edits JSON directly. Reserve for technical admin tooling.

## Pre-Flight Checklist

1. **Top-level fields**: `configurationTypeId: 4`, `referenceName` ends with `_editor`, filename stem matches the `referenceName`, `description` populated and ≤ 100 chars, `accessModifier` set (default `public`).
2. **Exactly one embedded datasource** in `datasources[]`, with `accessModifier: "private"`, `type: "flows"`, and single-result shape (`getFlow` populated; `getListFlow` and `getByKeysFlow` are `null`; `resultIsCollection: false`; `outParams[0].isCollection: false`). See [`flow-datasources.md` → Single-Result Shape](../../datasource-creator/references/flow-datasources.md#single-result-shape--getflow).
3. **`datasourceKeyDef`** on `datasourceConfig` matches the embedded datasource's `keyDef` exactly, and matches the `inParams` shape the host will pass.
4. **Consumer entity shape is in sync**: `configOutParameters.result.objectTypeDef` on the editor's `datasourceConfig` mirrors the datasource's `outParams[0].objectTypeDef` field-for-field. Any entity-shape change must update both places in the same edit.
5. **Init-hook split is correct**: `onInitFlowConfig` does not read `$editor.entity` (entity is not yet hydrated at that point); entity-dependent defaults and UI-state derivations live in `onDataLoadedFlowConfig`.
6. **Save path branches on `$editor.entity.isNew`** — `crud_create_entity` when new, `crud_update_entity` when existing. Neither branch is hardcoded.
7. **Validation wiring**: `onFormValidateFlowConfig` sets `$editor.toolbar.<save_button>.control.readOnly` based on field validity, so the save button is only clickable when the form is valid.
8. **Every host reference carries a full `configParameters` contract** — every `inParam` the editor declares is represented in the reference (unused ones with `value: null`). See [`component-wiring.md` → Reference Contracts Include Every Target inParam](../../component-wiring-check/references/component-wiring.md#reference-contracts-include-every-target-inparam).

## Cross-References

- [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules.
- [`component-wiring.md`](../../component-wiring-check/references/component-wiring.md) — host reference contracts and var declarations.
- [`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md) — platform-wide globals available inside editor code.
- [`file-format.md`](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table and editing rules.
- [`forms.md`](../../form-creator/references/forms.md) — sibling component for transient input collection; contrast with editors (which bind to a live entity).
- [`grids.md`](../../grid-creator/references/grids.md) — typical host for editors via row-click / row-action flows.
- [`datasources.md`](../../datasource-creator/references/datasources.md) — taxonomy and the embedded-datasource section.
- [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md) — single-result shape authoring; required for editor-backing datasources.
