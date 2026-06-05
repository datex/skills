# Type Definition Files

## Interfaces

Interface type files are named `<referenceName>-customType.json` and are single-line minified JSON. The component lives on the branch — this is the naming convention, not a local `src/` path. When creating a new interface from scratch, ask the user for `accessModifier` (`public` or `private`).

**Top-level interface skeleton** — constants for every interface file:
- `type: "interface"`
- `configurationTypeId: 22`
- `baseTypes: null` (no inheritance support yet)
- `enumTypeDef: null`, `isStringValue: null`
- `inParams: null`, `outParams: null`, `vars: null`, `events: null`

Per-file fields:
- `id` — numeric; use a placeholder (e.g. `0`) when authoring; user fills in real value
- `referenceName` and `title` — both equal the filename stem (e.g. `i_example`)
- `description` — human description
- `accessModifier` — `"public"` or `"private"` (ask user when creating)
- `objectTypeDef` — array of property descriptors

**Property descriptor rules** — every property (top-level AND nested inside inline objects) includes:
- `id` — property name
- `type` — `string` | `number` | `boolean` | `date` | `object` | `union`
- `isCollection` — boolean
- `required` — boolean
- `objectType` — usually `null`; FQN string for interface/enum references
- `isSecured: false` — include on every property (secured-property variant not yet covered)

**Six property shapes**:

1. **Scalar primitive** (string | number | boolean | date)
   ```
   {"id":"foo","type":"string","isCollection":false,"required":false,"objectType":null,"isSecured":false}
   ```

2. **Array of primitives** — same as scalar with `"isCollection":true`.

3. **Inline object** (anonymous nested structure)
   ```
   {"id":"foo","type":"object","isCollection":false,"required":false,"objectType":null,"isSecured":false,"objectTypeDef":[ ...child property descriptors... ]}
   ```

4. **Reference to another interface or enum**
   ```
   {"id":"foo","type":"object","isCollection":false,"required":false,"objectTypeDef":null,"oneOf":null,"objectType":"<Package>.<referenceName>","isSecured":false}
   ```
   Examples: `"Allocations.i_preallocation_action"`, `"Allocations.e_allocation_replenishment_context"`.

5. **Union**
   ```
   {"id":"foo","type":"union","isCollection":false,"required":false,"objectType":null,"isSecured":false,"oneOf":[
     {"type":"string","isCollection":false,"objectType":null,"isConstant":true,"constantValue":"some-constant"},
     {"type":"string","isCollection":false,"objectType":null},
     {"type":"number","isCollection":false,"objectType":null}
   ]}
   ```
   `oneOf` entries carry `type`/`isCollection`/`objectType`; literal constants add `isConstant: true` + `constantValue`.

6. **Object collection** — same as object forms (inline or reference) with `"isCollection":true`.

## Enums

Enum type files share the `-customType.json` suffix and `configurationTypeId: 22` with interfaces but use a different shape. Single-line minified JSON. Ask the user for `accessModifier` (`public` or `private`) when authoring from scratch.

**Top-level enum skeleton** — constants for every enum file:
- `type: "enum"`
- `objectTypeDef: []` (empty array, **not** `null`)
- `baseTypes: null`
- `configurationTypeId: 22`
- `inParams: null`, `outParams: null`, `vars: null`, `events: null`

Per-file fields:
- `id` — numeric; placeholder (e.g. `0`) when authoring; user fills in real value
- `referenceName` and `title` — both equal the filename stem (e.g. `e_awi_merge_orders_strategy`)
- `description` — human description (≤ 100 chars)
- `accessModifier` — `"public"` or `"private"`
- `isStringValue` — `true` for string-valued enums; `null` (**not** `false`) for number-valued enums
- `enumTypeDef` — array of value descriptors

**Enum value-descriptor naming**:
- `id` (reference key): **ProperCase**, no spaces — spaces are not allowed in `id` (e.g. `RoyalBlue`, `ForestGreen`).
- `value` for string-valued enums: **kebab-case** by default (e.g. `royal-blue`, `forest-green`), unless the user specifies otherwise.

**Two value-descriptor shapes**:

1. **String-valued** (`isStringValue: true`)
   ```
   {"id":"First","value":"first"}
   ```

2. **Number-valued** (`isStringValue: null`) — `value` is a stringified integer; entries also carry `description: null`
   ```
   {"id":"First","value":"0","description":null}
   ```

To reference an enum from an interface property, use the same shape as an interface reference: `{type:"object", objectType:"<Package>.<enum_referenceName>", ...}` (the enum's runtime values are stringly/numerically typed but the schema-level reference goes through `type:"object"`).

## Custom Types Cannot Self-Reference

Custom types have no syntax for referencing themselves recursively. There is no `objectType: "<Package>.<this_type_name>"` recursion path — the platform's type loader does not resolve a type referring to its own FQN. If a type needs nested children of itself (a tree with arbitrary-depth `children`), the nested shape must be **inlined to a fixed maximum depth** — repeating the full property descriptor set at each level.

When the engine that produces the tree has a hard recursion cap, make the type's inlined depth match the cap so every value the engine can emit fits inside the type contract. Maintain both with a generator script alongside the file so the N copies stay in sync; manual edits to one level without the others is a defect.

**Wrong** (will not validate):

```
{"id":"node","type":"object","objectType":"Allocations.i_node","isCollection":true}
```

**Right** (inline N times to match engine cap):

```
{"id":"node","type":"object","isCollection":true,"objectTypeDef":[
  ...same property descriptors as parent...,
  {"id":"node","type":"object","isCollection":true,"objectTypeDef":[
    ...repeated...
  ]}
]}
```

## UI Components Cannot Reference Custom Enums in vars / inParams / outParams

In **`vars`**, **`inParams`**, and **`outParams`** on **UI components** (editors, forms, selectors, hubs, grids), property descriptors **cannot** use `objectType: "<Package>.e_<enum>"` references. The platform's TS-validation pass for UI-component param declarations does not resolve custom `$types.*` namespaces and produces:

```
Cannot find namespace '_types'. Did you mean 'Type'?
```

(The `_types` token is an artifact of the platform rewriting `$types` to `_types` at some processing stage. The error message looks confusing but the cause is the enum reference in a UI-param declaration.)

**Workaround:** declare the field as the underlying primitive that matches the enum's runtime value, then cast at the use site inside flow code.

| Enum kind | Declaration in vars/inParams/outParams | Usage in flow code |
|---|---|---|
| String-valued (`isStringValue: true`) | `{"type":"string","objectType":null,"objectTypeDef":null,...}` | `const v = $form.fields.x.control.value as $types.<Package>.e_<enum>;` |
| Number-valued (`isStringValue: null`) | `{"type":"number","objectType":null,"objectTypeDef":null,...}` | same cast pattern |

**Scope of the constraint:** UI components only. Flow-tier components (actions, functions, flow datasources) and custom-type files themselves can declare `objectType: "<Package>.e_<enum>"` references freely — only UI-component vars/inParams/outParams are affected.

## Tightening a Previously-Loose Type Ripples to Consumers

When a type is already in use, tightening it — adding required fields, removing optional ones, narrowing a property from `object` to a specific shape, or rewriting `objectTypeDef` from `null` to a strict schema — can break callers that previously got an implicit `any` and accessed properties the new type doesn't declare. Flow code that referenced `suggestion.preallocation_actions` while the type had only `{type, location_id, …}` typed compiled cleanly when the type was loose; once tightened, every reference site fails on the platform's strict pass.

**Before any tightening edit**, invoke the `impact-analysis` skill on the type's FQN to enumerate every reference site, then audit each one against the new shape. Net-new types skip this — nothing references them yet.
