# Visualization (configurationTypeId 25, CLI type `visualization`)

> Stub reference doc — no component-creator skill exists for this type yet. See [`datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md) for the cti table and the "documented gap" note. Distilled from the one shipped instance org-wide plus its generated runtime context; fill the remaining `_TODO_`s once more instances exist to compare.

A visualization renders an interactive, code-driven 3D/2D scene (observed use case: a warehouse floor plan with dock doors) and lets flow code paint individual scene objects based on live data — there is no declarative datasource binding; the component is a blank canvas that `on_init` populates and `on_data_loaded` colors.

## Purpose & When to Use

Use a visualization when the UI needs to represent live operational state as positions/colors on a pre-built spatial model (e.g. "which dock doors are occupied right now") rather than as rows in a grid or fields in a form. It is not a general charting component — see [`datex-studio-shared`](SKILL.md)'s widget coverage for charts/KPI tiles. Only one instance has been observed org-wide (a dock-door floor plan), so breadth of use cases beyond that is `_TODO_ (only one instance observed)`.

## File Location & Naming

- CLI type: `visualization`.
- `configurationTypeId`: 25.
- File suffix: unconfirmed (`—` in the platform's own enumeration); conventionally inferred as `-visualization.json` by analogy with other types, not independently verified.
- Package default `Utilities`, `accessModifier: "public"`, `description` non-empty ≤100 chars — standard platform defaults, confirmed present on the one observed instance.

## Minimal Valid Skeleton

Reproduced (with values genericized) from the one live instance; top-level key order as observed:

```json
{
  "type": "warehouse",
  "toolbar": [],
  "flows": [],
  "onInitFlowConfig": null,
  "onDataLoadedFlowConfig": null,
  "configurationTypeId": 25,
  "id": 0,
  "referenceName": "example_visualization",
  "title": "Example visualization",
  "description": "One-line purpose under 100 chars.",
  "inParams": [],
  "accessModifier": "public"
}
```

The observed instance's actual `inParams` carried one entry: `{"id": "warehouse_id", "required": true, "type": "number", "isCollection": false, "isSecured": false}` — included here as a realistic shape, not a required field of the type itself.

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `type` | Discriminates the visualization's renderer/scene kind | Enum `VisualizationType`, four members: `warehouse`, `palletCartonization`, `vehicleLoading`, `yard` (designer labels: Warehouse, Pallet Cartonization, Vehicle Loading, Yard Visualization; captured from the Studio designer (option lists), dxs 0.5.8). Validate accepts all four and names the enum on a bad value. The designer's type dropdown offers only `warehouse`; the other three are disabled there. Only `"warehouse"` is observed in production — what the other three render is `_TODO_ (runtime unverified)` |
| `toolbar` | Toolbar buttons/separators hosted above the scene | Same shape as hub/grid toolbars — see Common Patterns |
| `flows` | Embedded flow definitions (cti 9 nodes) referenced by id from `onInitFlowConfig`/`onDataLoadedFlowConfig`/toolbar buttons | |
| `onInitFlowConfig` | `{flowId}` pointer into `flows[]`, run on load | Loads the scene model (see Common Patterns) |
| `onDataLoadedFlowConfig` | `{flowId}` pointer into `flows[]`, run after the model loads | Paints scene objects from live data |
| `configurationTypeId` | Component identity | `25` |
| `id` | Component identity | `0` for new |
| `referenceName` | Code-facing handle | Snake_case |
| `title` | Display title | Sentence case per [`naming-conventions.md`](../datex-studio-conventions/naming-conventions.md) |
| `description` | Searchable description | Non-empty, ≤100 chars |
| `inParams` | Caller-supplied inputs | Observed instance takes a single numeric `warehouse_id` |
| `accessModifier` | Visibility | `public` by default |

There is **no declarative datasource field anywhere in this skeleton** — the component is fully code-driven. Don't look for a `datasourceConfig` the way widgets/calendars have one; it doesn't exist on this type.

## Runtime Globals

Confirmed from the generated `visualizationContext` for the one observed instance:

```typescript
interface IVisualization {
  title: string;
  inParams: { warehouse_id: number };   // shape mirrors this instance's inParams
  events: {};
  toolbar: {
    refresh: IToolModel<IButtonModel>,
    separator1: IToolModel<IControlModel>,
    color_guide: IToolModel<IButtonModel>
    // ...one entry per toolbar item, keyed by its id
  };

  on_init(event?: any): Promise<any>;
  on_data_loaded(event?: any): Promise<any>;

  setVisualizationModel(model: string): Promise<void>;

  dockdoors: IVisDockdoor[];

  setMaterial(obj: IVisObject, material: IVisMaterial);
  get activeDockdoorMaterial(): IVisMaterial;
  get inactiveDockdoorMaterial(): IVisMaterial;
  normalizeValue(value: number): number;

  refresh();
  close();
}
```

Bound to the global `$visualization` inside this component's own flow code (`on_init`, `on_data_loaded`, toolbar click flows) — confirmed by the observed flow bodies calling `$visualization.setVisualizationModel(...)`, `$visualization.dockdoors.find(...)`, `$visualization.setMaterial(...)`.

- `dockdoors` is the only named scene-object collection observed. Whether other collections exist, and for which visualization types, is `_TODO_ (not exposed by the designer; runtime unverified)` — the designer's starter `on_init` example references only `$visualization.dockdoors`.
- The shapes of `IVisObject` (what a scene-object entry in `dockdoors[]` looks like beyond an `Id` property) and `IVisMaterial` (beyond the `{color: {r,g,b}, opacity}` literal used in the one observed call) were not independently declared anywhere in the generated context text searched — `_TODO_ (shape inferred only from call-site usage, not from a type declaration)`.
- `activeDockdoorMaterial` / `inactiveDockdoorMaterial` getters exist but no observed flow code reads them — `_TODO_ (runtime unverified)`.
- `normalizeValue(value: number): number` — purpose unconfirmed, no observed call site — `_TODO_`.
- `refresh()` / `close()` exist on the interface; the observed instance's "Refresh" toolbar button reuses the `on_data_loaded` flow directly rather than calling `$visualization.refresh()`, so `refresh()` itself is unverified at runtime — `_TODO_ (runtime unverified)`. Whether `close()` works despite being a dialog-closing style method on a component that (in the observed instance) isn't opened as a dialog is likewise `_TODO_ (runtime unverified)`.
- Renderer/engine details (what draws the scene, how a model's geometry is authored/uploaded, what `setVisualizationModel`'s `model: string` argument actually contains beyond "comes back from a datasource `.get()` call as `result?.Model`") are `_TODO_ (no further instance to compare; open question to the platform team)`.

## Invocation Contract

Only `inParams` were observed being supplied by a caller (a plain value-passing contract, same shape as any other component's inParams — see [`component-wiring-check/references/component-wiring.md`](../component-wiring-check/references/component-wiring.md) for the general rules). No `outParams`, `vars`, or `events` beyond the empty `events: {}` were present on the one instance, and no host component (hub/editor/dashboard) was observed embedding a visualization the way `widgets[]` embeds a widget — whether visualizations are typically opened as a standalone view/dialog vs. hosted inline is `_TODO_ (only one instance observed)`.

## Common Patterns

### Load a model, then paint it

`on_init` fetches a model via a standalone datasource and hands it to the component:

```typescript
if ($utils.isDefined($visualization.inParams.warehouse_id)) {
  const model = (await $datasources.<Pkg>.<ds>.get({ warehouse_id: $visualization.inParams.warehouse_id })).result?.Model;
  await $visualization.setVisualizationModel(model);
}
```

`on_data_loaded` then finds each scene object by id and paints it based on live data:

```typescript
const viz_dd = $visualization.dockdoors.find(item => item.Id === res_dd.Id);
if (viz_dd) {
  $visualization.setMaterial(viz_dd, { color: { r: 0, g: 0, b: 0 }, opacity: 0.5 });
}
```

### Legend as a label-only toolbar button

The observed instance uses a toolbar button with no `clickFlowConfig` purely to display static legend text next to the real "Refresh" button:

```json
{
  "id": "color_guide",
  "type": "button",
  "buttonConfig": {
    "label": "Green (Open) Red (Active) Yellow (Incoming) Black (Disabled)",
    "buttonDefaultStyleClass": "link",
    "readOnly": false, "disabled": false, "splitButton": false, "tooltip": "", "buttons": []
  }
}
```

### Refresh button reuses `on_data_loaded`

Rather than a dedicated refresh flow, the toolbar's "Refresh" button's `clickFlowConfig` points at the same `flowId` as `onDataLoadedFlowConfig` — re-running the paint step without reloading the model.

## Pre-Flight Checklist

1. Standard tail sanity: non-empty `description` ≤100 chars, `accessModifier` set — see [`datex-studio-conventions/universal-checklist.md`](../datex-studio-conventions/universal-checklist.md).
2. Don't look for a declarative datasource field on this type — model loading is 100% code, driven from `on_init`.
3. `type` is validated against a server-side enum (`VisualizationType`) but the validator never lists members — confirm any non-`"warehouse"` value against a real designer or a working instance before relying on it; don't guess.
4. If painting scene objects, confirm the object actually exists in the loaded model before calling `setMaterial` — the observed pattern always guards with `dockdoors.find(...)` returning truthy first.

## Cross-References

- [`datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md) — cti table and the "documented gap" note covering this type.
- [`datex-studio-runtime/runtime-globals.md`](../datex-studio-runtime/runtime-globals.md) — `$visualization` global entry (pending cross-cutting update).
- [`datex-studio-shared/footprint-queries.md`](footprint-queries.md) — sibling stub doc for the other roadmap types with no creator skill yet.

---
Distilled from the one production visualization component on a Footprint Manager package and its generated designer context, dxs 0.5.8.
