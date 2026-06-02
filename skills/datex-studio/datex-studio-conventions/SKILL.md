---
name: datex-studio-conventions
description: |
  Datex Studio platform conventions for component file authoring: file format
  invariants (configurationTypeId table, file locations and suffixes, TS-expression
  encoding rule for declarative string slots, the `return;` outparam pitfall),
  naming conventions (per-component-type suffix indicators, tailored_/custom_
  provenance prefixes, sentence-case display-text rule, user-facing `title`
  vs `referenceName` distinction), and defaults (package=Utilities,
  accessModifier=public, descriptions ≤100 chars and mandatory), plus the
  universal cross-cutting component checklist that validators and creators link.

  Not invoked directly — other skills link into the files below. Install this
  alongside any Datex Studio component-creator skill (action-creator,
  function-creator, grid-creator, hub-creator, form-creator, editor-creator,
  selector-creator, storage-creator, type-definition-creator, datasource-creator,
  backend-test-creator, tailoring-overlay) so cross-skill references resolve.
depends:
  - backend-test-creator
  - component-wiring-check
  - datasource-creator
  - post-edit-verification
  - tailoring-overlay
  - type-definition-creator
---

# Datex Studio — Component Authoring Conventions

This skill is a **library**, not a workflow. The Datex Studio component-creator skills cite the files here via relative paths (e.g. `../datex-studio-conventions/file-format.md`). It exists as its own skill so that `npx skills` / `skills.sh` install it alongside its consumers — sibling non-skill directories are not copied by those tools.

## When this skill is relevant

You're following a Datex Studio component-creator skill and it points you here. Read only the specific reference file the parent skill named — do not preload the whole tree.

If you're asked a platform question that isn't already scoped to a more specific skill (e.g. "what's the `configurationTypeId` for a hub?", "how do I name a tailored grid's datasource?", "what's the default package for new components?"), use the index below to find the right file.

## Reference index

- [file-format.md](file-format.md) — Component file JSON format: file locations and suffixes per type, the `configurationTypeId` numeric table, the TS-expression encoding rule for declarative string slots, the dynamic-tooltip-via-vars pattern, the `return;` outparam pitfall, TypeScript strictness inside flow code, datasource result types declared as optional.
- [naming-conventions.md](naming-conventions.md) — Component name patterns per type (per-type suffix indicators, the `_dd` reservation), `tailored_`/`custom_` provenance prefixes, sentence-case display-text rule, user-facing `title` vs `referenceName` distinction, the visible-types bound list.
- [defaults.md](defaults.md) — Default package (`Utilities`), default access modifier (`public`), description mandatory and ≤100 chars.
- [universal-checklist.md](universal-checklist.md) — The single enumeration of the cross-cutting checks that apply to **every** component (description ≤100, accessModifier, referenceName↔stem, minified JSON, correct `configurationTypeId`, snake_case new params, `id: 0`). Referenced by `component-validator`, `grid-validator`, `post-edit-verification`, and every creator's "File basics" pre-flight item rather than restated in each.

## Notes for skill authors

When a Datex Studio creator skill needs to reference content here:

1. Link with a relative path: `../datex-studio-conventions/<file>.md`.
2. Declare the dependency in the consumer's SKILL.md frontmatter:
   ```yaml
   depends:
     - datex-studio-conventions
   ```
   The `depends` field is a forward-looking marker for [vercel-labs/skills#860](https://github.com/vercel-labs/skills/issues/860); until that ships, document the dependency in the consumer's install notes and instruct users to install both skills together.

This skill is a sibling of `datex-studio-runtime` (which covers runtime-globals, calling-conventions, and control-types) and `datex-studio-shared` (which covers Datex Studio CLI operational context — branch selection, Studio lifecycle, designer context navigation, report authoring). The three shared-reference skills divide the cross-cutting platform knowledge by concern.
