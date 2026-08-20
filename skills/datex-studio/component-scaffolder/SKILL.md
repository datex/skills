---
name: component-scaffolder
description: |
  Use when scaffolding a new Datex Studio component from a documented
  skeleton — maps a requested type to folder, suffix,
  configurationTypeId, minimal-valid skeleton, and matching creator
  skill. Owns scaffold-routing so creator skills stay focused on
  authoring their own type. After creating the minimal-valid skeleton
  on the branch via dxs, hands off to
  the matching creator (action-creator, function-creator, grid-creator,
  hub-creator, form-creator, editor-creator, embed-creator, selector-creator,
  storage-creator, type-definition-creator, backend-test-creator,
  datasource-creator) for body authoring. Triggers: "scaffold a new
  component", "create a new grid/hub/form/editor/embed/selector/storage/
  interface/enum/backendTest/action/function/datasource", "starter
  <type> file", "new <type> from scratch".
depends:
  - datex-studio-conventions
  - action-creator
  - backend-test-creator
  - datasource-creator
  - editor-creator
  - embed-creator
  - form-creator
  - function-creator
  - grid-creator
  - hub-creator
  - selector-creator
  - storage-creator
  - tailoring-overlay
  - type-definition-creator
---

# Component Scaffolder

Scaffold a new Datex Studio component from a documented skeleton. This skill is the **routing layer** for "I need to start a new <X> component." It maps a requested component type to:

1. The file suffix (carried on the `referenceName`).
2. The `configurationTypeId` numeric ID.
3. The canonical minimal-valid skeleton (sourced from the matching creator skill's `references/<type>.md`).
4. The matching creator skill to hand off to for the actual body authoring.

Creator skills (action-creator, function-creator, grid-creator, etc.) own authoring their own component type. This skill owns the **dispatch decision** — which suffix, which cti, which skeleton doc, which creator skill — so that routing logic doesn't get duplicated into every creator skill. The branch is the source of truth; the scaffolder never writes into a local `src/` tree.

## References

- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — Canonical `configurationTypeId` table, file suffix rules, the wrong-cti failure mode.
- Each creator skill's `references/<type>.md` — Canonical minimal-valid skeleton for that component type. Never fabricate JSON structure from memory; always consult the matching reference doc.

## Workflow

1. **Gather the three required inputs:**
   - **Type** — one of: `action`, `function`, `interface`, `enum`, `grid`, `hub`, `form`, `editor`, `embed`, `selector`, `storage`, `backendTest`, `datasource` (OData or flow query type, platform variant), `footprintDatasource` (OData or flow query type, Footprint variant). If the caller said "datasource" without qualifying the variant, ask which variant they want (platform `-datasource` vs Footprint `-footprintDatasource`) — they're a different `configurationTypeId` and a different component variant. See [datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) for the full taxonomy.
   - **Name** — the component reference name (without file suffix). Carry the type indicator on the name itself (`_storage`, `_hub`, `_form`, `_editor`, `_embed`, `_grid`, `_dd` for selectors, `_action`, `_flow` for functions, `i_` prefix for interfaces, `e_` prefix for enums) per [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md).
   - **Description** — non-null, non-empty, **≤100 characters**. This is a hard SQL column cap on the Footprint side — imports fail with a SQL truncation error if exceeded. Ask the caller for one if not provided; do not proceed without a description.

2. **Look up the dispatch row** in the table below for the requested type. That gives you the suffix, `configurationTypeId`, the reference doc with the canonical skeleton, and the creator skill to delegate to next.

3. **Read the canonical skeleton** from the referenced doc. Do not guess JSON structure. The reference doc owns the authoritative skeleton shape (and any per-type nuances — e.g. component-variant rules for selectors and datasources, hook-flow layout for backend tests).

4. **Apply the skeleton:**
   - `referenceName` → the component name. (Exception: actions — `referenceName` ends in `_action` while the file suffix is `-footprintFlow.json`. The creator-name pairing is intentional; see [action-creator/references/actions.md](../action-creator/references/actions.md).)
   - `title` → for **backend types** (function, action, datasource, footprintDatasource, interface, enum, storage, backendTest) the title never reaches a screen, so set it equal to `referenceName`. For **user-facing types** (form, editor, hub, grid, embed, and standalone selectors) the `title` renders as a header / dialog title / tab label, so it must be a distinct sentence-case display name — a `title` byte-identical to `referenceName` is a naming violation per [../datex-studio-conventions/naming-conventions.md → Display Names for User-Facing Components](../datex-studio-conventions/naming-conventions.md#display-names-for-user-facing-components). Derive one from the name (e.g. `custom_example_map_embed` → `Example map`) or ask the caller.
   - `description` → the caller-supplied description (≤100 chars).
   - `accessModifier` → ask the caller; default to `"public"` if they don't have a preference.
   - `configurationTypeId` → the numeric ID from the dispatch table. Copy it from a working component of the same type if you have any doubt — wrong cti is a Validate-clean / Preview-broken failure mode (see [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md)).
   - All other fields → skeleton defaults (empty arrays, nulls, etc.). Do not pre-fill placeholder properties, filters, or code beyond the minimum valid skeleton.

5. **Check for conflicts on the branch.** The branch — not the local working tree — is the source of truth for what exists. Probe it with `dxs configuration get <type> <referenceName> -b <branchId>`. A 404 (`DXS-404-001`) means the name is free; any hit means the component already exists → stop and report, do not overwrite. The caller may want a different name, or they may want to modify the existing one (which is the creator skill's job, not the scaffolder's).

6. **Write the skeleton to a temp `body.json`.** This local file is scratch/temp storage only — the branch is the system of record, not the file. Any local working copy the caller keeps is a convenience mirror, never the source of truth.

7. **Validate, then create on the branch via dxs** — two steps, and the first gates the second:

   ```bash
   dxs configuration validate <type> -b <branchId> -D body.json   # exit 1 = errors found
   dxs configuration upsert   <type> -b <branchId> -D body.json
   ```

   `validate` exits **1** when it finds errors — that is validation reporting findings, not a
   broken CLI. Read the `validation_errors` payload, fix the skeleton, re-validate; do not run the
   `upsert` on a body that failed the gate. See
   [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md#validate-exit-codes--a-non-zero-exit-is-a-finding-not-a-malfunction).

   `upsert` resolves create-vs-update by `referenceName`; with nothing on the branch (step 5 confirmed this) it takes the create path. The minimal-valid component now lives on the branch.

8. **Hand off to the matching creator skill.** The skeleton is on the branch, so the creator works in edit mode (fetch → extract inner `.json` → author → `upsert`). Tell the caller which creator skill owns this component type going forward and what the obvious next step is (e.g. "the grid is scaffolded on the branch; invoke `grid-creator` to add columns and wire the datasource", "the storage is scaffolded; invoke `storage-creator` to define the `objectTypeDef` columns").

## Dispatch Table

| Type | Suffix (on `referenceName`) | `configurationTypeId` | Skeleton reference | Creator skill |
|---|---|---|---|---|
| `action` | `-footprintFlow` | 18 | [action-creator/references/actions.md](../action-creator/references/actions.md) | `action-creator` |
| `function` | `-flow` | 9 | [function-creator/references/functions.md](../function-creator/references/functions.md) | `function-creator` |
| `interface` | `-customType` | 22 | [type-definition-creator/references/type-definitions.md](../type-definition-creator/references/type-definitions.md) | `type-definition-creator` |
| `enum` | `-customType` | 22 | [type-definition-creator/references/type-definitions.md](../type-definition-creator/references/type-definitions.md) | `type-definition-creator` |
| `grid` | `-grid` | 3 | [grid-creator/references/grids.md](../grid-creator/references/grids.md) | `grid-creator` |
| `hub` | `-hub` | 2 | [hub-creator/references/hubs.md](../hub-creator/references/hubs.md) | `hub-creator` |
| `form` | `-form` | 5 | [form-creator/references/forms.md](../form-creator/references/forms.md) | `form-creator` |
| `editor` | `-editor` | 4 | [editor-creator/references/editors.md](../editor-creator/references/editors.md) | `editor-creator` |
| `embed` | `-embed` | 20 | [embed-creator/references/embeds.md](../embed-creator/references/embeds.md) | `embed-creator` |
| `selector` | `-selector` | 7 | [selector-creator/references/selectors.md](../selector-creator/references/selectors.md) | `selector-creator` |
| `storage` | `-storage` | 17 | [storage-creator/references/storage.md](../storage-creator/references/storage.md) | `storage-creator` |
| `backendTest` | `-backendTest` | 24 | [backend-test-creator/references/backend-tests.md](../backend-test-creator/references/backend-tests.md) | `backend-test-creator` |
| `datasource` (platform variant) | `-datasource` | 6 | [datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) | `datasource-creator` |
| `footprintDatasource` (Footprint variant) | `-footprintDatasource` | 19 | [datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) | `datasource-creator` |

Notes on the table:

- **Datasources have two component variants** (`-datasource` and `-footprintDatasource`) which are different `configurationTypeId`s. Each variant can carry **either** query type (OData or flow) — the variant is the runtime tier, the query type is how the data is fetched. The selectability matrix (selectors only back to `-datasource.json`, etc.) is owned by [datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) — defer to that reference rather than re-deriving here.
- **`interface` and `enum` share the `-customType.json` component type** (cti=22). The internal body differs substantially — see [type-definition-creator/references/type-definitions.md](../type-definition-creator/references/type-definitions.md) for the two shapes.
- **For tailored variants** (e.g. tailoring an existing core-library grid via `baseConfiguration` overlay), do not scaffold from these skeletons — the tailored-overlay shape is different and is owned by the `tailoring-overlay` skill. Invoke that skill directly instead of routing through this scaffolder.
- **For modifying an existing component**, do not scaffold a new file — invoke the matching creator skill directly. This skill scaffolds new components only.

## Rules

- **Skeletons come from the reference docs.** Always read the matching `references/<type>.md` before building the body. Do not fabricate JSON structure from memory. The reference doc is authoritative for skeleton shape and skeleton defaults.
- **The branch is the source of truth.** The skeleton reaches the branch via `dxs configuration upsert`; any local `body.json` is temp scratch, never the system of record. Check existence with `dxs configuration get`, not by inspecting local file paths.
- **`referenceName` must equal the filename stem exactly.** The only exception is actions, whose `referenceName` ends in `_action` while the file suffix is `-footprintFlow.json` — this is the documented convention, not a typo. **`title`** equals `referenceName` for backend types, but user-facing types (form, editor, hub, grid, embed, standalone selector) require a distinct sentence-case display `title` — see step 4 and [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md#display-names-for-user-facing-components).
- **Description is mandatory and ≤100 characters.** Per the SQL column cap. Do not proceed without one. Do not silently truncate — confirm with the caller.
- **`configurationTypeId` matters at codegen time even though Studio's Validate doesn't enforce it.** Wrong cti → Preview cascade failures rooted in files that never touched the broken component. Always copy from a working component of the same type, or from the dispatch table above. See [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) for the failure-mode discussion.
- **Minimum valid only.** No placeholder properties, filters, columns, or code beyond what the skeleton requires for Validate to pass. The creator skill owns body authoring; this skill creates an empty-but-valid component on the branch and hands off.
- **Stop on conflict.** If `dxs configuration get` finds the `referenceName` already on the branch, do not overwrite. Report it and let the caller decide whether to rename, modify the existing one (via the creator skill), or delete.
- **One scaffold per invocation.** If the caller wants to scaffold several components (e.g. a hub + its tab grids + its filter datasource), do them one at a time and hand off the natural ordering — typically datasources first, then the consuming UI components.
