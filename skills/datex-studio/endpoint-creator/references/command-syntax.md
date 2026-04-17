# Endpoint Command Syntax

Complete reference for all `dxs endpoint` commands.

## add

Expose a flow or datasource as an API endpoint.

```bash
dxs endpoint add \
  --alias <alias> \
  --flow <flow_ref_name> \
  --description "<description>" \
  --branch <id>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--alias` | Yes | URL path alias for the endpoint |
| `--flow` | One of | Target flow reference name |
| `--datasource` | flow/ds | Target datasource reference name |
| `--description, -d` | Yes | Endpoint description |
| `--module` | No | Module reference for cross-module targets |
| `--branch, -b` | Yes | Branch ID |

Specify exactly one of `--flow` or `--datasource`, not both.

**Examples:**
```bash
# Flow endpoint
dxs endpoint add --alias orders --flow get_orders_flow \
  -d "Get orders" --branch 64

# Datasource endpoint
dxs endpoint add --alias materials --datasource ds_materials \
  -d "Materials lookup" --branch 64

# Cross-module reference
dxs endpoint add --alias items --datasource ds_items --module Materials \
  -d "Cross-module items" --branch 64
```

## remove

Remove one or more endpoints by alias.

```bash
dxs endpoint remove --alias <alias> --branch <id>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--alias` | Yes | Alias(es) to remove. Repeatable for batch removal. |
| `--branch, -b` | Yes | Branch ID |

**Examples:**
```bash
# Single removal
dxs endpoint remove --alias orders --branch 64

# Batch removal
dxs endpoint remove --alias orders --alias materials --branch 64
```

## update

Modify an existing endpoint. At least one change flag is required.

```bash
dxs endpoint update --alias <alias> [change flags] --branch <id>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--alias` | Yes | Current alias of the endpoint to modify |
| `--new-alias` | No | Rename the alias |
| `--flow` | No | Change target to a flow |
| `--datasource` | No | Change target to a datasource |
| `--description, -d` | No | Change description |
| `--module` | No | Change module reference |
| `--branch, -b` | Yes | Branch ID |

`--flow` and `--datasource` are mutually exclusive. Providing either replaces the current target entirely, including switching the target type.

**Examples:**
```bash
# Change description
dxs endpoint update --alias orders -d "Fetch all orders" --branch 64

# Switch target from flow to datasource
dxs endpoint update --alias orders --datasource ds_orders --branch 64

# Rename alias
dxs endpoint update --alias orders --new-alias order-list --branch 64
```

## list

List all endpoints on a branch.

```bash
dxs endpoint list --branch <id>
```

## get

Get details of a specific endpoint by alias.

```bash
dxs endpoint get --alias <alias> --branch <id>
```

Returns: alias, description, type (flow/datasource), target reference name, module.
