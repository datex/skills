---
name: package-cascade
description: |
  Use when a Datex Studio package (ComponentModule) has changed and its consumers must be
  updated and republished up the dependency graph. Recursively finds every package that
  references the changed one (directly or transitively), re-pins each to the new published
  version, and republishes — bottom-up, interactively, stopping at applications (which are
  reported as stale, never republished). Triggers: "propagate this package change", "update
  everything that references package X", "cascade republish", "bump and republish all
  dependents", "roll out the new version of <package> to its consumers", "who needs
  republishing after I published <package>".
depends:
  - datex-studio-shared
  - commit-message-generator
  - release-notes-generator
---

# Package Cascade

Propagate a **published** package change up the dependency graph: re-pin and republish every
**package** (ComponentModule) that references it, recursively, **stopping at applications**
(which are reported as stale, never auto-published). This skill is thin, interactive
orchestration over the `dxs source cascade` commands.

## REQUIRED BACKGROUND
- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — branch & connection selection
- [references/cascade-workflow.md](references/cascade-workflow.md) — the phase-by-phase runbook with exact `dxs` commands
- [references/plan-schema.md](references/plan-schema.md) — the cascade plan JSON shape
- [references/interaction-patterns.md](references/interaction-patterns.md) — tree rendering, pick/prune prompts, progress narration
- [references/troubleshooting.md](references/troubleshooting.md) — publish failures, locks, conflicts, resume

## When to use / not use
Use when the **origin package is already published** and you want its consumers updated. The
user makes the change, commits, and publishes the origin themselves; this skill takes over
from the published version.

Not for: authoring the package change itself (use the component-creator skills), single-branch
caller analysis (use `impact-analysis`), or forward dependency inspection (`dxs source deps`).

## Division of labour (do not cross this line)
The **CLI owns all determinism**: graph traversal, topological ordering, the transitive-reference
rebuild, and conflict/cycle detection live in `dxs source cascade plan` and `dxs source reference
set`. This **skill owns interaction**: present the plan, ask all-or-subset, drive execution,
report. **Never hand-edit AppConfig JSON, never compute the update order yourself, never reason
about the transitive closure in prose** — delegate to `dxs`. If you reach for `jq` on an
appConfig, stop: that work belongs in `dxs source reference set`.

## Workflow

```
Phase 0  Establish origin+org  — user names the package; resolve uniqueIdentifier (dxs source repo
         search); take the newest published version from the user; pick the target org (auto when
         the user sees only one); CONFIRM (a wrong version poisons every pin, a wrong org syncs the
         wrong tenant).
Phase 1  Plan                  — dxs -O json source cascade plan -p <uid> -v <version> --org <orgId>
Phase 2  Present & select      — render the tree; ask ALL / subset / review-only (see
         references/interaction-patterns.md); a cycle or conflict = hard stop.
Phase 3  Execute bottom-up     — dxs source cascade run --plan plan.json [--select …];
         narrate each republish (n of N).
Phase 4  Report                — republished packages (+ new versions) and stale applications
         to update separately.
```

Follow **[references/cascade-workflow.md](references/cascade-workflow.md)** for the exact commands in each phase.

## Sibling skills
- **[datex-studio-shared](../datex-studio-shared/branch-setup.md)** — branch & connection setup (see REQUIRED BACKGROUND above).
- **[release-notes-generator](../release-notes-generator/SKILL.md)** — draft the text you pass as `--release-notes "<notes>"` in Phase 3; remember it is applied verbatim to every republished node in that run, not per-node.
- **[commit-message-generator](../commit-message-generator/SKILL.md)** — `cascade run` always writes a fixed commit message (`chore(deps): cascade update <uid>`) and has no `--commit-message` flag, so this sibling only applies if you step outside `cascade run` and drive the per-node primitives (`branch commit`) by hand for a bespoke message — a current limitation, not the default path.

## Safety gates
- **Confirm the origin package + version + target org** before planning (Phase 0). A wrong version poisons every pin; a wrong org syncs the wrong tenant.
- **Cascade is single-tenant** — Phase 1 passes `--org <id>` so only the target org's packages are planned. Consumers in other tenants are excluded (and could not be republished anyway; publishing is gated to the owning org).
- **Never assume a branch/repo ID** — the plan carries each node's Main branch id; surface it, don't guess.
- **Cycle or version conflict = hard stop.** `cascade plan` sets `cycleDetected`; `reference set` aborts on conflict. Report and do not force.
- **Explicit go/no-go** after presenting the plan — nothing mutates before the user picks (Phase 2).
- **Applications are never auto-published** — they appear only in `staleApplications`.
- **Leave failures inspectable** — on a failed node, keep its feature branch, report it, and offer resume via `--select` of the remaining nodes.
- **Publish access** — if the user lacks package-publish rights the first publish fails; surface it early.
