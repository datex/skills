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
