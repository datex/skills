---
name: app-config-editor
description: |
  Use when editing a package's Datex Studio application configuration singleton
  (configurationTypeId=32, CLI type `appconfig`, fixed referenceName `appConfig`)
  on a branch — the package's `settings[]` (connection bindings and literal values
  read as `$settings.<Package>.<name>`) and its `references[]` dependency manifest.
  Owns the singleton rule (one per package, edit in place; delete and re-create only from a saved body,
  edit the own row only), the `settingType` union (1 = connection binding, 2 =
  literal), the hard secret-redaction rule (appConfig holds connection names and
  API keys in plaintext), the storage/OData connection gates, and routing
  `references[]` changes to `package-cascade`. Triggers: "add a setting to the
  package", "wire a MongoDB connection for storage", "edit appConfig",
  "$settings.<Package>", "There must be exactly one storage connection string
  configured", "DXS-DS-021", "bump a package reference", "create an appConfig".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - impact-analysis
  - package-cascade
  - storage-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# App Config Editor

Edit a package's **application configuration** singleton (configurationTypeId=32) on a branch. Every application and package already has exactly one, with the fixed `referenceName: "appConfig"`; this skill only ever **edits its `settings[]`** — adding, changing, or retiring a connection binding or a literal setting that code reads as `$settings.<Package>.<name>`. The same body also carries `references[]`, the package's dependency manifest, which this skill never hand-edits.

**appConfig holds secrets in plaintext** (connection bindings, API keys stored as literal settings). The redaction rule below is a hard rule of this skill, not a style preference.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/app-config.md](references/app-config.md) — Authoritative reference: body shape, the `settingType` union, `references[]`, the `$settings` surface, gates, pre-flight checklist
- [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md) — Shared lifecycle for every auto-provisioned singleton: own-row discovery, envelope secrets, `readonly`, write path, edit in place, delete and re-create only from a saved body
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — envelope vs inner body, validate exit codes, lock failure modes
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — `$settings.<Package>` and the `$utils.http` base-URL rule that reads it
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md#configurationtypeid-reference) — `configurationTypeId` ↔ CLI type table

## Dependencies

- **`package-cascade`** skill — owns every `references[]` change (re-pin, bump, add a dependency) through `dxs source reference set` / `dxs source cascade`; never hand-edit `references[]`
- **`impact-analysis`** skill — invoked before renaming or removing a setting other code reads as `$settings.<Package>.<name>`
- **`storage-creator`** skill — the consumer side when the reason for a MongoDB binding is a new storage component
- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context

## CLI Lifecycle

There is **no create path**: the platform provisions the appConfig with the package. Edits go through `dxs configuration` with CLI type **`appconfig`** (lowercase), mapping to `configurationTypeId: 32`. Full rules in [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md).

**Edit the branch's own appConfig:**

```bash
# 1. Resolve the OWN row — list returns the own row plus one row per direct reference
dxs -O json configuration list appconfig -b <branchId> \
  | jq '.configurations[] | select(.applicationId == <branchId> and .isExternal == false) | .id'
# 2. Fetch and extract the body in ONE command — the envelope is never printed or kept
dxs -O json configuration get appconfig <ownId> -b <branchId> | jq '.configuration.json' > body.json
# 3. Edit body.json — settings[] only (never references[], never the tail)
# 4. Validate — gates the push; exit 1 = errors found, not a broken CLI
dxs configuration validate appconfig -b <branchId> -D body.json
# 5. Push — path A; fallbacks in the lifecycle doc (Rule 5)
dxs configuration upsert appconfig -b <branchId> -D body.json
# 6. Verify — project names only, never values
dxs -O json configuration get appconfig <ownId> -b <branchId> \
  | jq '[.configuration.json.settings[] | {name, settingType}]'
```

### Round-trip rule (critical)

Never pipe an envelope into `upsert` — it silently destroys configuration content ([../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md)). For appConfig there is a second reason: the envelope and body carry plaintext secrets, so extract in the same command as the fetch and **never print, paste, log, or diff** either one.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md; confirm the branch with the user
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Route the request]
  references[] change (bump / re-pin / add a dependency) -> `package-cascade`; stop
  "create an appConfig"                                    -> refuse; it already exists
  settings[] change                                        -> continue
        |
[Phase 3: Resolve own row + fetch]
list appconfig -> own id (applicationId == branchId, isExternal false)
get -> extract .configuration.json immediately
        |
[Phase 4: Edit settings[]]
  connection binding -> settingType 1 + apiConnectionType + apiConnectionName
  literal value      -> settingType 2 + valueType + value
  rename / remove    -> invoke `impact-analysis` first
        |
[Phase 5: Validate + push]
validate appconfig -> upsert appconfig (path A) -> lifecycle fallbacks if refused
        |
[Phase 6: Verify + gates]
round-trip fetch (names only) -> dxs source branch validate (storage gate)
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Route the request

- **`references[]` is not this skill's job.** It is the package's dependency manifest (direct and indirect references, pinned versions, pin-time settings snapshots), rebuilt by the CLI. Any change — bump a reference, pin a new version, add a dependency — goes to [`package-cascade`](../package-cascade/SKILL.md), which drives `dxs source reference set` and `dxs source cascade`. A branch whose only pending change is an appConfig reference bump is a routine "sync-only" diff, not a meaningful change.
- **Edit the existing appConfig in place; delete and re-create only from a saved body, never a second instance.** One already exists for every package; if you cannot find the own row, you are on the wrong branch or filtering the wrong field.

### Phase 4: Edit `settings[]`

Each entry is one of two shapes, discriminated by `settingType` (full table in [references/app-config.md → settings[]](references/app-config.md#settings--the-settingtype-union)):

1. **Connection binding** (`settingType: 1`, `ApiConnection`) — `{name, description, settingType: 1, apiConnectionType, apiConnectionName}`. `apiConnectionType` 1 = FootPrintApi, 8 = MongoDb, 9 = Amqp, 10 = Sftp, 11 = Tcp, 12 = MsSql (codes 2–7 do not exist). `apiConnectionName` must be the `name` of an existing organization connection of the same type — find it with `dxs -O json organization connection list | jq '.footprint_connections[] | {name, apiConnectionTypeId}'` (never print `connectionString`).
2. **Literal** (`settingType: 2`) — `{name, description, settingType: 2, valueType, value}`. `valueType` 2 = boolean, 3 = string, 4 = number, 5 = date, 6 = time.

`dxs configuration validate appconfig` does **not** check `settingType`, `apiConnectionType`, or `valueType` codes — a wrong code validates clean. Take codes from the reference doc, never guess.

`name` is the code-facing key: it becomes `$settings.<Package>.<name>`. Renaming or removing one breaks every reader — run [`impact-analysis`](../impact-analysis/SKILL.md) first.

### Phase 6: Verify + gates

- `dxs source branch validate <branchId>` fails with **"There must be exactly one storage connection string configured"** once the package has a storage component and its appConfig has no (or more than one) MongoDB binding. Component-level `validate` never catches it.
- A missing Footprint API binding surfaces at datasource generation: `dxs datasource generate -c <connection>` fails with `DXS-DS-021` when that connection isn't bound in the branch's appConfig ([branch-setup.md → Auto-resolving `--api-setting-name`](../datex-studio-shared/branch-setup.md#auto-resolving---api-setting-name)).

## Pre-Flight Checklist

Walk the full checklist in [references/app-config.md → Pre-Flight Checklist](references/app-config.md#pre-flight-checklist). The fast version:

1. **Lifecycle basics** — branch confirmed; own row resolved by `applicationId == <branchId>` and `isExternal == false`; no hardcoded id; no second instance created, and no delete without a saved body to restore from ([../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md)); universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) apply to every new setting's `description`.
2. **Secrets redacted** — no envelope printed; no `settingType: 1` value or key-like literal echoed in any output, report, or diff.
3. **Only `settings[]` edited** — `references[]` and the body tail unchanged.
4. **Codes from the table** — `settingType`, `apiConnectionType`, `valueType` match the reference doc (validate won't catch a wrong one).
5. **Binding names exist** — `apiConnectionName` is an existing organization connection of the matching type.
6. **Renames/removals** went through `impact-analysis`.
7. **Branch gate** — `dxs source branch validate` clean (exactly one MongoDB binding if the package has storage).

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/app-config.md → Common Failure Modes](references/app-config.md#common-failure-modes). The ones that bite most often:

- **Printing the envelope or the body** "to check it" — leaks every connection binding and API key. Project names only.
- **Hand-editing `references[]`** — route to `package-cascade`.
- **Creating an appConfig** (or upserting a skeleton) — it already exists; edit the own row.
- **Editing a dependency row** — a row with `isExternal: true` belongs to a referenced package; its `applicationId` is a snapshot, not a branch.
- **Trusting validate for codes** — a wrong `valueType` or `apiConnectionType` validates clean.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
