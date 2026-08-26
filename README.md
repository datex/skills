# Datex Agent Skills

This repository contains a set of agent skills for Datex products

- Datex Studio - The Low Code App Platform (LCAP) that Datex uses to build its products
- Footprint WMS - A 3PL optimized WMS built in Datex Studio

## Installation

These skills follow the [skills.sh](https://www.skills.sh/) / [vercel-labs/skills](https://github.com/vercel-labs/skills) format and can be installed with `npx skills`.

### Datex Studio skills depend on `datex-studio-shared`

Most `datex-studio-*` skills (report-creator, report-editor, function-creator, datasource-creator, endpoint-creator, hub-editor, branch-code-reviewer, commit-message-generator, release-notes-generator) reference cross-cutting context (branch setup, Studio lifecycle, RDLX-JSON report authoring, etc.) that lives in a companion skill named **`datex-studio-shared`**. Install it alongside any consumer skill, or relative-path links like `../datex-studio-shared/branch-setup.md` will not resolve.

Each consumer skill declares this in its frontmatter:

```yaml
depends:
  - datex-studio-shared
```

The `depends` field is a forward-compatible marker for [vercel-labs/skills#860](https://github.com/vercel-labs/skills/issues/860). Until automatic dependency resolution ships, install both explicitly:

```bash
# Install everything from this repo (simplest)
npx skills add <repo-url> --all

# Or pick targeted skills, including the shared one
npx skills add <repo-url> -s report-creator -s datex-studio-shared
```

### Why `datex-studio-shared` exists as a skill

Cross-skill content used to live in a plain `shared/` directory. `npx skills` only copies directories that contain a `SKILL.md`, so sibling non-skill directories were silently dropped on install. Promoting the content to a real skill with its own `SKILL.md` is the only pattern that travels through every installer today.

## Skill catalog

**42 Datex Studio skills + 3 Footprint skills.** Organized below per spec group (creators, editors, tailoring, validators, shared/library, utilities, workflow orchestration). The per-skill inventory is the catalog below; most of these skills were introduced by the Mitch merge.

### Datex Studio — Component creators (17)

Skills for authoring NEW component configurations on a branch. Each owns the rules and lifecycle for one component type.

| Skill | What it creates | configurationTypeId |
|---|---|---|
| [`action-creator`](skills/datex-studio/action-creator/SKILL.md) | Server-tier transactional flows (`*-footprintFlow.json`) | 18 |
| [`agent-creator`](skills/datex-studio/agent-creator/SKILL.md) | Agent configurations — commands and skills for the Footprint CLI (`fp`) | 38 |
| [`backend-test-creator`](skills/datex-studio/backend-test-creator/SKILL.md) | Mocha test suites (`*-backendTest.json`) | 24 |
| [`custom-angular-component-creator`](skills/datex-studio/custom-angular-component-creator/SKILL.md) | Custom Angular Components — bespoke coded UI via the `dxs ng` create → preview → push loop (a working folder, not a `*.json` body) | 36 |
| [`datasource-creator`](skills/datex-studio/datasource-creator/SKILL.md) | OData and flow datasources (`*-datasource.json`, `*-footprintDatasource.json`) | 6 / 19 |
| [`editor-creator`](skills/datex-studio/editor-creator/SKILL.md) | Single-entity view/edit screens (`*-editor.json`) | 4 |
| [`embed-creator`](skills/datex-studio/embed-creator/SKILL.md) | Iframe-hosting external URL / HTML-string embeds (`*-embed.json`) | 20 |
| [`endpoint-creator`](skills/datex-studio/endpoint-creator/SKILL.md) | API endpoints exposing flows or datasources as HTTP routes | 26 |
| [`footprint-workflows`](skills/datex-studio/footprint-workflows/SKILL.md) | TypeScript implementations bound to Footprint platform workflow slots (`*-footprintWorkflow.json`) | 23 |
| [`form-creator`](skills/datex-studio/form-creator/SKILL.md) | Transient-input forms and dialog openers (`*-form.json`) | 5 |
| [`function-creator`](skills/datex-studio/function-creator/SKILL.md) | Backend functions / flows (`*-flow.json`) | 9 |
| [`grid-creator`](skills/datex-studio/grid-creator/SKILL.md) | Data grids — densest creator (`*-grid.json`) | 3 |
| [`hub-creator`](skills/datex-studio/hub-creator/SKILL.md) | Filter-driven hub containers (`*-hub.json`) | 2 |
| [`report-creator`](skills/datex-studio/report-creator/SKILL.md) | RDLX-JSON reports (Active Reports JS) | — |
| [`selector-creator`](skills/datex-studio/selector-creator/SKILL.md) | Datasource-backed dropdowns / autocompletes (`*-selector.json`) | 7 |
| [`storage-creator`](skills/datex-studio/storage-creator/SKILL.md) | Cloud-persisted Mongo storage (`*-storage.json`) | 17 |
| [`type-definition-creator`](skills/datex-studio/type-definition-creator/SKILL.md) | Interfaces (`i_*`) and enums (`e_*`) (`*-customType.json`) | 22 |

### Datex Studio — Component editors (2)

Modifying EXISTING component configurations.

| Skill | What it modifies |
|---|---|
| [`hub-editor`](skills/datex-studio/hub-editor/SKILL.md) | Toolbar buttons and click flows on an existing hub |
| [`report-editor`](skills/datex-studio/report-editor/SKILL.md) | 5-category triage (label/style, rearrange, add column, datasource gap, new section) |

### Datex Studio — Tailoring (1)

| Skill | Purpose |
|---|---|
| [`tailoring-overlay`](skills/datex-studio/tailoring-overlay/SKILL.md) | Extend a core-library component via `baseConfiguration` overlay; flatten tailored → standalone custom |

### Datex Studio — Validators (3)

Audit-only skills (no mutations). Invoked as the final gate after authoring/modifying.

| Skill | Scope |
|---|---|
| [`component-validator`](skills/datex-studio/component-validator/SKILL.md) | Generic single-file audit; routes by file suffix to the matching creator's rules |
| [`grid-validator`](skills/datex-studio/grid-validator/SKILL.md) | Grid-specific gotchas (envelope, text-display coercion, dynamic-filter five-location sync) |
| [`project-validator`](skills/datex-studio/project-validator/SKILL.md) | Project-wide lint across 5 cross-component check categories |

### Datex Studio — Shared / library skills (3)

Reference-only library skills. **Not invoked directly.** Other skills link into the files they contain.

| Skill | Content |
|---|---|
| [`datex-studio-shared`](skills/datex-studio/datex-studio-shared/SKILL.md) | Branch & connection setup, Studio lifecycle, context navigation, flow code patterns, RDLX-JSON report authoring, vendored Datex app design system (Fluent 2) |
| [`datex-studio-conventions`](skills/datex-studio/datex-studio-conventions/SKILL.md) | File format invariants, naming conventions, defaults |
| [`datex-studio-runtime`](skills/datex-studio/datex-studio-runtime/SKILL.md) | Runtime globals, three-tier execution model, control-type catalog |

### Datex Studio — Utilities (15)

Workflow helpers consumed by creator skills or invoked standalone.

| Skill | Purpose |
|---|---|
| [`branch-code-reviewer`](skills/datex-studio/branch-code-reviewer/SKILL.md) | Branch-level code review with severity tags ([ISSUE]/[WARNING]/[INFO]/[OK]) |
| [`codebase-research`](skills/datex-studio/codebase-research/SKILL.md) | Read-only codebase investigation with Datex Studio-specific patterns |
| [`commit-message-generator`](skills/datex-studio/commit-message-generator/SKILL.md) | Draft 3-part Datex commit messages |
| [`component-scaffolder`](skills/datex-studio/component-scaffolder/SKILL.md) | Type → folder/suffix/configurationTypeId/skeleton/creator dispatch |
| [`component-wiring-check`](skills/datex-studio/component-wiring-check/SKILL.md) | Audit the three silent-failure traps (moduleId, configParameters mirror, vars declaration) |
| [`db-query`](skills/datex-studio/db-query/SKILL.md) | `$db` predicate DSL + flow-db-datasource patterns |
| [`devops-requirements`](skills/datex-studio/devops-requirements/SKILL.md) | Extract requirements from Azure DevOps work items |
| [`footprint-cli`](skills/datex-studio/footprint-cli/SKILL.md) | Run `fp` against a deployed agent app: auth, verb discovery, 401/404 diagnosis |
| [`impact-analysis`](skills/datex-studio/impact-analysis/SKILL.md) | Reverse-trace caller analysis before contract changes (write-side / read-side split) |
| [`odata-execution`](skills/datex-studio/odata-execution/SKILL.md) | Incremental OData query development with `dxs odata execute` |
| [`post-edit-verification`](skills/datex-studio/post-edit-verification/SKILL.md) | Cheapest-first verification ladder after every component edit |
| [`prospective-release-notes`](skills/datex-studio/prospective-release-notes/SKILL.md) | Time-range anchor picker for unattended weekly release notes |
| [`release-notes-generator`](skills/datex-studio/release-notes-generator/SKILL.md) | 5-phase release notes pipeline (Technical + Customer outputs) |
| [`requirements-gathering`](skills/datex-studio/requirements-gathering/SKILL.md) | Standardized requirements brief from any source |
| [`schema-explorer`](skills/datex-studio/schema-explorer/SKILL.md) | OData schema discovery and field-mapping table builder |

### Datex Studio — Workflow orchestration (1)

Cross-cutting workflow skills that orchestrate multiple `dxs` command families instead of authoring a single component type.

| Skill | Purpose |
|---|---|
| [`package-cascade`](skills/datex-studio/package-cascade/SKILL.md) | Propagate a published package change up the dependency graph — re-pin and republish every consuming package, bottom-up, stopping at applications (reported as stale) |

### Footprint (3 skills, out of scope for the Mitch merge)

| Skill | Status |
|---|---|
| [`building-waves`](skills/footprint/building-waves/SKILL.md) | Empty stub — placeholder |
| [`footprint-entity-expert`](skills/footprint/footprint-entity-expert/SKILL.md) | Footprint WMS entity navigation, filter conventions, weight/unit math |
| [`slotting`](skills/footprint/slotting/SKILL.md) | Empty stub — placeholder |

## Recent history

The Datex Studio skill set was substantially expanded by the **Mitch skills merge**: 20 net-new skills added (12 component creators, 2 validators, 1 post-edit verification, 3 command-replacement skills, 2 shared/library siblings to `datex-studio-shared`) plus targeted absorption of Mitch's domain depth into 4 existing Datex skills (`datasource-creator`, `function-creator`, `impact-analysis`, `hub-editor` ↔ `hub-creator` cross-link).

## Not yet covered (roadmap)

Component types the platform supports but that no skill or reference doc covers yet. When feature work first touches one, add a skill and a reference doc following [docs/component-doc-template.md](docs/component-doc-template.md).

- `card`, `calendar`, `wizard`, `list`, `widget`, `visualization`, `codeeditor`, `localization`, `securitypolicy`, `shell`, `appconfig` — real, CLI-addressable config types with no skill covering them yet. The full platform enumeration, with each type's `configurationTypeId` and CLI type name, is the table in [`file-format.md`](skills/datex-studio/datex-studio-conventions/file-format.md#configurationtypeid-reference); regenerate it with `dxs api GET /configurationtypes`.
- Reports and API endpoints appeared on the original backlog but are now covered by `report-creator` and `endpoint-creator`.
- Custom Angular Components (type 36) are now covered by `custom-angular-component-creator`.
