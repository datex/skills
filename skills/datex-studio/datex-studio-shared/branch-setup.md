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

Each item is an AppConfig setting record, minimally `{ name, settingType, value }`. For an API-connection setting, `settingType` is the enum string `"ApiConnection"` and `value` holds the connection name (post-AppConfig-migration) or the connection ID as a string (mixed-state environments). Legacy fields such as `apiConnectionId`, `apiConnectionName`, and `settingTypeId` may or may not be present -- do NOT rely on them.

Present API connections using **AskUserQuestion** (skip if only one -- just inform the user). Store:
- The `name` (used for `--api-setting-name`, or rely on auto-resolve -- see below)
- The connection ID (used for `-c` flag) -- look it up via `dxs organization connection list --search <name>` rather than reading it off the settings record

### Auto-resolving `--api-setting-name`

`dxs datasource generate` will auto-resolve the API setting name from the branch's AppConfig if you omit `--api-setting-name`. The resolver handles all three legacy/migrated shapes (legacy `apiConnectionId` match, `value == str(connection_id)`, or `value == <connection name>`), so the omit-and-auto-resolve pattern is the most portable choice. Pass `--api-setting-name` explicitly only when there are multiple API-connection settings on the branch and you need to disambiguate.

### Finding a Customer's Connection

Use `dxs organization connection list --search <term>` to search connection names and URLs (case-insensitive).
