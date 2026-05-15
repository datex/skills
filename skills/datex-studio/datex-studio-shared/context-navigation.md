# Context Navigation

> **Shared reference** — used by function-creator and datasource-creator skills.

## Retrieval

Always pass `-O json` as a global flag:

```bash
dxs -O json function context <config.json> --branch <id>
dxs -O json datasource context <config.json> --branch <id>
```

JSON is preferred over YAML because `text` fields contain multi-line TypeScript code. In YAML these become block scalars with indentation-sensitive formatting that creates ambiguity between YAML structure and TypeScript content. In JSON the TypeScript lives in plain string values with explicit `\n` delimiters.

## Response Structure

```json
{
  "<semantic_key>": {
    "designer_contexts": [ ... ],
    "global_context": "..."
  }
}
```

The semantic key is `function_contexts` for functions or `datasource_contexts` for datasources.

### Designer Contexts

Each entry has: `id`, optional `vars[]` (each with `id` and `type`), optional `text` (TypeScript declarations), optional `imports[]`.

| Context ID | What it contains |
|------------|-----------------|
| `flowContext` | The config's own scope. For functions: `$flow` with `inParams`/`outParams`. For datasources: depends on config shape. Always in scope. |
| `defaultContext` | **The import gate.** Its `imports` array is the authoritative list of which symbols are available in backend code. Read this first. |
| `appContext` | Branch catalog of `$`-services. **Warning: contains both backend AND frontend symbols.** Only symbols imported by `defaultContext` are usable. |
| Other (e.g., `linkedDatasourcesContext`) | Additional scope for specific config types (datasource expressions, etc.). Always in scope. |
| `global_context` | Ambient TypeScript declarations — `$utils`, enums, shared interfaces. Available everywhere, no import needed. |

## How to Read the Context

1. **Start at `defaultContext.imports`** — this is the gate. Each entry has:
   - `from`: which context the symbol comes from (`"flowContext"` or `"appContext"`)
   - `declarations[]`: each with `declaration` (original name) and optional `alias` (name to use in code)

2. **Build the allow-list** — only symbols listed in `defaultContext.imports` declarations can be used in backend code. A symbol in `appContext.vars` that is NOT in this list is frontend-only or internal and must not be referenced.

3. **Respect aliases** — if a declaration has an `alias`, use the alias in code, not the original name. For example, if `$backendServices` has alias `$services`, write `$services.email.send(...)` not `$backendServices.email.send(...)`.

4. **Look up type details in `appContext.text`** — search for `interface <type>` to find methods, parameters, return types. Only look up types for symbols that passed the gate in step 2.

5. **Check `flowContext`** — defines `$flow.inParams` and `$flow.outParams` (for functions) or `$entity`/`$ccentity` (for datasources).

6. **`global_context` is always available** — `$utils` (http, date, odata, excel, blob), enums, shared interfaces.

### Example: reading `defaultContext.imports`

```json
{
  "id": "defaultContext",
  "imports": [
    {
      "from": "flowContext",
      "declarations": [
        { "declaration": "$flow" }
      ]
    },
    {
      "from": "appContext",
      "declarations": [
        { "declaration": "$apis" },
        { "declaration": "$backendServices", "alias": "$services" },
        { "declaration": "$customTypes", "alias": "$types" }
      ]
    }
  ]
}
```

This means: `$flow` (from flowContext), `$apis` (use as `$apis`), `$backendServices` (use as `$services`), `$customTypes` (use as `$types`) are available. Anything else in `appContext.vars` — e.g. `$shell`, `$frontendFlows` — is **not imported** and cannot be used.

## What NOT to Do

- **Never assume a symbol is available** from memory or because it existed on another branch. Always read `defaultContext.imports` from the context output.
- **Never use a symbol from `appContext.vars` without checking it appears in `defaultContext.imports`** — `appContext` contains frontend-only symbols like `$shell` that cause validation errors in backend code.
- **Never skip the context step** — the available services vary by branch, app, and config type.
- **Never use the original name when an alias exists** — write `$services` not `$backendServices`, `$types` not `$customTypes`.
- **When in doubt, validate** — run `dxs function validate` or `dxs datasource validate` to catch invalid references.
