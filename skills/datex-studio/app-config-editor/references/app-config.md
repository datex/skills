# App Config — Authoring Reference

Authoritative reference for the Datex Studio **application configuration** singleton (`configurationTypeId: 32`, CLI type `appconfig`, fixed `referenceName: "appConfig"`). Every application and package has exactly one. It carries two arrays: `settings[]` — the package's connection bindings and literal values, read in code as `$settings.<Package>.<name>` — and `references[]`, the package's dependency manifest. The shared singleton lifecycle (own-row discovery, envelope secrets, write path, edit in place, delete and re-create only from a saved body) lives in [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) and is not repeated here.

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Edit the appConfig when a package needs to:

- **bind a connection** — the Footprint API (OData datasources, actions, `$utils.http` from functions) or MongoDB (storage components via `$db`);
- **carry a literal setting** — a date format, an export limit, a third-party API key — that code reads by name instead of hardcoding.

The appConfig has a **dual role**: besides `settings[]` it holds `references[]`, rebuilt every time a reference is re-pinned. A branch whose only pending change is an appConfig reference bump is a routine sync-only diff. Reference changes belong to [`package-cascade`](../../package-cascade/SKILL.md) (`dxs source reference set`), never to a hand edit.

Per-user preferences are **not** appConfig settings — they belong to the `userConfig` singleton ([`user-config-editor`](../../user-config-editor/SKILL.md)).

## File Location & Naming

- `configurationTypeId: 32`; CLI type `appconfig`; fixed `referenceName: "appConfig"` (camelCase), `title: "Application configuration"`, `description: "Application configuration for settings and references"` — all provisioned, never changed.
- Conventional file name: `appConfig-appConfig.json` if the body is kept on disk at all — a naming convention only; the branch is the system of record. Given the secrets, prefer not to keep it on disk past the edit.
- Setting `name`s are code-facing identifiers (`$settings.<Package>.<name>`): PascalCase is the observed convention (`FootprintApi`, `MongoDb`, `DateFormat`, `ExcelExportLimit`). Each setting carries its own `description` — keep it non-empty and ≤100 chars ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)).

## Minimal Valid Skeleton

The shape of a base package's appConfig with its two connection bindings (connection names redacted). Recognise and edit against it — push it only as a restore of a deleted row, never as a second instance.

```json
{
  "settings": [
    { "name": "FootprintApi", "description": "General Api connection for the Footprint WMS.", "settingType": 1, "apiConnectionType": 1, "apiConnectionName": "<redacted>" },
    { "name": "MongoDb", "description": "MongoDb", "settingType": 1, "apiConnectionType": 8, "apiConnectionName": "<redacted>" }
  ],
  "references": [],
  "configurationTypeId": 32,
  "id": <ownId>,
  "referenceName": "appConfig",
  "title": "Application configuration",
  "description": "Application configuration for settings and references",
  "accessModifier": "public"
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `settings` | Connection bindings + literal settings | Array; union on `settingType` (below). Edited by this skill. |
| `references` | Dependency manifest | Array; direct + indirect references. **Not hand-edited** — `package-cascade`. `[]` on a package with no dependencies. |
| `configurationTypeId` | Type | `32`. |
| `id` | Own singleton id | Must equal the own row's id (resolved per the lifecycle doc). |
| `referenceName` / `title` / `description` | Identity | Fixed boilerplate; leave verbatim. |
| `accessModifier` | Visibility | `"public"`. |

### `settings[]` — the `settingType` union

| `settingType` | Meaning | Fields | Notes |
|---|---|---|---|
| `1` (`ApiConnection`) | Connection binding | `name`, `description`, `settingType`, `apiConnectionType`, `apiConnectionName` | `apiConnectionName` = the `name` of an existing organization connection whose type id equals `apiConnectionType` (verified live). |
| `2` (`Scalar`) | Literal value | `name`, `description`, `settingType`, `valueType`, `value` | `value` is stored as the literal; `valueType` decides its generated TypeScript type. |

**`apiConnectionType` codes** (from the organization connection registry, `dxs organization connection list` → `apiConnectionTypeId` / `apiConnectionTypeName`):

| Code | Connection type | Seen bound in an appConfig |
|---|---|---|
| 1 | FootPrintApi | yes |
| 8 | MongoDb | yes |
| 9 | Amqp | not observed |
| 10 | Sftp | not observed |
| 11 | Tcp | not observed |
| 12 | MsSql | not observed |

Codes 2–7 do not exist: the enum members are exactly 1 and 8–12, and nothing above 12 (captured from the Studio designer (option lists), dxs 0.5.8). The designer's connection-type dropdown lists these six names; when the appConfig already holds a MongoDb binding, it hides `MongoDb` for a new setting. Whether codes 9–12 are bindable from appConfig and how they surface in `$settings` is `_TODO_ (runtime unverified)`.

**`valueType` codes** (literal settings, `settingType: 2`):

| Code | Member |
|---|---|
| 2 | boolean |
| 3 | string |
| 4 | number |
| 5 | date |
| 6 | time |

There is no code 1 and nothing above 6 (captured from the Studio designer (option lists), dxs 0.5.8). Only `3` and `4` are observed in production bodies (reflected in the generated typings); `2`, `5` and `6` come from the designer's list. The designer clears the stored `value` whenever `valueType` changes, so set the type first, then the value.

**`settingType` codes:** `1` = `ApiConnection` (the designer's "API connection"), `2` = `Scalar` (the designer's "setting"); the enum has no other members.

**Serialization.** Live bodies carry integers, but the enums may also serialize by name (`settingType` `"ApiConnection"`, `apiConnectionType` `"FootPrintApi"`) — accept both when reading; write the integer form the body already uses ([../../datex-studio-shared/branch-setup.md](../../datex-studio-shared/branch-setup.md#select-connection)). Connection bindings carry no `valueType`/`value`; literals carry no `apiConnectionType`/`apiConnectionName` (null keys are omitted from fetched bodies).

**Validate does not check any of these codes.** A probe body with `settingType: 9` and `valueType: 99` validates clean — take codes from the tables above.

Finding a connection name without leaking secrets (the registry output includes `connectionString`):

```bash
dxs -O json organization connection list --search <text> \
  | jq '.footprint_connections[] | {name, apiConnectionTypeId, apiConnectionTypeName}'
```

A `settingType: 1` setting binds an **existing organization connection** by `apiConnectionName`; it does not create one. Connections are created and edited by an administrator in Studio, and the CLI only lists them: `dxs organization connection list` (name, type) and `dxs organization connection get <id>`. Observed `apiConnectionType` codes: 1 Footprint API, 8 MongoDB, 9 AMQP, 10 SFTP, 11 TCP, 12 MsSql. To wire a connection a package does not have yet (for example the MongoDB connection that storage components require), pick an existing connection of the right type from that list and add the binding; if no suitable connection exists, the request goes to an administrator before the appConfig edit.

### `references[]` — dependency manifest (read-only for this skill)

| Field | Meaning |
|---|---|
| `uniqueIdentifier` | The referenced package's identity (string). |
| `referenceName` | The referenced package's name. |
| `version` | Pinned published version, `YYYYMMDD.HHMMSS`. |
| `isDirect` | `true` for a direct reference; `false` for an indirect (transitive) one. Indirect references never appear as `configuration list` rows. |
| `settings` | Snapshot of the referenced package's `settings[]` at pin time — may contain secrets; redaction applies. |
| `settingsMappings` | `[{from, to}]` wiring between the referenced package's setting names and this package's. Every observed mapping is identity (`from == to`); direction `_TODO_`. Indirect references carry none; a few direct ones carry none (effect `_TODO_`). |

Any change here goes through [`package-cascade`](../../package-cascade/SKILL.md).

The CLI only re-pins an existing direct reference (`dxs source reference set -b <branch> -p <uniqueIdentifier> -v <version>`); adding or removing one is done by editing `references[]` in the package's own appConfig and upserting it. Verified end to end on a feature branch (dxs 0.5.8):

1. **Add**: append an entry `{uniqueIdentifier, referenceName, version, isDirect: true, settings, settingsMappings}` — copy the shape from a package that already references the same module (its `settings` block is the referenced package's own connection settings, its `settingsMappings` map each of them to a setting of the referencing package) — then `dxs configuration upsert appconfig`. `dxs source deps --branch <branch>` lists it immediately. Follow with `dxs source reference set` for the same version: it accepts the hand-added reference and rebuilds the transitive references (the referenced package's own dependencies appear with `isDirect: false`).
2. **Every connection setting of the referenced package must be mapped to a setting that exists on the referencing package.** A mapping to a setting the package does not have fails `dxs source branch validate` with `Module <Package> setting <Name> is mapped to missing setting <Name>` and a codegen error (`Cannot find namespace '<App>_<Name>'`); dropping the mapping instead makes branch validate fail with a bare `Sequence contains no elements` (DXS-API-500). Add the missing setting to the referencing package (same `name`, a connection binding of the same `apiConnectionType`) before adding the reference.
3. **Remove**: upsert the body with the entry removed — `dxs source deps` goes empty and branch validate passes. Do not gate the removal on `dxs configuration validate appconfig`: for references that command reports the branch's *current* reference registry, not the submitted body, so it keeps reporting the old reference's errors until the upsert has landed. Run `dxs source branch validate` after the upsert instead.

Prefer `package-cascade` for version bumps across many packages; use the body edit only to add or remove a reference.

## Runtime Globals

N/A inside the appConfig — it has no code strings. Its consumer surface is `$settings.<Package>.<name>` ([../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md)). The generated typings show two surfaces:

| Interface | Contents per package | Typing |
|---|---|---|
| `ISettingsService` | every setting | literal → `string` (`valueType` 3) / `number` (4); Footprint API binding → `{ url: string }`; MongoDB binding → `any` |
| `IFrontendSettingsService` | **literal settings only** — no connection bindings | same literal typing |

So server-side code reads a Footprint API base URL as `$settings.<Package>.FootprintApi.url` (the `$utils.http` function-tier rule in runtime-globals), while the frontend surface exposes only literals. Which tier binds which interface is `_TODO_ (runtime unverified)`; the implication — a literal setting is on the frontend settings surface and may reach the browser — means an API key stored as a literal should be treated as browser-visible until proven otherwise.

## Invocation Contract

- **Readers** reference settings by name: `$settings.<Package>.<name>`. A rename or removal breaks every reader — run [`impact-analysis`](../../impact-analysis/SKILL.md) (`dxs source explore reverse-trace`) first. Settings are invisible to component wiring (`configParameters`/`moduleId` do not apply).
- **Consumers of this package** receive its settings through their own `references[].settingsMappings`; renaming a setting a consumer maps is a contract change for them too (inferred from the mapping shape — `_TODO_ (runtime unverified)`).
- **Gates:**
  - `dxs source branch validate` → **"There must be exactly one storage connection string configured"** when the package has a storage component and not exactly one MongoDB binding (verified via validate). Component `validate` never reports it; storage components are inert until the binding exists.
  - A missing Footprint API binding surfaces when generating a datasource: `dxs datasource generate -c <connection>` fails with `DXS-DS-021` if that connection isn't bound in the branch's appConfig ([../../datex-studio-shared/branch-setup.md](../../datex-studio-shared/branch-setup.md#auto-resolving---api-setting-name)). The setting's `name` (not `apiConnectionName`) is what a datasource's `apiSettingName` refers to.

## Common Patterns

### Add a literal setting

```bash
jq '.settings += [{"name":"ExportRowLimit","description":"Maximum rows exported to Excel.","settingType":2,"valueType":4,"value":5000}]' body.json > body.next.json && mv body.next.json body.json
```

Then validate → upsert, and read it as `$settings.<Package>.ExportRowLimit`. Store `value` as the JSON type matching `valueType`: a JSON number for `4`, a JSON string for `3` (observed on production bodies).

### Wire MongoDB for a new storage component

Add one `settingType: 1`, `apiConnectionType: 8` entry naming an existing MongoDb organization connection, then confirm `dxs source branch validate` no longer reports the storage-connection gate. Exactly one MongoDB binding per package.

### Report a change without leaking secrets

```bash
jq '[.settings[] | {name, settingType, apiConnectionType, valueType}]' body.json
```

Never `cat body.json`, never diff whole bodies.

## Pre-Flight Checklist

1. **Lifecycle** — branch confirmed; own row by `applicationId == <branchId>` and `isExternal == false`; edit the existing row; delete and re-create only from a saved body, never a second instance ([../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md)).
2. **Secrets** — envelope never printed or kept; `apiConnectionName` values and key-like literals redacted everywhere you show output; `dxs source branch settings` output treated the same way.
3. **Scope** — only `settings[]` edited; `references[]` and the tail (`configurationTypeId`, `id`, `referenceName`, `title`, `description`, `accessModifier`) unchanged.
4. **Codes** — `settingType`, `apiConnectionType`, `valueType` from the tables above.
5. **Binding target exists** — `apiConnectionName` names an organization connection of the same type id.
6. **Descriptions** — each new setting's `description` non-empty, ≤100 chars.
7. **Impact** — renames/removals cleared by `impact-analysis`.
8. **Validate** — `dxs configuration validate appconfig` before the write; `dxs source branch validate` after (storage gate).
9. **Verified** — round-trip fetch projected to names only; no lock left held.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `There must be exactly one storage connection string configured` on branch validate | Package has storage but no (or several) MongoDB bindings | Add/remove `settingType: 1`, `apiConnectionType: 8` entries until exactly one remains. |
| `DXS-DS-021` from `dxs datasource generate` | The `-c` connection is not bound by any Footprint API setting in the package's appConfig | Add a `settingType: 1`, `apiConnectionType: 1` binding naming that connection, or pass `--api-setting-name`. |
| Setting validates but code sees the wrong type / nothing | Wrong `valueType` or `settingType` code — validate does not check them | Use the code tables. |
| `$settings.<Package>.<name>` fails to compile after an edit | Setting renamed/removed with live readers | Restore it or update every reader found by `impact-analysis`. |
| Secrets in a transcript or report | Envelope or full body printed | Rotate the exposed key with its owner; from then on project names only. |
| Reference bump hand-edited, branch validate errors | `references[]` edited with `jq` | Revert; re-pin through `package-cascade` / `dxs source reference set`. |
| Upsert refused or pushes to the wrong row | Body `id` from a dependency row, or `--allow-external` used | Re-resolve the own row; never use `--allow-external` on a singleton. |

## Cross-References

- [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) — own-row discovery, envelope secrets, `readonly`, write path.
- [../../package-cascade/SKILL.md](../../package-cascade/SKILL.md) — every `references[]` change.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) — `$settings` and the `$utils.http` base-URL rule.
- [../../storage-creator/SKILL.md](../../storage-creator/SKILL.md) — storage components that need the MongoDB binding.
- [../../user-config-editor/SKILL.md](../../user-config-editor/SKILL.md) — per-user settings (a different singleton).
- [../../impact-analysis/SKILL.md](../../impact-analysis/SKILL.md) — callers of a setting before rename/removal.
