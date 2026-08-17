---
name: datex-studio-shared
description: |
  Shared reference content used by other Datex Studio skills (report-creator,
  report-editor, function-creator, datasource-creator, endpoint-creator, hub-editor,
  branch-code-reviewer, commit-message-generator, release-notes-generator).
  Not invoked directly — other skills link into the files below. Install this
  alongside any Datex Studio skill so cross-skill references resolve.
  Covers: the canonical `dxs configuration` round-trip (get → extract `.json` →
  edit → upsert) and its silent-wipe guard, branch & connection selection,
  Studio lifecycle, designer context navigation, flow code patterns
  (`$utils.isDefined()`, OData pagination), RDLX-JSON report authoring
  (design standards, CLI commands, dataset rules, sample data, deploy patterns,
  troubleshooting), component-type references for cards (cti 11), lists
  (cti 14), and frontend flows (cti 27), and the Fluent 2 app design system
  (theme tokens, component class names, traps) for hand-authored UI.
depends:
  - function-creator
---

# Datex Studio — Shared Reference

This skill is a **library**, not a workflow. The other `datex-studio-*` skills cite the files here via relative paths (e.g. `../datex-studio-shared/branch-setup.md`). It exists as its own skill so that `npx skills` / `skills.sh` can install it alongside its dependents — sibling non-skill directories (the old `shared/`) are not copied by those tools.

## When this skill is relevant

You're following another Datex Studio skill and it points you here. Read only the specific reference file the parent skill named — do not preload the whole tree.

If a user asks a Datex Studio question that isn't already scoped to a more specific skill (e.g. "how do branch IDs work across `dxs` commands?", "what's the OData pagination pattern?"), use the index below to find the right file.

## Reference index

### Cross-skill operational context

- [configuration-roundtrip.md](configuration-roundtrip.md) — **Canonical** `dxs configuration get → extract inner `.json` → edit → upsert` round-trip for every component-creator/editor skill, and the silent-wipe bug the extraction step prevents. The branch is the source of truth; the JSON files are throwaway scratch.
- [branch-setup.md](branch-setup.md) — Active organization, repository, feature branch, and API connection selection. The Branch ID Policy (always ask, never assume) lives here.
- [studio-management.md](studio-management.md) — Studio lifecycle: check status, start in background with readiness verification, clean up.
- [context-navigation.md](context-navigation.md) — How to retrieve and read `dxs -O json … context` responses (backend vs. frontend symbol filtering), plus the `nomenclature` registry for discovering custom types and enum members (`$types.<Package>.*`).
- [flow-code-patterns.md](flow-code-patterns.md) — `$utils.isDefined()`, date defaulting, `$shell.Reports.open{ref}()`, and the OData pagination / 5000-record cap pattern.

### Component-type references (no dedicated creator skill yet)

- [cards.md](cards.md) — card components (`-card.json`, cti 11): the list-item repeater primitive; `$card` imperative surface, the no-cross-flow-calls trap and its window-helper workaround, mutate→emit→refresh loop, inline-editing patterns, pre-flight checklist.
- [lists.md](lists.md) — list components (`-list.json`, cti 14): card-based sibling of the grid; `datasourceConfig`/`itemConfig` wiring contracts, `$list` surface, report-card refresh, full-text search pushdown, pre-flight checklist.
- [frontend-flows.md](frontend-flows.md) — frontend flows (`-frontendFlow.json`, cti 27): browser-tier sibling of functions; the wrong-cti failure mode, static-dispatch-only rule for `$frontendFlows`, by-reference object inParams, and browser keyboard-handling rules (zone.js `__zone_symbol__` escape hatch, `KeyboardEvent.code` vs `.key`, reserved-combo blocklist).

### Datex app design system (`design-system/`)

The Fluent 2 UI design system for **hand-authored** UI — most importantly a Custom Angular Component (see `custom-angular-component-creator`), which doesn't get Datex styling for free. A vendored verbatim mirror of the Claude Design "Datex Studio App" system; see the folder README for provenance + how to refresh.

- [design-system/README.md](design-system/README.md) — what's here, provenance, and refresh steps.
- [design-system/02-tokens.md](design-system/02-tokens.md) — theme tokens (use `var(--…)`, never a hex), status colors, typography, spacing, icon fonts.
- [design-system/03-components.md](design-system/03-components.md) — the real `datex-*` class names to compose (buttons, fields/forms, grids, cards, widgets, toolbars, tabs).
- [design-system/06-traps.md](design-system/06-traps.md) — compiled-CSS gotchas that contradict intuition. Plus [01-principles](design-system/01-principles.md), [04-patterns](design-system/04-patterns.md), [05-voice-and-copy](design-system/05-voice-and-copy.md).

### RDLX-JSON report authoring (`report-authoring/`)

Used by `report-creator` and `report-editor`.

- [report-authoring/design-standards.md](report-authoring/design-standards.md) — Datex design language: color palette, typography, table styling, field label-value pattern, grid alignment, report categories.
- [report-authoring/json-structure.md](report-authoring/json-structure.md) — Document template, element JSON formats, expression quick reference.
- [report-authoring/design-patterns.md](report-authoring/design-patterns.md) — Coordinate system, layout patterns, element sizing.
- [report-authoring/cli-commands.md](report-authoring/cli-commands.md) — Detailed `dxs report` CLI syntax: batch ops, tablix, images, datasets, set/move/remove, validation.
- [report-authoring/sample-data.md](report-authoring/sample-data.md) — Companion `.data.json` files for live preview.
- [report-authoring/dataset-rules.md](report-authoring/dataset-rules.md) — DataSet management: CommandText rules, collection handling, date annotations, sensitivity properties.
- [report-authoring/deploy-patterns.md](report-authoring/deploy-patterns.md) — Upload, preview, and verification patterns.
- [report-authoring/troubleshooting.md](report-authoring/troubleshooting.md) — Common RDLX-JSON and CLI mistakes & fixes.

## Notes for skill authors

When a `datex-studio-*` skill needs to reference content here:

1. Link with a relative path: `../datex-studio-shared/<file>.md`.
2. Declare the dependency in the consumer's SKILL.md frontmatter:
   ```yaml
   depends:
     - datex-studio-shared
   ```
   The `depends` field is a forward-looking marker for [vercel-labs/skills#860](https://github.com/vercel-labs/skills/issues/860); until that ships, document the dependency in the consumer skill's README/install notes and instruct users to run `npx skills add … --all` (or list both names explicitly).
