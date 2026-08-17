# Datex Studio Skill Suite

Portable, self-sufficient skill set for authoring Datex Studio / Footprint WMS components. **This directory is the canonical source of platform knowledge** — component authoring rules, runtime semantics, file format, and hard-won gotchas all live in the skills' `SKILL.md` + `references/` files. A fresh repo containing only this directory plus the prerequisites below works at full capability.

## Prerequisites

- **`dxs` CLI on PATH** — every skill assumes branch-first workflow via `dxs` (source of truth = the Studio branch, not local files). Verify with `dxs --version`.
- **Python 3.10+** — for bundled scripts and eval tooling (`pip install pyyaml` for skill validation).
- Install the suite **as a set** — skills cross-link via relative paths (`../<skill>/...`); a single skill extracted alone will have dangling references.

## Install into a project

From the project root (PowerShell):

```powershell
.\.agents\skills\install-skills.ps1            # links every skill into .claude\skills\
.\.agents\skills\install-skills.ps1 -Target "$HOME\.claude\skills"   # or user scope
```

The script creates one directory junction per skill (no admin rights needed) so Claude Code discovers them under `.claude/skills/`. Re-running is idempotent.

**Optional but recommended:** wire the harness-level component save gate — see [`component-validator/scripts/INSTALL.md`](component-validator/scripts/INSTALL.md).

## Layout

- `<skill>/SKILL.md` — workflow + pre-flight checklist (what Claude loads on trigger).
- `<skill>/references/*.md` — the deep reference docs (canonical platform knowledge).
- `<skill>/evals/evals.json` — integration eval suite (dev-time only; excluded from packaging). Run via the `skill-creator` plugin's eval loop; creator-skill suites provision a throwaway `dxs` branch in `setup` and delete it in `teardown`.
- `<skill>-workspace/` — eval run artifacts (git-ignored).
- Cross-cutting knowledge lives in `datex-studio-conventions/` (file format, naming, defaults), `datex-studio-runtime/` (globals, calling conventions, control types, scheduled jobs), and `datex-studio-shared/` (dxs round-trip, flow code patterns, cards/lists/frontend-flows, report authoring).

## Rules for contributors

1. **New platform knowledge lands here first** — in the owning skill's `references/` doc (or `datex-studio-shared/` when no owning skill exists). Never in a host repo's docs; those drift out of the portability guarantee.
2. Docs use **dxs-branch-first framing** and cross-skill relative links only — no host-repo paths, no machine paths, no workspace names.
3. Component-type docs follow the repo's `docs/component-doc-template.md`.
4. New skill frontmatter: `name`, `description`, and `depends:` — all top-level (matching this repo's convention).
