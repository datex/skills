---
name: endpoint-creator
description: |
  Use when creating, modifying, or removing API endpoints on a Datex Studio branch.
  Covers the full lifecycle: requirements, prerequisite creation (datasources, flows),
  endpoint wiring, and verification. Trigger for: "create an endpoint", "expose this
  flow as an API", "add an API for X", "modify endpoint", "remove endpoint",
  "change endpoint alias", "create an API that does X".
---

# Endpoint Creator

Create, modify, or remove API endpoints on a Datex Studio branch. Endpoints expose
flows or datasources as HTTP API routes. Only available for API Applications (type 6).

## References

- [../shared/branch-setup.md](../shared/branch-setup.md) -- Branch & connection selection (shared across skills)
- [references/command-syntax.md](references/command-syntax.md) -- All `dxs endpoint` commands with examples

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`function-creator`** skill — invoked when a new flow is needed as an endpoint target
- **`datasource-creator`** skill — invoked when a new datasource is needed as an endpoint target

## Workflow

```
[Phase 1: Setup + Validation]
Follow branch-setup.md for branch selection
        |
dxs source branch show <id> → check isApiApplication
        |
  +-----+-----+
  |           |
 YES          NO → error: "Endpoints only supported for API Applications"
  |
[requirements brief in context?]
  +-----+-----+
  |            |
 YES          NO → invoke requirements-gathering skill
  |            |
  +-----+------+
        |
[Phase 2: Intent Detection]
        |
  +-----+-----+-----+
  |           |       |
 ADD       MODIFY   REMOVE
  |           |       |
  |           |     ⚠ warn: "Removing may break external consumers"
  |           |     get user confirmation
  |           |     dxs endpoint remove --alias <x> --branch <id>
  |           |     → Phase 5
  |           |
  |     dxs endpoint get --alias <x> --branch <id>
  |     determine changes needed
  |     ⚠ warn if contract change (alias, target, params)
  |     get user confirmation
  |     dxs endpoint update ... --branch <id>
  |     → Phase 5
  |
[Phase 3: Target Resolution]
For each endpoint to add:
  [does target flow/datasource exist on branch?]
    +-----+-----+
    |           |
   YES          NO
    |           |
   use it    [ask user: flow or datasource?]
    |           +-----+-----+
    |           |           |
    |        FLOW       DATASOURCE
    |           |           |
    |       invoke       invoke
    |       function-    datasource-
    |       creator      creator
    |           |           |
    +-----------+-----------+
        |
[Phase 4: Endpoint Wiring]
dxs endpoint add --alias <x> --flow/--datasource <target> -d "<desc>" --branch <id>
        |
[Phase 5: Verification]
Build change summary from actions taken
Verify each added/modified endpoint with dxs endpoint get
Present focused changelog to user
```

## Phase Details

### Phase 1: Setup + Validation

1. Follow [branch-setup.md](../shared/branch-setup.md) for branch selection
2. Run `dxs source branch show <id>` and check `isApiApplication`
   - If false → error: "Endpoints are only supported for API Applications (type 6). This branch belongs to a {appTypeName} application."
3. Check whether a **requirements brief** already exists in the conversation context
   - **Requirements brief exists** — use it
   - **No requirements brief** — invoke the `requirements-gathering` skill
4. From the requirements, extract: endpoint aliases, descriptions, target types (flow/datasource), and whether targets are new or existing

<HARD-GATE>
Do NOT proceed past Phase 1 if the branch is not an API Application. Endpoints are only available for API Applications.
</HARD-GATE>

### Phase 2: Intent Detection

Determine intent from the requirements brief and user request:
- **Add** — "create endpoint", "expose flow", "add API for X"
- **Modify** — "change endpoint", "rename alias", "switch target"
- **Remove** — "remove endpoint", "delete endpoint", "stop exposing"

**Contract change warning (modify and remove):**

Before modifying or removing an endpoint, present a warning:

> "Changing/removing this endpoint may break external consumers who depend on it. Proceed?"

Wait for explicit user confirmation before proceeding. This applies to:
- Removing any endpoint
- Changing an endpoint's alias (URL path changes)
- Changing an endpoint's target (response shape may change)

<HARD-GATE>
Do NOT modify or remove endpoints without presenting the contract change warning and receiving explicit user confirmation.
</HARD-GATE>

### Phase 3: Target Resolution

For each endpoint to add:

1. Check if the target flow/datasource already exists on the branch:
   - `dxs function list --branch <id>` for flows
   - `dxs datasource list --branch <id>` for datasources
2. If it exists → use its reference name, move to Phase 4
3. If it doesn't exist → ask the user: "Should this endpoint be backed by a flow or a datasource?"
   - **Flow** → invoke `function-creator` skill. Flows can access databases, external APIs, and other backend services.
   - **Datasource** → invoke `datasource-creator` skill. Datasources query OData entities directly or use custom JavaScript code (flow-based datasources).
4. After the creator skill completes, capture the reference name of the created artifact

### Phase 4: Endpoint Wiring

Wire each endpoint using [command-syntax.md](references/command-syntax.md).

**Add:**
```bash
dxs endpoint add --alias <alias> --flow/--datasource <ref_name> \
  --description "<desc>" --branch <id>
```

**Modify:**
```bash
dxs endpoint update --alias <alias> [--new-alias/--flow/--datasource/-d/--module] \
  --branch <id>
```

**Remove:**
```bash
dxs endpoint remove --alias <alias> --branch <id>
```

### Phase 5: Verification

Build a focused change summary and present it to the user:

```
Endpoint changes applied:
  - Added: "orders" → flow get_orders_flow ("Get orders")
  - Added: "materials" → datasource ds_materials ("Materials lookup")
  - Renamed: "old-name" → "new-name"
  - Removed: "deprecated-endpoint"
```

For added/modified endpoints, verify with `dxs endpoint get --alias <alias> --branch <id>` to confirm wiring is correct server-side. For removed endpoints, confirm the alias no longer exists.

Present only the endpoints that were just changed — not the full list.

## Alias Rules

- Must match: `^[a-zA-Z0-9]+(?:[/\-_~]*[a-zA-Z0-9]+)*$`
- Must start and end with alphanumeric characters
- Allowed separators: `/`, `-`, `_`, `~`
- Reserved aliases (cannot use): `app`, `settings`, `$treeshakelog`, imported application reference names

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Trying to add endpoints on a non-API application | Check `isApiApplication` from `dxs source branch show` in Phase 1 |
| Alias with spaces or special characters | Must match the alias regex pattern |
| Using reserved aliases (`app`, `settings`, `$treeshakelog`) | Choose a different alias |
| Modifying/removing without warning about external consumers | Always present contract change warning and get user confirmation |
| Referencing a flow/datasource that doesn't exist on branch | Verify existence in Phase 3; create via the appropriate skill if missing |
| Skipping requirements and guessing endpoint structure | Always ensure requirements are gathered first |
| Adding endpoints to wrong branch | Confirm branch with user in Phase 1 via branch-setup.md |
