# Toolbar Buttons & Click Flows

JSON shapes and common patterns for the two arrays you'll modify on a hub config: `toolbar[]` (visible buttons) and `flows[]` (the flow functions those buttons can call). For the flow-code patterns themselves (`$utils.isDefined()`, `$shell.Reports.open{ref}()`, date defaulting), see [../../datex-studio-shared/flow-code-patterns.md](../../datex-studio-shared/flow-code-patterns.md).

## Hub config skeleton

A hub configuration is a JSON object with many top-level fields. The two that matter for this skill:

```json
{
  "id": 8642750,
  "applicationId": 80102,
  "referenceName": "inventory_hub",
  "...": "many other fields — preserve them all",

  "toolbar": [
    { /* button 1 */ },
    { /* button 2 */ }
  ],

  "flows": [
    { /* flow ref 1 */ },
    { /* flow ref 2 */ }
  ]
}
```

`dxs configuration upsert` replaces the **entire** object — every field not in your edited copy is deleted server-side. Always start from a fresh `dxs configuration get hub <id> -b <branchId> -O envelope.json`, extract the inner body with `jq .json envelope.json > body.json` (see [hub-config-api.md](hub-config-api.md)), and modify only `toolbar[]` and `flows[]` in `body.json`.

## Toolbar button entry

A typical toolbar button that launches a report looks like:

```json
{
  "id": 0,
  "label": "Labor Summary",
  "icon": "fa-chart-bar",
  "tooltip": "Open the labor summary report for the current warehouse & date range",
  "clickFlowConfig": {
    "reference": "open_labor_summary_flow",
    "inParamsMap": [
      { "id": "warehouseId", "expression": "$hub.context.warehouseId" },
      { "id": "startDate",   "expression": "$hub.context.startDate"   },
      { "id": "endDate",     "expression": "$hub.context.endDate"     }
    ]
  }
}
```

Fields:

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Y | Numeric ID; usually `0` for newly-added entries (server assigns on PUT). When in doubt, copy the shape of an existing button on the same hub. |
| `label` | Y | Display text on the button. |
| `icon` | N | Font-awesome class or equivalent — match the convention already in use on the hub. |
| `tooltip` | N | Hover text. |
| `clickFlowConfig` | Y | Wires the button to a Datex Studio flow function. |
| `clickFlowConfig.reference` | Y | The flow's `referenceName` (must match a function on the branch; must also appear in `flows[]`). |
| `clickFlowConfig.inParamsMap` | N | Maps the flow's input parameter names to expressions sourced from hub context (e.g., `$hub.context.warehouseId`). |

**Always copy the field shape of an existing button on the same hub** rather than inventing one from this doc — different hub generations carry different optional fields and you don't want to lose any by omission.

## Flows array entry

Each click flow referenced by a toolbar button must have a matching entry in `flows[]`:

```json
{
  "reference": "open_labor_summary_flow",
  "module": null
}
```

Fields:

| Field | Required | Notes |
|-------|----------|-------|
| `reference` | Y | The flow function's `referenceName` — must match the toolbar button's `clickFlowConfig.reference` exactly. |
| `module` | N | Set when the flow lives in a different module than the hub's app. `null` (or omitted) for same-app flows. |

A `toolbar[]` button with no matching `flows[]` entry won't fire when clicked. An orphaned `flows[]` entry (no toolbar reference) is harmless but should be cleaned up when removing a button.

## Click-flow function signature

The click flow function (created via the `function-creator` skill) receives the inParams declared in its config and named in the button's `inParamsMap`. A typical signature for the report-launching flow above:

```typescript
// open_labor_summary_flow
// inParams: warehouseId (number), startDate (date?), endDate (date?)

let { warehouseId, startDate, endDate } = $flow.inParams;

// Default missing date range — see shared/flow-code-patterns.md
const today = new Date();
today.setHours(23, 59, 59, 999);
if (!$utils.isDefined(startDate) && !$utils.isDefined(endDate)) {
    const s = new Date(); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
    startDate = s;
    endDate = today;
} else if (!$utils.isDefined(startDate)) {
    const s = new Date(); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
    startDate = s;
} else if (!$utils.isDefined(endDate)) {
    const candidate = new Date(startDate);
    candidate.setDate(candidate.getDate() + 7);
    candidate.setHours(23, 59, 59, 999);
    endDate = candidate <= today ? candidate : today;
}

await $shell.Reports.openlabor_summary_report({
    Warehouse: String(warehouseId),
    StartDate: startDate,
    EndDate: endDate
});
```

Key details (full rationale in [../../datex-studio-shared/flow-code-patterns.md](../../datex-studio-shared/flow-code-patterns.md)):

- `$utils.isDefined()` — not `!= null`, not `!startDate` — for the null checks
- `$shell.Reports.open{report_referenceName}(...)` — `open` is a literal prefix, no separator
- Parameter keys (`Warehouse`, `StartDate`, `EndDate`) must match the report's `ReportParameters[].Name` exactly, case-sensitive

## Common patterns

### Add a button that launches a report

1. Confirm the report exists and note its `referenceName` and `ReportParameters[].Name` list.
2. Create the click flow with `function-creator` — inParams match what the hub will pass; body resolves defaults and calls `$shell.Reports.open{ref}()`.
3. Fetch the hub config: `dxs configuration get hub <configId> -b <branchId> -O envelope.json`, then extract `jq .json envelope.json > body.json` (see [hub-config-api.md](hub-config-api.md)).
4. Append the new entry to `toolbar[]` and add the click-flow reference to `flows[]` in `body.json`.
5. Push the inner body: `dxs configuration upsert hub -b <branchId> -D body.json`.

### Change which report a button launches

In most cases: edit the click flow function's code only (`$shell.Reports.open{newRef}(...)`). The hub config doesn't need to change if the flow reference stays the same. Use `function-creator` for the function edit.

### Re-label a button

Edit `toolbar[].label` (and optionally `icon` / `tooltip`). No flow change. `dxs configuration get hub` → edit → `dxs configuration upsert hub`.

### Remove a button

1. Remove the entry from `toolbar[]`.
2. Remove the corresponding entry from `flows[]` (unless another button still references the same flow — check first).
3. Optionally delete the click flow function itself via `dxs function delete <ref> --branch <id>` if no other hub uses it.

### Reorder buttons

Reorder `toolbar[]` entries. The display order matches array order.

## Quick reference: where things live

| Concern | Lives in | Edited via |
|---------|----------|-----------|
| Button label, icon, position | `toolbar[]` entry on the hub config | This skill (`dxs configuration get hub` → edit → `dxs configuration upsert hub`) |
| What the button does | Click flow function code | `function-creator` |
| Parameter wiring (hub → flow) | `toolbar[].clickFlowConfig.inParamsMap` | This skill |
| Parameter wiring (flow → report) | Click flow body — `$shell.Reports.open{ref}({...})` | `function-creator` |
| Report layout / parameters | The report itself | `report-creator` / `report-editor` |
