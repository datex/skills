---
name: hub-editor
description: |
  Use when adding, modifying, or removing toolbar buttons and click flows on a
  Datex Studio hub configuration. Covers fetching hub config via
  `dxs configuration get hub`, editing the toolbar[] and flows[] arrays, wiring
  click flows that launch reports, and pushing the modified config back with
  `dxs configuration update hub`. Trigger for: "add a toolbar button to the X
  hub", "wire a button that opens the Y report", "modify hub N", "change what
  the X button does", "launch report Y from a hub button".
depends:
  - datex-studio-shared
---

# Hub Editor

Modify a Datex Studio hub configuration to add toolbar buttons, wire click flows, and integrate reports or other actions into a hub UI.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch selection (shared across skills)
- [../datex-studio-shared/flow-code-patterns.md](../datex-studio-shared/flow-code-patterns.md) — `$utils.isDefined()`, date defaulting, `$shell.Reports.open{ref}()`
- [references/hub-config-api.md](references/hub-config-api.md) — `dxs configuration get/update` workflow for hub configs (and `dxs api --raw / -D / -O` fallback)
- [references/toolbar-and-click-flows.md](references/toolbar-and-click-flows.md) — `toolbar[]` and `flows[]` JSON structure, `clickFlowConfig` reference, common patterns

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist
- **`function-creator`** skill — invoked when the click flow does not yet exist as a Wavelength function

## CLI Status

Hub edits go through `dxs configuration` — the generic CRUD primitive over every platform configuration type (hub, grid, form, flow, footprintquerymanager, appconfig, etc.; run `dxs configuration types` to list all). The full round-trip is:

```bash
dxs configuration get hub <configId> -b <branchId> -O hub.json   # fetch
# edit hub.json locally
dxs configuration update hub <configId> -b <branchId> -D hub.json # push
```

There is no `dxs hub` subcommand and no field-level patching — you fetch the whole document, edit JSON, and push the whole document back. See [references/hub-config-api.md](references/hub-config-api.md) for the complete reference.

Note on naming: `dxs configuration` operates on platform configurations (hubs, grids, etc.) on a branch. `dxs config` (also aliased as `dxs settings`) operates on local CLI settings stored in `~/.datex/config.yaml`. Prefer `dxs settings` in any context that also discusses `dxs configuration` — it eliminates the easy confusion.

## Workflow

```
[Phase 1: Setup]
Follow branch-setup.md for branch selection
        |
[requirements brief in context?]
  +-----+-----+
  |            |
 YES          NO → invoke requirements-gathering
  |            |
  +-----+------+
        |
[Phase 2: Locate the hub]
Identify hub by reference name (e.g., inventory_hub)
        |
dxs source explore config <hub_ref> --branch <id>
  → extract: hub config ID
        |
[Phase 3: Fetch current hub configuration]
dxs configuration get hub <configId> -b <branchId> -O hub.json
        |
[Phase 4: Plan the change]
What's changing?
  +------+------+------+
  |      |      |      |
 ADD   MODIFY REMOVE  RENAME
  toolbar       button       click flow
        |
[Phase 5: Click-flow prerequisite (if adding/changing a button)]
Does the target click flow function exist?
  +-----+-----+
  |           |
 YES         NO
  |           |
 use it    invoke function-creator
  |        (writes the .ts code,
  |         upserts the function,
  |         returns reference name)
  +-----+-----+
        |
[Phase 6: Edit hub.json]
Modify toolbar[] and flows[] arrays per references/toolbar-and-click-flows.md
        |
[Phase 7: Validate locally]
python -m json.tool hub.json > /dev/null   ← syntactic check
diff -u hub.json.orig hub.json             ← review the change
        |
[Phase 8: Push updated config]
dxs configuration update hub <configId> -b <branchId> -D hub.json
        |
[Phase 9: Verify]
Reload the hub in the running app (or re-fetch and diff)
to confirm the change took effect
```

## Phase Details

### Phase 1: Setup

Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md). The branch ID is required by every `dxs configuration` command (`-b/--branch`) — pass it explicitly in skill examples; don't rely on implicit scoping.

### Phase 2: Locate the hub

You need the **hub configuration ID** (`configId`). The simplest path:

```bash
dxs source explore config <hub_reference_name> --branch <branch_id>
```

This returns the hub config metadata, including its `id`. If you don't know the reference name, list configs filtered to the hub type:

```bash
dxs source explore configs --branch <branch_id> | grep -i hub
```

Hub configs use a `configurationTypeId` distinct from datasources (6) and functions (9). Check the `dxs source explore configs` output to see the type IDs in use on your branch.

### Phase 3: Fetch current hub configuration

```bash
dxs configuration get hub <configId> -b <branch_id> -O hub.json
```

Always start from a fresh fetch — never edit a stale copy. See [references/hub-config-api.md](references/hub-config-api.md) for the full reference.

### Phase 4: Plan the change

The hub configuration has two interconnected arrays:

| Array | Purpose |
|-------|---------|
| `toolbar[]` | UI buttons that appear in the hub's toolbar — each has a `clickFlowConfig` |
| `flows[]` | Wavelength flow function references the hub knows about — every flow referenced from a `clickFlowConfig` must appear here |

A typical "add a toolbar button that launches a report" change touches **both** arrays: a new entry in `toolbar[]` and the click flow reference added to `flows[]`. See [references/toolbar-and-click-flows.md](references/toolbar-and-click-flows.md) for the JSON structure and the common patterns.

### Phase 5: Click-flow prerequisite

Hub toolbar buttons execute a Wavelength function as their click handler. If the target click flow function doesn't exist yet, invoke `function-creator` first. The click flow code typically:

1. Reads the hub's date-range / context inputs from `$flow.inParams`
2. Applies defaults for any missing values — see [../datex-studio-shared/flow-code-patterns.md](../datex-studio-shared/flow-code-patterns.md) for the canonical date-defaulting pattern using `$utils.isDefined()`
3. Calls `$shell.Reports.open{ref}()` (or another shell action) with the resolved parameters

Reference [../datex-studio-shared/flow-code-patterns.md](../datex-studio-shared/flow-code-patterns.md) when authoring the click flow so the function-creator's output uses `$utils.isDefined()` (not `!= null`) and the documented date-defaulting block.

### Phase 6: Edit hub.json

Use a JSON editor or `jq` to add/modify entries. Two safety rules:

- **Preserve everything you didn't change.** Hub configs contain UI state, version stamps, and properties unrelated to your edit. `dxs configuration update` replaces the entire object; missing fields are deleted.
- **Keep `toolbar[]` and `flows[]` consistent.** Every `clickFlowConfig.reference` in `toolbar[]` must have a matching entry in `flows[]`, and vice versa.

### Phase 7: Validate locally

```bash
python -m json.tool hub.json > /dev/null      # JSON-parses?
diff -u hub.json.orig hub.json                # review actual changes
```

Save the pre-edit fetch as `hub.json.orig` immediately after `dxs configuration get` — the diff is your only structural review before pushing.

### Phase 8: Push updated config

```bash
dxs configuration update hub <configId> -b <branch_id> -D hub.json
```

The `-D/--data-file` flag reads the body from a file, bypassing shell escaping entirely — so `\r\n` sequences and embedded quotes in the JSON are no longer a concern.

### Phase 9: Verify

Re-fetch the config:

```bash
dxs configuration get hub <configId> -b <branch_id> -O hub-after.json
diff -u hub.json hub-after.json
```

The diff should be empty (or contain only server-side fields like `updatedDateTime`). Reload the hub in the running app to confirm the new toolbar button appears and the click flow fires correctly.

## Common Operations

| Operation | What changes |
|-----------|-------------|
| Add a toolbar button that opens a report | `toolbar[]` gets a new entry; `flows[]` gets the click-flow reference; click flow function may need to be created |
| Change which report a button opens | Click flow function code (`$shell.Reports.open{newRef}(...)`) — no hub-config change required if the flow reference stays the same |
| Rename / re-label a button | `toolbar[].label` (or equivalent display field) — no flow change |
| Remove a button | Remove the entry from `toolbar[]` AND the (now-orphaned) reference from `flows[]` |
| Reorder buttons | Reorder `toolbar[]` entries |

## Key Rules

- **Never edit a stale `hub.json`.** Always re-fetch with `dxs configuration get hub` before edits — other users or releases may have modified the hub.
- **`dxs configuration update` replaces the entire config.** Don't omit fields you didn't intend to change.
- **`toolbar[]` and `flows[]` must stay in sync.** A toolbar button without a corresponding flow entry won't fire; an orphaned flow entry is harmless but should be cleaned up.
- **Click flow code must use `$utils.isDefined()`** — see [../datex-studio-shared/flow-code-patterns.md](../datex-studio-shared/flow-code-patterns.md). Native null checks misfire against Wavelength's value model.
- **`$shell.Reports.open{ref}()` parameter keys are case-sensitive and must match the report's `ReportParameters[].Name` exactly.**
- **Save `hub.json.orig` before editing.** It's your only diff target before push.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Trying `dxs hub get` / `dxs hub update` | These commands don't exist. Use `dxs configuration get hub` / `dxs configuration update hub` |
| Using `dxs config get <id>` to fetch the hub | `dxs config` (alias `dxs settings`) operates on local CLI settings, not platform configurations. Use `dxs configuration get hub <id> -b <branchId>` |
| Reading `endpoints.py` to construct a URL by hand | `dxs configuration` covers every type in `KNOWN_TYPES` — you no longer need the URL pattern. Reserve `dxs api` for endpoints not covered by `dxs configuration` |
| Trying `dxs api --save` | That flag has never existed. Use `-O/--output-file` (writes raw JSON) on `dxs api`, or use `dxs configuration get ... -O` |
| Falling back to a Python `httpx.put()` helper for large bodies | No longer needed. `dxs configuration update -D <file>` and `dxs api PUT -D <file>` both read the body from a file and bypass shell escaping |
| Piping `dxs api GET ... | tail -n +2` to strip a preamble | The "preamble" was always on stderr; the real issue was the response envelope. Use `--raw` (or `-O`) on `dxs api` to get just the body |
| Forgetting `-b/--branch` on `dxs configuration` commands | The flag is required. Pass it explicitly in every example |
| Adding a `toolbar[]` button without adding to `flows[]` | Button renders but doesn't fire. Both arrays must reference the click flow |
| Using `!= null` or `!startDate` in click flow code | Use `$utils.isDefined(startDate)` — Wavelength's value model doesn't compare cleanly with literal null/undefined |
| Mismatched parameter keys in `$shell.Reports.open{ref}()` | Keys are case-sensitive and must match the report's parameter `Name` values exactly. Mismatches silently render with the parameter unset |
| Pushing an edited config that's missing fields from the original | `update` replaces the whole object; omitted fields get deleted. Always start from a fresh `get` and only modify what you mean to change |
