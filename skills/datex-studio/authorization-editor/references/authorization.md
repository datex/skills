# Authorization — Authoring Reference

Authoritative reference for the Datex Studio **authorization** singleton (`configurationTypeId: 34`, CLI type `authorization`, fixed `referenceName: "authorization"`). Every application and package has exactly one. It declares the package's named **operations** and assigns them to organization **roles**; UI code reads the assignment through `$operations.<Package>.<Op>`. The shared singleton lifecycle (own-row discovery, envelope secrets, write path, edit in place, delete and re-create only from a saved body) lives in [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) and is not repeated here.

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Edit the authorization config when a feature must behave differently per role: hide a hub tab, disable a toolbar button, block a navigation, or turn on an optional capability for some roles only. The operation is the **named switch**; the role assignment decides who it applies to; consumer flow code decides what it does.

Not for per-user preferences (`userConfig`, [`user-config-editor`](../../user-config-editor/SKILL.md)) and not for package-wide feature values (`appConfig`, [`app-config-editor`](../../app-config-editor/SKILL.md)).

## File Location & Naming

- `configurationTypeId: 34`; CLI type `authorization`; fixed `referenceName: "authorization"`, `title: "Authorization"`, `description: "Authorization configuration for this application"` — provisioned, never changed.
- Conventional file name: `authorization-authorization.json` if the body is kept on disk — a naming convention only; the branch is the system of record.
- **Operation names** are code-facing identifiers (`$operations.<Package>.<name>`): `Disable_<Area>_<Action>` or `Enable_<Area>_<Action>`, PascalCase segments joined by underscores (`Disable_Location_Edit`, `Disable_Outbound_Order_Cancellation`, `Enable_SupportTools`). On a large manager package roughly nine in ten operations are `Disable_*`, under one in ten `Enable_*`, plus a couple of legacy un-prefixed names — do not copy those.
- Each operation's `description` is non-empty, ≤100 chars, and describes what **assigning** it does.

## Minimal Valid Skeleton

The shape of a small package's authorization config. Recognise and edit against it — push it only as a restore of a deleted row, never as a second instance.

```json
{
  "operations": [
    { "name": "Enable_SupportTools", "description": "Enables a user's access to the support tools feature.", "isAuthorizable": true },
    { "name": "Disable_Location_Edit", "description": "Disables editing of locations.", "isAuthorizable": true }
  ],
  "roles": [
    { "organizationRoleName": "Admin", "assignedOperations": [ { "name": "Enable_SupportTools" } ] },
    { "organizationRoleName": "QA", "assignedOperations": [ { "name": "Disable_Location_Edit" } ] }
  ],
  "configurationTypeId": 34,
  "id": <ownId>,
  "referenceName": "authorization",
  "title": "Authorization",
  "description": "Authorization configuration for this application",
  "accessModifier": "public"
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `operations` | Declared operations | `[{ name, description, isAuthorizable }]`. `isAuthorizable` is `true` on every observed operation; meaning of `false` `_TODO_`. |
| `roles` | Role → operation assignments | `[{ organizationRoleName, assignedOperations: [{ name }] }]`. Assignments are **objects** (`AuthorizationRoleOperation`); a bare string fails validate. |
| `configurationTypeId` | Type | `34`. |
| `id` | Own singleton id | Must equal the own row's id. |
| `referenceName` / `title` / `description` | Identity | Fixed boilerplate; leave verbatim. |
| `accessModifier` | Visibility | `"public"`. |

**`organizationRoleName`** names a role in the organization-level role registry (`Admin`, `User`, `QA` observed). The registry's source and how to list it from the CLI are `_TODO_`; `dxs source branch roles` returns `DXS-API-ROUTE-404` in dxs 0.5.8.

**What `validate` does not check** (verified live): an `assignedOperations[].name` that is not declared in `operations[]`, and an `organizationRoleName` that does not exist — both validate clean.

## Polarity

| Prefix | Assigning it to role R means | Typical consumer check |
|---|---|---|
| `Disable_<X>` | users of R **lose** X | `if (await $operations.<Pkg>.Disable_<X>.isAssignedToAll()) { /* disable X */ }` |
| `Enable_<X>` | users of R **gain** X | `if (await $operations.<Pkg>.Enable_<X>.isAssignedToAny()) { /* allow X */ }` — some call sites use `isAssignedToAll`; match the package's siblings |

`isAssignedToAll()` is true only when **every** role the current user holds carries the operation; `isAssignedToAny()` when at least one does ([../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md)). Consequence for `Disable_*` checked with `isAssignedToAll`: a user who also holds any role **without** the operation keeps the capability. To restrict a capability for "users of role R", assign `Disable_<X>` to R and confirm R is not usually combined with an unrestricted role.

## Runtime Globals

N/A inside the authorization config — it has no code strings. Its consumer surface is `$operations.<Package>.<Op>` (UI tier), typed by the generated `IOperationsService`, one `IOperation` member per declared operation:

```ts
interface IOperation {
  isAssignedToAll(): Promise<boolean>;
  isAssignedToAny(): Promise<boolean>;
}
```

A cross-package `$operations.<Pkg>.<Op>` resolves against that package's **published** release ([../../datex-studio-runtime/runtime-globals.md → Unpublished Cross-Package Surfaces](../../datex-studio-runtime/runtime-globals.md#unpublished-cross-package-surfaces)). Same-package availability right after the upsert is immediate (verified live): a newly declared operation appeared as a member of the generated `IOperationsService` the moment a same-package component's designer context was regenerated — no publish step needed, because the consumer and the authorization config both live on the same unpublished branch.

## Invocation Contract

- **Consumers** call `$operations.<Package>.<Op>.isAssignedToAll()` / `.isAssignedToAny()` from UI-tier flows — usually a hub's or grid's `on_init` or an operations-applying flow — and flip UI state: `$hub.tabs.<id>.hidden`, a toolbar button's `control.readOnly`, `$grid.canAdd = false`, or `$hub.close()` for an access-gated hub ([../../hub-creator/references/hubs.md](../../hub-creator/references/hubs.md#common-patterns)).
- **Renaming or removing** an operation breaks every call site at compile time — run [`impact-analysis`](../../impact-analysis/SKILL.md) first (`dxs source explore reverse-trace` needs the module-qualified name).
- No `configParameters`/`moduleId` wiring applies — operations are referenced by name only.

## Common Patterns

### Add a `Disable_*` operation and assign it

```bash
jq '.operations += [{"name":"Disable_Carrier_Delete","description":"Disables deleting carriers.","isAuthorizable":true}]
    | (.roles[] | select(.organizationRoleName=="QA") | .assignedOperations) += [{"name":"Disable_Carrier_Delete"}]' \
  body.json > body.next.json && mv body.next.json body.json
```

Consumer, in the grid's `on_init`:

```ts
if (await $operations.<Package>.Disable_Carrier_Delete.isAssignedToAll()) {
    $grid.topToolbar.delete.control.readOnly = true;
}
```

### Report the change without the envelope

```bash
jq '{operations: [.operations[].name], roles: [.roles[] | {organizationRoleName, ops: [.assignedOperations[].name]}]}' body.json
```

### Audit role hygiene

List roles and their operation counts; flag any role that looks like a leftover test or person-named role, any assignment naming an undeclared operation, and any declared operation no role carries (unused, or intended for a role managed elsewhere — ask).

### Add a role and assign operations

```bash
jq '.roles += [{"organizationRoleName":"<Role>","assignedOperations":[{"name":"<Op>"}]}]' \
  body.json > body.next.json && mv body.next.json body.json
```

This appends a role entry whose name must already exist in the organization's role registry, and `validate` does not check that: a misspelled role validates clean and simply never applies. Every `<Op>` in `assignedOperations` must also be declared in `operations[]` (add it first with the pattern above); `validate` does not check that either. Before appending, confirm the role is not already in `roles[]` (`jq '[.roles[].organizationRoleName]' body.json`); to give an existing role more operations, append to its `assignedOperations` instead of adding a second entry.

### Remove an operation (and every assignment of it)

First find the consumers of `$operations.<Package>.<Op>` with [`impact-analysis`](../../impact-analysis/SKILL.md) (`dxs source explore reverse-trace <Op> --branch <branchId>`). A consumer that still references a removed operation fails codegen and `validate`: expect a codegen error of the form `Property '<Op>' does not exist on type 'IOperationsService'`, because the operation disappears from the generated `IOperationsService`. Update or remove those consumers on the same branch.

```bash
jq 'del(.operations[] | select(.name=="<Op>"))
    | (.roles[] | select(.assignedOperations != null) | .assignedOperations) |= map(select(.name != "<Op>"))' \
  body.json > body.next.json && mv body.next.json body.json
```

Remove the name from `operations[]` and from every role's `assignedOperations` in one edit; a leftover assignment of an undeclared name validates clean but is dead. Removing a whole role is the same recipe on `roles[]` (`del(.roles[] | select(.organizationRoleName=="<Role>"))`) and has no code consumers, because code reads operations, never roles.

## Pre-Flight Checklist

1. **Lifecycle** — branch confirmed; own row by `applicationId == <branchId>` and `isExternal == false`; edit the existing row; delete and re-create only from a saved body, never a second instance ([../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md)).
2. **Read path** — roles/operations read via `dxs configuration get authorization`, not `dxs source branch roles|operations`.
3. **Polarity** — prefix chosen from the table; the effect of the assignment is stated to the user.
4. **Shape** — new operation `{name, description, isAuthorizable: true}`; assignments are `{name}` objects.
5. **Declared** — every `assignedOperations[].name` exists in `operations[]`.
6. **Roles** — role names match existing organization roles; leftover test roles flagged, not silently edited.
7. **Descriptions** — non-empty, ≤100 chars ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)).
8. **Impact** — renames/removals cleared by `impact-analysis`.
9. **Consumer** — `isAssignedToAll` / `isAssignedToAny` consistent with polarity and sibling call sites.
10. **Validate** before the write; round-trip fetch; no lock left held.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| The role that should have X lost it | `Disable_X` assigned to it (polarity inverted) | Remove the assignment; assign to the roles that must lose X, or use an `Enable_X` operation. |
| Restriction never applies for some users | `Disable_X` checked with `isAssignedToAll`, and those users hold another role without it | Expected semantics — assign to all their roles, or change the check deliberately. |
| Assignment has no effect | Assigned name not declared in `operations[]` (validate does not catch it) | Declare the operation, or fix the name. |
| `Property '<Op>' does not exist on type` in consumer code | Operation not declared, renamed, or (cross-package) not yet published | Declare it; for another package, publish and re-pin. |
| `Error converting value "<op>" to type '...AuthorizationRoleOperation'` on validate | `assignedOperations` given as strings | Use `[{ "name": "<op>" }]`. |
| `DXS-API-ROUTE-404` | `dxs source branch roles` / `operations` | Use `dxs configuration get authorization`. |
| Upsert pushes to the wrong row | Body `id` from a dependency row | Re-resolve the own row. |

## Cross-References

- [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) — own-row discovery, envelope secrets, `readonly`, write path.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) — the `$operations` row and the unpublished cross-package rule.
- [../../hub-creator/references/hubs.md](../../hub-creator/references/hubs.md) — role-gated tabs and the access-gated `on_init` (consumer side).
- [../../grid-creator/SKILL.md](../../grid-creator/SKILL.md) — grid toolbar state the gate usually flips.
- [../../shell-editor/references/shell.md](../../shell-editor/references/shell.md) — role-gated navigation: the shell hides `$workspace.menubar.<id>` with the same `Disable_*` → `isAssignedToAll()` / `Enable_*` → `isAssignedToAny()` polarity, evaluated in `on_init`.
- [../../impact-analysis/SKILL.md](../../impact-analysis/SKILL.md) — call sites of an operation before rename/removal.
