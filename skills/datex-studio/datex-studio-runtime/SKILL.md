---
name: datex-studio-runtime
description: |
  Datex Studio platform runtime semantics: platform-injected globals (`$flow`,
  `$datasources`, `$db`, `$shell`, `$frontendFlows`, `$operations`, `$apis`,
  `$flows`, `$types`, `$utils`, `$services.jobs`, `$editor`, `$datasource`),
  three-tier execution model (functions / actions / UI components) and the
  caller→callee allow/deny matrix per tier, generic CRUD action set in the
  Utilities package, and `controlConfig.type` values used on field controls
  (codeBox, textBox, numberBox, dateBox, checkBox, selectBox, button, label,
  text, image, draw, progressBar, matrix) with sibling-config-block rules.

  Not invoked directly — other skills link into the files below. Install this
  alongside any Datex Studio component-creator skill (action-creator,
  function-creator, grid-creator, hub-creator, form-creator, editor-creator,
  selector-creator, storage-creator, db-query, tailoring-overlay) so cross-skill
  references resolve.
depends:
  - action-creator
  - component-wiring-check
  - datasource-creator
  - datex-studio-conventions
  - editor-creator
  - form-creator
  - grid-creator
  - hub-creator
  - storage-creator
---

# Datex Studio — Runtime Semantics & Execution Model

This skill is a **library**, not a workflow. The Datex Studio component-creator skills cite the files here via relative paths (e.g. `../datex-studio-runtime/calling-conventions.md`). It exists as its own skill so that `npx skills` / `skills.sh` install it alongside its consumers — sibling non-skill directories are not copied by those tools.

## When this skill is relevant

You're following a Datex Studio component-creator skill and it points you here. Read only the specific reference file the parent skill named — do not preload the whole tree.

If you're asked a runtime question that isn't already scoped to a more specific skill (e.g. "can an action call a function?", "what's the tier rule for datasources?", "what's `$utils.isDefined` semantics?", "what fields does `codeBoxConfig` have?"), use the index below to find the right file.

## Reference index

- [runtime-globals.md](runtime-globals.md) — Platform-injected globals reference table (every `$...` global the platform exposes inside flow code, with shape and tier restrictions) and the `$utils` helper notable semantics (`isDefined` is collection-aware; `isDefinedTrimmed` is whitespace-aware).
- [calling-conventions.md](calling-conventions.md) — The three execution tiers (functions / actions / UI components), the caller→callee allow/deny matrix per tier, datasource tier rule, storage tier rule (`$db` is function-tier only), the generic CRUD action set (`crud_create_entity` / `crud_update_entity` / `crud_delete_entity` in the Utilities package).
- [control-types.md](control-types.md) — `controlConfig.type` values across forms / editors / hub filters / grid cells; sibling-config-blocks-stay-null rule; declarative-string-slot encoding via cross-link to `../datex-studio-conventions/file-format.md`; dynamic mutation via flow code on the `$<container>.fields.<id>.control.<prop>` surface; detailed `codeBox` section plus stubs for textBox, numberBox, dateBox, checkBox, selectBox, button, label, text, image, draw, progressBar, matrix.

## Notes for skill authors

When a Datex Studio creator skill needs to reference content here:

1. Link with a relative path: `../datex-studio-runtime/<file>.md`.
2. Declare the dependency in the consumer's SKILL.md frontmatter:
   ```yaml
   depends:
     - datex-studio-runtime
   ```

This skill is a sibling of `datex-studio-conventions` (which covers file-format, naming-conventions, and defaults) and `datex-studio-shared` (which covers Datex Studio CLI operational context — branch selection, Studio lifecycle, designer context navigation, report authoring). The three shared-reference skills divide the cross-cutting platform knowledge by concern.
