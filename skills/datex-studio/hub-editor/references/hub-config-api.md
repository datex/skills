# Hub Configuration API

Concrete commands for reading and writing a hub configuration. The `dxs configuration` command group is the generic primitive for CRUD on every platform configuration type (hub, grid, form, flow, etc.) — there is no hub-specific subcommand, and you no longer need to know the underlying URL pattern.

## Recommended workflow (use this)

```bash
# 1. Pull the current hub config to a file
dxs configuration get hub <configId> -b <branchId> -O hub.json

# 2. Edit hub.json locally (toolbar[], flows[], etc.)

# 3. Push it back
dxs configuration update hub <configId> -b <branchId> -D hub.json
```

That's the entire round-trip. The same pattern works for any config type — substitute `flow`, `grid`, `form`, `editor`, `report`, `footprintquerymanager`, `appconfig`, etc. (`dxs configuration types` lists the supported names).

### Finding the IDs

```bash
dxs source explore config <hub_reference_name> --branch <branchId>
```

The output includes the hub config's `id`. The `-b/--branch` flag on `dxs configuration` is required (or set globally via the top-level `-b`); always pass it explicitly in skill examples.

### Validation and diff

```bash
python -m json.tool hub.json > /dev/null && echo "valid JSON"
cp hub.json hub.json.orig          # save before editing for diff target
```

After editing:

```bash
diff -u hub.json.orig hub.json     # review the change before PUT
```

### Verify after update

Re-fetch and diff:

```bash
dxs configuration get hub <configId> -b <branchId> -O hub-after.json
diff -u hub.json hub-after.json
```

The diff should be empty, or contain only server-managed fields (e.g., `updatedDateTime`, `version`, `lastModifiedBy`).

## When to use `dxs api` instead

Reserve `dxs api` for endpoints not covered by `dxs configuration` (one-off exploratory calls, organizations, branches metadata, etc.). The newer flags make it pipe-friendly:

| Flag | Purpose |
|------|---------|
| `--raw` | Print just the response body to stdout (no envelope). Use when piping to `jq`, `json.loads`, etc. |
| `-O, --output-file PATH` | Write the response body to a file (implies `--raw`). |
| `-D, --data-file PATH` | Read the request body from a file. Bypasses shell escaping entirely — use this for any PUT/POST/PATCH body bigger than a one-liner. |

Examples:

```bash
# Pipe-clean GET
dxs api GET /applications/64/hubconfigurations/8642750 --raw | jq '.toolbar'

# Save a body to disk
dxs api GET /applications/64/hubconfigurations/8642750 -O hub.json

# PUT a large body without shell-escaping pain
dxs api PUT /applications/64/hubconfigurations/8642750 -D hub.json
```

Validation rules:

- Positional `PAYLOAD` and `--data-file` are mutually exclusive.
- `--output-file` implies `--raw` (writing an envelope to disk would defeat the purpose).
- Invalid JSON in `--data-file` reports the file path in the error.

## Why not `dxs source` push?

`dxs source` operations target Datex's internal git-like source branches and don't write to a customer's live hub configuration. The `dxs configuration` command (and its underlying runtime endpoint) is the only path for in-place changes on a branch.

## What `dxs configuration` does NOT do

The current command is a generic primitive — full-document round-trips only. There is no hub-aware ergonomics like `dxs hub toolbar add` or `dxs hub flow add`. The recommended workflow remains "fetch, edit JSON, push." If field-level patching becomes necessary, layer it on top in the skill (e.g., a `jq` snippet) rather than waiting for a CLI command.
