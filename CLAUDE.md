# CLAUDE.md

Guidance for Claude Code when working in the **Datex Agent Skills** repo — installable agent skills for **Datex Studio** (the low-code platform) and **Footprint WMS**. The human-facing catalog of every skill is in [README.md](README.md); start there for "which skill does what."

## What this repo is

A collection of agent skills in the [skills.sh](https://www.skills.sh/) / vercel-labs/skills format. Skills live under `skills/datex-studio/` and `skills/footprint/`, one directory per skill, each with a `SKILL.md` plus optional `references/`.

## Repository invariants

These hold across every Datex Studio skill — keep new or edited skills consistent with them:

- **The dxs CLI is the source of truth, never local files.** Skills author configurations on a branch via `dxs`, not by treating a local `src/<type>/*.json` tree as authoritative. A local `body.json` is throwaway scratch; the branch is the system of record.
- **Default write verb: `dxs configuration upsert <type>`.** The CLI exposes three writers — `create` (POST, new configs), `update` (lock+PUT, existing configs), and `upsert` (orchestrated create-or-update). Prefer `upsert`: it resolves by `referenceName` and takes the create or update path automatically, handling the source-control lock protocol on your behalf, so skills don't have to know in advance whether the config exists. Reach for the explicit `create`/`update` only when you specifically need one path. Editing an existing config uses the round-trip: `dxs configuration get <type> <id> -b <branch> -O envelope.json` → `jq .json envelope.json > body.json` (extract the inner body — **never** write back the raw envelope) → edit → `dxs configuration validate <type> …` → `dxs configuration upsert <type> …`. `dxs configuration delete` needs `-y`/`--yes` to skip its prompt non-interactively.
- **`configurationTypeId` is a body field, not a CLI argument.** The CLI type argument is the lowercase name from `ConfigurationEndpoints.KNOWN_TYPES` (e.g. `grid`, `hub`, `footprintflow`, `footprintdatasource`, `customtype`, `backendtest`). The numeric id (grid=3, hub=2, …) lives inside the JSON body. Both columns, for every platform type, are in the table in `skills/datex-studio/datex-studio-conventions/file-format.md` — regenerate it from `dxs api GET /configurationtypes` rather than hand-editing rows.
- **"Datex Studio," never "Wavelength."** Wavelength is a trademark of another party; use "Datex Studio" in skill names, docs, and prose. (It may legitimately appear only as the literal Azure DevOps work-item type "Wavelength Component.")
- **DRY at the skill level.** Shared content lives once, in a library skill, and is linked — not copied across skills.
- **Packaging quirk:** `npx skills` only ships directories that contain a `SKILL.md`. Cross-cutting reference material therefore lives inside real "library" skills — `datex-studio-shared`, `datex-studio-conventions`, `datex-studio-runtime` — not a bare `shared/` folder. These three are reference-only, **not invoked directly**; other skills link into their files via relative paths, so install them alongside any consumer skill (declared in each skill's `depends:`).
- **Never assume a branch ID.** Confirm with the user. Branch selection is org-scoped: `dxs auth status` → `dxs source repo list --org <organization_id>` → `dxs source branch list --repo <repo_id> --status feature -n 10` → ask. Never `--all-repos` — it sweeps every org and buries the branches that matter. Full procedure: [branch-setup.md](skills/datex-studio/datex-studio-shared/branch-setup.md).

## Two-tier skill model

- **Utility skills** (e.g. `schema-explorer`, `odata-execution`, `requirements-gathering`) are consulted as background and are also usable standalone.
- **Workflow / creator skills** produce artifacts (component configs, reports) and pull in utility guidance via `depends:` + `REQUIRED BACKGROUND` references.

## Where things live

- **Skill catalog** (what each skill does): [README.md](README.md)
- **Authoring conventions** (file format, naming, defaults): `skills/datex-studio/datex-studio-conventions/`
- **Runtime semantics** (globals, execution tiers, control types): `skills/datex-studio/datex-studio-runtime/`
- **Cross-cutting workflow references** (branch setup, config round-trip, report authoring): `skills/datex-studio/datex-studio-shared/`

## Adding a new component type

Component reference docs (the `references/<type>.md` inside a creator skill) follow a standard shape. When documenting a component type that doesn't have a doc yet, start from [docs/component-doc-template.md](docs/component-doc-template.md) so the docs stay uniform. The forward-looking list of types not yet covered is the **"Not yet covered (roadmap)"** section of [README.md](README.md).
