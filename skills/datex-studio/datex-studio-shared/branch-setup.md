# Branch & Connection Setup

> **Shared reference** -- used by report-creator, report-editor, and datasource-creator.

## Select Branch

### Step 1: Identify the active organization

```bash
dxs auth status
```

Note the `organization` and `organization_id` from the active identity.

### Step 2: List repositories for that organization

```bash
dxs source repo list --org <organization_id>
```

This returns only the org's repos (typically 3-10), not the full platform (hundreds).

> **Anti-pattern:** Do NOT use `dxs source branch list --all-repos` -- it queries every repo across all organizations and returns thousands of results. Always scope to the active org's repos first.

### Step 3: List feature branches for each repo

```bash
dxs source branch list --repo <repo_id> --status feature -n 10
```

Repeat for each repo, or focus on the most relevant one (e.g., a "Reports" repo for report work).

### Step 4: Present results and ask the user

Use **AskUserQuestion** with options built from the output:

```
AskUserQuestion:
  question: "Which feature branch should we work with?"
  options:
    - label: "{id} - {repositoryName}"
      description: "{commitTitle} by {authorDisplayName}"
```

Include a "New branch" option if none of the existing branches are relevant. To create one:

```bash
dxs source branch create --repo <repo_id> --title "<title>" --description "<description>"
```

### Branch ID Policy

Never assume or reuse a branch ID from memory. Always ask the user to confirm which branch to use, even if a branch ID appeared earlier in the session.

## Select Connection

```bash
dxs source branch settings <branch_id>
```

Each item is an AppConfig setting record. A Footprint API connection setting looks like this (verified against a live module branch):

```yaml
- name: FootprintApi              # ← this is the --api-setting-name value
  description: General Api connection for the Footprint WMS.
  settingType: 1                  # 1 = ApiConnection (an INT, not the string "ApiConnection")
  valueType: null
  value: null                     # null for connection settings
  apiConnectionType: 1            # 1 = FootPrintApi (8 = MongoDb, etc.)
  apiConnectionName: DSV          # ← the connection's NAME; match this to your -c connection
```

Key facts: `settingType` and `apiConnectionType` are **integers** (`1`/`1` for a Footprint API connection), not enum strings. There is **no `apiConnectionId`** field -- the connection is identified by `apiConnectionName` (its name). `value` is `null` for connection settings. The value you pass to `--api-setting-name` is the setting's `name` (e.g. `FootprintApi`) -- **not** `apiConnectionName` (the connection name like `DSV`).

Present API connections using **AskUserQuestion** (skip if only one -- just inform the user). Store:
- The `name` (used for `--api-setting-name`, or rely on auto-resolve -- see below)
- The connection ID (used for `-c` flag) -- look it up via `dxs organization connection list --search <name>` rather than reading it off the settings record

### Auto-resolving `--api-setting-name`

`dxs datasource generate` will auto-resolve the API setting name from the branch's AppConfig if you omit `--api-setting-name`. It finds the branch's settings where `settingType == ApiConnection (1)` **and** `apiConnectionType == FootPrintApi (1)`, resolves your `-c` connection's name, and returns the `name` of the setting whose `apiConnectionName` matches. This works on host *and* ComponentModule branches, so omit-and-auto-resolve is the most portable choice. Pass `--api-setting-name` explicitly only to disambiguate when multiple API-connection settings exist -- pick the setting whose `apiConnectionName` matches your connection and use its `name`.

The resolver refuses to guess: if your `-c` connection isn't wired into the branch's AppConfig, `generate` fails with **`DXS-DS-021`** rather than inventing a default. If you hit that, pass `--api-setting-name` explicitly (find it with `dxs source branch settings <branch>`), or wire the Footprint API connection into the branch's AppConfig in Datex Studio and retry.

### Finding a Customer's Connection

Use `dxs organization connection list --search <term>` to search connection names and URLs (case-insensitive).

## Lock Pre-Flight — Check Group Locks Before Editing an Inherited Component

Configuration locks are held **per application group, across every branch in it** — not per branch. A component locked by any branch in the group cannot be modified from any other branch, including a brand-new one.

`dxs source locks --repo <repo_id>` is the check. It takes a **repository** id — the same id every other `--repo` flag accepts — resolves it to that repository's application group(s), and merges the locks across all of them:

```bash
dxs source locks --repo <repo_id>
# each entry: {id, applicationId (the branch holding it), referenceName, configurationTypeId, lockedBy}
```

> **On dxs < 0.4.19 this command was broken** — it passed the repository id straight to an endpoint that expects an `applicationGroupId`, so it reported `total_config_locks: 0` for a repo that in fact had dozens of locks (verified 2026-08-17 on FootprintManager: `--repo 87` returned 0, the group returned 69). If you are on an older CLI, upgrade (`dxs update`) rather than working around it; a clean result from an old build is *no information*, not a green light. A value matching no repository is still treated as a raw application-group id for backward compatibility.

Run this **before** editing any inherited component, and match on `referenceName`. `dxs source status --branch <id>` only shows the branch's own pending changes, so it cannot see a lock held elsewhere; `dxs source status --repo <repo_id>` (dxs ≥ 0.4.20) resolves groups the same way `locks` does and includes the group locks section.

### Symptom when you skip it

`dxs configuration upsert` swallows a `400 "Config is already locked."` from its lock step — it assumes the lock is its own — and then the PUT fails. That second failure means *someone else's branch holds the lock*, not that the lock call was forgotten.

On dxs ≥ 0.4.19 the CLI enriches that bare platform 400 (`"Cannot update configuration that is not locked or marked for deletion."`) into **`DXS-LOCK-002`**, which names the lock holder, the holding branch, and the date — resolved from the branch's application group locks. Read the holder off the error; no separate lookup is needed. Other 400s pass through untouched. On an older CLI you get the bare message instead and must confirm with `dxs source locks --repo <repo_id>`, where the `applicationId` on the lock record is the branch to chase.

**Never unlock another branch's config to unblock yourself** — including your own older branches. Unlocking reverts that branch's pending copy of the component. Surface the lock holder (branch id, title, and whether that branch has a pending change to the same component via `dxs source status --branch <that branch>`) and let the user decide: commit/publish the holding branch, do the edit there, or defer.
