# Runtime Globals

Platform-injected globals available inside flow code. For *which* tier can call *what* (function ↔ action ↔ UI, datasource tier restrictions, storage access), see [calling-conventions.md](calling-conventions.md). This doc is the naming/shape reference; calling-conventions is the authoritative tier policy.

## Reference Table

| Global | Purpose |
|---|---|
| `$flow` | Current function/action context. `.inParams` / `.outParams` for I/O. |
| `$datasource` | Current footprint-datasource context (OData type). `.inParams` for declared inputs. Used inside the `value` of declarative `filters` expressions. **Note the singular** — different from `$datasources`. |
| `$flows` | Invoke other functions (or actions from actions) within accessible component packages. E.g. `$flows.Acme.some_function({ ... })` |
| `$apis` | Invoke actions from functions via the API layer. E.g. `$apis.Acme.FootprintApi.extendedActions.some_action({ ... })` |
| `$api` | **Built-in native actions, accessible across all packages** (not subject to package access boundaries). E.g. `$api.Shipments.CreateSalesOrderShipment({ ... })`. Distinct from `$apis` (plural), which is package-scoped. |
| `$types` | Access type definitions (interfaces and enums) from accessible packages. E.g. `$types.Acme.e_widget_strategy.FIRST` |
| `$datasources` | Datasource queries. E.g. `$datasources.Acme.fpds_get_widget.get({ widget_id: 123 })`. Syntax is uniform across both component variants (`-datasource.json`, `-footprintDatasource.json`) and both query types (OData, flow); callability is tier-restricted — see [calling-conventions.md](calling-conventions.md) and [datasources.md](../datasource-creator/references/datasources.md) for the taxonomy. |
| `$utils` | Platform-injected global utilities (`isDefined`, `isDefinedTrimmed`, `date`, `odata`, `http`, etc.). See [`$utils` Helpers](#utils-helpers--notable-semantics) below. |
| `$editor` | Current editor-component context. `.entity` (hydrated record, with `.isNew` for unsaved state), `.fields`, `.toolbar`, `.vars`, `.inParams`, `.outParams`. See [editors.md](../editor-creator/references/editors.md). |
| `$embed` | **UI-tier only.** Current embed-component context (single-`<iframe>` host). `.inParams` (values the opener passed), `.vars` (component-scoped state, declared in `vars[]`), `.outParams`. Opened via `$shell.open<referenceName>Dialog(...)` (package-scoped as `$shell.<Package>.open<referenceName>Dialog(...)` when registered under a module). See [embeds.md](../embed-creator/references/embeds.md). |
| `$db` | Cloud-storage (Mongo-backed) access to storage components (`-storage.json`). E.g. `$db.Acme.widget_rule_storage.sort({ created_on: "desc" }).toList()`. **Function-tier only** — see [calling-conventions.md](calling-conventions.md) and [storage.md](../storage-creator/references/storage.md). |
| `$services.jobs` | Scheduling primitive for cron-driven flow invocations. E.g. `$services.jobs.Acme.nightly_sweep_flow.schedule.list({ scheduleName })`, `.create(...)`, `.update(...)`, `.activate(id)`, `.deactivate(id)`. Paired with the `ScheduleConcurrency` enum (`cancel`, …). Function-tier. Schedule state is the source of truth for whether a recurring job is on — avoid parallel "is enabled" config flags that can drift. **Target flow must be registered as a job worker** to appear under `$services.jobs.<Package>.*`: set `enableProgressAndCancelation: true` and declare non-null `outParams` on the flow. A flow with `enableProgressAndCancelation: false` or `outParams: null` will be missing from the generated `$services.jobs.<Package>` type and any `.schedule.*` call against it fails to compile. |
| `$shell` | **UI-tier only.** Package-scoped dialog primitives invoked from hub/grid/form/editor code. Built-ins: `$shell.<Package>.openConfirmationDialog(title, body, continueText, cancelText)` → `Promise<boolean>` (resolves to the user's choice); `$shell.<Package>.openErrorDialog(title, message)` for a simple error alert; `$shell.<Package>.showErrorDetails(title, message, error)` for an error with a details pane. Forms and editors generate per-component openers named `$shell.<Package>.open<referenceName>Dialog(inParams?, layout?, size?)` — the return value is the target component's `outParams` object, so a form declaring `outParams: [{ id: "is_confirmed", ... }]` lets the caller do `const { is_confirmed } = await $shell.Acme.openwidget_option_formDialog('flyout', EModalSize.Standard)`. The `<Package>` segment reflects where the **target** component is registered: components under a package carry it (the target's module, never the caller's), while a **top-level application component has no package** and is opened without a segment, as `$shell.open<referenceName>Dialog(...)`. |
| `$frontendFlows` | **UI-tier only.** Invokes a frontend/client-side flow, a sibling to `$flows` whose body executes in the browser rather than on the cloud backend. E.g. `await $frontendFlows.Utilities.export_data_frontflow({ type, description, module_id, component_id, inputs, data })`. Same `<Package>.<flow_name>` shape as `$flows`; the distinction is where the flow runs. Used for UI-orchestration helpers (file download, Excel export/import dialogs, clipboard ops, etc.) that must run client-side. |
| `$operations` | **UI-tier permission checks.** Package-scoped gate on named operations assigned to the current user's role set. E.g. `if (await $operations.FootprintManager.Disable_Contact_Add.isAssignedToAll()) { $grid.canAdd = false; }`. Every registered operation exposes `.isAssignedToAll()` → `Promise<boolean>`. Typically called from `on_init` / `on_apply_operations` grid or hub flows to disable toolbar buttons, hide add/delete affordances, or gate navigation. Operations are declared elsewhere (not currently documented here) — referencing one pulls it from the package's registered operation list. |

## `$utils` Helpers — Notable Semantics

**`$utils.isDefined`** — returns `false` for `null`, `undefined`, **and empty arrays/strings** (not just nullish values). This means a guard like `if ($utils.isDefined(errors)) { throw new Error(errors.join('\n')); }` correctly skips empty error lists without needing a separate `.length > 0` check. Do not "fix" these guards by adding length checks — the helper is intentionally collection-aware.

**`$utils.isDefinedTrimmed`** — stricter string-oriented companion to `isDefined`. In addition to the nullish/empty cases `isDefined` already handles, it also returns `false` for **whitespace-only strings** (e.g. `"   "`, `"\t\n"`). Use this when a string field is semantically required but users might submit blanks that pass `isDefined`. For non-string inputs it behaves the same as `isDefined`.

**`$utils.date` argument order** — the platform's actual signatures are `$utils.date.add(value, unit, date)` and `$utils.date.endOf(unit, date)`: the value/unit come **before** the date, the opposite of most JS date libraries (moment/dayjs-style `date.add(value, unit)`). Writing `$utils.date.add(someDate, 7, 'day')` compiles against loose typings but computes garbage — always put the amount and unit first.

**`$utils.http` tier availability and base URL** — available at **both** the action tier and the function tier. Unlike `$db`, an http call does not force logic down to the function tier. **But the two tiers do not take the same URL.** An action runs inside the Footprint runtime and may pass a relative OData path (`Orders?$select=Id`); a function runs in the cloud backend, has no implicit base, and must build an absolute URL from `$settings`:

```typescript
const base = $settings.<Package>.FootprintApi.url;
const root = `${base}${base.endsWith('/') ? '' : '/'}Orders`;
const rows = ((await $utils.http.get(`${root}?$select=Id,OrderStatusId&$filter=...`)) as any)?.value ?? [];
```

A relative path in a function **compiles and validates**, then fails at runtime with `Invalid URL` — so `dxs configuration validate` cannot catch it, and neither can a validate probe. (This entry originally recorded only availability, established by exactly such a probe; the calling-convention difference cost a runtime failure on 2026-08-17.) Copy the pattern from a flow that already reads OData — `Utilities.get_uom_conversion_factors_flow`, `Allocations.get_location_coordinates_flow`, `SalesOrders.get_automation_candidate_orders_flow`.

## `$shell` Package Scoping — Cross-Package Dialogs

The `$shell` injected into flow code is **package-scoped**: flow code in package A cannot see `$shell.B` at all — the property is simply absent at runtime, so a `Utilities` frontend flow probing `$shell.SomeOtherPackage` gets `undefined` even though the target component exists and is public. Symptom: dialog-opening code that works inside its own package "stops working" the moment the target lives elsewhere.

The proven cross-package resolution pattern (browser tier):

1. Probe **every package context's `$shell`** from the global context registry — `globalThis.registry.contexts` (the app context first). If the registry hasn't been populated yet, rebuild it lazily via a helper frontend flow before probing.
2. Fall back to `window.$shell`, then the injected `$shell`.
3. Resolve the opener dynamically off whichever shell exposes the module: `(shell as any)[module_id]['open' + component_id + 'Dialog']` — the `as any` cast is required because openers are statically typed. Use direct property GETs to test existence, with key enumeration as casing recovery (module casing varies).
4. Detect whether a generated opener expects an inputs argument via `Function.length` — do **not** string-match parameter names, which are renamed in minified production builds.

Wrap this once in a shared `navigate`-style frontend flow (taking `module_id` + `component_id`) rather than repeating the probe at every call site.
