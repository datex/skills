---
name: agent-creator
description: |
  Use when AUTHORING a Datex Agent application — creating the Agent application, referencing
  the packages whose functions and datasources become its commands, writing the singleton
  agent configuration (commands, owned skills, profile), checking it with `dxs agent check`,
  and handing the deployed app to `fpx`. Triggers: "create an agent", "new agent app",
  "add a command to the agent", "write the agent's skill", "agent check fails",
  "resolved: false", "agent manifest". For RUNNING a deployed agent's commands, use `fpx`.
depends:
  - fpx
  - datex-studio-shared
  - package-cascade
---

# Agent creator

Verified against **dxs 0.6.0** and **fpx 0.1.0**. Requires dxs 0.6.0 or later — Agent
applications and their whole `dxs agent` command group are new in that release.

An **Agent application** is its own application type in Datex Studio. One Agent application
is one agent: it carries exactly one agent configuration, the singleton `agent` (configuration
type 38), with three parts:

| Part | What it is | Who reads it |
|---|---|---|
| Commands | aliases pointing at functions and datasources of the app and its referenced packages | `fpx` (one subcommand per alias) and, later, the app's own agent loop |
| Skills | owned markdown, carried whole inside the manifest | the agent at run time |
| Profile | system prompt, model class, optional model pin | the harness at run time |

The deployed app serves this as its manifest at `GET /api/$agent/manifest`. The manifest is
the runtime's **only** source: a hosted agent has no access to this repo, your workspace, or
Datex Studio.

Follow [branch-setup.md](../datex-studio-shared/branch-setup.md) for picking a branch. Never
assume a branch id.

## The loop

### 1. Create the Agent application

To work against an existing one instead, list the organization's repos filtered to the Agent
type and pick a branch from there:

```bash
dxs source repo list --org <organization id> --type agent
```

Otherwise create one:

```bash
dxs source repo create --type agent --name "ABC Slotting Agent" --org <organization id>
```

The output names `main_branch_id`; use it (or a feature branch cut from it) from here on. The
platform seeds the singleton with reference name `agent`. `DXS-REPO-001` means the derived
identifier is not `[a-z][a-z0-9-]*` (pass `--unique-identifier`); `DXS-REPO-002` means the name
is taken for that organization.

### 2. Reference the packages the commands come from

An agent is only as capable as the packages it references. Pin each package whose functions
or datasources the agent will call:

```bash
dxs source deps -b <branch>
dxs source reference set -b <branch> -p <package uniqueIdentifier> -v <version>
```

When a referenced package is republished later, re-pin its consumers with the
[`package-cascade`](../package-cascade/SKILL.md) skill.

### 3. Discover what can become a command

```bash
dxs configuration list datasource -b <branch>
dxs configuration list flow -b <branch>
```

A command's `ref` is bare for the app's own configs (`ds_open_orders`) and module-qualified
for a referenced package's (`FootprintManager/ds_warehouses_dd`). Only the cloud tier is
callable: `function` → a flow (type 9), `datasource` → a datasource (type 6). A
`footprintflow` or `footprintdatasource` reports `resolved: false`; wrap it in a cloud flow
and point the command at the flow. If nothing on the branch does what the agent needs, say
so and agree on creating it; never point a command at an approximate target.

Pick the fewest commands that cover the process.

### 4. Author the singleton

The agent config is the singleton with reference name `agent`. Follow the
[configuration round-trip](../datex-studio-shared/configuration-roundtrip.md) — get by id,
extract the `json` field, edit, validate, upsert:

```bash
dxs configuration get agent agent -b <branch> -O envelope.json
dxs configuration validate agent -D body.json -b <branch>
dxs configuration upsert agent -D body.json -b <branch>
```

`Warning (DXS-AGENT-030)` means the branch is not an Agent application: the config will be
refused at validate/publish. Move it to an Agent application instead. After any upsert, re-run
`dxs agent check -b <branch>` (step 5) — it is the only thing that confirms every command still
resolves.

Body shape:

```jsonc
{
  "configurationTypeId": 38,
  "referenceName": "agent",
  "title": "ABC slotting agent",
  "description": "…",
  "commands": [
    {
      "type": "datasource",                     // "datasource" | "function"
      "ref": "ds_slot_pick_history",            // bare = own app; "Module/ref" = referenced package
      "alias": "pick-history",                  // kebab-case, unique; becomes `fpx pick-history`
      "description": "Completed pick tasks … One row per pick task (not per order or line) …",
      "paramsDoc": "warehouseId: number (required). dateFrom: date (required, ISO) …"
    }
  ],
  "skills": [{ "name": "abc-slotting", "source": "owned", "content": "---\nname: abc-slotting\n…" }],
  "profile": {
    "systemPrompt": "…",
    "modelClass": "frontier",
    "model": null,
    "limits": { "maxToolCalls": 20 }
  },
  "trigger": { "type": "onDemand", "schedule": null }
}
```

Rules for each part:

- **Aliases** are kebab-case and unique. `fpx` reserves `use`, `status`, `commands`,
  `manifest`, `skills`, `profile`, `login`, `auth`, `run`, `update`, `help`; `dxs agent check`
  reports a command that shadows one as `dropped`.
- **Description** is what the agent reads when it chooses the command. Say what one row *is*
  when it is not what the alias suggests, and say "Paged: 5000 rows per call" when it is.
  Retargeting a command's `ref` in the designer resets its description and clears its
  `paramsDoc`: rewrite both after any retarget.
- **paramsDoc** names every parameter exactly as the target declares it (camelCase or
  snake_case included) with type and required/optional.
- **Skills** are `source: "owned"` with the full markdown in `content`. A `referenced` skill
  installs nothing.
- **Skill content** names commands by alias and parameters by name. For aggregation over more
  than one page it carries an `fpx` export-and-script recipe: export with
  `fpx <alias> -D params.json --all --out rows.jsonl`, then compute in a script that prints only
  the summary. It never names Studio internals: no `$datasources`, `$flows`, `dxs`, Studio
  reference names or file paths.
- **systemPrompt** says who the agent is, names its skill, tells it never to page rows through
  the conversation, and names the report it ends with.
- **limits** (optional; omit any field to use the environment's default ceiling) caps one turn's
  `maxIterations`, `maxRunTokens`, `maxToolCalls`, and `maxScriptSeconds` — a value above the
  environment's own ceiling is silently capped to that ceiling at runtime, not rejected, so there
  is no reason to guess high. Absent an override, the environment's default ceilings are 12
  iterations, 2,000,000 tokens, 50 tool calls, and 180 script seconds per turn. Save-time
  validation only rejects values outside the absolute range each field can ever mean:
  `maxIterations` 1–50, `maxRunTokens` 10,000–5,000,000, `maxToolCalls` 1–500,
  `maxScriptSeconds` 10–3600.

The worked example is [the ABC/Pareto slotting agent](references/examples/abc-slotting/README.md):
six commands, one owned skill whose embedded script turns three exports into a Pareto
classification and a ranked move list.

### 5. Check the manifest

```bash
dxs agent check -b <branch>
```

Every command must be `ok`. The other verdicts:

| Verdict | Means | Fix |
|---|---|---|
| `unresolved` | the ref does not exist on the branch, or is server-tier | fix the ref or its module prefix; wrap server-tier configs in a cloud flow |
| `not_exposed` | the config exists but the app exposes no endpoint for it | fix the app's endpoints and republish |
| `dropped` | a duplicate alias, or an alias shadowing an `fpx` command | rename the alias |

`DXS-AGENT-020` carries each command's verdict under `details.commands`. `DXS-AGENT-001` means
the branch is not an Agent application or has no manifest. `dxs agent manifest -b <branch>`
prints the whole manifest.

### 6. Deploy, then the tenant prerequisites

Deploy through the Manager as for any application. A freshly deployed Agent application
answers `401`/`403` until an admin has done three one-time steps — see
[the fpx skill](../fpx/SKILL.md#the-three-tenant-prerequisites).

**Model key (only for the app's own agent loop).** `fpx` needs none of this — it is only for
the agent loop the deployed app runs itself. In the Manager, create an AI API connection
(provider Anthropic or OpenAI, and the API key), add one connection setting of that type to
the Agent application in Datex Studio, bind it to the connection per environment, then
regenerate. Without a bound key the loop still deploys; a turn answers `503
ModelNotConfigured` naming the setting. A model connection may be Anthropic or OpenAI — each
runs the same agent loop with its own built-in default model (Anthropic `claude-opus-5`,
OpenAI `gpt-6-astra`); there is no per-app model setting to configure.

### 7. Hand the app to fpx and try one turn

```bash
dxs agent url -b <branch> --env <environment>
```

It prints `app_url`, `app_scope`, `tenant_id` and an `fpx_use` line (`DXS-AGENT-010`: the
deployed component has no backend registration yet; `DXS-AGENT-011`: the deployment cannot be
found). Paste the `fpx_use` line, adding `--account you@customer.com` for customer tenants:

```bash
fpx use <app_url> --app-scope <app_scope> --tenant-id <tenant_id>
fpx commands
```

The [`fpx`](../fpx/SKILL.md) skill covers everything from here: calls, exports, scripts and
errors. To smoke-test the app's own agent loop:

```bash
dxs agent chat --app-url <app_url> --app-scope <app_scope> -m "Which materials are class A in warehouse 12?"
```

`DXS-AGENT-040` covers every failed turn: a `409` is the turn limit, a non-JSON `200` is the
web shell answering a wrong URL.

## CLI-first — no workarounds

`dxs` is the only sanctioned authoring surface. When it falls short, report the gap as a CLI
or platform bug. Never hand-edit platform artifacts, never sidestep a validation error, and
never leave an unexplained `unresolved` for the runtime to discover.

## Modify an existing agent

Same [round-trip](../datex-studio-shared/configuration-roundtrip.md) as step 4: get by id,
extract the `json` field, edit, upsert:

```bash
dxs configuration get agent agent -b <branch> -O envelope.json
dxs configuration upsert agent -D body.json -b <branch>
```

Then run `dxs agent check -b <branch>` again: a renamed function or datasource silently turns
its command `unresolved`.

## Checklist

- [ ] `dxs agent check` reports every command `ok`
- [ ] aliases are kebab-case, unique, and shadow no `fpx` command
- [ ] every command has a description; every command with inputs has a `paramsDoc`
- [ ] every skill is owned, self-contained, and names aliases, not Studio internals
- [ ] multi-page work is an `fpx` export plus a script that prints only the summary
- [ ] the systemPrompt names the skill and the final report
- [ ] after deploy: the three tenant prerequisites are done, and `fpx commands` lists the aliases
