# Function Flag Guide

When, why, and how to use each `dxs function generate` flag.

## --enable-progress

**When:** The function is long-running — scheduled jobs, bulk processing, heavy API calls, batch operations, anything that takes more than a few seconds.

**Why:** Enables progress reporting and cancellation support. The function's code scope gains two additional variables:
- `abortController: AbortController` — check `abortController.signal.aborted` to detect cancellation
- `reportProgress: (min: number, max: number, current: number) => void` — report progress to the caller

**How:**
```bash
dxs function generate ... --enable-progress -o process_items_flow.json
```

**Code pattern:**
```typescript
const items = $flow.inParams.items;
for (let i = 0; i < items.length; i++) {
  if (abortController.signal.aborted) break;
  reportProgress(0, items.length, i);
  // ... process item
}
$flow.outParams.processed = items.length;
```

**Note:** Functions with `--enable-progress` appear in the jobs/scheduling system. Callers can submit them as background jobs with `$services.jobs.process_items_flow.submit()` and track progress.

## --private

**When:** The function is internal to the module — a helper that other modules should not call directly.

**Why:** Sets access modifier to private. The function won't appear in other modules' `$flows.*` intellisense. Use for implementation details that aren't part of the module's public API.

**How:**
```bash
dxs function generate ... --private -o helper_flow.json
```

**Decision guide:**
- Function is called by other modules → **public** (default, no flag needed)
- Function is a helper used only within this module → **private** (`--private`)
- Unsure → start **public**, make private later if no cross-module callers exist (use `impact-analysis` to verify)

## --code-file

**When:** Always required. Path to the TypeScript file containing the function body code.

**Why:** The function's logic lives in a `.ts` file that gets embedded into the config JSON.

**How:**
```bash
dxs function generate ... --code-file sum_flow.ts -o sum_flow.json
```

**Rules:**
- Max file size: 512 KB
- The file contains only the function body — no imports, no function declaration wrapper
- For the modify flow, extract code from the existing config (`stepConfig.executeCodeConfig.code`), write to a temp `.ts` file, edit, then pass back via `--code-file`

## -r / --reference-name

**When:** Always required. The function's identifier on the branch.

**Why:** Other configs reference the function by this name (e.g., `$flows.sum_flow()`). It becomes part of the generated TypeScript service interface.

**How:**
```bash
dxs function generate -r process_order_flow ...
```

**Rules:**
- Must be a valid JS identifier (start with letter/`_`/`$`, no spaces/hyphens)
- Must end with `_flow` suffix (e.g., `sum_flow`, `validate_order_flow`, `boolean_array_to_mask_flow`)
- Cannot be changed after creation — renaming requires delete + recreate

## -t / --title

**When:** Always required. Display title shown in the Wavelength designer.

**Why:** Human-readable name for the function in the UI. Can differ from the reference name.

**How:**
```bash
dxs function generate -t "Process Order" ...
```

## -d / --description

**When:** Every function. Not technically required by the CLI but always provide it.

**Why:** Documents the function's purpose for other developers browsing the branch.

**How:**
```bash
dxs function generate -d "Processes an order and returns the shipment ID" ...
```

## -o / --output

**When:** Always required. Output path for the generated JSON config file.

**Why:** The config JSON is the artifact that gets validated and uploaded to the branch.

**How:**
```bash
dxs function generate ... -o process_order_flow.json
```

**Convention:** `<name>_flow.json` matching the reference name.

## --in-param

**When:** Each input the function accepts.

**Format:** `name:type` for required, `name:type?` for optional. Append `[]` for collections. Repeatable.

| Syntax | Required | Collection |
|--------|----------|------------|
| `name:type` | yes | no |
| `name:type?` | no | no |
| `name:type[]` | yes | yes |
| `name:type[]?` | no | yes |

**Types:** `string`, `number`, `boolean`, `date`, `object`, `union`, `blob`

**How:**
```bash
dxs function generate ... \
  --in-param orderId:number \
  --in-param status:string? \
  --in-param flags:boolean[] \
  --in-param tags:string[]? \
  -o order_flow.json
```

**Rules:**
- Parameter names must be valid JS identifiers
- Optional params (with `?`) get `required: false` in the config
- Collection params (with `[]`) get `isCollection: true` in the config — the runtime value is an array of the base type
- For complex objects, use `object` type and define the shape via `dxs function context`

## --out-param

**When:** Each output the function returns.

**Format:** `name:type` or `name:type[]` for collections. Repeatable. No optional marker — all output params are always present in the return shape (though their values may be null/undefined at runtime).

**How:**
```bash
dxs function generate ... \
  --out-param result:object \
  --out-param success:boolean \
  --out-param items:object[] \
  -o order_flow.json
```

**In code:** Set outputs via `$flow.outParams.*`:
```typescript
$flow.outParams.result = { id: 123, name: "Created" };
$flow.outParams.success = true;
$flow.outParams.items = [{ id: 1 }, { id: 2 }];
```
