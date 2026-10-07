# User Configuration — Editing Reference

Authoritative reference for the Datex Studio **user configuration** singleton (`configurationTypeId: 37`, CLI type `userconfig`, fixed `referenceName: "userConfig"`). The component declares the **schema** of per-user settings for one package; the **values** are per-user runtime state read and written through [`$userSettings.<Package>`](../../datex-studio-runtime/runtime-globals.md#usersettings--per-user-settings). It is one of the auto-provisioned singletons: the shared lifecycle (find the own row, edit in place; delete and re-create only from a saved body) lives in [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md); this doc covers only what is specific to `userConfig`.

> Distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Edit a package's `userConfig` when a feature needs a value that is **per user** and **per package** — a remembered default warehouse, a layout preference, a beta opt-in flag. Every package has exactly one `userConfig`; most carry `settings: null` (no per-user state yet), and it is common for only one package in an organization to have a populated schema.

Pick something else when:

- the data is **shared across users** or multi-row → a storage component ([../../storage-creator/references/storage.md](../../storage-creator/references/storage.md));
- the value is **application-level configuration** (connection names, environment literals) → the package's app configuration singleton (`appconfig`, cti 32), not this one.

The usual shape of the work is a pair: a schema edit here plus a consumer (typically a preferences form via [`form-creator`](../../form-creator/SKILL.md), sometimes a resolver function via [`function-creator`](../../function-creator/SKILL.md)) that reads and writes the new setting.

## File Location & Naming

- `configurationTypeId: 37`; CLI type argument **`userconfig`** (lowercase). `dxs source changes` reports the type string `userConfig`.
- `referenceName` is **always `"userConfig"`** and `title` is `"User configuration"` — fixed by the platform, never renamed. One instance per package.
- Conventional file name `userConfig-userConfig.json` (`<referenceName>-<typeSuffix>.json`) — a naming convention only; the branch is the system of record.
- Provisioned with the package; edit it in place. Delete and re-create only from a saved body, never a second instance. See [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md).

## Minimal Valid Skeleton

The provisioned, empty form — what a package without per-user settings carries (validates clean):

```json
{
  "settings": null,
  "configurationTypeId": 37,
  "id": 0,
  "referenceName": "userConfig",
  "title": "User configuration",
  "description": "User configuration for settings",
  "inParams": null, "outParams": null, "vars": null, "events": null,
  "accessModifier": "public"
}
```

On a real edit `id` is the **own row's** id from the fetched body, never `0`. A populated schema — one flat flag, one nested object, one string collection:

```json
{
  "settings": [
    { "id": "beta_opt_in", "required": false, "type": "boolean", "isCollection": false, "isSecured": false, "objectTypeDef": null },
    { "id": "defaults", "required": false, "type": "object", "isCollection": false, "isSecured": false,
      "objectTypeDef": [
        { "id": "warehouse_id", "type": "number", "isCollection": false, "isSecured": false },
        { "id": "owner_id", "type": "number", "isCollection": false, "isSecured": false }
      ] },
    { "id": "hidden_columns", "required": false, "type": "string", "isCollection": true, "isSecured": false, "objectTypeDef": null }
  ],
  "configurationTypeId": 37,
  "id": "<own row id>",
  "referenceName": "userConfig",
  "title": "User configuration",
  "description": "User configuration for settings",
  "inParams": null, "outParams": null, "vars": null, "events": null,
  "accessModifier": "public"
}
```

Fetched bodies carry every descriptor slot (`description`, `oneOf`, `fromBaseConfiguration`, `removed`, `objectType`, `isConstant`, `constantValue`, mostly `null`); leave them as fetched. Absence of a key in a body is not schema evidence — see [configuration-roundtrip.md → Fetched Bodies Omit Null Keys](../../datex-studio-shared/configuration-roundtrip.md#fetched-bodies-omit-null-keys--absence-is-not-schema-evidence).

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `settings` | The per-user settings schema | `null` when the package has none, else an array of **parameter descriptors** (below). Optional in the sense that `null` is valid. |
| `configurationTypeId` | Type | `37` |
| `id` | Identity | The own row's id (from the fetched body) |
| `referenceName` | Fixed handle | `"userConfig"` — never change |
| `title` | Display | `"User configuration"` — the platform default; exception to the "title is a distinct display name" rule |
| `description` | Searchable description | Non-empty, ≤100 chars; the provisioned default is fine |
| `accessModifier` | Visibility | `"public"` |
| `inParams` / `outParams` / `vars` / `events` | Unused tail | `null` |

### `settings[]` descriptor

Each entry is the same **parameter-descriptor primitive** used by `inParams`/`outParams` on every component:

| Key | Notes |
|---|---|
| `id` | snake_case setting key; becomes a property on `I<Package>UserSettings` |
| `type` | `boolean` \| `number` \| `string` \| `object`. The server deserializes it into its `JSType` enum — a non-member (e.g. `"date"`) is rejected with an HTTP 400 (`Error converting value … to type '…JSType'`), not a `validation_errors` list. |
| `isCollection` | `true` makes it an array of `type` (string collections are observed in production) |
| `isSecured` | `false` on every observed setting |
| `required` | `false` on every observed setting; what `required: true` would enforce on a per-user object is `_TODO_` — leave it `false` |
| `objectTypeDef` | For `type: "object"` — a nested array of descriptors (same shape). Production uses one level; two levels pass `validate` (verified live, dxs 0.5.8), runtime behaviour of deeper nesting `_TODO_` |

**`validate` checks little here.** It rejects a non-member `type` (the 400 above) but accepts duplicate setting `id`s and ids that are not valid identifiers (verified live, dxs 0.5.8); `configuration contexts userconfig` returns no designer context to inspect. Uniqueness and snake_case are on you.

## Runtime Globals

N/A for the component itself — `userConfig` carries no flows or code strings. Its consumer surface is the UI-tier global `$userSettings.<Package>` with four Promise-returning methods (`get` / `set` / `update` / `remove`); full signatures and semantics live in [runtime-globals.md → `$userSettings`](../../datex-studio-runtime/runtime-globals.md#usersettings--per-user-settings). Confirmed at the UI tier (form flow code); function/action-tier availability `_TODO_`.

## Invocation Contract

- **Generated interface.** Codegen emits `I<Package>UserSettings` from the branch's `settings[]`. Flow code that reads a key the branch's `userConfig` doesn't declare fails `dxs configuration validate` with `Property '<key>' does not exist on type 'I<Package>UserSettings'`.
- **Same-branch rule.** The interface is regenerated **per branch**, so a consumer component and the schema change it relies on must land on the **same branch**. Splitting them leaves the consumer red until both meet.
- **Cross-package consumers** see only the owning package's **published** schema — see [runtime-globals.md → Unpublished Cross-Package Surfaces](../../datex-studio-runtime/runtime-globals.md#unpublished-cross-package-surfaces).
- **Removing or renaming a setting** is a contract break for every consumer — run [`impact-analysis`](../../impact-analysis/SKILL.md) first; stored per-user values under the old key are not migrated (`_TODO_`: whether stale keys are dropped server-side).
- `_TODO_`: where values persist server-side; whether `get()` returns `null` or `{}` for a user who never saved.

## Common Patterns

### Read on init, write with read-then-`set()`

`update()` **cannot clear** a value: its merge drops `null`/cleared keys, so a cleared field rehydrates on the next load (verified live). Clearing therefore needs the full-replace path, and `set()` replaces the whole object, so spread the current value to keep sibling settings:

```ts
// on_init — read defensively: a first-time user may have no persisted object
const settings = await $userSettings.<Package>.get();
$form.fields.warehouse_id.control.value = settings?.defaults?.warehouse_id ?? null;

// on save — read-then-set() full replace
const current = (await $userSettings.<Package>.get()) ?? ({} as any);
const defaults: any = {};
if ($utils.isDefined(warehouse_id)) { defaults.warehouse_id = warehouse_id; }  // cleared keys omitted, not nulled
if ($utils.isDefined(owner_id)) { defaults.owner_id = owner_id; }
await $userSettings.<Package>.set({ ...current, defaults: defaults });           // spread keeps sibling settings
```

### Mode flag + resolver function

A boolean setting can select **how** a default is resolved rather than storing the value. Example: a `defaults.is_warehouse_by_activity` flag makes consumers call a resolver function (`$flows.<Package>.<resolver_flow>({})`, wrapping the legacy lookup) instead of reading `defaults.warehouse_id`. Keep the resolver call inside the mode branch so the other modes pay nothing:

```ts
const prefs = (await $userSettings.<Package>.get())?.defaults;
const byActivity = prefs?.is_warehouse_by_activity ?? !$utils.isDefined(prefs);   // unset → legacy behaviour
const warehouseId = byActivity
  ? (await $flows.<Package>.<resolver_flow>({})).<out_param>
  : prefs?.warehouse_id ?? null;
```

**Unset settings fall back to the legacy mode** (`?? !$utils.isDefined(prefs)`) so upgrade-day behaviour matches what users had before they ever saved preferences; the preferences form's first-open hydration mirrors the same fallback.

### Add a setting descriptor

```bash
jq '.settings = ((.settings // []) + [{"id":"<setting_id>","required":false,"type":"boolean","isCollection":false,"isSecured":false,"objectTypeDef":null}])' \
  body.json > body.next.json && mv body.next.json body.json
```

`.settings // []` covers the provisioned `settings: null`. For `type: "object"` replace `objectTypeDef` with an array of nested descriptors (`{"id":"<field_id>","type":"number","isCollection":false,"isSecured":false}`). Use a snake_case `id` that is not already in `settings[]`: `validate` accepts duplicates, so uniqueness is on the author. Consumers can use the new key immediately on the same branch via `$userSettings.<Package>`, because the generated `I<Package>UserSettings` is regenerated from the branch's descriptors; no publish is needed for same-package code.

### Remove or rename a setting descriptor

First find the consumers of `$userSettings.<Package>` with [`impact-analysis`](../../impact-analysis/SKILL.md) (`dxs source explore reverse-trace userConfig --branch <branchId>`); consumers read the global rather than reference the component, so if the trace does not surface the code that reads the key, fetch the likely consumers (preferences forms, resolver functions) and search their code for `<setting_id>`. A consumer that still reads a removed key fails with `Property '<setting_id>' does not exist on type 'I<Package>UserSettings'`.

```bash
jq 'if .settings then .settings |= map(select(.id != "<setting_id>")) else . end' \
  body.json > body.next.json && mv body.next.json body.json
```

Stored per-user values under the old key are not migrated, and whether the server drops them is `_TODO_`; treat them as orphaned and have consumers ignore unknown keys. A rename is a removal of `<old_id>` plus an addition of `<new_id>` (previous pattern) together with a consumer migration on the same branch: consumers read `<new_id>`, falling back to `<old_id>` for users whose value has not been re-saved, until the old key is no longer needed.

## Pre-Flight Checklist

1. **Own row, not a dependency's.** Edit the row with `applicationId == branchId` and `isExternal == false` — the singleton lifecycle in [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md). Never create a second `userConfig`; delete and re-create only from a saved body.
2. **Fixed identity.** `referenceName: "userConfig"`, `configurationTypeId: 37`, `title: "User configuration"` unchanged; `description` non-empty ≤100 — plus the universal checks ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)).
3. **Additive by default.** New descriptors appended; existing ids not renamed or retyped without an `impact-analysis` pass.
4. **Descriptor sanity.** Unique snake_case `id`s (validate does **not** catch duplicates or non-identifiers); `type` ∈ `boolean|number|string|object`; `objectTypeDef` only on `type: "object"`; `isCollection` set explicitly.
5. **Same branch.** The consumer that reads/writes the new key is on the same branch as the schema edit.
6. **Consumers never `set()` a partial object** — spread `current` first.
7. **Clearing goes through read-then-`set()`**, never `update()` with `null`.
8. **Consumers read defensively** (`settings?.x?.y`) — no guarantee a persisted object exists.
9. **Validate gates the write.** `dxs configuration validate userconfig` before the write; exit 1 = findings, not a broken CLI.

## Cross-References

- [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) — own-row discovery, `readonly`, write path, never-create rule (shared by every singleton editor)
- [runtime-globals.md → `$userSettings`](../../datex-studio-runtime/runtime-globals.md#usersettings--per-user-settings) — consumer API
- [file-format.md → `configurationTypeId` Reference](../../datex-studio-conventions/file-format.md#configurationtypeid-reference)
- [configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — envelope / inner-body rule, validate exit codes
- [../../form-creator/references/forms.md](../../form-creator/references/forms.md) — the usual consumer (a preferences form)
- [../../storage-creator/references/storage.md](../../storage-creator/references/storage.md) — the shared, multi-row alternative
