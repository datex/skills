# Code Editors — Authoring Reference

Authoritative reference for Datex Studio **code editor** components (`configurationTypeId: 21`, CLI type `codeeditor`, conventional `-codeEditor.json` file suffix). A code editor is a UI component whose whole surface is one syntax-highlighted JSON or XML text editor plus an optional toolbar, opened as a dialog or a view to show, beautify, export, or edit a payload. For the in-form alternative see the `codeBox` control ([../../datex-studio-runtime/control-types.md](../../datex-studio-runtime/control-types.md#codebox)); for rendering HTML see embeds ([../../embed-creator/references/embeds.md](../../embed-creator/references/embeds.md)). Cross-cutting rules: [file-format](../../datex-studio-conventions/file-format.md), [naming-conventions](../../datex-studio-conventions/naming-conventions.md), [defaults](../../datex-studio-conventions/defaults.md), [runtime-globals](../../datex-studio-runtime/runtime-globals.md), [calling-conventions](../../datex-studio-runtime/calling-conventions.md).

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Pick a **code editor** when the requirement is centred on **one JSON or XML payload** that deserves its own dialog or view:

- **Viewer** — show an integration message, an API request/response, an import request; beautify it on open; offer Export/Download.
- **Editor** — let the user correct a JSON/XML configuration blob and save it back through a function.
- **Large payload browser** — page through a payload too big to load at once (chunked loading with toolbar paging).

Pick something else when:

| Need | Use |
|---|---|
| The payload is one input among other fields, or the caller needs typed values back from the dialog | A **form** with a `codeBox` field ([../../form-creator/references/forms.md](../../form-creator/references/forms.md), [control-types → codeBox](../../datex-studio-runtime/control-types.md#codebox)) |
| Render HTML or an external page (no editing) | An **embed** ([../../embed-creator/references/embeds.md](../../embed-creator/references/embeds.md)) |
| A single record with typed fields and view/edit mode | An **editor** ([../../editor-creator/references/editors.md](../../editor-creator/references/editors.md)) |

No production code editor declares `outParams`, `events`, or a datasource; their openers resolve `Promise<void>`. A code editor hands data **out** only by calling a function (or downloading a file), never by returning it to the opener.

## File Location & Naming

The component lives on the branch (authored via the dxs CLI round-trip); the file name is a naming convention only.

- File name: `<referenceName>-codeEditor.json`
- Suffix: `-codeEditor.json`
- `configurationTypeId: 21`; CLI type argument: `codeeditor`
- `referenceName`: snake_case, **ends in `_code_editor`** (e.g. `rule_content_code_editor`, `carrier_request_code_editor`). The type indicator is mandatory per [../../datex-studio-conventions/naming-conventions.md → Component Naming Matrix](../../datex-studio-conventions/naming-conventions.md#component-naming-matrix).
- `title`: user-facing (the dialog header until `on_init` overrides it) — a distinct sentence-case phrase, never byte-identical to `referenceName` ([Display Names for User-Facing Components](../../datex-studio-conventions/naming-conventions.md#display-names-for-user-facing-components)).
- `description`: mandatory, non-empty, ≤100 chars. Validate does **not** enforce it — two production bodies have none.
- Default package and access per [../../datex-studio-conventions/defaults.md](../../datex-studio-conventions/defaults.md).

**Legacy names (known violations).** The widely copied `view_json_payload`, `view_xml_payload`, `messages_json_payload`, and `config_content_code` predate the convention: no `_code_editor` indicator and `title` equal to `referenceName`. Call them out; do not replicate them. (`view_field_code_editor` and `render_entity_import_request_code_editor` already conform.)

## Minimal Valid Skeleton

A JSON viewer with Beautify, bound to an inParam, titled at runtime:

```json
{
  "value": "$codeEditor.inParams.payload",
  "mode": "json",
  "icon": "ms-Icon ms-Icon--FileCode",
  "toolbar": [
    {
      "id": "beautify",
      "type": "button",
      "buttonConfig": {
        "label": "Beautify",
        "icon": "icon-ic_fluent_align_left_20_regular",
        "readOnly": false,
        "disabled": false,
        "splitButton": false,
        "buttons": [],
        "clickFlowConfig": { "flowId": "on_beautify_clicked" }
      }
    }
  ],
  "flows": [
    {
      "enableProgressAndCancelation": false,
      "configurationTypeId": 9,
      "start": "step1",
      "nodes": [
        {
          "id": "step1",
          "type": "step",
          "stepConfig": {
            "type": "ExecuteCodeActivity",
            "executeCodeConfig": {
              "code": "$codeEditor.beautify();\n$codeEditor.title = $codeEditor.inParams.title ?? 'Payload';\n"
            }
          }
        }
      ],
      "referenceName": "on_init",
      "title": "on_init",
      "accessModifier": "public"
    },
    {
      "enableProgressAndCancelation": false,
      "configurationTypeId": 9,
      "start": "step1",
      "nodes": [
        {
          "id": "step1",
          "type": "step",
          "stepConfig": {
            "type": "ExecuteCodeActivity",
            "executeCodeConfig": { "code": "$codeEditor.beautify();\n" }
          }
        }
      ],
      "referenceName": "on_beautify_clicked",
      "title": "on_beautify_clicked",
      "accessModifier": "public"
    }
  ],
  "onInitFlowConfig": { "flowId": "on_init" },
  "configurationTypeId": 21,
  "id": 0,
  "referenceName": "payload_viewer_code_editor",
  "title": "Payload viewer",
  "description": "Shows a JSON payload, beautified, in a dialog.",
  "inParams": [
    { "id": "payload", "required": false, "type": "string", "isCollection": false },
    { "id": "title", "required": false, "type": "string", "isCollection": false }
  ],
  "accessModifier": "public"
}
```

The absolute minimum validate accepts is `mode` plus the identity fields; everything else (`toolbar`, `flows`, `onInitFlowConfig`, `value`, `inParams`) may be omitted or empty — but a viewer without a bound `value` or an `on_init` that assigns one opens empty.

Verified live: the skeleton above sends no null-valued keys, and `get` after `upsert` returned keys byte-identical to what was sent (only the server-assigned `id` differed) — the same normalization behavior (strip-on-null, stamp-on-id) documented for other component types.

## Required Top-Level Fields

Top-level keys on the code-editor body (the inner `.json`, not the envelope):

| Key | Required | Notes |
|---|---|---|
| `mode` | **yes** | Server enum `ECodeEditorMode`. Members: `json` and `xml` only (lowercase; the server parses names case-insensitively); the designer's Mode dropdown, on this editor and on the `codeBox` control, lists the same two (JSON, XML), captured from the Studio designer (option lists), dxs 0.5.8. Missing → `Mode is required`. `plaintext`, `text`, `javascript`, `typescript`, `html`, `css`, `sql`, `yaml`, `markdown`, `csv` are rejected (`Error converting value ... ECodeEditorMode`). |
| `value` | usual | TypeScript expression for the initial text: raw `"$codeEditor.inParams.payload"`, or `""` when `on_init` assigns `$codeEditor.value` imperatively. A literal must be TS-quoted. Validate does not compile it. See [file-format → Declarative String Values Are TypeScript Expressions](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions). |
| `toolbar` | usual | Array of tool items — see [Toolbar](#toolbar). `[]` or absent for a bare viewer. |
| `flows` | usual | Embedded flows (`configurationTypeId: 9`): `on_init` plus one per click flow. Every flow is also callable as `$codeEditor.<referenceName>()`. |
| `onInitFlowConfig` | usual | `{ "flowId": "on_init" }`. The flow must exist (`Missing 'Init flow' on_init`). |
| `inParams` | usual | What the opener passes — conventionally `payload` and `title`, plus whatever the save flow needs (an entity id). snake_case ids. |
| `vars` | optional | Component state (paging counters). Every `$codeEditor.vars.<id>` used in code must be declared. |
| `icon` | optional | Component icon class; production uses `"ms-Icon ms-Icon--FileCode"`. |
| `outParams`, `events` | not used | The server model carries both slots (null on every production body). Declaring them validates and adds `outParams` / `events.outParamsChange` to `ICodeEditor`, but whether the dialog opener then returns them is `_TODO_ (runtime unverified)`. Use a form when values must come back. |
| `onDataLoadedFlowConfig` | not used | Present (null) in the server-normalized body; there is no datasource slot to load. Purpose `_TODO_`. |
| `configurationTypeId` | yes | `21`. |
| `id`, `referenceName`, `title`, `description`, `accessModifier` | yes | Standard identity; see [File Location & Naming](#file-location--naming). |

**There is no `readOnly` key.** No production body has one, the server-normalized body (`get` → `.json`) has no such slot, and validate silently drops unknown keys — so `"readOnly": true` validates and does nothing. Read-only is a convention: omit the Save button (or hide it at runtime — see [Optional Save](#optional-save-hidden-save-button)). The designer's settings form (Reference ID, Description, Access modifier, Code value, Mode, Init flow) has no read-only or editable toggle either, so whether the editor surface itself can be made non-editable is `_TODO_ (not exposed by the designer; runtime unverified)`.

### Toolbar

Each item is `{ id, type, buttonConfig? }`:

```json
{ "id": "save", "type": "button",
  "buttonConfig": {
    "label": "Save", "icon": "icon-ic_fluent_save_20_regular",
    "buttonDefaultStyleClass": "primary", "tooltip": "",
    "readOnly": false, "disabled": false, "splitButton": false, "buttons": [],
    "clickFlowConfig": { "flowId": "on_save" } } }

{ "id": "separator1", "type": "separator" }
```

- `type`: `"button"` or `"separator"` (a separator carries no `buttonConfig`).
- `buttonConfig.clickFlowConfig.flowId` must name a flow in `flows[]` (`Missing 'Click flow' <id>`). Omit `clickFlowConfig` for a label-only button (a page indicator).
- `buttonDefaultStyleClass` (`"primary"` / `"secondary"` observed) and `tooltip` are optional.
- The toolbar `id` becomes the key under `$codeEditor.toolbar` — keep it snake_case and unique.

## Runtime Globals

Inside code-editor flow code, `$codeEditor` is the component context. The generated interface (regenerate with `dxs -O json configuration contexts codeeditor -b <branchId> -D body.json`, projecting `designerContexts[] | select(.id=="codeEditorContext") | .text`) has this shape:

```ts
interface ICodeEditor {
  title: string;                 // writable — the dialog/view header
  value: string;                 // writable — the editor text (always a string)
  inParams: { payload?: any, title?: string };     // from inParams[]
  vars: { current_page_number?: number };          // only when vars[] is declared
  events: { };                                     // empty unless events/outParams are declared
  toolbar: {
    beautify: IToolModel<IButtonModel>,            // one entry per toolbar id
    separator1: IToolModel<IControlModel>          // separators type as IControlModel
  };
  on_init(event?: any): Promise<any>;              // every flow in flows[] is a method
  on_beautify_clicked(event?: any): Promise<any>;
  beautify();                                      // pretty-print value per mode
  minify();
}
```

- **`close()` is missing from the typing** but production flows call it as `// @ts-ignore` + `$codeEditor.close();`. `_TODO_ (runtime unverified)` — confirm in Preview that it closes the dialog and resolves the opener's promise.
- Toolbar controls are mutable at runtime through `.control`: `$codeEditor.toolbar.<id>.control.readOnly`, `.icon`, `.label` (production paging code). `$codeEditor.toolbar.<id>.hidden = true` is also used in production to hide a button.
- Flows call each other as `await $codeEditor.<flowRef>()` — no phantom calls: the flow must exist in `flows[]`.
- Standard UI-tier globals (`$flows`, `$frontendFlows`, `$shell`, `$utils`, `$datasources`) are available; UI-tier calling rules apply ([../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md)) — call functions, not actions.
- `$utils.blob.saveFile(blob, { fileName, extensions })` downloads the text (Export pattern).

## Invocation Contract

Each code editor generates two openers on its package's `$shell` (signatures from the generated app context):

```ts
open<referenceName>Dialog: (inParams: { ... }, mode?: 'modal' | 'flyout', size?: EModalSize) => Promise<void>
open<referenceName>:       (inParams: { ... }, replaceCurrentView?: boolean) => void
```

```ts
// dialog
await $shell.<Package>.openpayload_viewer_code_editorDialog(
    { payload: JSON.stringify(message, null, 2), title: 'Inbound order message' },
    'flyout', EModalSize.Large);
// view
$shell.<Package>.openpayload_viewer_code_editor({ payload, title }, false);
```

- `open` + `referenceName` (snake_case preserved) + `Dialog`; `<Package>` is the **code editor's own** package, not the caller's. Only a top-level application component (no package) drops the segment — see [runtime-globals → `$shell`](../../datex-studio-runtime/runtime-globals.md#reference-table) and [`$shell` Package Scoping](../../datex-studio-runtime/runtime-globals.md#shell-package-scoping--cross-package-dialogs).
- **Same name, different contract.** `view_json_payload` / `view_xml_payload` exist in six or more packages. Base copies take `{ payload?, title? }`; one package's copy takes `{ payload?, title?, id?, application_name?, storage? }` and saves through that package's message/log update functions; another's takes `{ payload?, title?, id?, disable_save? }`. Always package-qualify and read the target package's signature before calling.
- The dialog resolves `Promise<void>` — nothing comes back. A caller that opened a Save-capable editor refreshes its own data after the `await`.
- Pass the payload as a **string** (`JSON.stringify(obj, null, 2)` for JSON) and declare the inParam `type: "string"`. Production `payload` inParams are typed `object` (generated as `any`) and bound into the string-typed `value`; whether a non-string object renders correctly is `_TODO_ (runtime unverified)`.
- Dialogs ignore Escape ([runtime-globals → `$shell` Dialogs Ignore Escape](../../datex-studio-runtime/runtime-globals.md#shell-dialogs-ignore-escape)); a Save flow must call `close()` itself.
- A host that declares the code editor in a declarative reference contract mirrors every inParam with the target's `moduleId` — [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md).

## Common Patterns

### Beautify and title on init

```ts
// on_init
$codeEditor.beautify();
const title: string = $codeEditor.inParams.title ?? '';
$codeEditor.title = title === '' ? 'Payload' : title;
```

Assign `$codeEditor.value` first when `value` is `""` and the text comes from a call (`$codeEditor.value = await ...; $codeEditor.beautify();`).

### Save through a function, then close

```ts
// on_save — read the EDITED text from $codeEditor.value, never from inParams
await $flows.<Package>.save_rule_content_flow({
    rule_id: $codeEditor.inParams.rule_id,
    content: $codeEditor.value
});

// @ts-ignore — close() is missing from the generated ICodeEditor typing
$codeEditor.close();
```

`$codeEditor.value` is the editor text (a string). Production passes it as `$codeEditor.value as any` when the target inParam is typed `object`; prefer typing the function inParam `string`, or `JSON.parse` it (catching parse errors) when the function needs an object. Close only after the awaited call succeeds, so a failed save leaves the user's edits on screen.

### Optional Save (hidden Save button)

```ts
// on_init — one component serves both the viewer and the editor case
if ($codeEditor.inParams?.disable_save) {
    $codeEditor.toolbar.save.hidden = true;
}
```

### Export to file

```ts
// on_export_to_file
const blob = new Blob([$codeEditor.value]);
await $utils.blob.saveFile(blob, { fileName: `payload_${$codeEditor.inParams.id}.json`, extensions: ['.json'] });
```

Production viewers also guard very large payloads in `on_init`: when `$codeEditor.value.length` exceeds a threshold (300 000 chars observed), they call `await $codeEditor.on_export_to_file()` and replace `value` with a short "too large to display" message.

### Paged loading with toolbar mutation

For payloads fetched in chunks: `vars` hold `current_page_number` / `total_pages`; a `load_chunk` flow sets `$codeEditor.value` from a function and beautifies; navigation buttons call it as `await $codeEditor.load_chunk()`, disabling the buttons and swapping the icon while loading, then a `set_state` flow re-enables them and updates a label-only page indicator:

```ts
$codeEditor.toolbar.next_chunk.control.readOnly = true;
$codeEditor.toolbar.next_chunk.control.icon = 'datex-default-spinner';
await $codeEditor.load_chunk();
$codeEditor.toolbar.next_chunk.control.icon = 'icon icon-ic_fluent_next_frame_20_regular';
await $codeEditor.set_state();   // sets readOnly per page, and
// $codeEditor.toolbar.page.control.label = `Page ${n} of ${total}`;
```

## Pre-Flight Checklist

1. **File basics** — `configurationTypeId: 21`, file `<referenceName>-codeEditor.json`, `referenceName` ends `_code_editor` and matches the stem, `title` distinct sentence-case; universal checks ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)); `description` non-empty ≤100 chars.
2. **`mode`** present and `json` or `xml`.
3. **`value`** correctly encoded (raw `$codeEditor.inParams.<id>`, `""`, or TS-quoted literal) — validate will not catch a mistake here.
4. **`onInitFlowConfig.flowId`** and every toolbar `clickFlowConfig.flowId` name a flow in `flows[]`; no orphan flows copied from a template (an `on_beautify_clicked` with no Beautify button).
5. **Toolbar ids** unique, snake_case; separators carry no `buttonConfig`.
6. **`vars`** declared for every `$codeEditor.vars.<id>`; every `$codeEditor.<flow>()` call has a matching flow.
7. **Save flow** reads `$codeEditor.value`, awaits a `$flows` function (not an action), then `// @ts-ignore` directly above `$codeEditor.close()`.
8. **Read-only** viewers have no Save button; no `readOnly` key and no `outParams` authored.
9. **Opener** — `$shell.<Package>.open<referenceName>Dialog(...)` with the code editor's own package and that package's inParam signature; caller does not consume a return value.
10. **Validate clean** — `dxs configuration validate codeeditor -b <branchId> -D body.json`.
11. **Preview smoke test** — payload renders beautified; Save persists and closes; Export downloads.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `Mode is required` on validate | `mode` missing | Add `"mode": "json"` or `"xml"`. |
| `Error converting value "plaintext" to type ... ECodeEditorMode` | `mode` not an enum member | Use `json` or `xml`; for plain text use a form `codeBox` or a multiline `textBox`. |
| `Missing 'Init flow' on_init` / `Missing 'Click flow' on_save` | `flowId` names no flow in `flows[]` | Add the flow or fix the id. |
| `Property 'close' does not exist on type 'ICodeEditor'` | Generated typing omits `close()` | `// @ts-ignore` on the line above `$codeEditor.close();`. |
| Save "works" but the change is lost | Save flow persisted `$codeEditor.inParams.payload` | Persist `$codeEditor.value`. |
| Editor opens empty | `value` unbound/`""` and `on_init` never assigns `$codeEditor.value`; or the caller passed nothing | Bind `value` to the inParam or assign it in `on_init`; check the opener's arguments. |
| Opener call fails to compile, or extra inParams ignored | Called another package's copy (divergent signature) or omitted the package segment | Package-qualify to the target and match its inParams. |
| `const r = await ...Dialog(...)` is always `undefined` | Code-editor dialogs resolve `Promise<void>` | Persist through a function; use a form when values must return. |
| `readOnly: true` has no effect | No such slot; validate drops unknown keys | Omit or hide the Save button. |
| Push wiped content | Upserted the envelope instead of the inner `.json` | `jq .json envelope.json > body.json` before editing. |

## Cross-References

- [../../datex-studio-runtime/control-types.md](../../datex-studio-runtime/control-types.md#codebox) — `codeBox`, the field-level alternative inside forms/editors (documented with the control; its designer Mode dropdown also lists JSON and XML).
- [../../form-creator/references/forms.md](../../form-creator/references/forms.md) — pick a form when the payload is one input among others or values must come back (outParams + `is_confirmed`).
- [../../embed-creator/references/embeds.md](../../embed-creator/references/embeds.md) — pick an embed to render HTML or an external page.
- [../../function-creator/SKILL.md](../../function-creator/SKILL.md) — author the function a Save button calls.
- [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table; TS-expression rule for `value`.
- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — `_code_editor` indicator, display-name rule, known violations.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) — `$shell` openers, package scoping, Escape behaviour.
- [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules.
- [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — get → extract `.json` → edit → validate → upsert.
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — opener contract and target-module rule.
