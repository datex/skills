# Control Types

Reference for `controlConfig.type` values used on field controls across forms, editors, hub filters, and grid cells. A `controlConfig` carries one populated sub-config block plus every other sub-config explicitly `null`; the populated block matches the `type`.

For component-level authoring rules, see [`forms.md`](../form-creator/references/forms.md), [`editors.md`](../editor-creator/references/editors.md), [`hubs.md`](../hub-creator/references/hubs.md), [`grids.md`](../grid-creator/references/grids.md). For the TS-expression encoding for declarative string slots, see [`file-format.md`](../datex-studio-conventions/file-format.md); for runtime globals, see [`runtime-globals.md`](runtime-globals.md).

## Cross-cutting rules

These apply to **every** control type below.

1. **Sibling sub-config blocks stay present and null.** A `textBox` field still carries `dateBoxConfig: null`, `numberBoxConfig: null`, `codeBoxConfig: null`, etc. The platform's structural diff relies on it. Don't omit keys, don't reorder them. (A body fetched back from the branch shows the null siblings stripped — fetched bodies omit null keys, see [configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md#fetched-bodies-omit-null-keys--absence-is-not-schema-evidence). That is the server's storage form, not a rule against authoring them.)
2. **Declarative string slots are TypeScript expressions.** `value`, `tooltip`, `placeholder`, `format`, and any other string slot inside a `*Config` are inlined into generated component code verbatim. Wrap display text in **backticks** (`` "`Click me`" ``), wrap plain-string literals in **TS quotes** (`"'MM/DD/YYYY'"`), leave **raw expressions unwrapped** (`"$form.inParams.foo"`). An unwrapped tooltip like `"Opens the dialog."` compiles to bare tokens and breaks the build. Full rule: [`file-format.md` → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).
3. **Dynamic mutation goes through flow code.** Use `$form.fields.<id>.control.<prop> = ...` (and equivalents on `$editor` / `$hub` / `$grid`) inside flow `executeCodeConfig.code`. Some props (notably `tooltip`) are declarative-only and ignore flow-code assignment — route those through a `vars` slot the field binds to.
4. **Don't mix declarative + imperative init on the same field with different sources.** A `value` binding and an `onInitFlowConfig` write that read different paths is a silent bug — the declarative wins at render and the imperative looks correct but has no effect. Pick one idiom per field.

---

## codeBox

A multi-line, syntax-highlighted code editor control. Use it for fields whose value is structured text (JSON, XML, raw code) where syntax coloring, line numbers, monospace, and auto-indent improve readability.

### When to use vs `textBox` (multiline)

| Need | Pick |
|---|---|
| Display a JSON / XML / structured payload | `codeBox` (`mode: "json"` / `"xml"`) |
| Display a log dump or computed report | `textBox` with `multiline: true` — `codeBox` offers only `json` / `xml` modes, so it has no plain-text mode |
| Free-form prose, comments, descriptions | `textBox` with `multiline: true` |
| Need `readOnly: true` (truly read-only, not greyed out) | `textBox` with `multiline: true` — `codeBox` has no `readOnly` slot |
| Need a `placeholder` when empty | `textBox` — `codeBox` has no `placeholder` slot |
| React to user edits via a value-change handler | `textBox` — `codeBox` exposes no `uiValueChangeFlowConfig` |

### Schema

```json
{
  "id": "preview_output",
  "label": "Preview",
  "required": false,
  "fromBaseConfiguration": null,
  "removed": null,
  "controlConfig": {
    "type": "codeBox",
    "textBoxConfig": null,
    "dateBoxConfig": null,
    "numberBoxConfig": null,
    "checkBoxConfig": null,
    "buttonConfig": null,
    "labelConfig": null,
    "textConfig": null,
    "selectBoxConfig": null,
    "imageConfig": null,
    "drawConfig": null,
    "codeBoxConfig": {
      "value": "`(click Refresh preview)`",
      "mode": "json",
      "tooltip": "`Tooltip text wrapped in backticks.`",
      "disabled": null
    },
    "progressBarConfig": null,
    "matrixConfig": null
  },
  "widthType": "full",
  "defaultStyleClass": null,
  "onValidationFlowConfig": null
}
```

### `codeBoxConfig` fields

| Field | Type | Notes |
|---|---|---|
| `value` | string (TS expression) | Initial display value. Backtick-wrap display text; reference vars unwrapped. For computed output, leave as a backtick-wrapped placeholder and write via flow code in `onInitFlowConfig` or a button handler. |
| `mode` | string | Syntax-highlighting mode: `"json"` or `"xml"` only (lowercase). The designer's Mode dropdown on the `codeBox` control lists only those two (captured from the Studio designer option lists, dxs 0.5.8), and `validate` rejects any other value such as `"typescript"`, `"javascript"`, `"yaml"` or `"plaintext"`. |
| `tooltip` | string (TS expression) | Backtick-wrap display text. Same encoding rule as every other `*Config.tooltip`. |
| `disabled` | boolean \| null | Greys out the control. There is **no separate `readOnly` slot** — see Caveats. |

Notable absences (compared to `textBoxConfig`): no `readOnly`, no `placeholder`, no `multiline` (always multi-line), no `uiValueChangeFlowConfig`.

### Setting the value from flow code

```ts
// Compute structured output and dump as JSON.
const summary = { warehouses_evaluated: rows.length, detail: rows };
$form.fields.preview_output.control.value = JSON.stringify(summary, null, 2);
```

The codeBox renders the assigned string with `mode`-based syntax coloring. Pretty-print at the call site (`JSON.stringify(x, null, 2)`) — the control does not auto-format.

### Caveats

- **No `readOnly` slot.** A codeBox set declaratively + populated via flow code is editable by the user. To prevent edits, set `disabled: true` (which greys it out) — there is no neutral read-only state. If you need a non-greyed read-only display, use a multiline `textBox` instead.
- **No `placeholder` slot.** Set `value` to a backtick-wrapped placeholder string in `onInit` (e.g. `"`(click Refresh)`"`).
- **No `uiValueChangeFlowConfig`.** A codeBox cannot trigger a flow on edit. If you need to react to user changes, use `textBox` (multiline).
- **`value` is a TS-expression slot.** A literal display string (`"(click Refresh preview)"`) without backticks compiles to bare tokens and breaks the build — same rule as every other `*Config.value`.
- **No `multiline` toggle.** The codeBox is always multi-line and sized by its container.

### Compatible components

`codeBox` is a generic field control — usable anywhere a field's `controlConfig.type` is interpreted: form fieldsets, editor fieldsets, hub filter blocks, grid cell controls. The schema is identical across components.

---

A whole dialog dedicated to one JSON/XML payload (toolbar, beautify, save/export) is a **code editor component** (cti 21), not a form with a codeBox — see [code-editors.md](../code-editor-creator/references/code-editors.md). The component's `mode` (`ECodeEditorMode`) rejects `plaintext` (verified live via validate, dxs 0.5.8); its observed members are `json` and `xml`.

## Other control types

The control types below are used widely in the workspace but don't yet have detailed sections here. Backfill as authoring touches them — same convention as the component-doc-stubbing rule. Each type's `*Config` lives in `controlConfig.<type>Config` with the populated block matching `controlConfig.type`.

### textBox

Single- or multi-line text input. Notable slots: `multiline`, `readOnly`, `disabled`, `placeholder`, `value`, `tooltip`, `uiValueChangeFlowConfig`. Most-used control in forms today.

### numberBox

Numeric input. Slots: `readOnly`, `disabled`, `placeholder`, `format` (TS-expression — typically a quoted formatter literal like `"'#,##0'"`), `value`, `tooltip`, `uiValueChangeFlowConfig`.

### dateBox

Date / datetime input. Shape as stored on a production form (fetched read-only, dxs 0.5.8; sibling null blocks stripped by the server):

```json
"controlConfig": {
  "type": "dateBox",
  "dateBoxConfig": {
    "includeTime": false,
    "readOnly": false,
    "disabled": false,
    "format": "'MM/DD/YYYY'",
    "value": "$form.inParams.schedule?.date?.start",
    "tooltip": "`Date schedule will start executing.`"
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `includeTime` | boolean | `false` = date picker; `true` = date + time. Observed on every sampled dateBox (2 of 10 `true`). |
| `readOnly` / `disabled` | boolean | Same semantics as on `textBox`. |
| `format` | string (TS expression) | A quoted literal (`"'MM/DD/YYYY'"`) or a raw expression bound to a var (`"$form.vars.date_time_format"`). Absent or `""` on half the sampled fields — the control then uses its default format. |
| `value` | string (TS expression) | Raw expression (`"$form.inParams.start_date"`) or `""` for empty. |
| `tooltip` | string (TS expression) | Backtick-wrapped text, or `""`. |
| `uiValueChangeFlowConfig` | `{ flowId }` \| absent | Lives **inside** `dateBoxConfig`; references a flow in the host's `flows[]`. |

`placeholder` was not observed on any sampled dateBox. Field-level keys (`id`, `label`, `required`, `widthType`) are as for any field — see [forms.md](../form-creator/references/forms.md).

**Shared date-time format.** Forms that show date + time bind every dateBox's `format` to one string var (`$form.vars.date_time_format`, declared in `vars[]`) and seed it in `on_init` from a shared format flow, so the format is resolved once per form rather than hard-coded per field. Same idiom as the dynamic-tooltip rule in [file-format.md](../datex-studio-conventions/file-format.md#dynamic-tooltip-values-go-through-a-var).

### checkBox

Boolean toggle. Slots: `label` (note: lives **inside** `checkBoxConfig`, not on the field — the field's outer `label` is typically `""` for checkbox fields), `readOnly`, `disabled`, `value` (TS-expression — `"false"` / `"true"` / `"$form.inParams.x"`), `type` (`"checkBox"` vs `"slideToggle"`), `tooltip`, `showNullValue`, `uiValueChangeFlowConfig`.

### selectBox

Dropdown / autocomplete backed by a selector. Slots: `value`, `readOnly`, `disabled`, `dropdownConfig` (configures the bound selector — `configId`, `moduleId`, `configParameters[]` mirroring the selector's inParams, `isOwned`), `allowMultiSelection`, `type` (`"dropdown"`), `placeholder`, `tooltip`, `uiValueChangeFlowConfig`. Cross-component wiring rules: [`component-wiring.md`](../component-wiring-check/references/component-wiring.md).

### button

Action button. Slots: `label`, `icon`, `buttonDefaultStyleClass` (`"primary"` / `"secondary"`), `readOnly`, `disabled`, `splitButton` (boolean — when true, `buttons[]` defines drop-down entries), `tooltip`, `clickFlowConfig` (`flowId` references a flow on the host component). Used both as toolbar items and as in-fieldset action triggers.

### label

Static display text. **Declarative-only** — the runtime model `ILabelModel` exposes neither `.value` nor `.styles`, so flow-code assignments like `$hub.filters.foo.control.value = '...'` or `.control.styles.setStyle('color', ...)` fail the TypeScript check with `Property 'X' does not exist on type 'ILabelModel'`. This is the strictest case of cross-cutting rule 3: nothing on a label control is settable imperatively.

- **Dynamic label text:** declare a string var on the host component (`$hub.vars.foo_text`, `$form.vars.foo_text`, …), bind `labelConfig.value` to it as an unwrapped TS expression (e.g. `"$hub.vars.foo_text"`), and write to the var from flow code. Seed the var in `on_init` so the label has defined text before first render.
- **Runtime styling:** there is no path. Bake the visual distinction into the text itself (e.g. a `✓` + count for the active state vs a plain "None set" when empty), or pick a different control type.
- The field-level visibility toggle (`.hidden = true/false`) still works on label fields.

Other slots TBD.

### text

Plain-text display variant. Slots TBD.

### image / draw / progressBar / matrix

Specialized controls; not yet observed in the workspace. Stub when first encountered.

---

## Cross-References

- [`forms.md`](../form-creator/references/forms.md) — form authoring rules; `fieldsets[].fields[].controlConfig` is the primary mount point for control types.
- [`editors.md`](../editor-creator/references/editors.md) — editor fields use the same `controlConfig` shape.
- [`hubs.md`](../hub-creator/references/hubs.md) — hub filter blocks and toolbar buttons reuse the control-type schema.
- [`grids.md`](../grid-creator/references/grids.md) — grid cell controls (in-line editing) and toolbar buttons reuse the schema.
- [`component-wiring.md`](../component-wiring-check/references/component-wiring.md) — `selectBox` → selector wiring rules (`configId`, `moduleId`, `configParameters` mirroring).
- [`file-format.md` → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions) — the encoding rule for every string-valued slot.
