---
name: release-notes-generator
description: |
  Use when generating release notes between two Datex Studio branches. Compares
  a baseline (older) branch against a target (newer) branch, mines commits and
  linked DevOps work items, reads config diffs, and drills into updated
  dependencies to produce Technical and Customer release notes. Trigger for:
  "generate release notes from X to Y", "write release notes between <old> and
  <new>", "release notes for <app> between branches A and B", "compare releases
  X and Y and summarize". For time-range-based anchor picking ("weekly notes",
  "what shipped last week"), use `prospective-release-notes` — it resolves the
  two branch IDs and then invokes this skill.
---

# Release Notes Generator

Generate release notes between two Datex Studio branches by combining three
sources: commits (what merged), work items (why), and config diffs (what
actually changed). Produces both a Technical and a Customer variant.

## References

- [../shared/branch-setup.md](../shared/branch-setup.md) — Branch selection, when the user has not yet given both branch IDs

## Prerequisites

- **`--from` branch ID** — the older release (baseline)
- **`--to` branch ID** — the newer release (target)

Both are needed up front. If the user only provided one (or neither), ask for
the missing IDs before doing any work — the Branch ID Policy applies (never
assume).

## Workflow

```
[Phase 1: Compare]
dxs source compare --from <old> --to <new>
  → releases (intermediate), committed_branches, dependency_changes
        |
[Phase 2: Work Items per Commit]
For each interesting commit (parallel):
  dxs source workitems --branch <commit_branch_id> --description
        |
[Phase 3: Source Diffs]
For each created/meaningfully-modified/bug-fix config:
  dxs source diff --from <old> --to <new> --config <ref_name>
        |
[Phase 4: Drill Dependencies]
For each dependency_changes entry:
  dxs source compare --from <dep_old> --to <dep_new>
  Repeat Phases 2-3 recursively on the dependency's commits
        |
[Phase 5: Write Notes]
Compose two variants per the Output Formats below:
  • Technical — for developers/support
  • Customer — for end users / operations
Deduplicate work items that appear in multiple dependencies.
```

## Phase Details

### Phase 1: Compare

```bash
dxs source compare --from <old_branch_id> --to <new_branch_id>
```

The response contains three arrays that drive the rest of the workflow:

- **`releases`** — intermediate published releases between the two branches.
  Use this for the summary header (release count, date span).
- **`committed_branches`** — each merged feature branch, with `id`, `title`
  (commit message), `author`, and a `changes` array listing `reference_name`,
  `type`, `modification` (`add`/`update`/`delete`).
- **`dependency_changes`** — which component packages (Waves, Carts, etc.)
  were updated, with old/new branch IDs for drilling.

**Commits WITH changes** are direct code/config changes to this module.
**Commits WITHOUT changes** are sync commits pulling in dependency updates —
the real work lives in the dependencies (Phase 4).

### Phase 2: Work Items per Commit

For each commit whose `changes` array is non-trivial (or every commit, when
scope allows), fetch the linked work items:

```bash
dxs source workitems --branch <commit_branch_id> --description
```

Work items are the most valuable input for release notes. They contain:

- `title` — often far more descriptive than the commit message
- `type` — Development / Bug / Wavelength Component / etc.
- `state` — Done / Committed / etc.
- `assigned_to` — author attribution
- `description` — full requirements, steps to reproduce, mockups, acceptance
  criteria

If a commit has **no linked work items**, flag it as "Missing traceability"
and fall back to the commit ID and title for the entry. Never silently drop
these.

> Work items provide the *why*. Commit titles are a signal — work items are
> the authoritative source for business context.

### Phase 3: Source Diffs

For each interesting config, pull the unified diff:

```bash
dxs source diff --from <old_branch_id> --to <new_branch_id> --config <reference_name>
```

The response tells you:

- `change_type` — `created` / `modified` / `deleted` / `unchanged`
- `content` — full config (when created)
- `diff` — unified diff (when modified)

**When to pull a diff:**

- **Always diff newly-created configs.** `content` shows the full structure
  of the new thing (a hub's tabs, a flow's logic, a grid's columns). This is
  what lets you write a structural description in the notes.
- **Diff heavily-modified configs.** When a single config appears in many
  commits, the cumulative diff is the best way to see what actually changed.
- **Diff bug fixes.** Fixes are often a one- or two-line change; the diff
  tells you whether the fix matches the work item's reported problem.

**Config type → where to look for meaning:**

| Type | What it describes |
|---|---|
| `hub` | Navigation structure, tabs, action bars |
| `flow` / `footprintFlow` | Backend business logic |
| `frontendFlow` | UI interactions and navigation |
| `form` / `editor` | User interface screens |
| `grid` | Data display, columns, filters |
| `selector` | Dropdown/picker options |
| `datasource` | Data fetching queries |
| `storage` | State management (often MongoDB) |

**Modification types:**

- `add` — new config, likely a new feature. Always diff it.
- `update` — modified. May be significant or trivial; the diff decides.
- `delete` — removed. Potential breaking change; flag it.

### Phase 4: Drill Into Dependencies (NOT optional)

Dependency updates often contain the most significant features and fixes. A
release with 60+ updated dependencies likely has major changes buried in
component packages (Waves, Carts, Inventory, FootprintManager, etc.) that
will be missed if you only look at the main app's commits.

For each entry in `dependency_changes` from Phase 1:

```bash
# Compare the dependency's baseline vs. target
dxs source compare --from <dep_old_branch_id> --to <dep_new_branch_id>
```

Then **repeat Phases 2–3 recursively** on the dependency's commits. When the
dependency itself has `dependency_changes`, drill again. The recursion bottoms
out at leaf packages with no further dep updates.

**Use subagents for scale.** Analyzing 60 dependencies sequentially is too
slow and leads to shortcuts. Spawn parallel Agents (one per dependency) to
run Phases 2–3; aggregate their outputs when you compose the notes.

> Main app commits are often just "sync" commits that pull in dependency
> updates. Real features like "Wave Planning", "Cart Management", "Order
> Import" are implemented in their respective component packages. Skipping
> dependency analysis means missing 80%+ of the actual changes.

### Phase 5: Write Notes

Produce **both** a Technical variant and a Customer variant.

#### Mandatory Requirements (both variants)

Every feature and bug fix entry MUST include:

1. **Work Item Link** — clickable URL to DevOps.
   `[#XXXXXX](https://dev.azure.com/DatexCorporation/_apis/wit/workItems/XXXXXX)`
   If no work item exists, flag as "Missing traceability" and use the commit ID.
2. **Business Context** — the *why* from the work item description.
3. **Author Attribution** — who implemented it (from work item or commit).
4. **Technical Details** — added/modified configs (Technical variant only).

> Release notes without work item links are incomplete. They lack traceability
> and make it impossible for readers to get more context.

#### Deduplication

The same work item can appear across multiple dependencies (e.g., a feature
touching Waves *and* FootprintManager). When composing the final notes,
deduplicate by work item ID — list the feature once and note that it spans
multiple modules, rather than repeating it per dependency.

## Output Formats

### Technical Release Notes

```markdown
# Release Notes — <app>  (<from_version> → <to_version>)

## Summary
- Date range: <from_date> → <to_date>
- Intermediate releases: <count>
- Dependencies updated: <count>

## New Features

### <Feature Title from Work Item>
**Work Item:** [#NNNNNN](…/workItems/NNNNNN)
**Author:** <Name>

<Description from the work item requirements.>

**Structure / Technical Details:**
- <What was created — new configs, tabs, flows>
- <Key structural notes from the diff>

**New configurations:** <count> configs including <brief list>.

---

## Improvements
<same shape as Features, for enhancements to existing functionality>

---

## Bug Fixes

### <Bug Title from Work Item>
**Work Item:** [#NNNNNN](…/workItems/NNNNNN)
**Author:** <Name>

**Problem:** <What users experienced — from work item description.>
**Fix:** <What was actually changed — from the source diff.>

---

## Dependencies Updated

| Dependency | From | To | Significant Changes |
|---|---|---|---|
| Waves | <ver> | <ver> | Wave planning feature, N bug fixes |
| …      | …    | …  | …                                 |
```

### Customer Release Notes

- **Audience:** End users, warehouse managers, operations staff.
- **Tone:** Clean, professional prose. Informative, not marketing-speak.
- **Focus on "what this means for you":** practical impact.
- **Omit:** Configuration names, branch IDs, internal technical details.

```markdown
# What's New — <app>  <from_version> → <to_version>

## New Capabilities

### <Feature Title>
<Two to four sentences in plain language explaining what the user can now do
and why it matters. No config names, no branch IDs.>

---

## Improvements

- <Short sentence per improvement, focused on user-visible impact.>
- <…>

---

## Fixes

- <Short sentence per fix describing the user-visible problem that is no
  longer happening.>
- <…>
```

**Customer Notes Anti-Patterns — avoid:**

- Heavy emoji usage (unprofessional for business software)
- Marketing-speak ("We're excited to announce…")
- Technical jargon (config names, branch IDs, flow names)
- Vague descriptions ("various improvements", "bug fixes")

## Tips

1. **The code is the source of truth.** Commit titles and work items are
   signals — the code has the real context. This is why Phase 3 is mandatory.
2. **Every feature branch should have a work item.** If one doesn't, flag
   "Missing traceability"; don't paper over it.
3. **Diff new configs to understand structure.** A hub's tabs, a flow's logic,
   a grid's columns are all visible in the diff of an `add` config.
4. **Bug fixes reveal themselves in diffs.** A complex-sounding bug often has
   a one-line fix. Show the actual change in the Technical notes.
5. **Dependencies are where the features live.** Phase 4 is where 80% of the
   substance often is. Don't skip it.
6. **Use subagents for scale.** Sequential dependency analysis over 60+
   packages hits time and context limits. Parallel Agents are the fix.
7. **Aggregate carefully.** Deduplicate work items that appear in multiple
   dependencies — they're the same feature, touched in two places.

## Example Session

```bash
# Step 1: Compare main app releases
dxs source compare --from 64920 --to 67162
# 16 committed_branches, 19 updated dependencies

# Step 2: Work items for a feature commit
dxs source workitems --branch 66644 --description
# Work item #234705 — Mobile Configurator hub

# Step 3: Structure of the new hub
dxs source diff --from 64919 --to 67159 --config mobile_configurator_hub
# Tabs: Warehouses, Owners, Order Classes, Equipment Types

# Step 4: Drill into Waves dependency
dxs source compare --from 64876 --to 67102
# 12 commits with wave planning features

dxs source workitems --branch 67099 --description
# Work item #180436 — wave creation requirements

dxs source diff --from 64876 --to 67102 --config create_annotation_task_action
# Shows the new flow's code

# Check a bug fix
dxs source workitems --branch 66852 --description        # Bug #238852
dxs source diff --from 64919 --to 67159 \
  --config outbound_orders_eligible_for_return_grid
# agGrid: null → agGrid: true
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Skipping Phase 4 because "the main app only had sync commits" | Those sync commits are the signal that the work is in dependencies — drill |
| Using commit titles as feature titles | Use the linked work item's title; commit titles are often rushed |
| Repeating the same feature under multiple dependencies | Deduplicate by work item ID when composing |
| Omitting work item links "to keep notes clean" | Links are mandatory; without them notes are untraceable |
| Customer notes with config names / branch IDs | Strip internal vocabulary — customer variant is prose, not config soup |
| Sequential dependency analysis over 50+ deps | Use parallel Agents; sequential hits context and time limits |
