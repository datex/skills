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

Present API connections using **AskUserQuestion** (skip if only one -- just inform the user). Store both:
- The `apiConnectionId` (used for `-c` flag)
- The `name` (used for `--api-setting-name`)

### Finding a Customer's Connection

Use `dxs organization connection list --search <term>` to search connection names and URLs (case-insensitive).
