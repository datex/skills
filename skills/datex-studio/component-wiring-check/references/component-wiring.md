# Component Wiring

When one component references another — a hub field pointing at a selector, a hub tab mounting a grid, a grid's `datasourceConfig` pointing at an external datasource, a selector pointing at a datasource — the wiring has strict contract-matching rules. Break them and the reference silently fails at runtime rather than loudly at import. This doc covers the three most common silent-failure traps.

## Cross-Component References Use the Target's Module

When one component references another, the `moduleId` on that reference must match the package the **target** component lives in — not the package of the referencing component, and not the feature folder name.

A single feature folder can host components that ultimately belong to different packages — a hub in `FootprintManager` alongside a data-dictionary selector in `Carriers`, for instance. The package is not encoded in the folder name or in any naming prefix; it's a property of each individual component file. Getting the `moduleId` wrong at the reference site does not cause a loud import error; it manifests later as the platform being unable to resolve the component at runtime.

When adding a reference, either read the target component file's package declaration directly, or ask the user if the target's module is not obvious. Do not infer from the feature folder or from the "default to `Utilities`" new-component rule (see [defaults.md](../../datex-studio-conventions/defaults.md)) — that default is for *new* components, not for *references to existing ones*.

## Reference Contracts Include Every Target inParam

The reference's `configParameters` must be a **one-to-one shape match** against the target's `inParams`:

- **Every `inParam` the target declares** gets an entry in `configParameters` — including ones the caller doesn't intend to bind. Unused params stay in the contract with an explicit `null` / `undefined` / `""` `value`.
- **No extra entries.** `configParameters` that doesn't appear on the target is silently ignored at runtime — it looks like wiring exists but nothing binds. This is the more dangerous direction: the caller thinks a value is flowing through when the target never sees it.

The reference is a contract-match against the target's inParams shape. Neither missing nor extra entries throw loudly at import:

- **Missing** entries manifest at runtime as the target resolving an undefined input silently — for selectors backed by datasources this often shows up as an empty dropdown or a misfiltered list.
- **Extra** entries are drift that look functional — a hub tab declaring a `full_text_search` configParameter against a grid whose inParams list doesn't include `full_text_search` is dead wiring, and the value never reaches the grid's datasource. The grid behaves as if no search was wired.

The rule applies regardless of `required: true/false` on the target inParam. When the target's shape is out of sync with what the caller actually needs — e.g. a hub wants to scope a grid by `project_ids` / `owner_ids` / `warehouse_ids` but the grid doesn't declare those inParams yet — extend the *target* in the same edit rather than adding phantom entries to the caller. The caller's `configParameters` must only ever describe what the target actually accepts.

Concrete example: `carrierservicetype_dd` declares both `carrierId` (scalar) and `carrierIds` (collection). A hub filter that only needs the collection form must still include a `carrierId` entry in its `configParameters` with `value: null`, so the full inParams shape is mirrored. Conversely, if the filter currently declares a `warehouseId` configParameter and the selector's inParams don't list `warehouseId`, that entry must be removed — no amount of value-binding in the caller will make the selector receive it.

## Component Variables Must Be Declared

Forms, hubs, editors, and grids expose a mutable state bag — `$form.vars`, `$hub.vars`, `$editor.vars`, `$grid.vars` — read and written inside flow code. Every var read or written must have a matching entry in the component's top-level `vars` array; otherwise it's undeclared at the component contract level. Setting `$form.vars.foo = true` in an `on_init` handler without declaring `foo` leaves the var off the component's typed surface, so downstream code can't rely on it being typed and imports don't enforce its shape.

Declarations use the same inParam-shaped descriptor used elsewhere in the platform — `id`, `type`, `isCollection`, `isSecured`, plus the familiar `null` slots:

```json
{
  "id": "is_batch_optimized_supported",
  "required": null, "description": null, "oneOf": null, "fromBaseConfiguration": null,
  "type": "boolean", "objectTypeDef": null, "objectType": null,
  "isCollection": false, "isSecured": false, "isConstant": null, "constantValue": null
}
```

The rule applies identically to forms, hubs, editors, and grids. When touching flow code that assigns to `$form.vars.*` / `$hub.vars.*` / `$editor.vars.*` / `$grid.vars.*`, verify the component's `vars` array declares every `id` used — add the declaration in the same edit.

**Grids additionally carry `rowVars`** — per-row scratch state accessed as `$row.vars.<id>` inside row flows (`on_save_new_row`, `on_save_existing_row`, etc.). `rowVars` lives at the grid's top level alongside `vars` and uses the identical descriptor shape. Declare every `$row.vars.<id>` you read or write; an undeclared row var escapes the row-typed surface the same way an undeclared grid-var does.

## Custom Angular Component `componentReferences`

A Custom Angular Component (type 36) embeds other components through `componentReferences: [{ referenceName, moduleId, kind }]` (`manifest.componentRefs` in the `dxs ng` working folder). The reference is thinner than every other reference site, so the audit is different:

- **`moduleId` follows [the rule above](#cross-component-references-use-the-targets-module) verbatim** — the **target's** owning module. Omitted/blank means the CAC's own application (the host app, or the package the CAC lives in). A same-app target with `moduleId` set to the CAC's own module is redundant but harmless; a cross-module target with a blank `moduleId` does not resolve.
- **There is no `configParameters` mirror.** Bindings are hand-written in the CAC's template (`[<inParamId>]="…"`), so the platform checks **existence and kind only** (`validate` on save/publish; `dxs ng push` preflight `DXS-NG-056`). The "missing / extra configParameters" traps do not apply; their equivalents are template bindings.
- **`kind`** must be one of `selector, grid, editor, form, card, list, widget, customAngularComponent` (case-sensitive) — the per-kind tags, classes and binding families are in [custom-angular-components.md → Generated surface per kind](../../custom-angular-component-creator/references/custom-angular-components.md#generated-surface-per-kind); do not keep a second copy of that table here. It must also match the target's real configuration type. Note which layer tells you that: the platform's save and publish validation reports a wrong-kind target as the wrong type by name, but the existence check below cannot — it returns the same not-found result whether the target is missing or is simply of another kind, so treat a not-found as "missing **or** wrong kind" and check the type before concluding the component was never created.

Audit a CAC reference with four checks, in order:

1. `kind` ∈ the list above.
2. The target exists in the module `moduleId` names: `dxs configuration get <type> <moduleId>/<referenceName> -b <branch>`, where `<type>` is the kind in lower case — `customangularcomponent` for `customAngularComponent`; the camelCase kind is not a `dxs configuration` type (omit the `<moduleId>/` prefix when `moduleId` is blank — a bare reference resolves only the CAC's own application, never a referenced package's copy). A 404 here is the same failure `dxs ng push` raises as `DXS-NG-056`.
3. Every **required** `inParam` of the target is bound in the CAC template (`dxs configuration get customangularcomponent <id> -b <branch>` → `code.template`); an unbound required input leaves the target in its empty/placeholder state at runtime instead of showing data — the exact form (a `Please provide <id>` block, a disabled control, or an empty list/tile) depends on kind, see [custom-angular-components.md → What to read in the harness](../../custom-angular-component-creator/references/custom-angular-components.md#what-to-read-in-the-harness).
4. **No hosting loop.** Nothing the target hosts may lead back to this CAC — not a hosted CAC's own `componentReferences`, a CAC widget's content, an editor, hub, dashboard or card tab, a list item, a calendar event, a wizard step or a grid row expand. The platform rejects a loop on save, Validate and publish with `Cyclical references detected: <Type> <name> hosts itself (<name> -> … -> <name>)`; each hop in the route carries its type and the slot that hosts the next one (`editorOrder (Editor, tab cac_tab)`), so break the loop at the hop that should not host its parent. A loop with no CAC on it — a grid whose row expand is itself — is legitimate lazy recursion and is not reported.

Tags, classes and the two binding families per kind are documented once, in [custom-angular-components.md → Generated surface per kind](../../custom-angular-component-creator/references/custom-angular-components.md#generated-surface-per-kind). Fixes belong to `custom-angular-component-creator` (edit `manifest.json`, `dxs ng preview --refresh`, `dxs ng push`), never to a JSON round-trip of the type-36 body.
