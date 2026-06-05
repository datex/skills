---
name: type-definition-creator
description: |
  Use when authoring or modifying Datex Studio type definitions
  (configurationTypeId=22, *-customType.json suffix) on a branch — both
  interfaces (i_<name>) and enums (e_<name>) live in this single component
  type. Owns the interface vs enum decision, custom-type self-reference
  prohibition, UI-component enum FQN constraint (vars/inParams/outParams
  cannot use FQN to reference custom enums — declare as primitive instead),
  and the "tightening a previously-loose type ripples to consumers" impact
  rule. Triggers: "create an interface", "create an enum", "define a shared
  type", "add a property to i_xxx", "add a value to e_xxx", authoring types
  for flow inParams/outParams/objectTypeDef.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - backend-test-creator
  - editor-creator
  - form-creator
  - selector-creator
  - impact-analysis
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Type Definition Creator

Author or modify a Datex Studio type definition (configurationTypeId=22) on a branch — a `-customType.json` file that declares either an **interface** (`i_<name>`) or an **enum** (`e_<name>`). Both shapes live in the same component type and share the suffix, but the internal body differs substantially. Type definitions are consumed across the platform: flow `inParams` / `outParams`, datasource `objectTypeDef`, other type defs, and (with one important constraint) UI-component params.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/type-definitions.md](references/type-definitions.md) — Authoritative type-definition reference: file shape, the six property-descriptor shapes for interfaces, the two value-descriptor shapes for enums, self-reference prohibition with inline-to-depth workaround, UI-component enum FQN constraint and the primitive-plus-cast workaround, the tightening-ripples-to-consumers impact rule
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table; JSON file locations
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `i_*` / `e_*` prefix rules; `-customType.json` suffix; filename stem matching
- [../datex-studio-conventions/defaults.md](../datex-studio-conventions/defaults.md) — `accessModifier` defaults (interfaces and enums require an explicit choice — ask the user when authoring from scratch)

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`impact-analysis`** skill — invoked **before** any tightening edit on an existing type that's already in use: adding a required field, removing an optional one, narrowing a property from generic `object` to a specific shape, rewriting `objectTypeDef` from `null` to strict, renaming a property, or removing the type entirely. The type's FQN (`<Package>.<referenceName>`) is the trace target; every consumer that referenced the loose shape and accessed properties the new shape doesn't declare will break on the platform's strict pass. Net-new types skip this step

## CLI Lifecycle

Type-definition authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs customtype` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`customtype`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), mapping to `configurationTypeId: 22`. Both interfaces (`i_<name>`) and enums (`e_<name>`) share this single component type — the inner `type` field (`"interface"` vs `"enum"`) distinguishes them.

**Create a new type definition:**

```bash
# 1. Build body.json from scratch (see references/type-definitions.md → Interfaces / Enums)
# 2. Validate (recommended)
dxs configuration validate customtype -b <branchId> -D body.json
# 3. Create
dxs configuration upsert customtype -b <branchId> -D body.json
```

**Edit an existing type definition:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get customtype <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate (recommended)
dxs configuration validate customtype -b <branchId> -D body.json
# 5. Push
dxs configuration upsert customtype -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

Type-definition bodies are unusually lean compared to other configuration types — there are no `inParams` / `outParams` / `vars` / `events` / `flows` content slots (all stay `null`). The body is essentially the component-identity envelope plus either `objectTypeDef[]` (interfaces) or `enumTypeDef[]` (enums). Round-trip discipline (fetch → jq-extract → edit → validate → push) still applies — the platform's import path runs the full envelope-aware update regardless of body size. Type-definition files are also **single-line minified JSON** on disk (unusual compared to other component files — don't pretty-print).

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]
  +-----+-----+
  |            |
 YES          NO -> invoke `requirements-gathering`
  |            |
  +-----+------+
        |
[Phase 2: Decide interface vs enum vs nested]
Consult references/type-definitions.md:
  - shared shape that multiple components reference
    -> interface (i_<name>) — objectTypeDef[] with property
       descriptors; type:"interface"; enumTypeDef:null;
       isStringValue:null
  - fixed set of named values (string-valued kebab-case or
    number-valued stringified integer)
    -> enum (e_<name>) — enumTypeDef[] with value descriptors;
       type:"enum"; objectTypeDef:[] (empty array, NOT null);
       isStringValue:true (string) OR null (number)
  - anonymous nested structure used only inside one parent
    type, no separate FQN
    -> nested inline object on the parent's objectTypeDef[]
       (no separate -customType.json file)
        |
[Phase 3: Author type body]
Build body.json (single-line minified):
  - File basics: suffix -customType.json, configurationTypeId 22,
    referenceName and title both equal filename stem, description
    <= 100 chars, accessModifier set (confirmed with user)
  - Interface body: objectTypeDef[] array of property descriptors,
    each carrying id / type / isCollection / required / objectType /
    isSecured; the six property shapes (scalar, array of primitives,
    inline object, FQN reference, union, object collection)
  - Enum body: enumTypeDef[] array of value descriptors; ProperCase
    ids, kebab-case values by default for string-valued; number-valued
    entries carry description:null
  - References use FQN ("<Package>.<referenceName>") — never the
    referenceName alone
  - Self-reference prohibition: custom types cannot reference
    themselves by FQN — inline to a fixed maximum depth matching
    the producing engine's recursion cap; maintain via a generator
    script alongside the file
  - UI-component enum FQN constraint: if this type (or an enum from
    this package) will be used inside vars/inParams/outParams of an
    editor/form/selector/hub/grid, do NOT declare it as
    objectType:"<Package>.e_<enum>" in those param descriptors —
    declare as the underlying primitive and cast at use time;
    flow-tier components and other custom-type files can reference
    enums via FQN freely
  - Sibling slots stay null: inParams, outParams, vars, events all
    null — type definitions have no code strings of their own
        |
[Phase 4: Validate + push]
dxs configuration validate customtype -b <branchId> -D body.json
        |
   +----+----+
   |         |
  CREATE   MODIFY-EXISTING
   |         |
   |         use the corrected round-trip
   |         (get -O envelope -> jq .json -> body)
   |         |
   +----+----+
        |
        v
dxs configuration upsert customtype -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: (Optional) Impact analysis if tightening or removing]
For tightening edits on an existing type (adding required fields,
removing optionals, narrowing object -> specific shape, rewriting
objectTypeDef null -> strict, renames, removal), invoke the
`impact-analysis` skill with target <Package>.<referenceName>
to enumerate every reference site and audit each one against the
new shape. Net-new types skip this step.
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm, or run `dxs source branch list --all-repos --status feature` for selection.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief should establish what the type represents (a shared data shape across multiple components, a fixed value set, or an anonymous nested structure on one parent type), the consumers that will reference it (flow params, datasource shapes, UI components), and whether `accessModifier` should be `public` or `private`.
   - **No brief** — invoke the `requirements-gathering` skill first. Getting the interface vs enum vs nested decision right up front avoids restructuring the type after consumers have already wired against it.

### Phase 2: Decide interface vs enum vs nested

Consult [references/type-definitions.md](references/type-definitions.md) before authoring. The decision drives the body shape:

**Interface** (`i_<name>`) — a shared structural shape that multiple components reference. `type: "interface"`, body is `objectTypeDef[]` with property descriptors. Use when the same shape appears in two-or-more places (a flow's `inParams`, a datasource's `outParams[].objectTypeDef`, another interface's nested reference) and centralizing the definition avoids drift.

**Enum** (`e_<name>`) — a fixed set of named values. `type: "enum"`, body is `enumTypeDef[]` with value descriptors. `isStringValue: true` for string-valued enums (kebab-case `value` by default); `isStringValue: null` (**not** `false`) for number-valued enums (stringified-integer `value` with `description: null` per entry). Use when callers need a closed set of identifiable values with referential constants.

**Anonymous nested inline object** — when the structure exists only inside one parent type and has no independent identity, inline it as a `type: "object"` property descriptor on the parent's `objectTypeDef[]` with a nested `objectTypeDef[]` of child descriptors. No separate `-customType.json` file. Use when the shape isn't shared and giving it a name doesn't pay for itself.

When in doubt: "Will more than one component reference this exact shape, by name?" If yes → interface. "Is the shape just a fixed list of choices?" → enum. Otherwise → inline nested. See [references/type-definitions.md → Interfaces](references/type-definitions.md#interfaces), [references/type-definitions.md → Enums](references/type-definitions.md#enums).

### Phase 3: Author type body

Build `body.json` (single-line minified JSON — don't pretty-print) from the skeletons in [references/type-definitions.md → Interfaces](references/type-definitions.md#interfaces) and [→ Enums](references/type-definitions.md#enums). Key points:

1. **File basics.** Per the **Pre-Flight Checklist** below + [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md) for the `-customType.json` file shape. Type-specific while building: `accessModifier` is `"public"` or `"private"` — **confirm the choice with the user when creating from scratch** (the universal checklist assumes the `public` default; custom types often want `private`).

2. **Interface body.** Top-level constants: `type: "interface"`, `baseTypes: null` (no inheritance support yet), `enumTypeDef: null`, `isStringValue: null`, `inParams: null`, `outParams: null`, `vars: null`, `events: null`. The body is `objectTypeDef[]` — an array of property descriptors. Every property (top-level AND nested inside inline objects) carries `id` / `type` / `isCollection` / `required` / `objectType` / `isSecured: false`. The six property shapes (scalar primitive, array of primitives, inline object, FQN reference to another interface or enum, union with `oneOf[]`, object collection) are spelled out in [references/type-definitions.md → Interfaces](references/type-definitions.md#interfaces).

3. **Enum body.** Top-level constants: `type: "enum"`, `objectTypeDef: []` (empty array, **NOT** `null`), `baseTypes: null`, `inParams: null`, `outParams: null`, `vars: null`, `events: null`. Per-file: `isStringValue: true` for string-valued enums; `isStringValue: null` (**not** `false`) for number-valued enums. `enumTypeDef[]` — array of value descriptors. **Value-descriptor naming**: `id` (reference key) is **ProperCase** with no spaces (e.g. `RoyalBlue`, `ForestGreen`); `value` for string-valued enums is **kebab-case** by default (e.g. `royal-blue`, `forest-green`) unless the user specifies otherwise. Number-valued entries carry stringified integers (e.g. `"value":"0"`) and `description: null`.

4. **References use FQN.** `objectType` is `"<Package>.<referenceName>"` — not just the referenceName. Both interface references (`"Allocations.i_preallocation_action"`) and enum references (`"Allocations.e_allocation_replenishment_context"`) follow this format. Inside an interface, an enum reference uses the same `{type:"object", objectType:"<Package>.<enum_referenceName>", ...}` shape as an interface reference (the enum's runtime values are stringly/numerically typed, but the schema-level reference goes through `type:"object"`).

5. **Self-reference is not allowed.** Custom types cannot reference themselves recursively — there is no `objectType: "<Package>.<this_type>"` recursion path. If a type needs nested-of-itself children (a tree with arbitrary-depth `children`), **inline the structure to a fixed maximum depth** — repeating the full property descriptor set at each level. When the engine producing the tree has a hard recursion cap, match the type's inlined depth to that cap so every value the engine can emit fits the type. Maintain the inlined copies via a generator script alongside the file; manual edits to one level without the others is a defect. See [references/type-definitions.md → Custom Types Cannot Self-Reference](references/type-definitions.md#custom-types-cannot-self-reference).

6. **UI-component enum FQN constraint.** In **`vars`**, **`inParams`**, and **`outParams`** on **UI components** (editors, forms, selectors, hubs, grids), property descriptors **cannot** use `objectType: "<Package>.e_<enum>"` references. The platform's TS-validation pass for UI-component param declarations does not resolve custom `$types.*` namespaces and produces `Cannot find namespace '_types'. Did you mean 'Type'?` (the `_types` token is an artifact of the platform rewriting `$types` to `_types`). **Workaround**: declare the field as the underlying primitive (`string` for string-valued enums, `number` for numeric), then cast at the use site inside flow code (`const v = $form.fields.x.control.value as $types.<Package>.e_<enum>;`). **The constraint applies to UI components only** — flow-tier components (actions, functions, flow datasources) and custom-type files themselves can declare `objectType: "<Package>.e_<enum>"` references freely. See [references/type-definitions.md → UI Components Cannot Reference Custom Enums in vars / inParams / outParams](references/type-definitions.md#ui-components-cannot-reference-custom-enums-in-vars--inparams--outparams).

7. **Sibling slots stay null.** `inParams`, `outParams`, `vars`, `events` are always `null` on a type-definition body — type definitions have no code strings of their own. Don't invent code slots; match the convention.

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch
dxs configuration validate customtype -b <branchId> -D body.json

# For a new type definition
dxs configuration upsert customtype -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get customtype <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert customtype -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed property-descriptor or value-descriptor shapes, and structural errors before push. It does **not** catch the self-reference prohibition (which surfaces as a type-loader failure at consumer-compile time), the UI-component enum FQN constraint (which surfaces as `Cannot find namespace '_types'` on the consuming UI component), or tightening-rippling-to-consumers (which surfaces as strict-pass type errors on every reference site that previously got an implicit `any`). Walk the [references/type-definitions.md](references/type-definitions.md) sections covering each of these gotchas before push.

### Phase 5: (Optional) Impact analysis if tightening or removing

For **net-new** types, skip this phase — nothing references the type yet.

For an **existing type that's already in use**, any of the following counts as a tightening edit that ripples to consumers:

- Adding a required field that previous patches didn't include.
- Removing an optional field that consumers may still read.
- Narrowing a property from generic `type: "object"` to a specific FQN reference or strict inline shape.
- Rewriting an `objectTypeDef` from `null` (open-shape) to a strict array of descriptors.
- Renaming a property — every consumer accessing the old name breaks.
- Removing the type entirely — every FQN reference site breaks.

For any of these, **invoke the `impact-analysis` skill** with target `<Package>.<referenceName>` (the type's FQN) **before push**. The skill enumerates every reference site across the codebase — flow `inParams` / `outParams`, datasource `objectTypeDef`, other type defs, UI-component params with `objectType` references — so each site can be audited against the new shape in the same edit. Code that previously got an implicit `any` and read fields the new type doesn't declare will break on the platform's strict pass. Do not grep callers inline from the parent agent — multi-file scans are a dedicated skill's job. See [references/type-definitions.md → Tightening a Previously-Loose Type Ripples to Consumers](references/type-definitions.md#tightening-a-previously-loose-type-ripples-to-consumers).

## Pre-Flight Checklist

Before push, walk the full body content in [references/type-definitions.md](references/type-definitions.md). The fast version:

1. **File basics.** Suffix `-customType.json`, `configurationTypeId: 22`, `accessModifier` confirmed with user for new files — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **Type distinction is correct.** Interfaces use `type: "interface"`, `enumTypeDef: null`, `isStringValue: null`, `objectTypeDef: [...]`. Enums use `type: "enum"`, `objectTypeDef: []` (empty array, **not** `null`), `enumTypeDef: [...]`, `isStringValue: true` OR `null` (never `false`).
3. **Property descriptors are complete.** Every entry in `objectTypeDef` (top-level and nested) has `id`, `type`, `isCollection`, `required`, `objectType`, `isSecured`. Inline objects carry `objectTypeDef`; FQN references carry `objectType`; unions carry `oneOf[]`.
4. **Enum `id` is ProperCase with no spaces.** `value` follows requested casing (default kebab-case for string-valued). Number-valued entries carry stringified integers and `description: null`.
5. **References use FQN.** `objectType` is `"<Package>.<referenceName>"` — not just the referenceName.
6. **`id` placeholder.** `id: 0` at author time; the user / import assigns the real value.
7. **No self-reference.** If a type needs nested-of-itself children, inline to a fixed maximum depth matching the producing engine's recursion cap; maintain via a generator script.
8. **UI-component enum FQN constraint observed.** If this type (or an enum from this package) will be used inside `vars`, `inParams`, or `outParams` of an editor/form/selector/hub/grid, do not write `objectType: "<Package>.e_<enum>"` in those declarations — declare as the underlying primitive and cast at use time.
9. **Sibling slots null.** `inParams`, `outParams`, `vars`, `events` all stay `null` — type definitions have no code strings of their own.
10. **Tightening edits gated by impact analysis.** Any change to an in-use type that adds required fields, removes optional ones, narrows a property, rewrites `objectTypeDef` from `null` to strict, renames a property, or removes the type goes through the `impact-analysis` skill on the type's FQN before push. Net-new types skip this step.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Enum `isStringValue` set to `false` instead of `null` for number-valued enums | The platform treats `false` and `null` differently — number-valued enums require `null` (and entries carry `description: null` plus stringified-integer `value`). Set `isStringValue: null` exactly. |
| Enum `objectTypeDef` set to `null` instead of `[]` | Enums use `objectTypeDef: []` (empty array) — `null` is the interface convention. The platform's loader distinguishes the two shapes by this field; setting it to `null` mis-shapes the enum. |
| Enum `id` contains spaces or non-ProperCase characters | Spaces are not allowed in `id`. Use ProperCase (e.g. `RoyalBlue`, `ForestGreen`). |
| Property descriptor missing `isSecured: false` | Every property (top-level AND nested) carries `isSecured`. Include it on every descriptor; default to `false` when no secured-property variant is intended. |
| `objectType` set to bare `referenceName` instead of FQN | References use `"<Package>.<referenceName>"` — not just `i_thing` or `e_thing`. The platform resolves by FQN; bare names fail to resolve. |
| Attempted to self-reference (`objectType: "<Package>.<this_type>"` recursion) | Custom types cannot reference themselves. Inline the nested shape to a fixed maximum depth matching the producing engine's recursion cap. Maintain the inlined copies via a generator script. See [references/type-definitions.md → Custom Types Cannot Self-Reference](references/type-definitions.md#custom-types-cannot-self-reference). |
| `Cannot find namespace '_types'` error on a UI component that references an enum via `objectType: "<Package>.e_<enum>"` in `vars` / `inParams` / `outParams` | UI-component param declarations cannot use enum FQN references. Declare as the underlying primitive (`string` for string-valued, `number` for numeric) and cast at the use site inside flow code (`as $types.<Package>.e_<enum>`). Flow-tier components and other custom-type files can reference enums freely. |
| Tightened an in-use type without running impact analysis; consumers now fail on strict-pass | Code that previously got an implicit `any` and read fields the new type doesn't declare breaks on the platform's strict pass. Revert the tightening, invoke the `impact-analysis` skill on the type's FQN, audit every reference site, and update them in the same edit as the tightening. |
| Renamed a property on an in-use type without updating consumers | Every reference site referencing the old name fails. Invoke the `impact-analysis` skill on `<Package>.<referenceName>` first, then update every hit in the same edit. |
| Pretty-printed the JSON file | Type-definition files are **single-line minified JSON** on disk — unusual compared to other component files. Don't pretty-print; the import path expects the minified shape. |
| Inferred an explicit `false` for `isStringValue` on a number-valued enum from reading similar JSON elsewhere | The convention is `true` (string-valued) or `null` (number-valued). `false` is wrong. |
| Declared an interface's top-level `objectTypeDef` as `null` thinking it was an open shape | Interfaces use `objectTypeDef: [...]` (array of descriptors). The `null` form is the interface's `enumTypeDef` slot, not its primary body. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
