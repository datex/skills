# Singleton Configuration Lifecycle

Shared reference for the six **auto-provisioned singleton** configuration types — the per-package configurations that Datex Studio creates for every application and package, exactly one each, with a fixed `referenceName`. Every singleton editor skill (`app-config-editor`, `authorization-editor`, `security-policy-editor`, `replacements-editor`, `user-config-editor`, `shell-editor`) links here for the lifecycle rules they share and keeps only its type's body shape in its own reference doc.

> Provenance: distilled from production components on a Footprint package and the generated designer contexts, dxs 0.5.8.

## The six singletons

| cti | Type | CLI type | Fixed `referenceName` | Boilerplate `title` / `description` (as provisioned) | Editor skill |
|---|---|---|---|---|---|
| 1 | Shell | `shell` | `shell` | package name / package description (the shell carries the package's identity, unlike the others) | [`shell-editor`](../shell-editor/SKILL.md) |
| 28 | SecurityPolicy | `securitypolicy` | `securityPolicy` | `Security Policy` / `Security Policy` | [`security-policy-editor`](../security-policy-editor/SKILL.md) |
| 32 | AppConfig | `appconfig` | `appConfig` | `Application configuration` / `Application configuration for settings and references` | [`app-config-editor`](../app-config-editor/SKILL.md) |
| 33 | Replacements | `replacements` | `replacements` | `Replacements` / `Configuration replacements for this application` | [`replacements-editor`](../replacements-editor/SKILL.md) |
| 34 | Authorization | `authorization` | `authorization` | `Authorization` / `Authorization configuration for this application` | [`authorization-editor`](../authorization-editor/SKILL.md) |
| 37 | UserConfig | `userconfig` | `userConfig` | `User configuration` / `User configuration for settings` | [`user-config-editor`](../user-config-editor/SKILL.md) |

Note the casing: the CLI type is all-lowercase (`appconfig`), the `referenceName` is camelCase (`appConfig`). Keep the provisioned `referenceName`, `title`, and `description` exactly as fetched — they are not authoring choices.

## Rule 1 — one instance per package: edit in place, delete and re-create from a saved body

The platform provisions one instance per application/package when the package is created, so there is no "new appConfig": ordinary work **fetches and edits** that instance.

- **Ordinary work edits the existing own row** (Rules 2–3). Nothing needs a create-path `upsert`, a skeleton, or `id: 0`.
- **Delete is supported and reversible** (verified on all six types). Snapshot the body first (Rules 3 and 4), then `dxs configuration delete <clitype> <ownId> -b <branchId> --yes`. The row stays in `dxs configuration list` with the same id and `modificationTypeId: "delete"`, and `dxs source status` shows the pending change as `delete`. Restore with `dxs configuration upsert <clitype> -b <branchId> -D body.json`: it reports `"action": "updated"`, keeps the same id, and flips the pending change back to `update`. A round-trip fetch is identical to the saved body except that keys whose value is `null` come back omitted. No `id: 0` and no `--allow-external` are needed.
- **Validation while a singleton is deleted:** shell fails with `Shell configuration not found`; userConfig fails with `DXS-API-500 Sequence contains no elements`; the other four types validate clean, which proves nothing about the restored branch. Restore the row before relying on `dxs source branch validate`.
- **The one thing not to do is create a second instance** with a different `referenceName`, and never pass `--allow-external`. A second instance is accepted (two own rows of the type), but `dxs source branch validate` then fails with `An item with the same key has already been added. Key: <branchId>`, while `dxs configuration get <clitype> <fixedReferenceName>` still resolves the original. Deleting the extra row recovers.
- **Not verified:** creating a singleton from a skeleton when no own row exists. If the own row seems absent, first suspect the wrong branch or the wrong filter (Rule 2) before creating anything.
- If the own row seems missing (see Rule 2), you are on the wrong branch or resolved the wrong row — stop and re-check, do not create.
- The skeletons in the editor skills' reference docs are **shapes to recognise and edit against**, not bodies to push from scratch.
- Never pass `--allow-external` to an `upsert` of a singleton: it would fork a referenced package's singleton into this application's namespace (see [configuration-roundtrip.md → --allow-external](configuration-roundtrip.md#upserting-a-package-owned-reference-name-is-refused---allow-external)).

## Rule 2 — resolve the branch's own row by `applicationId`, never by a hardcoded id

`dxs configuration list <clitype>` on a singleton type returns **more than one row**: the branch's own instance **plus one row per directly referenced package** (a manager package with ~60 direct references lists ~60 rows, every one with the same `referenceName`).

```bash
dxs -O json configuration list authorization -b <branchId> \
  | jq '.configurations[] | select(.applicationId == <branchId> and .isExternal == false)
        | {id, applicationId, referenceName}'
```

- **Own row** = `applicationId == <branchId>` **and** `isExternal == false`. Exactly one row matches.
- **Dependency rows** carry `isExternal: true` and an `applicationReferenceName` naming the referenced package. Their `applicationId` is the id of the **commit snapshot** the reference is pinned to — not the package's Main branch. Never use a dependency row's `applicationId` as a branch id.
- List rows commonly report `readonly: true`. Verified live: this is not universal — a branch's own row can report `readonly: false` even with no edit yet applied (observed on every one of the six singleton types on the same branch, before any write). Do not use `readonly` to predict whether a write will be accepted; see Rule 5 for the verified behavior. `isModule` reflects whether the owning application is a package (`true`) or an application (`false`); neither field selects the own row.
- Never hardcode a singleton id across branches or packages: ids differ per package and per branch lineage. Resolve it each time.
- Shortcut (verified live, dxs 0.5.8): `dxs configuration get <clitype> <fixedReferenceName> -b <branchId>` resolves the bare fixed name to the **own** row (per [configuration-roundtrip.md → Reference names resolve to the branch's own config](configuration-roundtrip.md#reference-names-resolve-to-the-branchs-own-config)), and `Module/<fixedReferenceName>` reads a referenced package's copy read-only. Confirm the returned `id`/`applicationId` against the list result before editing.

## Rule 3 — the round-trip

Same canonical pattern as every configuration ([configuration-roundtrip.md](configuration-roundtrip.md)), with two output shapes to know:

| Fetch form | Where the body is |
|---|---|
| `dxs -O json configuration get <clitype> <id> -b <branchId>` (stdout) | `.configuration.json` (an object) |
| `dxs configuration get <clitype> <id> -b <branchId> -O envelope.json` (file) | `.json` |

```bash
# 1. Resolve the own id (Rule 2), then fetch and extract the body IMMEDIATELY — never keep the envelope around
dxs -O json configuration get <clitype> <ownId> -b <branchId> | jq '.configuration.json' > body.json
# 2. Edit body.json — only the type's content arrays; leave the tail untouched
# 3. Validate — gates the push; exit 1 = errors found, not a broken CLI
dxs configuration validate <clitype> -b <branchId> -D body.json
# 4. Push (path A — see Rule 5 for the fallback)
dxs configuration upsert <clitype> -b <branchId> -D body.json
# 5. Verify by round-trip fetch of the own id (project only the field you changed)
```

**Body tail is self-describing.** Every singleton body ends with the same tail; keep it verbatim:

```json
"configurationTypeId": <cti>, "id": <ownId>, "referenceName": "<fixed>", "title": "<boilerplate>", "description": "<boilerplate>", "accessModifier": "public"
```

`id` must equal the envelope's `id` (the own row's id). A body whose `id` belongs to a dependency row is a wrong-row edit.

**Validate is shallow on most singletons.** On securityPolicy, appConfig, replacements, authorization and userConfig it checks JSON shape and named enums only — it does not cross-check names, codes, or targets (each editor's reference doc lists what slips through). The shell is the exception: its validate checks wiring (`Outdated contract. Missing input parameter <id>`, `Invalid contract. Referenced configuration … does not exist or has been renamed`), placement and the `viewType` allow-list, requires a `home` view, and compiles its embedded flows — see [shell.md](../shell-editor/references/shell.md). A clean validate is necessary, not sufficient.

## Rule 4 — the envelope hazard (secrets)

On five of the six types (all but `appconfig` itself), the GET envelope's `application.configurations[]` embeds a **full copy of the branch's own appConfig body** — including plaintext connection bindings and any API keys stored as literal settings. The appConfig envelope carries the same secrets in its own body.

Hard rules for every singleton editor:

1. Extract the body (`.configuration.json` / `.json`) in the same command as the fetch. Never print, paste, log, quote, or diff an envelope; never commit or attach one.
2. In any report, transcript excerpt, or diff, **redact** the values of `settingType: 1` connection bindings (`apiConnectionName`) and any literal `value` that looks like a key, secret, password, or credential (`*Key`, `*Secret`, `*Password`, long random strings). Show the setting `name` and `<redacted>`.
3. When showing a change, project only the edited array (`jq '.operations'`, `jq '.contentSecurityPolicy.directives'`) — never the whole appConfig.
4. Delete scratch envelopes once the body is extracted.

## Rule 5 — the write path under `readonly: true`

List rows commonly report `readonly: true`, including the own row, but — per the Rule 2 correction above — that flag is not reliable evidence either way. Verified live (all six singleton types, same-package own row, each given a small reversible edit): the flag does **not** block a CLI write. Document and try the paths in this order:

| Path | Command | Notes |
|---|---|---|
| **A — upsert (first)** | `dxs configuration upsert <clitype> -b <branchId> -D body.json` | Resolves the bare fixed `referenceName` to the own row and handles the source-control lock. Risk: the same `referenceName` is also inherited from every referenced package — compare the "inherited more than once" caveat in [configuration-roundtrip.md](configuration-roundtrip.md#type-identifiers). **Verified live: this is the only path needed.** Upsert succeeded on the first attempt, with no refusal, for all six types (shell, securityPolicy, appConfig, replacements, authorization, userConfig) — a round-trip fetch confirmed each edit landed and, after reverting the content, confirmed it landed back at the original value. |
| **B — update (fallback)** | lock the own config, then `dxs configuration update <clitype> <ownId> -b <branchId> -D body.json` | `update` is a bare PUT: it fails with `Cannot update configuration that is not locked or marked for deletion` unless the branch already holds the lock (see [configuration-roundtrip.md → Branch & lock lifecycle failure modes](configuration-roundtrip.md#branch--lock-lifecycle-failure-modes)). There is no `dxs` lock subcommand; a successful path-A attempt leaves the lock held. **Not exercised live** — path A never needed a fallback on any of the six types, so whether the raw lock route works on a singleton remains unconfirmed; the point is moot in practice since path A always sufficed. |
| **C — Studio designer** | the package's configuration designers in Studio (Settings, Security Policy, Authorization; replacements are also configured in Studio) | Use when A and B are both refused. Stop and tell the user; do not improvise a raw-API workaround. |

**Lock side effect (verified live):** a successful path-A `upsert` on a singleton leaves the usual source-control lock held on that `referenceName`, exactly as for any other registered type — including when the edit that was just pushed restored the body to its pre-edit content. A revert-via-upsert does not release it, and deleting the singleton (Rule 1) is not a way to "reset" it: whether a delete releases the lock is not verified. The lock clears on the owning user's Studio commit. Plan singleton write-path testing with that in mind — the branch will carry a pending "update" on every singleton type touched, even ones whose content round-trips back to original.

After any write: re-fetch the own id and confirm the edit landed (project the edited array only), then confirm the lock is held under this branch (`dxs source status --branch <branchId>`) — expected, per the lock side effect above; it does not clear until the owning user's Studio commit.

## Read-only projections

| Command | Returns | Use |
|---|---|---|
| `dxs source branch settings <branchId>` | own appConfig `settings[]` | quick read; values are **unredacted** — Rule 4 applies to its output |
| `dxs source branch replacements <branchId>` | own `replacements[]` | quick read |
| `dxs source branch shell <branchId>` | own shell body | quick read |
| `dxs source branch roles <branchId>` / `operations <branchId>` | `DXS-API-ROUTE-404` in dxs 0.5.8 | broken — read authorization via `dxs configuration get authorization` instead |

None of these write. Edits always go through Rule 3.

## Raw routes (reference only)

The CLI wraps `/applications/<branchId>/<clitype>configurations[/<id>]` (e.g. `/applications/<branchId>/securitypolicyconfigurations/validate`). Listed so an error URL is recognisable — do not call these directly when a `dxs configuration` command exists.

## Pre-Flight (every singleton edit)

1. Branch confirmed with the user; `statusName` is `WorkspaceActive`.
2. Own row resolved by `applicationId == <branchId>` and `isExternal == false`; no hardcoded id.
3. Body extracted immediately; envelope never printed; secrets redacted in everything you show.
4. Only the type's content arrays edited; tail (`configurationTypeId`, `id`, `referenceName`, `title`, `description`, `accessModifier`) unchanged.
5. `validate` before the write; write via path A, then B, then C.
6. Round-trip fetch confirms the edit; the lock is now held under this branch (expected until a Studio commit — Rule 5), not released.
7. Edit the existing row; delete and re-create only from a saved body; never a second instance, never `--allow-external`.

## Cross-References

- [configuration-roundtrip.md](configuration-roundtrip.md) — canonical round-trip, the silent-wipe guard, `--allow-external`, lock failure modes.
- [branch-setup.md](branch-setup.md) — branch/connection selection and the always-ask branch policy.
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md#configurationtypeid-reference) — the `configurationTypeId` ↔ CLI type table.
- [../impact-analysis/SKILL.md](../impact-analysis/SKILL.md) — run before removing an operation, a setting, or a replacement other code depends on.
