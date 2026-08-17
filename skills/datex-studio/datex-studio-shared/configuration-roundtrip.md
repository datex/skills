# Configuration Round-Trip Pattern

> Shared reference for Datex Studio component-creator skills that fetch, modify, and push back configurations via `dxs configuration`. Documents the corrected round-trip pattern that avoids the destructive `get -O envelope.json | update -D envelope.json` silent-wipe bug discovered in the Phase 0d smoke test (see `datex-studio-cli` repo's `docs/superpowers/specs/2026-05-28-configuration-roundtrip-documentation-design.md`).

## The pattern

When modifying an existing configuration on a branch:

```bash
# 1. Fetch the existing configuration (writes the full server envelope to file)
#    NOTE: the body (`json`/`jsonString`) is returned ONLY when fetching by NUMERIC id.
#    Fetching by reference name returns a metadata-only envelope — resolve the id from
#    that first (its `id` field), then re-fetch by id (confirmed 2026-08-06, cli 0.4.12).
dxs configuration get <type> <id> -b <branch> -O envelope.json

# 2. CRITICAL: extract the inner body. Never pipe the envelope directly to upsert.
jq .json envelope.json > body.json

# 3. Edit body.json per the rules in the relevant creator skill's references/<type>.md

# 4. Push the modified inner body (upsert resolves create-vs-update by referenceName)
dxs configuration upsert <type> -b <branch> -D body.json

# 5. (Optional) Validate before pushing in step 4
dxs configuration validate <type> -b <branch> -D body.json
```

> **Which write verb?** The CLI ships `create` (POST), `update` (lock+PUT), and `upsert` (orchestrated create-or-update). Prefer `upsert` everywhere — it resolves the path by `referenceName` and manages the source-control lock for you, so you don't have to know whether the config already exists. Use the explicit `dxs configuration update <type> <id>` / `dxs configuration create <type>` only when you deliberately want one path.

## Reference names resolve to the branch's own config

`get`, `update`, `delete`, and `upsert` resolve a bare reference name to **this
branch's own** configuration — never to a config inherited from a **referenced
package**. This holds on ComponentModule (package) branches too, where the
branch's own configs live under the module's own reference name.

To deliberately **read** a referenced package's config, address it explicitly as
`Module/ref`:

```bash
# Read a hub owned by the referenced package "SharedPkg"
dxs configuration get hub SharedPkg/hub_home -b <branch>
```

`Module/ref` is read-only: `update`, `delete`, and `upsert` reject it, because a
referenced package's config cannot be modified from a consuming branch (edit it
in its own package instead). If a bare name isn't found on your branch but
exists in a referenced package, the error names the package and shows the
`Module/ref` form.

## The bug this avoids

`dxs configuration get -O envelope.json` writes the full server response shape (id, json, jsonString, version, modifiedDate, …). `dxs configuration upsert -D` expects only the inner `json` body. Piping the envelope directly results in the server silently wiping the configuration's content (Phase 0d smoke test on hub 655 — toolbar/flows/onInitFlowConfig all reset to null).

The corrected docstring on `dxs configuration get -O` (committed `c4aea9c` in `datex-studio-cli`) tells users to extract `.json` before passing to `upsert -D`. The `jq .json envelope.json > body.json` step in the pattern above is the recommended extraction; `python -c "import json,sys;json.dump(json.load(open(sys.argv[1]))['json'],open(sys.argv[2],'w'))" envelope.json body.json` works equivalently on systems without `jq`.

## `description` is capped at 256 characters

**Any** configuration type whose `description` exceeds 256 characters fails to save with:

```
DXS-API-500  "An error occurred while saving the entity changes. See the inner exception for details."
             code: Microsoft.EntityFrameworkCore.DbUpdateException
```

Bisected live on 2026-08-13 (cli 0.4.12, customType on branch 92572): 255 and 256 save, 257/258/259/260 fail, reproducibly. The error names neither the field nor the limit, and **`dxs configuration validate` passes a body that the save then rejects** — validation does not check it.

Two consequences worth knowing before you hit them:

- This is the concrete cause behind at least some sightings of the "large component fails to save" platform bug. Check `len(description)` **first**; only reach for incremental composition once the description is known-good.
- A failed save can leave the configuration absent from the branch (a failed *create* lands nothing; re-list before assuming otherwise). Keep the body on disk so a retry is cheap.

Guard it at authoring time rather than discovering it from a 500:

```python
assert len(desc) <= 256, len(desc)
```

## Creating new configurations

For a new configuration (no existing id):

```bash
# 1. Build body.json from scratch per the rules in the creator skill's references/
# 2. (Optional) Validate
dxs configuration validate <type> -b <branch> -D body.json
# 3. Upsert (same command — with no existing config on the branch, it takes the create path)
dxs configuration upsert <type> -b <branch> -D body.json
```

No round-trip extraction needed — there's no envelope to unwrap.

## Type identifiers

The dxs CLI normalizes type names to lowercase, no hyphens. Reference table:

| Component | configurationTypeId | CLI type identifier |
|---|---|---|
| hub | 2 | `hub` |
| grid | 3 | `grid` |
| editor | 4 | `editor` |
| form | 5 | `form` |
| datasource | 6 | `datasource` |
| selector | 7 | `selector` |
| function (flow) | 9 | `flow` |
| storage | 17 | `storage` |
| action (footprintFlow) | 18 | `footprintflow` |
| footprintDatasource | 19 | `footprintdatasource` |
| customType (interface/enum) | 22 | `customtype` |
| footprintWorkflow | 23 | `footprintworkflow` |
| backendTest | 24 | `backendtest` |

> See [`../footprint-workflows/`](../footprint-workflows/SKILL.md) for the `footprintworkflow` type — a TypeScript implementation bound to a named Footprint platform workflow extension point.

> **`upsert` cannot resolve a reference name the branch inherits more than once.** If two referenced
> packages both expose a config with the target `referenceName` (e.g. `i_awi_configuration`, which
> Allocations / Cartonization / Invoices / Totes / Waves each define), `upsert` resolves it as
> pre-existing and 404s trying to lock a config the branch does not own —
> `.../config/<referenceName>/lock` → `DomainObjectNotFoundException`. Use `dxs configuration create`
> for the first push and explicit `dxs configuration update <id>` thereafter. Confirmed 2026-08-12,
> cli 0.4.12, creating `SalesOrders.i_awi_configuration`.

## Validation resolves references from the branch, not your payload

`dxs configuration validate` / `upsert` type-check the component against what is **already on the
branch** — never against other files you are about to push. Consequences (each observed live):

- **Upsert order matters.** Push dependencies first: a storage before the flows that read it (the
  generated `IStorageItem_<Pkg>_<storage>` type comes from the pushed schema); a datasource before
  the functions referencing `$datasources.<Pkg>.<name>`; a callee before the wrapper that calls it.
  A consumer validated too early fails against the dependency's *old* on-branch signature (or its
  absence) even though your local files are mutually consistent.
- **Cross-package references bind the *published* dependency version.** New type members, flows, or
  actions on an unpublished sibling branch are invisible to a consuming package until the sibling
  is committed **and published** and the consumer's package reference is bumped — and the reference
  bump is a **Studio UI step** (`dxs` has no reference-update command). A change to a cross-package
  contract is therefore never a single-branch edit; plan the publish + bump into the sequence.
  (Corollary: for loosely-typed columns, a string literal that matches a published enum's value can
  decouple you from the publish cycle — weigh that against type safety.)
- **A reference bump can surface pre-existing, unrelated validation errors** from the stale branch
  baseline (e.g. a selector gained an input parameter and old consumer forms don't pass it). After
  a sync/bump, `dxs source branch validate` may report errors your change did not cause — triage
  by asking whether the implicated components are in your changeset before attempting to "fix"
  anything; such errors typically clear when the branch is updated from main.

## Branch & lock lifecycle failure modes

- **First write to a config your branch only inherits: use `upsert`, not `update`.** A component that
  came from Main and has not yet been modified on your branch is not locked *by* your branch, so
  explicit `dxs configuration update <type> <id>` fails with
  `Cannot update configuration that is not locked or marked for deletion` (`DXS-API-400`,
  `DomainObjectValidationException`). Nothing is wrong — the branch simply does not own the component
  yet. `upsert` acquires the lock, writes, and flips it to a pending `update`; `update` only works
  once the branch already holds it. Confirmed 2026-08-14, cli 0.4.12, editing a SalesOrders form and
  editor inherited from Main on a fresh branch. **Note the error text is nearly identical to the
  cross-branch case below but the fix is the opposite** — check whether *your* branch has a pending
  change for the component (`dxs source changes --branch`) before hunting for a foreign lock holder.
- **Cross-branch single-writer lock.** `upsert` fails with `Cannot update configuration that is not
  locked` when the component is held as a **pending update on someone else's branch** — the lock is
  repo-wide per component, not per branch. Diagnose with raw probes:
  `dxs api .../sourcecontrol/<branch>/config/<ref>/lock` (contradictory lock/unlock responses on
  your branch expose the foreign lock; check `/sourcecontrol/<repo>/locks` for the holder, and
  verify you leave no probe locks behind). The lock releases when the holding branch **commits**;
  then re-fetch the component (their committed body is the new baseline), re-apply your edit on
  top, and upsert.
- **Pending changes are NOT a writability signal.** A committed branch keeps its change list, so
  `dxs source status --branch <id>` still returns the components it carries — reading that as "the
  branch is open" is wrong. Check `statusName` / `isCommit` from `dxs source branch list` instead:
  `WorkspaceActive` is writable, `WorkspaceHistory` is not. Confirmed 2026-08-17 after a write failed
  on a branch whose pending changes had just been inspected and looked healthy.
- **Committed/published branches are read-only.** Once a branch is committed it moves to
  `WorkspaceHistory` status and every write fails with `Application is not in Feature status`.
  Recovery: create a new branch off updated Main (which now carries the committed feature), verify
  the baseline body matches what you expect (id-only drift is normal), and land the edit there.
  This can happen mid-changeset when the user commits the pinned branch — re-confirm the branch
  rather than retrying the write.
- **Verify upserts by round-trip fetch, not by scanning command output.** In a compound command a
  failed upsert's error can be masked by a later success line. After a batch of pushes, `get` the
  component back (by numeric id) and confirm the edit is present.

## Consumers

This reference is linked from every Datex Studio component-creator skill that uses the `dxs configuration` lifecycle. Skills should add this file to `depends:`:

```yaml
depends:
  - datex-studio-shared
  # ... other deps
```
