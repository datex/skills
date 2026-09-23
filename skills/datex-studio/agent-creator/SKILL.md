---
name: agent-creator
description: |
  Use when creating or modifying an Agent configuration (ConfigurationType 38) on a
  Datex Studio branch. An Agent is a capability consumed by more than one runtime: the
  dynamic Footprint CLI (`fp`) at a shell, and the in-process agent host that codegen emits
  into the generated app. Its commands map to the branch's functions/datasources and its
  skills travel with the manifest. Trigger for:
  "author an agent", "create an agent configuration", "make an agent for X",
  "add a command/skill to the agent", "agent for the Footprint CLI".
depends:
  - datex-studio-shared
---

# Agent Creator

Author an **Agent configuration** — the artifact behind the Footprint CLI (spike 248960).
Publishing model: one generic CLI (`fp`) fetches the agent's **manifest** at startup and
materializes its command tree from it. Nothing is compiled per agent.

**The manifest is the runtime's ONLY source.** A hosted agent harness has no access to the
skills repo, this workspace, or Datex Studio — it receives exactly what this configuration
carries. Consequences you must design for:

- Every skill must be **owned** (`source: "owned"`) with the FULL SKILL.md markdown inline in
  `content`. `source: "referenced"` only *names* a library skill and installs nothing:
  `fp skills install` writes `skills[].content` verbatim and has no library to resolve a name
  against. The Studio designer no longer offers the choice (owned-only), and Validate now
  reports any contentless skill — a referenced one included, because the runtime skips it
  silently. The enum survives in the model so server-side inlining can land without a
  migration; until it does, referenced is not a thing you can use.
- Command `description` and `paramsDoc` become the CLI's `--help` text — they are the
  agent's only documentation for each tool. Write them for an LLM operator. Both are
  *optional* in the designer (a target config may carry no description of its own, and `fp`
  falls back to `Execute function <ref>`), but a command with no description is a tool an
  agent has to guess at — treat empty as a gap to fill, not a default. **Retargeting a
  command resets them.** Changing a command's Reference in the designer overwrites
  `description` from the new target and clears `paramsDoc` — unconditionally, because text
  written for the previous config would otherwise go on describing something this command no
  longer calls, in the manifest and in `fp <command> -h`. Rewrite `paramsDoc` after any
  retarget. `fp <command> -h` also prints the parameter schema the deployed app declares,
  which is the check on whether your prose still matches.
- The skill markdown must refer to commands **by their alias**, never by Studio reference
  names or file paths.

### Skills describe the work, not the surface (hard rule)

**A manifest skill must never mention CLI syntax.** No `--params`, `--top`, `--select`,
`--skip`, no `fp <command> -h`, no `fp commands`, and no `fp ` prefix on an alias. The same
manifest is consumed by three harnesses now — `fp` at a shell, and the **in-process agent
host inside the generated app**, which turns each command into a tool call and dispatches it
straight onto the generated services — and a skill written for one of them is wrong on the
others. A skill that says "pass `--select`" instructs an agent to use something a tool caller
does not have; an agent that follows it either fails or invents a parameter.

**The in-process host makes the rule stricter, not looser.** It is tempting to write
`$datasources.Module.ds_x.getList(...)` into a skill now that the host calls the generated
services directly. Do not. The agent never writes code — it emits a tool call named by the
**alias**, and the host resolves the alias to a service on the other side of that call. Naming
`$datasources` or `$flows` in a manifest skill is the same mistake as naming `--select`,
pointed the other way, and it breaks `fp` as well.

Write the intent and let each surface document its own syntax:

| Instead of | Write |
|---|---|
| ``Run `fp warehouses --params '{"fullTextSearch":"Dallas"}'`` | ``Run `warehouses` with `fullTextSearch: "Dallas"`` |
| "Keep `--top` small, page with `--skip`" | "Cap the rows you ask for; narrow with filter parameters rather than pulling everything" |
| "Pass `--select Id,LookupCode`" | "Ask for only the fields the answer needs" |
| "Run `fp commands` at the start of a session" | *nothing* — discovery is the harness's job, not the agent's |

**Parameter names are fair game; flag names are not.** `warehouseId`, `statusIds`,
`fullTextSearch` are what the command declares, so they belong in the skill — and must match
the target's `inParams` exactly, camelCase included. A skill that says `full_text_search`
where the config declares `fullTextSearch` sends an agent to a parameter the app ignores.
`fp <command> -h` prints the schema the deployed app actually declares; check the skill's
parameter names against it.

The same rule applies to `profile.systemPrompt`, which is handed to the harness verbatim.

### Say what a row *is* when it is not what the command is called

A command named `unslotted-orders` whose rows are *shipments* will be miscounted, because
`metadata.total_count` counts rows. State it in the command's `description` — the text the
agent reads at the moment it chooses and interprets the call — not only in the skill.

## CLI-first — no workarounds (hard rule)

`dxs` is the **only sanctioned surface** for authoring an Agent configuration. When it falls
short, **report the gap as a CLI or platform bug**, don't route around it — a workaround
hides a defect every later authoring session will hit again.

- **Never hand-edit platform artifacts or script around the CLI.** Round-trip through
  `dxs configuration get` / `upsert`. If a field cannot be set that way, that is the finding.
- **A validation error is the contract talking.** `dxs configuration upsert agent` and the
  designer's Validate button report duplicate aliases, missing refs and owned skills with no
  content. Fix the config, or report the message if it looks wrong — do not disable or
  sidestep the check.
- **Verify the manifest, and report what it says.** After every change, re-check that each
  command reports `resolved: true`. A `resolved: false` you cannot explain is a bug report
  (wrong ref? wrong tier? renamed target?), not something to leave for the runtime.
- **Do not invent capability.** If the branch has no function or datasource for what the
  agent needs, say so and agree on creating one — never point a command at an approximate
  target so the agent "has something".

## Configuration shape

```jsonc
{
  "configurationTypeId": 38,
  "referenceName": "slotting_agent",        // slug: [a-z][a-z0-9_]*
  "title": "Slotting Agent",
  "description": "…",
  "commands": [
    {
      "type": "datasource",                 // "datasource" | "function"
      "ref": "ds_open_orders",              // bare = own app; "Module/ref" = referenced module
      "alias": "open-orders",               // kebab-case, unique — becomes `fp open-orders`
      "description": "Open orders, filterable by status.",   // fp --help text
      "paramsDoc": "status: string (optional)"               // input params doc for the LLM
    }
  ],
  "skills": [
    { "name": "slotting", "source": "owned", "content": "---\nname: slotting\n…full SKILL.md…" }
  ],
  "profile": {
    "systemPrompt": "…",                    // handed to the harness via `fp profile show --raw`
    "modelClass": "efficient",              // "efficient" | "frontier"
    "model": null                           // optional pin; null lets the class decide
  },
  "trigger": { "type": "onDemand", "schedule": null }   // "onDemand" | "schedule"
}
```

## Workflow

```
[Phase 1: Setup]
Follow branch-setup.md for branch selection (never assume a branch id)
        |
[Phase 2: Discover capabilities]
dxs configuration list datasource -b <id>
dxs configuration list flow -b <id>
(cloud tier ONLY — see below; footprintdatasource / footprintflow are not callable)
        |
pick the refs the agent's task needs — fewest commands that cover the process
        |
[Phase 3: Draft]
write the JSON to a temp file:
  - alias per command: kebab-case verb/noun, unique
  - owned skill: frontmatter (name, description with when-to-use),
    numbered workflow using the ALIASES, decision rules, and a rule to
    shape every datasource call (--top/--select — never pull full tables)
  - systemPrompt: who the agent is, "work strictly through your CLI
    commands (<aliases>)", follow the skill, end runs with a summary
        |
[Phase 4: Upsert]
dxs configuration upsert agent -D <file>.json -b <BRANCH_ID>
        |
[Phase 5: Verify via the manifest]
dxs api GET /applications/<BRANCH_ID>/agentconfigurations/referenceName/<ref>/manifest
  → every command must show "resolved": true
  → any false: the ref does not exist on the branch — fix the ref (check module prefix)
        |
(optional, proves the loop) fp use <ref> --branch <BRANCH_ID> && fp --help
```

## Verification checklist

- [ ] Manifest returns every command with `resolved: true`
- [ ] Aliases are kebab-case and unique; each command has `description` (+ `paramsDoc` when
      the target takes inputs)
- [ ] All runtime skills are `owned` with complete, self-contained markdown (no references
      to files, repos, or Studio — a harness has only this content and its own tool surface)
- [ ] Skill workflow steps name command aliases and say nothing about any surface — no
      `--select`, and equally no `$datasources` / `$flows`
- [ ] systemPrompt names the aliases and instructs the agent to work only through its
      commands + end a run with a summary
- [ ] If the app has been generated since, the **baked** manifest also reports the command
      (see below — it answers a stricter question than the platform one)

## Two manifests, and two meanings of `resolved`

The platform serves a manifest over its API — that is what `fp` fetches. Since the in-process
host landed, **codegen also bakes a manifest into the generated app** (`src/agent.manifest.ts`),
and it does so only when the branch has an Agent configuration: no agent config, no
`/api/$agent` route in that application at all. That generation-time gate is why nothing needs
an "agent mode" switch at deploy time.

The two carry the same field with different meanings:

| | Platform manifest (what `fp` reads) | Baked manifest (what the app runs on) |
|---|---|---|
| `resolved: true` means | the config exists **on the branch** | this application **actually generated** it |
| `target` | the URL shape to POST to | absent — nothing goes over HTTP in-process |

**The baked answer is the stricter one**, and it is the one that decides whether a deployed
agent can really call a command: a ref can resolve on the branch and still be missing from a
particular application, because module membership and tree-shaking are decided at generation
time. A command that resolves on the branch but not in the app is offered as no tool at all,
and the host reports why rather than failing silently.

So `resolved: false` in a baked manifest is not necessarily a bad ref — check which question
you are failing before changing the config.

## A bare ref is not always `app`

`"ref": "ds_open_orders"` means *this application's own* config — and "this application" has a
real name. It is `app` only when the application carries no reference name of its own, which is
the case for Web, Mobile, Api and Portal definitions. **A ComponentModule (package/module)
branch carries its own name**, so its bare refs resolve under that name and its generated app
mounts `/api/<module-name>/…`, never `/api/app/…`.

You never have to compute this: the manifest carries it as `ownModule`, and both `fp` and the
in-process host read it from there rather than assuming.

**Known gap — on a ComponentModule branch, author commands with module-qualified refs.**
Publish-time contract validation still assumes a bare ref belongs to an unnamed application, so
a bare ref on such a branch fails validation with *"Referenced configuration … does not exist or
has been renamed"* — for a config that is plainly on the branch. If you hit that error on a ref
you can see in `dxs configuration list`, this is why: qualify it (`MyModule/ds_open_orders`)
instead of hunting for a rename.

## Commands target the cloud tier only

A command's `type` maps to exactly one configuration type: `function` → `flow` (9),
`datasource` → `datasource` (6). **Do not point a command at a `footprintFlow` or
`footprintDatasource`.**

The reason is the CLI's URL shape, not a policy: `fp` calls
`/api/<module>/functions/<ref>` and `/api/<module>/datasources/<ref>/<verb>`, and the
generated app mounts those two routes from the Flow and Datasource routers. The server-tier
equivalents mount at `/footprintflows` and `/footprintdatasources`, behind the Footprint
preview router — so a server-tier command would be saved and shown as valid, and then 404 on
every call. The manifest endpoint resolves against the cloud tier only, so such a command
reports `resolved: false` and `fp` refuses it before calling (`DXS-FP-023`).

If the work needs an action or an FPDS, wrap it: author a cloud `flow` that calls the
server-tier config, and point the command at the flow.

## Modify / extend an existing agent

`dxs configuration get agent <ref> -b <id> -O file.json` (the reference name is the
positional `CONFIG_REF` — there is no `--reference-name` flag), extract the
`json` body, edit, and upsert the body back (`upsert` handles lock/update). Re-verify the
manifest afterwards — a renamed function/datasource silently flips its command to
`resolved: false`.
