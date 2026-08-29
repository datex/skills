---
name: release-notes-generator
description: |
  Use when generating release notes between two Datex Studio releases. Enumerates
  the changed-dependency worklist with `dxs source release-tree`, mines each
  package's commits and linked DevOps work items, reads config diffs, and produces
  Technical and Customer release notes. Works for Datex products and for customer
  applications (which reference both the shared Datex catalog and their own org's
  packages). Trigger for: "generate release notes from X to Y", "write release
  notes between <old> and <new>", "release notes for <app> between branches A and
  B", "compare releases X and Y and summarize". For time-range-based anchor
  picking ("weekly notes", "what shipped last week"), use
  `prospective-release-notes` — it resolves the two branch IDs and then invokes
  this skill.
depends:
  - datex-studio-shared
---

# Release Notes Generator

Generate release notes between two Datex Studio branches by combining three
sources: commits (what merged), work items (why), and config diffs (what
actually changed). Produces both a Technical and a Customer variant.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch selection, when the user has not yet given both branch IDs

## Prerequisites

- **`--from` branch ID** — the older release (baseline) of the **root application**
- **`--to` branch ID** — the newer release (target) of the root application
- **dxs ≥ 0.4.9** — needs `source release-tree` and cross-org dependency
  resolution. Older builds' `deps-diff`/`compare` silently report **zero**
  dependency changes (they compared a field the AppConfig payload dropped) and
  cannot resolve a customer app's own-org packages. If `dxs source release-tree
  --help` fails, stop and say so — don't fall back to the blind path.
- **dxs ≥ 0.4.24 strongly preferred.** From that build `release-tree` resolves
  **Service-Pack-pinned** dependencies itself, reports a skipped sub-tree
  (`subtree_skipped` / `summary.subtrees_skipped`) instead of dropping it
  silently, names which side failed (`resolve_failed_sides`), and accepts
  `--extra-org` to index another org's repos. On an older build every one of
  those is manual work — see Phase 1b.
- **dxs ≥ 0.5.4 if anything calls `dxs source release-notes` directly** (this
  skill's own path is `release-tree`, which was never affected). Its dependency
  diff compared `marketPlaceApplicationVersionId` on both sides — a field the
  `AppConfig` migration dropped — so it compared `None` to `None` and a
  dependency **bump was never reported as updated**. From 0.5.4 it diffs on the
  resolved `version` through the same helper `source compare` and `deps-diff`
  use, so the three agree, and a bump whose branches can't be resolved is
  reported as unclassified rather than dropped.

Both branch IDs are needed up front. If the user gave a **version name** instead
(or a date, or only one), resolve it first — see *Resolving the root app &
versions* below. The Branch ID Policy applies: never assume an ID.

## Resolving the root app & versions

The "root application" is whatever the user is releasing — and it is **not
always a Datex product**. A customer's deployed app (e.g. Tobin's `Footprint`,
`tob-footprint`) is typically a thin aggregator: it has **few or zero direct
commits of its own**, and its release *is* the set of dependency version bumps.
That's expected — the substance lives in the dependencies, which `release-tree`
enumerates.

Two resolution wrinkles to handle before Phase 1:

- **Cross-org packages.** A customer app references both the shared **Datex
  catalog** (org 1) and packages from its **own organization** (e.g. `tob-*`).
  `release-tree` auto-detects the root app's org (via
  `applicationDefinitionId → repo → organization`) and indexes both, so the
  customer's own packages resolve. Without that (older dxs), they vanish
  silently. Find a customer's app: `dxs source repo list --org-name <CODE>`.
- **Version names, incl. Service Packs.** If given a version name, resolve it to
  a branch ID. The default-group listing **excludes Service Packs**, so a
  versionName like `20260423.145611.SP.20260604.154933` won't appear there:
  - default releases: `dxs source branch list --repo <id> --default-group --status published -n 0` → match `versionName`
  - Service Packs: `dxs source servicepack list --repo <id>` to find the SP group, then `dxs source branch list --repo <id> --group-id <sp_group> --status published -n 0`
  - (`branch search` matches the branch *name*, not `versionName` — don't use it.)

  This is the manual path for the **root app's** own version name. For
  **dependencies**, `release-tree` handles the SP fallback itself on
  dxs ≥ 0.4.24 — see *Phase 1b*.

## Workflow

```
[Phase 1: Enumerate]
dxs source release-tree --from <root_old> --to <root_to>   (--recursive if nested)
  → root + every changed dependency, each resolved to from/to branch IDs
    (cross-org), plus added / removed packages
        |
[Phase 1b: Recover unresolved deps]   summary.resolve_failed must reach 0
Usually empty on dxs >= 0.4.24 (SP groups resolved automatically). If not:
  no repository for uniqueIdentifier -> re-run with --extra-org <orgId>
  still unresolved                   -> manual lookup (see Phase 1b)
  (with --recursive: re-walk each recovered dep — its sub-tree was skipped too)
        |
[Phase 2: Commits per package]
For root + each changed dependency (parallel):
  dxs source compare --from <pkg_old> --to <pkg_new> --exclude-sync
  → committed_branches (id, title, author, date, changes), workitem_ids
        |
[Phase 3: Work Items per commit]
  dxs source workitems --branch <commit_branch_id> --description
        |
[Phase 4: Source Diffs]
For each created/meaningfully-modified/bug-fix config:
  dxs source diff --from <pkg_old> --to <pkg_new> --config <ref_name>
        |
[Phase 5: Write Notes]
Compose two variants per the Output Formats below:
  • Technical — for developers/support
  • Customer — for end users / operations
Deduplicate work items that appear in multiple dependencies. Note added/removed
packages (a newly-included package is a feature; a removed one, a flag).
```

## Phase Details

### Phase 1: Enumerate (release-tree)

```bash
dxs source release-tree --from <root_old_branch_id> --to <root_to_branch_id>
# add --recursive only if dependencies have their own changed sub-dependencies;
# a flat aggregator (the common case) is complete in one pass.
```

This single call replaces the old "compare the main app, then recursively
`compare`-drill each dependency" dance. It returns:

- **`root`** — the application being released (`reference_name`, branch IDs).
  Often a thin wrapper with no direct commits of its own.
- **`dependencies`** — every changed dependency, each already resolved to
  `repo_id`, `from_branch_id`, `to_branch_id` (the IDs you need to drill it),
  plus `from_version` / `to_version`. Resolved **cross-org**, so a customer
  app's own packages (e.g. `tob-reports`) are included, not just the Datex
  catalog. Any dependency that couldn't be resolved carries a `resolve_error`,
  and (dxs ≥ 0.4.24) `resolve_failed_sides: ["from"|"to"]` — **read the side
  from that field, not by parsing the `; `-joined `resolve_error` string**,
  which is prose and not parseable. An unresolved entry also carries
  `subtree_skipped: true` when `--recursive` could not descend through it.
- **`added`** / **`removed`** — packages newly included in, or dropped from, the
  release. These have no commit delta to mine; record them directly in Phase 5
  (a newly-included package is a feature; a removed one, a potential flag).
- **`summary`** — counts (`dependencies_total`, `resolved_ok`, `resolve_failed`,
  `added_count`, `removed_count`, and on dxs ≥ 0.4.24 `subtrees_skipped`), plus
  `max_depth_reached` and `recursive`. With `--recursive`, compare
  `max_depth_reached` against `--max-depth` (default 10) — if they're equal the
  walk may have been truncated. **`subtrees_skipped > 0` is as serious as
  `resolve_failed > 0`**: it counts dependencies whose entire changed sub-tree
  went un-enumerated because the walk could not descend through them.

> **Why not `compare`/`deps-diff` for enumeration?** On the resolved-version
> diff they are correct only on dxs ≥ 0.4.9; older builds report **zero** changed
> dependencies (they compared `marketPlaceApplicationVersionId`, dropped from the
> AppConfig payload) — so a run would conclude "nothing changed" and skip the
> 80%+ of substance that lives in dependencies. `release-tree` is the
> authoritative enumerator and also hands you the branch IDs to drill.

### Phase 1b: Recover every `resolve_failed` dependency (NOT optional)

**`summary.resolve_failed` must reach 0 before you proceed to Phase 2 — or every
remaining failure must be named in the notes as an unanalyzed gap (see the end of
this section).** An unresolved dependency is missing at least one branch ID, so
it cannot be compared or diffed — it drops out of the notes silently, which is
the exact failure this skill exists to prevent. Treat a non-zero count as a
blocker, not a warning.

**On dxs ≥ 0.4.24 this phase is usually a no-op** — check
`summary.resolve_failed` and `summary.subtrees_skipped`, and if both are 0, go
straight to Phase 2. `release-tree` resolves Service-Pack-pinned dependencies
itself: `_published_version_map` merges the repo's Default application group
first, then falls back to its **Service Pack** groups for any version still
missing (one extra listing only for repos that need it). A versionName
containing `.SP.`, e.g. `20260423.145611.SP.20260604.154933`, now resolves
normally. On dxs < 0.4.24 it never resolved, because the lookup saw only the
Default group — if you are on an older build, upgrade (`dxs update`) rather than
working the table below by hand.

When something *does* fail, recover by cause:

| Signal | Cause | Recovery |
|---|---|---|
| `resolve_failed_sides: ["to"]` (or `["from"]`) | Only one side is missing — the other branch ID is good | Recover **only** the named side; never discard an ID you already have. Read the side from this field, not by parsing the `; `-joined `resolve_error` prose. |
| `no repository for uniqueIdentifier …` | The package's org isn't in the repo index (`repo_id` is absent). `release-tree` auto-detects the *root* app's org only. | **Re-run with `--extra-org <orgId>`** (repeatable, additive to the auto-detected orgs) — this is the in-band fix, and the CLI's own help names this exact case. Only if you don't know the org id: derive the org code from the dependency's `reference_name` prefix (`tob-reports` → `TOB`), `dxs source repo list --org-name <CODE>` for the org, then re-run with `--extra-org`. |
| `… not found in published releases` on dxs ≥ 0.4.24 | Genuinely unpublished, or a group type the fallback doesn't cover | `dxs source servicepack list --repo <repo_id>` → for each SP group id: `dxs source branch list --repo <repo_id> --group-id <gid> --status published -n 0` → match `versionName` to the entry's `from_version` / `to_version`. If it isn't there either, the version was never published — record it as an unanalyzed gap. |
| `subtree_skipped: true` | `--recursive` could not descend through this entry, so its whole changed sub-tree is missing from the worklist | Recover its branch IDs by the rows above, then re-walk it (see below). `summary.subtrees_skipped` counts these. |

Feed the recovered branch IDs into Phase 2 exactly as if `release-tree` had
returned them.

**If the Phase 1 run used `--recursive`, also re-walk each recovered
dependency.** An unresolved dependency is never enqueued for the next depth
level — the walk skips anything missing a branch ID — so its own changed
sub-dependencies were never enumerated either. Recovering the branch IDs fixes
the package itself but leaves everything beneath it invisible, which is the same
silent miss in miniature:

```bash
dxs source release-tree --from <recovered_from> --to <recovered_to> --recursive
```

Merge that output into the worklist — dedupe on `unique_identifier` +
`from_version` + `to_version` (the same key the walk uses internally), and carry
its `added` / `removed` into Phase 5 too. Then run Phase 1b again on its
`summary.resolve_failed` and `summary.subtrees_skipped`: a recovered sub-tree can
contain unresolvable dependencies of its own.

If a dependency still won't resolve after both paths, **say so explicitly in the
notes** ("could not analyze `<package>` `<from>` → `<to>`") rather than omitting
it — an unanalyzed package is a known gap, not an absence of change.

> Service Packs are the norm for customer applications, which are frequently
> hotfixed off a published release rather than tracking the default line. For a
> customer app, expect `resolve_failed > 0` and budget for this step.

### Phase 2: Commits per package

For the root **and** each changed dependency from Phase 1, list its commits
(parallel — this is the per-package fan-out):

```bash
dxs source compare --from <pkg_from_branch_id> --to <pkg_to_branch_id> --exclude-sync
```

From `branch_comparison` you get, per package:

- **`committed_branches`** — each merged feature branch:
  - `id` — branch id of the commit (use it for Phase 3 work items)
  - `title` — short commit headline. A headline only — never the body of a
    release note entry; the work item (Phase 3) and diff (Phase 4) carry that.
  - `author` — who committed
  - `date`
  - `changes` — config-level changes (`reference_name`, `type`, `modification`
    of `add`/`update`/`delete`)
- **`workitem_ids`** — linked DevOps work items for the whole package window.
- **`releases`** / `release_count` — intermediate releases (for the header).

`--exclude-sync` drops sync-only commits (which merely pull dependency updates);
the real work in those is captured because the dependency is its own package in
the worklist. A thin root app may legitimately return **zero** committed
branches — that's not an error, its release is the dependency bumps.

> **There is no per-commit `release_notes` field.** A commit carries only the
> five keys above. A verbose SideKick-authored commit description exists on an
> unmerged dxs branch (`feature/commit-message-suggestion-release-notes`) and
> has never shipped — don't look for it, and don't treat its absence as a
> degraded run. Until it merges, *what the commit did* comes from the work item
> and the diff, not from commit prose.

### Phase 3: Work Items per Commit

For each commit whose `changes` array is non-trivial (or every commit, when
scope allows), fetch the linked work items:

```bash
dxs source workitems --branch <commit_branch_id> --description
```

Work items are the most valuable input for the **business context** of a
release note. They contain:

- `title` — concise feature name (often more descriptive than the commit title)
- `type` — Development / Bug / Wavelength Component / etc.
- `state` — Done / Committed / etc.
- `assigned_to` — author attribution
- `description` — full requirements, steps to reproduce, mockups, acceptance
  criteria

If a commit has **no linked work items**, flag it as "Missing traceability" and
reconstruct the body from the Phase 4 diff — that is the only remaining account
of what the commit did. Use the commit ID and `title` as the entry headline.
Never silently drop these.

> Two inputs, two roles:
> - **Work items (Phase 3)** — the *why*. Business intent, requirements,
>   acceptance criteria. Primary input for the description in the notes.
> - **Diffs (Phase 4)** — the *how*. The code itself, the final source of
>   truth when the prose disagrees with what was actually committed.
>
> Commit titles are just headlines; they're not a primary input. There is no
> third, commit-level prose input — see the Phase 2 note.

### Phase 4: Source Diffs

For each interesting config, pull the unified diff (using the **owning package's**
from/to branch IDs from Phase 1):

```bash
dxs source diff --from <pkg_from_branch_id> --to <pkg_to_branch_id> --config <reference_name>
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

### Scale: dependencies are where the features live (NOT optional)

The root app's own commits are often just sync commits — or none at all. Real
features like "Wave Planning", "Cart Management", "Order Import" live in the
component packages (Waves, Carts, Inventory, FootprintManager, …). `release-tree`
already enumerated and resolved them in Phase 1; the work is to run Phases 2–4
over **every** one, not just the root. Skipping dependency analysis means missing
80%+ of the actual changes.

**Use subagents for scale.** A FootprintManager-class release is 20–60 packages
and hundreds of commits — too much for one context. Spawn parallel Agents (one
per package, or per batch of ~5 commits) to run Phases 2–4, then aggregate their
findings when you compose the notes. For the heavy, deterministic version of this
fan-out (cheap-model leaf/reduce over a baked worklist), see the v2 architecture
tracked in `datex/skills#16`.

### Phase 5: Write Notes

Produce **both** a Technical variant and a Customer variant.

#### Mandatory Requirements (both variants)

Every feature and bug fix entry MUST include:

1. **Work Item Link** — clickable URL to DevOps, built from the work item's
   **`external_id`** (not its internal id):
   `[#XXXXXX](https://dev.azure.com/DatexCorporation/_workitems/edit/XXXXXX)`
   (the `_workitems/edit/` browser path, not the `_apis/wit/workItems/` API
   endpoint). If no work item exists, flag "Missing traceability" and use the
   commit ID.
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
**Work Item:** [#NNNNNN](…/_workitems/edit/NNNNNN)
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
**Work Item:** [#NNNNNN](…/_workitems/edit/NNNNNN)
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
   signals — the code has the real context. This is why the Phase 4 diff is
   mandatory.
2. **Every feature branch should have a work item.** If one doesn't, flag
   "Missing traceability"; don't paper over it.
3. **Diff new configs to understand structure.** A hub's tabs, a flow's logic,
   a grid's columns are all visible in the diff of an `add` config.
4. **Bug fixes reveal themselves in diffs.** A complex-sounding bug often has
   a one-line fix. Show the actual change in the Technical notes.
5. **Dependencies are where the features live.** Running Phases 2–4 over every
   package release-tree enumerates is where 80% of the substance often is —
   especially for a thin customer wrapper whose own app has no commits.
6. **Use subagents for scale.** Sequential dependency analysis over 60+
   packages hits time and context limits. Parallel Agents are the fix.
7. **Aggregate carefully.** Deduplicate work items that appear in multiple
   dependencies — they're the same feature, touched in two places.

## Example Session

```bash
# Step 1 (Phase 1): Enumerate the worklist — root + every changed dependency,
# each resolved to from/to branch IDs, cross-org.
dxs source release-tree --from 64920 --to 67162
# root + 19 changed deps (e.g. Waves 64876→67102), 0 resolve_failed, 1 added

# Step 2 (Phase 2): Commits for the Waves dependency
dxs source compare --from 64876 --to 67102 --exclude-sync
# 12 committed_branches with wave planning work

# Step 3 (Phase 3): Why — the work item behind a commit
dxs source workitems --branch 67099 --description
# Work item #180436 — wave creation requirements

# Step 4 (Phase 4): How — the new flow's code
dxs source diff --from 64876 --to 67102 --config create_annotation_task_action

# Bug fix: why then how
dxs source workitems --branch 66852 --description        # Bug #238852
dxs source diff --from 64919 --to 67159 \
  --config outbound_orders_eligible_for_return_grid
# agGrid: null → agGrid: true
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Enumerating dependencies with `compare`/`deps-diff` | Blind on dxs < 0.4.9 (reports 0 changes) — use `source release-tree` |
| Concluding "nothing changed" because the root app had few/no commits | A thin wrapper's release *is* its dependency bumps — run Phases 2–4 over every dependency release-tree enumerated |
| Hunting for a per-commit `release_notes` / SideKick description | It doesn't exist in any shipped dxs — the *what* comes from the work item and the diff |
| For a customer app, only resolving Datex-org packages | release-tree resolves cross-org; the customer's own `*-` packages count too |
| Proceeding to Phase 2 with `summary.resolve_failed > 0` | Those packages silently vanish from the notes — recover each one per Phase 1b before mining commits |
| Proceeding to Phase 2 with `summary.subtrees_skipped > 0` | An entire changed sub-tree went un-enumerated, not just the one entry — recover and re-walk it per Phase 1b |
| Parsing the `; `-joined `resolve_error` string to find which side failed | Read `resolve_failed_sides` (dxs ≥ 0.4.24); `resolve_error` is prose and not parseable |
| Hand-recovering a Service-Pack-pinned dependency | `release-tree` resolves SP groups itself on dxs ≥ 0.4.24 — upgrade (`dxs update`) instead of working the recovery table |
| Treating `no repository for uniqueIdentifier` as a manual-lookup-only case | Re-run with `--extra-org <orgId>` (dxs ≥ 0.4.24) — that flag exists for exactly this |
| On a `--recursive` run, recovering a dependency's branch IDs but not re-walking it | The walk skipped its sub-tree the moment it failed to resolve — re-run `release-tree --recursive` on the recovered IDs (Phase 1b) |
| Using commit titles as feature titles | Use the linked work item's title; commit titles are often rushed |
| Building the DevOps link from the internal id / `_apis/` URL | Use `external_id` and the `_workitems/edit/` browser path |
| Repeating the same feature under multiple dependencies | Deduplicate by work item ID when composing |
| Omitting work item links "to keep notes clean" | Links are mandatory; without them notes are untraceable |
| Customer notes with config names / branch IDs | Strip internal vocabulary — customer variant is prose, not config soup |
| Sequential dependency analysis over 50+ deps | Use parallel Agents; sequential hits context and time limits |
