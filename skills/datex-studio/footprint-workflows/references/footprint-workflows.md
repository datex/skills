# Footprint Workflows

A **footprint-workflow** (`configurationTypeId: 23`, CLI type `footprintworkflow`, `configurationType.name` `FootprintWorkflow`) is a low-code TypeScript implementation that plugs into a **named extension point in the Footprint platform's workflow pipeline**. It is the modern, Studio-authored replacement for the legacy XAML "Datex Workflow" activities — the Footprint server invokes it at a fixed lifecycle moment (before an entity status commits, while planning allocation, while cartonizing, while recommending a location, …) instead of running the old Windows-Workflow-Foundation flowchart.

> **Two unrelated "workflow" worlds — don't conflate them.** The legacy XAML "Datex Workflow" engine (`.xaml`/Windows Workflow Foundation, e.g. the `workflow-translator` tool and `footprint-core/…/Workflow.Activities`) is the *old* mechanism. A `footprintworkflow` **config** is the *new* TypeScript mechanism that supersedes it at the same extension points. This skill is only about the config type. The `workflowDefinitionName` values you see (`Cartonization`, `Entity Status Change (Before Commit)`, `Allocation Strategy`, …) are the platform extension-point slots that *both* mechanisms target.

## Purpose & When to Use

Use a footprint-workflow when you need to **inject custom server-side logic at a Footprint platform extension point** — a slot the WMS calls during its own processing. Examples:

- **`Entity Status Change (Before Commit)`** — run logic just before an order/entity status change commits (dispatch to side-effect actions, veto, mutate in place).
- **`Cartonization`** — supply a custom packing plan when the platform asks how to pack shipping items into containers.
- **`Allocation Strategy`** — return a hard-allocation response the allocator will honor.
- **`Recommend License Plate Location` / `Recommend Receiving Location` / `Recommend Inventory Location`** — return location recommendations the platform uses.
- **`Barcode Parser`, `Blind Picking`, `Blind Receiving`, `Wave Release Processing`, `Survey Orchestration`, `Message Controller`, …** — see the [Extension-Point Catalog](#extension-point-catalog).

**Don't** reach for a footprint-workflow when:

- You just want a callable backend routine with a signature *you* design → that's a **function** (`flow`) or **action** (`footprintflow`). A workflow's signature is **fixed by the platform slot** — you don't get to choose it.
- You want a UI screen, a data fetch, or feature-owned storage → those are their own component types.
- The behavior isn't triggered by the Footprint platform at one of its named workflow slots. If nothing in the platform *calls* the slot, a workflow config is inert.

The mental model: **a footprint-workflow is an implementation of a platform interface.** The platform owns the interface (the slot, the input/output contract, the GUID); you own the body.

## File Location & Naming

- **CLI type identifier:** `footprintworkflow` (lowercase, matches `ConfigurationEndpoints.normalize_type` output).
- **`configurationTypeId`:** `23`.
- **Conventional export suffix:** `-footprintWorkflow.json` — by analogy to its siblings `footprintFlow` (action, `-footprintFlow.json`) and `footprintDatasource` (`-footprintDatasource.json`); `configurationType.name` is `FootprintWorkflow`. The **branch is the source of truth**, not a local path — fetch with `dxs configuration get` (see [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md)).
- **Naming:** prefer a `_workflow` suffix on the `referenceName` for new authoring (type-indicator convention, [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md)). Note the platform library (`FootprintWorkflowsManager`) is **mixed** — `advanced_cartonization_workflow` and `advanced_recommend_license_plate_location_workflow` carry the suffix; `allocation_strategy` and `entity_status_change` do not. Don't treat the suffix as enforced; do apply it to new configs.
- **`title`:** workflows are a **backend** type — the `title` never reaches a user screen, so the display-name rule does not bind. Match `referenceName` or use a short human label; both appear in the library.
- **Default package:** `Utilities` unless the feature dictates otherwise ([../../datex-studio-conventions/defaults.md](../../datex-studio-conventions/defaults.md)). The reference library lives in the **`FootprintWorkflowsManager`** package.
- **Default access modifier:** `public` ([../../datex-studio-conventions/defaults.md](../../datex-studio-conventions/defaults.md)).

## The Workflow-Definition Binding

Four top-level fields bind the config to its platform slot:

| Field | Meaning | Example | Where it comes from |
|---|---|---|---|
| `apiSettingName` | The Footprint API connection setting on the branch | `"FootprintApi"` | branch settings (`dxs source branch settings`) |
| `workflowDefinitionId` | Numeric id of the platform workflow slot | `18` | **workflowsMetadata API** → `id` |
| `workflowDefinitionName` | Human name of the slot | `"Cartonization"` | **workflowsMetadata API** → `name` |
| `workflowGUID` | A unique reference **you assign** to this workflow config | `"88c5baee-b316-4dce-bb07-fd624e11a922"` | **you generate it** (new) / **preserve it** (edit) — *not* in the metadata, matches nothing |

### Discovering the slot catalog (authoritative source)

The platform publishes its workflow-definition catalog **per Footprint connection**. Pull it with `dxs api`:

```bash
dxs api GET "/footPrintApiConnections/byName/<connectionName>/workflowsMetadata?applicationId=<branchId>" --raw -O meta.json

# Slot catalog: id (= workflowDefinitionId), name (= workflowDefinitionName), and the exact param contract
jq '.workflowsMetadataJson.workflowDefinitions[] | {id, name, description, inParams, outParams}' meta.json
```

- `<connectionName>` is a **real Footprint connection name** (e.g. `DSV`) — **not** the `apiSettingName` value `FootprintApi`, which throws `DomainObjectNotFoundException`. (Connection names resolve the same way as elsewhere in `dxs`; ask/look them up if unsure.)
- `<branchId>` is the application/branch id you're authoring on (the `applicationId` query param).
- The catalog is **connection-specific** — the available slots and ids reflect what that Footprint instance exposes. The `id`/`name` for a given slot are stable platform workflow-definition values (e.g. Cartonization is always `18`), but confirm against the connection you're targeting.

The response payload (`workflowsMetadataJson`) also carries:
- **`types`** — the full `FootPrintWorkflow.*` type surface as **structured JSON** (`objectTypeDef`/`enumTypeDef`), ~389 types on the DSV connection. More parseable than the `dxs configuration contexts` TypeScript blob for reading `Input`/result shapes.
- **`queryDefinitions`** — the platform query-definition catalog (out of scope here).

**Copy `id` → `workflowDefinitionId`, `name` → `workflowDefinitionName`, and the `inParams`/`outParams` verbatim** into your config body. The catalog is the source of truth for the slot signature — you don't invent or guess it.

### `workflowGUID` — a unique reference you own

`workflowGUID` is **not** in `workflowsMetadata` and does **not** have to match anything — it's a unique identifier **you assign** to the workflow config instance (analogous to a component GUID). The rule is simple:

- **New workflow → generate a fresh GUID.** Any v4 UUID works:
  ```bash
  python3 -c "import uuid; print(uuid.uuid4())"   # or: uuidgen | tr 'A-Z' 'a-z'
  ```
- **Editing an existing workflow → keep the existing GUID.** The round-trip (`get -O envelope.json` → `jq .json > body.json`) preserves `workflowGUID` automatically — **don't regenerate it**. Changing the GUID on an edit makes the platform treat it as a different workflow.

Getting the *slot* binding wrong (mismatched `workflowDefinitionId`/`workflowDefinitionName`, or a param contract that doesn't match the slot) means the platform won't wire the config to the slot — it validates clean but never runs. The GUID is independent of that wiring; it just needs to be present, unique to this config, and stable across edits.

## The Fixed Param Contract (the platform owns the signature)

Every footprint-workflow has a **single object in-param named `Input`**, typed to a platform base type `FootPrintWorkflow.<Slot>InputBaseWL`:

```json
"inParams": [
  {"id": "Input", "required": true, "description": null, "oneOf": null, "fromBaseConfiguration": null,
   "type": "object", "objectTypeDef": null, "objectType": "FootPrintWorkflow.CartonizationInputBaseWL",
   "isCollection": null, "isSecured": null, "isConstant": null, "constantValue": null}
]
```

The **out-params are dictated by the slot**, not by you:

| Slot | out-param shape (observed) |
|---|---|
| `Cartonization` | one object `CartonizationResult: FootPrintWorkflow.CartonizationResult` |
| `Allocation Strategy` | one object `HardAllocationResponse: FootPrintWorkflow.HardAllocationResponse` |
| `Recommend License Plate Location` | one **collection** `RecommendedLicensePlateLocation: FootPrintWorkflow.LicensePlateLocation[]` (`isCollection: true`) |
| `Entity Status Change (Before Commit)` | **none** (`outParams: []`) — it mutates/dispatches before commit, it doesn't return a value |

**You implement the body; you do not redesign the signature.** Don't add extra in-params, rename `Input`, or change the out-param contract — codegen and the platform invoker both rely on the slot's declared shape. Read the exact field shapes of `FootPrintWorkflow.<X>InputBaseWL` and the result type from `dxs configuration contexts` (see [Discovering the type surface](#discovering-the-type-surface)).

## Extension-Point Catalog

The authoritative, live catalog comes from the [workflowsMetadata API](#discovering-the-slot-catalog-authoritative-source) — always pull it for the connection/branch you're targeting rather than trusting a static list. The 26 slots observed on the `DSV` connection (`id` = `workflowDefinitionId`, in-param is always a single object `Input`):

| id | `workflowDefinitionName` | `Input` type (`FootPrintWorkflow.…`) | out-param(s) |
|---|---|---|---|
| 1 | Recommend License Plate Location | `RecommendLocationInputBaseWL` | `RecommendedLicensePlateLocation: LicensePlateLocation[]` |
| 4 | Blind Receiving | `BlindReceivingInputBaseWL` | `BlindReceiveTask: BlindReceiveTaskResult` |
| 5 | Get Barcode Parser | `GetBarcodeParserInputBaseWL` | `BarcodeParser: BarcodeParser` |
| 8 | Recurring Storage Custom Billing | `RecurringStorageCustomBillingInputBaseWL` | `BillableValue: number` |
| 12 | Custom Billing | `CustomBillingInputBaseWL` | `BillingTaskRequests: BillingTaskRequest[]` |
| 15 | Process Inventory For Allocation | `ProcessInventoryForAllocationInputBaseWL` | `Inventory: ProcessInventory[]` |
| 16 | Entity Status Change (Before Commit) | `EntityStatusChangeInputBaseWL` | *(none)* |
| 18 | Cartonization | `CartonizationInputBaseWL` | `CartonizationResult: CartonizationResult` |
| 21 | Allocation Strategy | `AllocationStrategyInputBaseWL` | `HardAllocationResponse: HardAllocationResponse` |
| 22 | Loading Request | `LoadingRequestInputBaseWL` | `OutputLocationIsFinalLoad: boolean` |
| 23 | Custom Commands (Get) | `GetCustomCommandsInputWL` | `CustomCommandNames: string[]` |
| 24 | Custom Commands (Execute) | `ExecuteCustomCommandsInputWL` | `PostCustomCommandActions: PostCustomCommandAction[]` |
| 25 | Recommend Lot/VendorLot | `RecommendLotVendorLotInputBaseWL` | `RecommendationResponse: LotVendorLotRecommendationResponse` |
| 26 | Barcode Parser | `BarcodeParserInputBaseWL` | `Barcode: Barcode`, `BarcodeList: Barcode[]` |
| 27 | Recommend Receiving Location | `RecommendReceivingLocationInputBaseWL` | `RecommendedLocation: Location` |
| 28 | Recommend Inventory Location | `RecommendInventoryLocationInputBaseWL` | `RecommendedLicensePlateLocation: LocationListLicensePlate[]` |
| 29 | Work Task Assignment | `TasksAssignmentInArgWL` | *(none)* |
| 31 | Outbound Processing Strategy | `OutboundProcessingStrategyInputBaseWL` | *(none)* |
| 33 | Survey Orchestration | `SurveyOrchestrationInputBaseWL` | `SurveyDefinitionId: number`, `SurveyId: number`, `DisallowExit: boolean` |
| 34 | Wave Release Processing | `WaveReleaseProcessingInputBaseWL` | *(none)* |
| 36 | Message Controller | `MessageControllerInputBaseWL` | `MessageControllerOutput: MessageControllerOutputBase` |
| 38 | Blind Picking | `BlindPickingInputBaseWL` | `BlindPickingResponse: BlindPickingResponse` |
| 51 | Capture | `CaptureRequestInputWL` | `Response: CaptureResponse` |
| 52 | Entity Import Lookup | `EntityImportLookupInputBaseWL` | `Result: EntityImportLookupResult` |
| 54 | Validate Build CLP | `BuildClpValidationRequestBaseWL` | *(none)* |
| 55 | Advanced survey orchestration | `AdvancedSurveyOrchestrationInputBaseWL` | `SurveyDefinitionId: number`, `SurveyId: number`, `Configuration: string` |

> **The set and ids are connection-specific** — pull the metadata for *your* connection rather than relying on this snapshot. Note the `Input` type name usually ends in `InputBaseWL` but not always (`GetCustomCommandsInputWL`, `TasksAssignmentInArgWL`, `CaptureRequestInputWL`, `BuildClpValidationRequestBaseWL`). The in-param `id` is always `Input`; the out-param contract is whatever the slot declares (including *none*).

## Per-Slot Field Reference (common slots)

The shapes below are the real `$types.FootPrintWorkflow.*` definitions for the four slots implemented in the `FootprintWorkflowsManager` library, extracted from `dxs configuration contexts`. **These are platform types — never hand-write them.** Re-run `contexts` on your branch to get the authoritative, current shape and to expand the large nested entity types (`Order`, `LicensePlate`, `Location`, `Task`, `ReplenishmentAction`, `ManualAllocationSuggestion`, …) that this section references but does not fully inline. JSDoc comments below are the platform's own field docs.

> **Reading convention.** `?` marks an optional field. Field types are shown with the `$types.FootPrintWorkflow.` prefix you use in workflow code (the contexts surface spells it `_types.FootPrintWorkflow.`). `number` fields named `*Id` are **platform indexes** (the integer id visible in the corresponding setup screen), not GUIDs.

### Cartonization — `workflowDefinitionId: 18`

`$flows…advanced_cartonization_workflow({ Input }) => Promise<{ CartonizationResult }>`

```ts
interface CartonizationInputBaseWL {
  CartonizationContext: $types.FootPrintWorkflow.CartonizationContextEnum;   // Order = 0, Shipment = 1
  CartonizationRequest: $types.FootPrintWorkflow.CartonizationRequest;
}
interface CartonizationRequest {
  /** Materials, quantities and packages requested to be cartonized. */
  QuantitiesToCartonize: $types.FootPrintWorkflow.CartonizationQuantity[];
}
interface CartonizationQuantity {
  MaterialId: number;   // index of the material
  PackagingId: number;  // index of the package
  OrderId: number;      // index of the outbound order (as seen in an order list)
  LineNo: number;       // line number in the outbound order
  Amount: number;       // amount to cartonize
}
```

Result you must populate on `$flow.outParams.CartonizationResult`:

```ts
interface CartonizationResult {
  /** Quantities that could NOT be cartonized — echo unplaced input here. */
  UncartonizedQuantities: $types.FootPrintWorkflow.CartonizationQuantity[];
  /** The packed containers and their contents. */
  Containers: $types.FootPrintWorkflow.CartonizationContainer[];
}
interface CartonizationContainer {
  ContainerTypeId: number;       // index of the container type
  Height?: number; Width?: number; Length?: number; DimensionUOM?: number;   // optional overrides of the
  Weight?: number; WeightUOM?: number; Volume?: number; VolumeUOM?: number;  // container type's defaults
  /** Materials/quantities/packages placed in this container. */
  Quantities: $types.FootPrintWorkflow.CartonizationQuantity[];
}
```

### Entity Status Change (Before Commit) — `workflowDefinitionId: 16`

`$flows…entity_status_change({ Input }) => Promise<{}>` — **no out-params**; you react before the status commits.

The base in-param is **thin** — it carries only `Context`. **Narrow it to the context-specific subtype** before reading status/entities (exactly as the library does: `$flow.inParams.Input as $types.FootPrintWorkflow.OrderStatusChangeInputWL`):

```ts
interface EntityStatusChangeInputBaseWL {
  Context: $types.FootPrintWorkflow.EntityStatusChangeContextEnum;
  // Order = 1, Shipment = 2, Task = 3, PickSlipClusterLookup = 4,
  // Wave = 5, PickSlip = 6, LoadContainer = 7, DockAppointment = 8
}
```

Subtypes (each `extends EntityStatusChangeInputBaseWL`), one per `Context`:
`OrderStatusChangeInputWL`, `ShipmentStatusChangeInputWL`, `TaskStatusChangeInputWL`, `WaveStatusChangeInputWL`, `PickSlipStatusChangeInputWL`, `LoadContainerStatusChangeInputWL`, `DockAppointmentStatusChangeInputWL`.

```ts
interface OrderStatusChangeInputWL extends EntityStatusChangeInputBaseWL {
  Context: $types.FootPrintWorkflow.EntityStatusChangeContextEnum;
  OldStatus: $types.FootPrintWorkflow.OrderStatusEnum;
  NewStatus: $types.FootPrintWorkflow.OrderStatusEnum;
  Orders: $types.FootPrintWorkflow.Order[];   // full Order entities — expand via contexts
}
```

`OrderStatusEnum` is a **bit-flag** enum (powers of two — don't assume contiguous values): `Created=1, Processing=2, Completed=4, Cancelled=8, Error=16, Virtually_Allocated=32, Hold=64, Wait=128, Ready=256, Backorder=512, Feedback_Started=1024, Approval_Required=2048, Rejected=4096`. Each entity context (`Shipment`, `Task`, …) has its own status enum on its subtype — read it from `contexts`.

### Allocation Strategy — `workflowDefinitionId: 21`

`$flows…allocation_strategy({ Input }) => Promise<{ HardAllocationResponse }>`

```ts
interface AllocationStrategyInputBaseWL {
  Context: $types.FootPrintWorkflow.HardAllocationContextEnum;   // 12 values; see below
  HardAllocationRequest: $types.FootPrintWorkflow.HardAllocationRequest;
}
interface HardAllocationRequest {
  WarehouseId: number;                          // index visible in Warehouse setup
  Quantity: $types.FootPrintWorkflow.InventoryQuantity;   // amount needed
  LocationsToIgnore: number[];                  // location indexes to exclude as sources (may be empty)
  LotId?: number; VendorLotId?: number; LicensePlateId?: number;   // optional source constraints
}
interface InventoryQuantity {
  MaterialId: number; PackagingId: number;
  PackagedAmount: number;   // amount in the given packaging
  BaseAmount: number;       // amount reduced to base packaging
}
```

`HardAllocationContextEnum`: `GenericHardAllocation=1, CreateAndPlanReplenTasksAllocation=2, GenerateManufacturingInventoryMoveTasksAllocation=3, InventoryAdjustmentTasksGenerationForMaterialTransferLineAllocation=4, InventoryPlanningTasksGenerationAllocation=5, InventoryTransferAllocation=6, ManufacturingLoadAnticipatedAllocationsAllocation=7, MaterialTranferTasksAllocation=8, PickTasksGenerationAllocation=9, PickTasksGenerationReallocation=10, InventoryTransformationAllocation=11, ReserveSerialsOnSalesOrderLineAllocation=12`.

Result on `$flow.outParams.HardAllocationResponse`:

```ts
interface HardAllocationResponse {
  /** Locations/license-plates that hold the desired inventory. */
  HardAllocationSuggestions: $types.FootPrintWorkflow.HardAllocationSuggestion[];
  /** Where the user must allocate manually (often the "no source found" result). */
  ManualAllocationSuggestions: $types.FootPrintWorkflow.ManualAllocationSuggestion[];
  /** Unallocated remainder — usually zero (rest goes to manual). */
  RemainingQuantity: $types.FootPrintWorkflow.InventoryQuantity;
}
interface AllocationSuggestion {
  LocationId?: number;      // source location (empty only if LicensePlateId given)
  LicensePlateId?: number;  // source LP (empty -> location+lot must be set)
  LotId?: number;
  Quantity: $types.FootPrintWorkflow.InventoryQuantity;
}
interface HardAllocationSuggestion extends AllocationSuggestion {
  /** Pre-allocation actions (e.g. material transfer / replenishment) to run first. */
  ReplenishmentActions: $types.FootPrintWorkflow.ReplenishmentAction[];
  ExpirationDate?: string;   // expiration date of the allocated lot
}
```

### Recommend License Plate Location — `workflowDefinitionId: 1`

`$flows…advanced_recommend_license_plate_location_workflow({ Input }) => Promise<{ RecommendedLicensePlateLocation: LicensePlateLocation[] }>` — note the out-param is a **collection** (`isCollection: true`).

```ts
interface RecommendLocationInputBaseWL {
  Context: $types.FootPrintWorkflow.RecommendLocationContext;   // Putaway=0, LicensePlateMove=1, Loading=2, PickAndDrop=3
  LicensePlatesAndTasks: $types.FootPrintWorkflow.LicensePlateTask[];
}
interface LicensePlateTask {
  LicensePlate: $types.FootPrintWorkflow.LicensePlate;   // full LP entity — expand via contexts
  Task: $types.FootPrintWorkflow.Task;                   // full Task entity — expand via contexts
}
```

Result (one entry per recommended placement) on `$flow.outParams.RecommendedLicensePlateLocation`:

```ts
interface LicensePlateLocation {
  LicensePlate: $types.FootPrintWorkflow.LicensePlate;   // which LP
  Location: $types.FootPrintWorkflow.Location;           // recommended location — full entity
}
```

> The remaining 14 slots in the catalog follow the same pattern — a `<Slot>InputBaseWL` with a `Context` enum + a request payload, and a slot-specific result type. Run `dxs configuration contexts footprintworkflow -D body.json` and grep the `appContext` for `<Slot>InputBaseWL` to read any slot not detailed here.

## Body Shape

Top-level keys (in the inner `.json` body, after `jq .json envelope.json`):

```
apiSettingName, workflowDefinitionId, workflowDefinitionName, workflowGUID,
configurationTypeId, start, nodes, fromBaseConfiguration,
id, referenceName, title, description, inParams, outParams, vars, events, accessModifier
```

The node graph reuses the **shared flow-graph model** (the same `nodes[]` / `stepConfig` / `decisionConfig` shape used by actions and functions). Every library workflow is a **single `ExecuteCodeActivity` step**: the TypeScript lives at `nodes[0].stepConfig.executeCodeConfig.code`. Multi-node graphs (`next`/`error` links, `decisionConfig` branches) are structurally possible but unused in the library — keep to a single step unless you have a concrete reason.

### Minimal Valid Skeleton

A result-returning workflow (Cartonization-shaped), minified to one line for upload. `code` shown unescaped for readability — in the real body it is a single JSON string with `\r\n` line endings.

```json
{
  "apiSettingName": "FootprintApi",
  "workflowDefinitionId": 18,
  "workflowDefinitionName": "Cartonization",
  "workflowGUID": "88c5baee-b316-4dce-bb07-fd624e11a922",
  "configurationTypeId": 23,
  "start": "step1",
  "nodes": [
    {
      "id": "step1",
      "type": "step",
      "stepConfig": {
        "type": "ExecuteCodeActivity",
        "executeCodeConfig": {
          "code": "const result = await $flows.Cartonization.plan_cartonization_action({ context: $flow.inParams.Input.CartonizationContext as number, entity_id: $flow.inParams.Input.CartonizationRequest.QuantitiesToCartonize[0]?.OrderId });\r\n$flow.outParams.CartonizationResult = { Containers: [], UncartonizedQuantities: [] };\r\n// map result -> $flow.outParams.CartonizationResult ..."
        },
        "next": null,
        "error": null
      },
      "decisionConfig": null
    }
  ],
  "fromBaseConfiguration": null,
  "id": 0,
  "referenceName": "advanced_cartonization_workflow",
  "title": "Advanced cartonization workflow",
  "description": "Configurable cartonization workflow that packs shipping items into shipping containers.",
  "inParams": [
    {"id": "Input", "required": true, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "object", "objectTypeDef": null, "objectType": "FootPrintWorkflow.CartonizationInputBaseWL", "isCollection": null, "isSecured": null, "isConstant": null, "constantValue": null}
  ],
  "outParams": [
    {"id": "CartonizationResult", "required": true, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "object", "objectTypeDef": null, "objectType": "FootPrintWorkflow.CartonizationResult", "isCollection": null, "isSecured": null, "isConstant": null, "constantValue": null}
  ],
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

For a **before-commit mutation** workflow (Entity-Status-Change-shaped), set `outParams: []` and have the code dispatch to side-effect handlers instead of returning a value.

- `id: 0` for a net-new config (the platform assigns the real id on import — [../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)).
- `vars`, `events`, `fromBaseConfiguration` stay `null` in every library example.
- `configurationTypeId: 23` appears at the body top level.

## Code Patterns — the body is a thin dispatcher

Workflow code runs **server-side inside the Footprint runtime** — the same tier as **actions** (transactional, `apiSettingName: FootprintApi`). The platform invokes it at the slot; your job is to translate `$flow.inParams.Input` into calls to package logic and (if the slot returns a value) populate `$flow.outParams`.

**Keep the node thin.** The library workflows dispatch to package actions and read footprint-datasources — they don't carry deep business logic inline. Put real logic in actions/functions and call them:

```typescript
// Entity Status Change (Before Commit) — dispatch by context + new status, no return value
switch ($flow.inParams.Input.Context) {
  case $types.FootPrintWorkflow.EntityStatusChangeContextEnum.Order: {
    const info = $flow.inParams.Input as $types.FootPrintWorkflow.OrderStatusChangeInputWL
                 & { Order?: $types.FootPrintWorkflow.Order, Orders?: $types.FootPrintWorkflow.Order[] };
    for (const order of info.Orders ?? (info.Order ? [info.Order] : [])) {
      switch (info.NewStatus) {
        case $types.FootPrintWorkflow.OrderStatusEnum.Completed:
          await $flows.FootprintWorkflowsManager.on_order_completed({ order_id: order.Id, previous_status_id: info.OldStatus });
          break;
        // ... other statuses
      }
    }
    break;
  }
}
```

```typescript
// Result-returning slot — read config via a footprintDatasource, dispatch, map into $flow.outParams
const config = (await $datasources.Utilities.fpds_get_configurations.get({
  scope: $types.Utilities.e_awi_scopes.Cartonization,
  context: $types.Cartonization.e_stage.OrderProcessing
})).result[0];

if ($utils.isDefined(config)) {
  const result = await $flows.Cartonization.plan_cartonization_action({ configuration: config.Id, /* ... */ });
  $flow.outParams.CartonizationResult = { Containers: [], UncartonizedQuantities: [] };
  // map result fields onto $flow.outParams.CartonizationResult ...
}
```

Tier-derived calling rules (workflow ≈ action tier — confirm reachability via `contexts`, see [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md)):

| You want to… | Use | Not |
|---|---|---|
| Call an action | `$flows.<Package>.<action_name>({ ... })` | — |
| Read a footprint-datasource | `$datasources.<Package>.<fpds_name>.get({ ... })` | a cloud `-datasource.json` (cross-tier) |
| Reference platform types/enums | `$types.FootPrintWorkflow.*` (and `$types.<Package>.*`) | hand-written interfaces |
| Null-check | `$utils.isDefined(x)` | `== null` / falsy checks ([../../datex-studio-shared/flow-code-patterns.md](../../datex-studio-shared/flow-code-patterns.md)) |
| Read input / write output | `$flow.inParams.Input` / `$flow.outParams.<Name>` | inventing new param names |

Because it is action-tier: **`$db` is not available** (function-tier only) and you **cannot call functions directly** — wrap function logic behind an action, or dispatch to a package action. The `return;` rule applies (see [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md#flow-return-requires-outparams-be-undeclared)): a slot with declared `outParams` must `return $flow.outParams;` for an early exit, never bare `return;`.

## Discovering the type surface

The `Input` shape and result types are platform types — read them from the designer contexts, never hand-roll them:

```bash
dxs configuration contexts footprintworkflow -b <branchId> -D body.json
```

This returns the full Monaco IntelliSense surface, including every `$types.FootPrintWorkflow.*` interface and enum (`CartonizationInputBaseWL`, `EntityStatusChangeContextEnum`, `OrderStatusEnum`, `HardAllocationResponse`, `LicensePlateLocation`, …). The type declarations live in the `appContext` designer context (`configuration_contexts.designerContexts[].text` where `id == "appContext"`) — grep it for `<Slot>InputBaseWL` and the result type to learn the exact fields before writing the body. The four common slots are already detailed in [Per-Slot Field Reference](#per-slot-field-reference-common-slots). The contexts call needs a `body.json` to anchor the package/branch — pass the skeleton or the config you're editing.

**The contexts response is scoped to the body you post.** The CLI command is a thin wrapper over `POST /applications/<branchId>/footprintworkflowconfigurations/contexts` (body = your workflow JSON). The returned `designerContexts` entry with `id == "flowContext"` echoes your declared signature back as a typed `IFlow` — e.g. for a Blind Picking body:

```ts
interface IFlow {
  inParams:  { Input: _types.FootPrintWorkflow.BlindPickingInputBaseWL };
  outParams: { BlindPickingResponse: _types.FootPrintWorkflow.BlindPickingResponse };
}
```

That makes `contexts` a quick **signature sanity check**: post your skeleton and confirm `flowContext` types `$flow.inParams.Input` / `$flow.outParams.*` to the slot's types before you write code. (The raw endpoint and the `dxs configuration contexts footprintworkflow -D body.json` wrapper return the same payload; use whichever is handier.)

**Alternative (often easier) for the platform types: the `workflowsMetadata` API.** The same [slot-catalog call](#discovering-the-slot-catalog-authoritative-source) also returns `workflowsMetadataJson.types` — the full `FootPrintWorkflow.*` type surface as **structured JSON** (`objectTypeDef`/`enumTypeDef` arrays), not a TypeScript text blob. Easier to query programmatically than the `contexts` output:

```bash
dxs api GET "/footPrintApiConnections/byName/<connectionName>/workflowsMetadata?applicationId=<branchId>" --raw -O meta.json
jq '.workflowsMetadataJson.types[] | select(.referenceName=="CartonizationInputBaseWL")' meta.json
```

**For the package types your dispatch code references (`$types.<Package>.*`): `dxs configuration nomenclature`.** Workflow code typically reaches into package-level custom types — enums like `$types.Utilities.e_awi_scopes.Cartonization` or `$types.Cartonization.e_stage.OrderProcessing` — that are **not** in the `FootPrintWorkflow.*` surface. Enumerate them (and their enum members) per branch with:

```bash
dxs configuration nomenclature -b <branchId>
# Just the enums for a package, with members
dxs configuration nomenclature -b <branchId> --package Cartonization --kind enum
# Verify a specific type/member by name
dxs configuration nomenclature -b <branchId> --search e_stage
```

Each item is `{key, name, constantValues}` where `key`/`name` are the fully-qualified `<Package>.<Type>` reference (interfaces `i_*`, enums `e_*`) and `constantValues` lists an enum's members (empty for interfaces). Use it to confirm an enum member name (`$types.<Package>.<e_type>.<Member>`) exists before referencing it in dispatch code. This is a general-purpose discovery tool (not workflow-specific); the canonical reference, with the "which discovery tool to use" guidance, lives in [../../datex-studio-shared/context-navigation.md#discovering-custom-types-and-enum-members](../../datex-studio-shared/context-navigation.md#discovering-custom-types-and-enum-members).

## CLI Lifecycle

Workflow authoring goes through `dxs configuration` — there is **no `dxs workflow` subcommand**. Build (or fetch + extract) the whole JSON body, edit it, push the whole thing back. PublishedMain configs are `readonly: true`; author on a **feature branch**.

**New workflow (discover the slot from the metadata API, assign a fresh GUID):**

```bash
# 1. Discover the slot: id (= workflowDefinitionId), name, exact inParams/outParams
dxs api GET "/footPrintApiConnections/byName/<connectionName>/workflowsMetadata?applicationId=<branchId>" --raw -O meta.json
jq '.workflowsMetadataJson.workflowDefinitions[] | select(.name=="Cartonization")' meta.json
# 2. Generate a fresh workflowGUID for this new config (matches nothing — just unique)
python3 -c "import uuid; print(uuid.uuid4())"
# 3. Build body.json: apiSettingName + workflowDefinitionId/Name (step 1) + your fresh GUID,
#    the slot's inParams/outParams verbatim, configurationTypeId:23, id:0, your referenceName/title/description/code
# 4. (Optional) read the Input/result field shapes — contexts OR meta.json's `types`
dxs configuration contexts footprintworkflow -b <branchId> -D body.json
# 5. Validate, then upsert
dxs configuration validate footprintworkflow -b <branchId> -D body.json
dxs configuration upsert  footprintworkflow -b <branchId> -D body.json
```

**Edit an existing workflow (round-trip — never skip the jq extract):**

```bash
dxs configuration get footprintworkflow <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json          # CRITICAL — see Round-trip rule
# ... edit nodes[0].stepConfig.executeCodeConfig.code ...
dxs configuration validate footprintworkflow -b <branchId> -D body.json
dxs configuration upsert  footprintworkflow -b <branchId> -D body.json
```

### Round-trip rule (critical)

Never pipe `envelope.json` straight into `upsert` — `dxs configuration get -O` writes the **full server envelope** (`id`, `json`, `jsonString`, `version`, …), but `upsert -D` expects only the inner `json` body. Piping the envelope silently wipes config content. Always `jq .json envelope.json > body.json` first. See [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md).

> **Security note on the envelope.** `dxs configuration get -O envelope.json` includes `application.applicationDefinition`, which can carry **Azure app-registration secrets** (`azAppRegBackendApplicationSecret`, …). The `jq .json` extract drops them. Never commit `envelope.json` and never paste its non-`.json` metadata anywhere.

### Editing the code string safely

The `code` value is a JSON string with `\r\n` (CR+LF) line endings. **Edit it with `json.load` / `json.dump` in Python**, not raw string replacement on the minified file — the escaping layer (`\\r\\n` in the file vs `\r\n` decoded) is easy to corrupt. Preserve existing escaping; never restructure the surrounding JSON. See [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md).

## Pre-Flight Checklist

Walk the [universal checklist](../../datex-studio-conventions/universal-checklist.md) **plus** these workflow-specific checks before `upsert`:

1. **`configurationTypeId: 23`** at the body top level; conventional suffix `-footprintWorkflow.json`.
2. **Slot binding is real** — `workflowDefinitionId` + `workflowDefinitionName` copied from the [workflowsMetadata catalog](#discovering-the-slot-catalog-authoritative-source) for the slot; `apiSettingName` matches the branch's Footprint setting. Never invent the id/name.
3. **`workflowGUID` is correct for the operation** — a fresh v4 UUID you **generated** for a NEW config, or the **unchanged** existing value on an edit (never regenerate, never reuse another config's GUID).
4. **Param contract matches the slot** — single `Input` in-param typed with the slot's input type (usually `FootPrintWorkflow.<Slot>InputBaseWL`); out-params exactly as the slot dictates (or `[]` for before-commit mutation). No renamed/extra params.
5. **`description` present, non-empty, ≤ 100 chars** (SQL cap).
6. **`accessModifier` set** (`public` default); **`id: 0`** for net-new.
7. **Single `ExecuteCodeActivity` node**, `start` points at its `id`, `decisionConfig: null`, `vars`/`events`/`fromBaseConfiguration` `null` — unless you deliberately built a multi-node graph.
8. **Code is action-tier compliant** — `$flows.<Pkg>.<action>` (not functions, not `$db`), `fpds` footprint-datasources only, `$types.FootPrintWorkflow.*` for the platform shapes, `$utils.isDefined`. Declared-`outParams` slots use `return $flow.outParams;` (never bare `return;`).
9. **Types verified** against `contexts` or the metadata `types` — the `Input` fields and result fields you reference exist in `$types.FootPrintWorkflow.*`, not assumed.
10. **Validated** — `dxs configuration validate footprintworkflow` passes against the branch.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Invented or mismatched `workflowDefinitionId` / `workflowDefinitionName` | Pull the slot's `id`/`name` (and its `inParams`/`outParams`) from the [workflowsMetadata API](#discovering-the-slot-catalog-authoritative-source) and copy them verbatim. The id/name identify the slot; a wrong or mixed pair validates clean but never wires. |
| Cloned another config's `workflowGUID`, or regenerated it on an edit | The GUID is a unique, stable per-config reference **you own** — not part of the slot binding. Generate a fresh v4 UUID for a NEW workflow (`python3 -c "import uuid; print(uuid.uuid4())"`); on edits keep the existing value unchanged (the `jq .json` round-trip preserves it). |
| Renamed `Input`, added extra in-params, or changed the out-param shape | The slot owns the signature. Keep the single `Input: FootPrintWorkflow.<Slot>InputBaseWL` in-param and the slot's exact out-param contract (or `[]`). Mismatches validate clean but break the platform invoke / codegen. |
| Hand-wrote interfaces for the `Input`/result instead of using `$types.FootPrintWorkflow.*` | Read the real shapes from `dxs configuration contexts footprintworkflow -D body.json` and reference `$types.FootPrintWorkflow.*`. |
| Tried to call a function or use `$db` from the workflow | Workflow is action-tier. Call actions via `$flows.<Pkg>.<action>`; wrap any function/`$db` logic behind an action. Use `fpds` footprint-datasources, not cloud `-datasource.json`. |
| Bare `return;` in a slot that declares `outParams` | Use `return $flow.outParams;` for early exit — bare `return;` produces a broken function body that Validate misses and Preview catches. |
| Piped `get -O envelope.json` straight into `upsert -D` | Always `jq .json envelope.json > body.json` first — the envelope wipes content (and carries secrets). |
| Edited the minified `code` string by raw find/replace and corrupted the JSON | Edit via Python `json.load`/`json.dump`; build replacement strings with `\r\n` joins; never restructure surrounding JSON. |
| Treated `title` as user-facing and over-engineered it | Workflows are backend — `title` never reaches a screen. A short label or the `referenceName` is fine. |
| Authored against PublishedMain | Main configs are `readonly: true`. Author on a feature branch; confirm the branch id (never guess). |
| Put deep business logic inline in the node | Keep the node a thin dispatcher to package actions; it matches the library and keeps the workflow easy to reason about. |
