---
name: authorization-editor
description: |
  Use when editing a package's Datex Studio authorization singleton
  (configurationTypeId=34, CLI type `authorization`, fixed referenceName
  `authorization`) on a branch — the package's declared `operations[]` and the
  `roles[]` that are assigned them, consumed in UI code as
  `$operations.<Package>.<Op>.isAssignedToAll()` / `.isAssignedToAny()`. Owns the
  singleton rule (one per package, edit in place; delete and re-create only from a saved body, edit the
  own row only), the `Disable_*` polarity trap (assigning `Disable_X` to a role
  REMOVES a capability), the role-assignment object shape, the broken
  `dxs source branch roles|operations` routes, and the leftover-test-role check.
  Triggers: "add an operation", "add a permission", "role-gate this button",
  "hide X for the QA role", "assign Disable_X to a role", "who can do X",
  "edit authorization", "$operations.<Package>", "isAssignedToAll",
  "Property 'Disable_X' does not exist on type", "dxs source branch roles 404",
  "create an authorization".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - impact-analysis
  - hub-creator
  - grid-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Authorization Editor

Edit a package's **authorization** singleton (configurationTypeId=34) on a branch — the list of named **operations** the package declares and the **roles** each operation is assigned to. UI code checks them as `$operations.<Package>.<Op>.isAssignedToAll()` / `.isAssignedToAny()` to hide, disable, or gate features. Every package already has exactly one authorization config, with the fixed `referenceName: "authorization"`; this skill only ever **edits** it and, where asked, writes the consumer gate that reads the new operation.

**Polarity is the trap.** Most operations are named `Disable_<X>`: assigning one to a role **takes a capability away** from that role. Read the name before assigning.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/authorization.md](references/authorization.md) — Authoritative reference: body shape, operations/roles, polarity, consumer patterns, pre-flight checklist
- [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md) — Shared lifecycle for every auto-provisioned singleton: own-row discovery, envelope secrets, `readonly`, write path, edit in place, delete and re-create only from a saved body
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md#unpublished-cross-package-surfaces) — the `$operations` row and the unpublished cross-package rule
- [../hub-creator/references/hubs.md](../hub-creator/references/hubs.md#common-patterns) — consumer side: role-gated tabs and the access-gated `on_init`
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — envelope vs inner body, validate exit codes

## Dependencies

- **`impact-analysis`** skill — invoked before renaming or removing an operation (`$operations.<Package>.<Op>` call sites break)
- **`hub-creator`** / **`grid-creator`** skills — the consumer side: where the gate flow lives (`on_init`, toolbar/tab state)
- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context

## CLI Lifecycle

There is **no create path**: the platform provisions the authorization config with the package. Edits go through `dxs configuration` with CLI type **`authorization`**, mapping to `configurationTypeId: 34`. Full rules in [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md).

**Edit the branch's own authorization config:**

```bash
# 1. Resolve the OWN row — list returns the own row plus one row per direct reference
dxs -O json configuration list authorization -b <branchId> \
  | jq '.configurations[] | select(.applicationId == <branchId> and .isExternal == false) | .id'
# 2. Fetch and extract the body in ONE command (the envelope embeds the appConfig's secrets)
dxs -O json configuration get authorization <ownId> -b <branchId> | jq '.configuration.json' > body.json
# 3. Edit body.json — operations[] and/or roles[] only
# 4. Validate — gates the push; exit 1 = errors found, not a broken CLI
dxs configuration validate authorization -b <branchId> -D body.json
# 5. Push — path A; fallbacks in the lifecycle doc (Rule 5)
dxs configuration upsert authorization -b <branchId> -D body.json
```

**Read roles and operations with `dxs configuration get authorization`.** `dxs source branch roles` and `dxs source branch operations` return `DXS-API-ROUTE-404` in dxs 0.5.8.

### Round-trip rule (critical)

Never pipe an envelope into `upsert` — it silently destroys configuration content ([../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md)). The authorization envelope also embeds a full copy of the branch's appConfig (plaintext secrets): extract the body in the same command and never print the envelope.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md; confirm the branch with the user
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Decide the operation + polarity]
  "users of role R must NOT be able to X" -> Disable_<X>, assign to R
  "only role R may do X"                  -> Enable_<X>, assign to R
  reuse an existing operation when one already names the capability
        |
[Phase 3: Resolve own row + fetch]   (configuration get, not source branch roles)
        |
[Phase 4: Edit]
  operations[] += {name, description, isAuthorizable: true}
  roles[<R>].assignedOperations[] += {name}
  rename / remove -> invoke `impact-analysis` first
        |
[Phase 5: Validate + push]
        |
[Phase 6: Consumer gate]
  flow code: if (await $operations.<Pkg>.Disable_<X>.isAssignedToAll()) { disable }
  match the polarity and the sibling call sites' All/Any choice
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Decide the operation + polarity

- **`Disable_<X>`** (the large majority of operations) — the role **loses** capability X when the operation is assigned. Consumer: `if (await $operations.<Pkg>.Disable_<X>.isAssignedToAll()) { /* disable X */ }`. With `isAssignedToAll`, the restriction applies only when **every** role the user holds carries it — a second role without it restores the capability.
- **`Enable_<X>`** — the role **gains** capability X. Observed consumers mix `isAssignedToAny` (grant if any role carries it — the common choice) and `isAssignedToAll`; match the existing call sites of the same package.
- Un-prefixed operation names exist on some production packages; don't copy that style — name operations `Disable_<Area>_<Action>` / `Enable_<Area>_<Action>`.
- Search the existing `operations[]` before adding: a capability usually already has an operation.

### Phase 4: Edit

1. **Operation** — `{ "name": "Disable_<X>", "description": "<what assigning it removes>", "isAuthorizable": true }`. `isAuthorizable` is `true` on every observed operation; the meaning of `false` is `_TODO_`. Description non-empty, ≤100 chars, and phrased from the assignment's point of view.
2. **Role assignment** — append `{ "name": "<op>" }` (an **object**, not a bare string) to the role's `assignedOperations[]`. Role entries are `{ organizationRoleName, assignedOperations }`; the role name must match an organization role (registry source `_TODO_`).
3. **Validate checks neither** that an assigned name is declared in `operations[]` nor that a role name exists — both validate clean when wrong. Check them yourself.
4. **Leftover test roles** — flag any role that looks like a test or person-named role (e.g. a role used once for a demo) to the user; never add to one silently, never delete one without being asked.

### Phase 6: Consumer gate

Operations are typed per package (`IOperationsService` → `IOperation { isAssignedToAll(); isAssignedToAny(); }`). A new operation in another package is invisible to consumers until that package is published and re-pinned ([runtime-globals → Unpublished Cross-Package Surfaces](../datex-studio-runtime/runtime-globals.md#unpublished-cross-package-surfaces)); same-package consumers see a new operation immediately after the upsert (verified live) — no publish needed. Gate code goes in the host's `on_init` (or its operations flow): hide a tab, set a toolbar button `readOnly`, or close the hub — see [../hub-creator/references/hubs.md](../hub-creator/references/hubs.md#common-patterns).

## Pre-Flight Checklist

Walk the full checklist in [references/authorization.md → Pre-Flight Checklist](references/authorization.md#pre-flight-checklist). The fast version:

1. **Lifecycle basics** — branch confirmed; own row by `applicationId == <branchId>` and `isExternal == false`; edit the existing row; delete and re-create only from a saved body, never a second instance ([../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md)); universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) for each new operation `description`.
2. **Polarity stated** — the answer says what assigning the operation does to the role (removes vs grants).
3. **Every assigned name is declared** in `operations[]`; assignments are `{name}` objects.
4. **Role names** match existing organization roles; leftover test roles flagged.
5. **Renames/removals** cleared by `impact-analysis`.
6. **Consumer** uses `isAssignedToAll`/`isAssignedToAny` consistently with polarity and sibling call sites.
7. **Validate** before the write; round-trip fetch confirms the edit; no lock left held.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/authorization.md → Common Failure Modes](references/authorization.md#common-failure-modes). The ones that bite most often:

- **Assigning `Disable_X` to the role that should *have* X** — inverts the intent.
- **`assignedOperations: ["Disable_X"]`** — entries are objects: `[{ "name": "Disable_X" }]`.
- **Assigning an operation never declared in `operations[]`** — validates clean, does nothing.
- **Reading roles with `dxs source branch roles`** — route 404 in dxs 0.5.8; use `configuration get`.
- **Creating an authorization config** — one already exists; edit the own row.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
