# Function Command Syntax

Complete reference for all `dxs function` commands.

## generate

Generate a function config JSON file from a TypeScript code file and parameters.

```bash
dxs function generate \
  -r <reference_name> \
  -t "<title>" \
  -d "<description>" \
  --code-file <path.ts> \
  --in-param <name>:<type> \
  --out-param <name>:<type> \
  -o <output.json> \
  --branch <id>
```

| Flag | Required | Description |
|------|----------|-------------|
| `-r, --reference-name` | Yes | Function reference name (valid JS identifier) |
| `-t, --title` | Yes | Display title |
| `-d, --description` | No | Function description (always provide) |
| `--code-file` | Yes | Path to .ts file with function body code (max 512 KB) |
| `--in-param` | No | Input parameter `name:type`, `name:type?`, `name:type[]`, or `name:type[]?`. Repeatable. |
| `--out-param` | No | Output parameter `name:type` or `name:type[]`. Repeatable. |
| `--private` | No | Set access modifier to private |
| `--enable-progress` | No | Enable progress and cancellation support |
| `-o, --output` | Yes | Output JSON file path |

**Parameter types:** `string`, `number`, `boolean`, `date`, `object`, `union`, `blob`

**Example:**
```bash
dxs function generate \
  -r fn_sum \
  -t "Sum Function" \
  -d "Sums an array of numbers" \
  --code-file fn_sum.ts \
  --in-param addends:number \
  --out-param sum:number \
  -o fn_sum.json \
  --branch 64
```

## context

Get designer contexts (types/interfaces) for a function config file. Returns the full type system available in the function's code scope.

```bash
dxs function context <config.json> --branch <id>
```

**Use after `generate`** to get the type system before writing actual code. The response includes `flowContext` (the function's own `$flow` interface), `appContext` (all branch services with typed signatures), and `globalContext` (runtime utilities like `$utils`).

## validate

Validate a function config file against a branch. Checks that the config is well-formed and compatible with the branch state.

```bash
dxs function validate <config.json> --branch <id>
```

**Always run before `upsert`.** Fix validation errors before uploading.

## upsert

Upload a function config file to a branch (create or update). If a function with the same reference name exists, it is updated.

```bash
dxs function upsert <config.json> --branch <id>
```

## get

Get a function configuration by reference name. Returns the full config including code body, input/output parameters, and variables.

```bash
dxs function get <reference_name> --branch <id>
```

**Use in the modify flow** to fetch the existing function before editing. The code body is at `stepConfig.executeCodeConfig.code` in the response.

## list

List all functions on a branch.

```bash
dxs function list --branch <id>
dxs function list --branch <id> -n 20   # limit to 20 results
```

## delete

Delete a function from a branch by reference name or config ID.

```bash
dxs function delete <reference_name> --branch <id>
dxs function delete --id <config_id> --branch <id>
```

Use `--id` when reference-name lookup returns 404. Get the ID from `dxs function list`.
