---
name: agent-creator
description: |
  Use when creating or modifying an Agent configuration (ConfigurationType 38) on a
  Datex Studio branch. An Agent is a capability consumed by the dynamic Footprint CLI
  (`fp`): its commands become CLI commands mapped to the branch's functions/datasources,
  and its skills become SKILL.md files installed into the agent harness. Trigger for:
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
- The skill markdown must refer to commands **by their alias** (that is the CLI surface),
  never by Studio reference names or file paths.

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
      to files, repos, or Studio — the harness only has the CLI and this content)
- [ ] Skill workflow steps name command aliases; includes the --top/--select shaping rule
- [ ] systemPrompt names the aliases and instructs CLI-only operation + end-of-run summary

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
