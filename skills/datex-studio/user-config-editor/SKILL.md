---
name: user-config-editor
description: |
  Use when editing a package's Datex Studio user configuration singleton
  (configurationTypeId=37, CLI type `userconfig`, fixed referenceName `userConfig`)
  on a branch — the per-user settings schema behind `$userSettings.<Package>`.
  Owns the singleton rule (one per package, edit in place; delete and re-create only from a saved body,
  edit the own row only), the `settings[]` parameter-descriptor shape (nested
  objects via `objectTypeDef`), the per-branch `I<Package>UserSettings` interface
  (schema and consumer land on the same branch), and the consumer patterns:
  defensive reads, `update()` cannot clear, read-then-`set()` with spread, mode
  flag + resolver function. Triggers: "add a user setting", "remember the user's
  default warehouse", "per-user preference", "user preferences form", "edit
  userConfig", "$userSettings", "Property does not exist on type
  I<Package>UserSettings", "cleared preference comes back after reload",
  "saving one preference wiped the others", "create a userConfig".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - form-creator
  - function-creator
  - impact-analysis
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# User Config Editor

Edit a package's **user configuration** singleton (configurationTypeId=37) on a branch — the schema of per-user settings whose values the UI tier reads and writes through `$userSettings.<Package>`. Every package already has exactly one, with the fixed `referenceName: "userConfig"`; this skill only ever **edits** it (adds, extends, or retires `settings[]` descriptors) and wires the consumer that uses the new setting.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/user-config.md](references/user-config.md) — Authoritative reference: body shape, `settings[]` descriptor, `I<Package>UserSettings` contract, consumer patterns, pre-flight checklist
- [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md) — Shared lifecycle for every auto-provisioned singleton: own-row discovery, `readonly`, write path, edit in place, delete and re-create only from a saved body
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md#usersettings--per-user-settings) — `$userSettings.<Package>` `get`/`set`/`update`/`remove` semantics
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — envelope vs inner `.json` body, validate exit codes
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md#configurationtypeid-reference) — `configurationTypeId` ↔ CLI type table
- [../form-creator/references/forms.md](../form-creator/references/forms.md) — the usual consumer: a preferences form

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`form-creator`** skill — invoked to author or edit the preferences form that reads/writes the new setting
- **`function-creator`** skill — invoked when a mode-flag setting needs a resolver function
- **`impact-analysis`** skill — invoked before renaming, retyping, or removing an existing setting (every consumer of `I<Package>UserSettings` breaks)
- **`component-wiring-check`** skill — invoked when the consumer is wired into a host (a hub toolbar or shell menu opening the preferences form)

## CLI Lifecycle

`userconfig` is a regular CLI type (verified live, dxs 0.5.8) — the generic `dxs configuration` round-trip applies. There is **no create step**: the platform provisions one `userConfig` per package. `configuration list` returns the own row plus one row per dependency package, commonly `readonly: true`; that flag is not reliable evidence either way (see Rule 2) — the own row is the one with `applicationId == branchId` and `isExternal == false`. Full detail in [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md).

**Edit the singleton:**

```bash
# 1. Find the own row (dependency packages' rows are listed too)
dxs -O json configuration list userconfig -b <branchId> \
  | jq '.configurations[] | select(.applicationId == <branchId> and .isExternal == false)'
# 2+3. Fetch AND extract the inner body in one command — a bare referenceName resolves to the
#      branch's own row; never keep the envelope (it embeds the appConfig body, secrets included)
dxs -O json configuration get userconfig userConfig -b <branchId> | jq '.configuration.json' > body.json
# 4. Edit body.json → settings[]
# 5. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate userconfig -b <branchId> -D body.json
# 6. Write — path A upsert, falling back to B (lock + update <ownId>) then C (Studio designer)
dxs configuration upsert userconfig -b <branchId> -D body.json
# 7. Re-fetch the own row, confirm the edit landed, confirm no lock is left held
```

Rows commonly report `readonly: true`, but that flag does **not** block a CLI write (verified live — path A/`upsert` succeeded first try on the own row); `upsert` by a reference name the branch also inherits from every referenced package is a known resolution trap. Use the ordered write paths in [singleton-config-lifecycle.md → Rule 5](../datex-studio-shared/singleton-config-lifecycle.md#rule-5--the-write-path-under-readonly-true) — never `create`, never `--allow-external` — rather than guessing.

### Round-trip rule (critical)

Never pipe an envelope into a write — it silently destroys configuration content. Extract the inner body at fetch time (`jq '.configuration.json'` on stdout, `jq .json` on an `-O` file), and never print or keep a singleton envelope: it embeds a full copy of the package's appConfig ([singleton-config-lifecycle.md → Rule 4](../datex-studio-shared/singleton-config-lifecycle.md#rule-4--the-envelope-hazard-secrets)). See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Per-user setting? decision]
  per user + per package value          -> userConfig (this skill)
  shared across users / multi-row       -> storage (storage-creator); stop here
  app-level configuration               -> appconfig singleton; stop here
        |
[Phase 3: Locate + fetch the own row]
list userconfig -> own row (applicationId == branchId, isExternal == false)
get userconfig userConfig | jq '.configuration.json' > body.json
Asked to "create a userConfig"?  -> refuse; one already exists, edit it
        |
[Phase 4: Edit settings[]]
Append descriptors (additive); nested shapes via objectTypeDef.
Rename / retype / remove an existing id?  -> invoke `impact-analysis` first
        |
[Phase 5: Validate + write]
dxs configuration validate userconfig -b <branchId> -D body.json
write per singleton-config-lifecycle.md
        |
[Phase 6: Consumer on the SAME branch]
invoke `form-creator` (preferences form) / `function-creator` (resolver)
read defensively; save = read-then-set() with spread
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 3: Locate + fetch the own row

`configuration list userconfig` on a package with N direct dependencies returns N+1 rows, every one titled "User configuration" and commonly `readonly: true` — that flag is not reliable evidence of writability (see [singleton-config-lifecycle.md → Rule 2](../datex-studio-shared/singleton-config-lifecycle.md#rule-2--resolve-the-branchs-own-row-by-applicationid-never-by-a-hardcoded-id)/[Rule 5](../datex-studio-shared/singleton-config-lifecycle.md#rule-5--the-write-path-under-readonly-true)). Only the row whose `applicationId` equals the branch id and whose `isExternal` is `false` belongs to this package; the rest are dependency packages' singletons and cannot be edited from here. A bare `get userconfig userConfig` resolves to the own row (verified live). A request to **create** a userConfig — or a second one — is always a misunderstanding: the package already has one; edit it.

### Phase 4: Edit `settings[]`

`settings` is `null` on a package with no per-user state; replace it with an array. Each entry is the standard parameter descriptor (`id`, `type` ∈ `boolean|number|string|object`, `isCollection`, `isSecured`, `required`, `objectTypeDef` for objects) — see [references/user-config.md → `settings[]` descriptor](references/user-config.md#settings-descriptor). Group related values under one `type: "object"` setting (e.g. `defaults{warehouse_id, owner_id}`) rather than many top-level keys; the consumer then writes the group as a unit. Keep the edit additive — renaming or retyping an id strands every stored value and breaks every consumer.

### Phase 6: Consumer on the same branch

The generated `I<Package>UserSettings` interface is regenerated **per branch** from this schema. A consumer that reads `settings.defaults.owner_id` validates only on a branch whose `userConfig` declares `owner_id`; land the schema edit and the consumer on the same branch. Consumer rules (all in [references/user-config.md → Common Patterns](references/user-config.md#common-patterns)):

```ts
const current = (await $userSettings.<Package>.get()) ?? ({} as any);   // read defensively
const defaults: any = {};
if ($utils.isDefined(owner_id)) { defaults.owner_id = owner_id; }       // cleared keys omitted, not nulled
await $userSettings.<Package>.set({ ...current, defaults: defaults });  // full replace; spread keeps siblings
```

`update()` cannot clear a value — its merge drops `null` keys and the old value comes back on reload.

## Pre-Flight Checklist

Walk the full checklist in [references/user-config.md → Pre-Flight Checklist](references/user-config.md#pre-flight-checklist). The fast version:

1. **Own row only** — `applicationId == branchId`, `isExternal == false`; never create a second `userConfig`; delete and re-create only from a saved body.
2. **Fixed identity** — `referenceName: "userConfig"`, `configurationTypeId: 37`, `title: "User configuration"` untouched — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
3. **Descriptors** — unique snake_case `id`s (validate accepts duplicates); `type` in `boolean|number|string|object`; `objectTypeDef` only on objects.
4. **Additive** — rename/retype/remove only after `impact-analysis`.
5. **Same branch** — schema edit and consumer together.
6. **Consumer writes** — read-then-`set({ ...current, ... })`; never `update()` to clear.
7. **`description`** non-null, non-empty, ≤100 chars.
8. **Validate before the write** — `dxs configuration validate userconfig`.

## Common Mistakes

The gotchas that bite most often:

- **Creating a `userConfig`** — the platform provisions exactly one per package; a second is never the answer. Edit the own row.
- **Editing a dependency's row** — the list shows every dependency package's singleton too; check `applicationId` and `isExternal`.
- **Schema on one branch, consumer on another** — the consumer fails validate with `Property '<key>' does not exist on type 'I<Package>UserSettings'`.
- **`update({ x: null })` to clear** — the merge drops the null; the old value rehydrates. Read, omit the key, `set()`.
- **`set({ defaults })` without spreading `current`** — wipes every sibling setting for that user.
- **A `type` outside `boolean|number|string|object`** — rejected with an HTTP 400 naming `JSType`, not a normal validation error.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content; extract `.configuration.json` at fetch time.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
