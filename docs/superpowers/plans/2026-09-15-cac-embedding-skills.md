# CAC Embedding Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Datex Studio skills in line with work item 253347 — a CAC can embed seven native component kinds, be placed as a Widget of type Custom Angular Component, gets per-target authoring rules, and its `dxs ng` preview loop now reports compile failures, logs, and preview inputs — with every rule stated once and every stale claim removed.

**Architecture:** All embedding and preview truth lives in one authoritative reference, `custom-angular-component-creator/references/custom-angular-components.md` (its `componentRefs` section is the doc's Invocation Contract slot per `docs/component-doc-template.md`); `SKILL.md` carries workflow pointers and Common-Mistakes rows that link back to it; `component-wiring-check` receives a short cross-reference only (DRY-at-skill-level). The change is walked through `docs/cli-release-checklist.md` (§1 behavior drift, §2 enumeration, §3 boilerplate sweep, §4 links) and lands **after** the platform and CLI releases it documents.

**Tech Stack:** Markdown skill files (skills.sh format: `SKILL.md` + `references/`), Git Bash for the repo's grep sweeps and the checklist's link script, git.

**Spec:** D:\Git\253347_cac_improvements\docs\superpowers\specs\2026-09-15-253347-cac-embedding-design.md

**Repo / branch:** worktree `D:\Git\skills-253347`, branch `feat/253347_cac_embedding`, base commit `6036bba` (clean). All line numbers below cite the files **as of that commit**; locate each edit by the quoted text (each quote is unique in its file) — later tasks shift line numbers.

## Global Constraints

- **Kind literals, canonical order, case-sensitive:** `selector, grid, editor, form, card, list, widget` — write them in exactly this order everywhere they are enumerated (they are `DesignerConfigTypeEnumToString` strings and lower-case into `ConfigurationEndpoints.KNOWN_TYPES`).
- **`moduleId` rule** (manifest key `module`): omitted/blank = the CAC's own application (host app, or the package the CAC lives in); a value = that module's reference name (the **target's** owning application). Same rule in codegen, .NET validation, the CLI resolver and these docs.
- **Generated surface per kind** (`<P>` = the target's application reference name: `app` for a host app, the package name inside a module): selector → `<P>-<ref>_single` / `<P>-<ref>_multi`, classes `<P>_<ref>_singleComponent` / `_multiComponent`, value-bound (`[(ngModel)]`/`[formControl]`, `[placeholder] [type] [styles] [tooltip] (displayTextChange)`, `[<inParamId>]`), no `refresh()`; grid/editor/form/card/list/widget → `<P>-<ref>`, class `<P>_<ref>Component`, file `./<P>.<ref>.component`, bind `[<inParamId>]` (grid inputs `any`, the rest typed), `(<eventId>)`, `(outParamsChange)` (only if outParams), `($refreshEvent)`, `($finish)`, `#ref` + `@ViewChild('ref', { read: <P>_<ref>Component })` → `refresh(skipParent, skipChildren, childToSkip)`.
- **CAC `refresh` override rule:** if the author defines it, it must be `refresh(skipParent = false, skipChildren = false, childToSkip: string = null)`; a CAC has no `$refreshChildren()` — forward to embedded children manually.
- **Mock keys** (`assets/harness-mocks.json`, `"<ds>.<method>"`): selector `getList`+`getByKeys`; grid `getList` (+`getByKeys`); list `getList`; editor/form `get`; widget `get` (fat number, gauges) or `getList` (pie); card none; owned datasources of an embedded component `"<embeddedRef>___<ds>.<method>"`.
- **Preview inputs:** `mocks/harness-inputs.json` = `{ "$container": "page|widget|dashboard-widget", "<inputId>": value, … }`; outside the IO signature (editing a value never re-scaffolds); `widget` frame = `.blade-wrapper > .blade-content > .datex-hub > (.hubdata + .widgets > .widget-container)` (hub and editor sizing identical), `dashboard-widget` = `.datex-dashboard > .section > .widgets > .widget-container`.
- **Widget type literal:** `EWidgetDesignerType.customAngularComponent`, Studio label `Custom Angular Component`, sub-config property **`customAngularComponentConfig`** (a `ReferenceConfig`: `configId`, `moduleId`, `configParameters`, `configOutParameters`, `outParamsChangeFlowConfig`); parameters mirror the CAC's and default-map to `$widget.inParams.<id>`; drift = `Outdated contract` at publish.
- **Error surfaces:** CLI `DXS-NG-056` (component reference preflight; message prefix `Component reference preflight failed:`; runs even with `--skip-connection-check`) and `DXS-NG-057` (harness compile failed; quotes the `✘ [ERROR]`/NG/TS lines; no screenshot); codegen `console.warn('[codegen][custom-angular] …')`; harness log `[codegen][harness] '<candidate>' component closure: …`; harness output lines `[harness][out] <id> <value>`; files `<folder>/.dxs-serve.log`, `<folder>/render.log`.
- **strictTemplates:** the harness (`dxs ng preview` and the save-time gate) and the real build all run `strictTemplates: true`; "preview and push are both strict".
- **`manifest.displayModes` is vestigial** (CLI always writes `["inline", "modal"]`, server never persists it, nothing reads it) — it must **not** be repurposed for the target; the target comes from requirements and is expressed via `"$container"`.
- **`componentRefs` DO round-trip** through `pull` (reconstructed from the persisted `componentReferences`); only `manifest.datasources`, `mocks/`, `node_modules` do not.
- **`$shell.open*` is inert in every harness build for every component** — there is no cross-module componentRef stub; a `module` ref materializes exactly like a same-app one.
- **Blast radius (skills):** per-kind table + markup examples live once in the CAC reference; `component-wiring-check` gets a short cross-reference; no new manifest field; no new skill; no new library file.
- **Landing order:** platform → CLI → skills. The CLI version checked against is recorded in the final commit message (checklist "Done means").
- **Repo rules (apply, do not restate):** never PowerShell — Bash/Read/Grep/Glob/Edit/Write only; "Datex Studio", never "Wavelength"; every commit stages **explicit paths** (`git add <path> <path>`), never `-A`/`.`; relative markdown links only (absolute `D:\…` paths break the checklist's link script — write them in backticks, not as links); keep the vendored design-system copy byte-identical (link to it, do not edit it).

## File Structure

| File | Action | Single responsibility |
|---|---|---|
| `skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md` | Modify | Authoritative CAC reference: `componentRefs` Invocation Contract (per-kind table, two markup examples, module rule, strictness, cross-module correction), `manifest.json` (example + `displayModes` note), mock coverage, **new** `mocks/harness-inputs.json` section, **new** "Authoring for a target" section, preview-loop corrections (E4), error table (`DXS-NG-056/057`) |
| `skills/datex-studio/custom-angular-component-creator/SKILL.md` | Modify | Workflow pointers only: description, embedding intro/clues, one-CAC rule, tab-content refresh signature, CLI lifecycle table, workflow diagram, Phase 1 target pointer, Phase 2 tree, Phase 3 seeding order, Phase 4 failure surfaces, Phase 5 `DXS-NG-056` gate, Pre-Flight items, round-trip correction, Common-Mistakes rows |
| `skills/datex-studio/component-wiring-check/references/component-wiring.md` | Modify | One short section: how the audit applies to CAC `componentReferences` (module rule, no `configParameters` mirror, three checks) linking to the CAC table |
| `skills/datex-studio/component-wiring-check/SKILL.md` | Modify | One References bullet, one Diagnostic-Index row, `depends:` entry for the linked skill |
| `docs/cli-release-checklist.md` | Modify | §2 table row: the embeddable-kind enumeration and its regeneration command |
| `docs/superpowers/plans/2026-09-15-cac-embedding-skills.md` | Create (this file) | The plan |

---

### Task 1: Reference doc — `componentRefs` Invocation Contract rewrite (item 2)

**Files:**
- Modify: `D:\Git\skills-253347\skills\datex-studio\custom-angular-component-creator\references\custom-angular-components.md` — lines 113 (coverage-gap paragraph), 117–137 (`## manifest.json` intro + example + trailing paragraph), 139–156 (`### componentRefs — embedding another component` through the cross-module paragraph), 160–162 (`## The light harness` — the "only your candidate" sentences), 187–197 (error table: add the `DXS-NG-056` row)
- Test: grep sweep (below) over the same file

**Interfaces:**
- Consumes (CLI plan `D:\Git\datex-studio-cli-253347\docs\superpowers\plans\2026-09-15-cac-embedding-cli.md`): `EMBEDDABLE_KINDS` = the seven kinds; `ValidationError(code="DXS-NG-056", message="Component reference preflight failed:\n  …")` with suggestions `dxs configuration list <kind> -b <branch>` / the module rule / `dxs ng preview <folder> --refresh -b <branch>`; `ManifestComponentRef` validators strip `name`/`kind` and normalize blank `module` → `None`; `data generate` warnings "run `dxs ng preview --refresh -b <branch>` first" and "not materialized; will not render; not seeded".
- Consumes (codegen plan `D:\Git\253347_cac_improvements\docs\superpowers\plans\2026-09-15-cac-embed-native-codegen.md`): `getComponentReferenceImports(moduleRef, referenceName, kind)` naming (`<moduleRef>_<ref>Component` from `./<moduleRef>.<ref>.component`; selector `_single`/`_multi` pair); `console.warn('[codegen][custom-angular] <app>.<cac>: componentReference '<name>' has unsupported kind '<k>' (supported: …)')`; the CAC template's `imports: [SharedModule, forwardRef(() => <class>)…]` (`custom-angular.component.hbs:38`, unchanged).
- Consumes (.NET plan `D:\Git\253347_cac_improvements\docs\superpowers\plans\2026-09-15-cac-reference-validation.md`): server messages `Embedded component '{name}': kind '{k}' is not supported. Allowed: selector, grid, editor, form, card, list, widget`, `Duplicate embedded component reference '{module.}{name}'`, existence-only contracts with `expectedConfigurationTypeId`.
- Produces (for Tasks 2–6): headings/anchors `### \`componentRefs\` — embedding another component` (`#componentrefs--embedding-another-component`), `#### Generated surface per kind` (`#generated-surface-per-kind`), `#### Two binding families — markup` (`#two-binding-families--markup`), `#### What to read in the harness`, `#### Preview and push are both strict`, `#### Cross-module refs materialize like same-app refs`; the literal enumeration string `selector, grid, editor, form, card, list, widget`; the `DXS-NG-056` table row.

- [x] **Step 1: Write the failing check (grep sweep) and run it — expect the stale lines to print**

```bash
cd "D:/Git/skills-253347"
F=skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
# stale claims that must disappear (expected after Task 1: NO output)
grep -n "compilable-but-inert\|may not materialize in the harness\|kind\": \"selector\", \"module\": \"<moduleRefName>\"\|silently skipped when its branch resolution fails\|only\*\* the candidate component is a real" "$F"
# new content that must appear (expected after Task 1: 2 or more / 1 / 1 / 1 — the kind bullet and the DXS-NG-056 row)
grep -c "selector, grid, editor, form, card, list, widget" "$F"
grep -c "^#### Generated surface per kind" "$F"
grep -c "^#### Two binding families — markup" "$F"
grep -c "| \`DXS-NG-056\` |" "$F"
```

Expected now (failure): the first grep prints lines 113, 141, 149, 151, 160 (the stale phrases); the counts print `0`, `0`, `0`, `0`.

- [x] **Step 2: Replace the coverage-gap paragraph (line 113)**

Replace this exact paragraph:

```
**Coverage gaps to check by hand.** `dxs ng data generate` does not seed a key for every reference: `$frontendFlows` refs aren't seeded at all, and a componentRef selector's backing datasource is silently skipped when its branch resolution fails during generation (no error, no key). After generating, open the file and confirm every datasource the component — and any embedded componentRef selector — reads has a key; add whatever is missing by hand.
```

with:

```
**Coverage gaps to check by hand.** `dxs ng data generate` reads the **materialized harness** — every generated `*.component.ts`, your CAC's and its embedded components' — and seeds one `"<ref>.<method>"` key per datasource call it finds, so embedded grids, editors, forms, lists and widgets are seeded together with your own calls. Run it **after** `preview --refresh`, never before: it tells you when the harness predates your `componentRefs`. It still does not seed: `$frontendFlows` (never mocked, see below); the **field shapes** of an embedded component's *owned* datasources (`"<ref>___<ds>.<method>"` — the key is written, the payload is empty); anything reached only through `$shell.open*`. It warns when a `componentRef` was not materialized (that component will not render and was not seeded). After generating, open the file, fill the payloads, and add any key it flagged.
```

- [x] **Step 3: Replace the `## manifest.json` section (lines 117–137)**

Replace from the line `## \`manifest.json\`` through the line ending `(\`referenceName\`, \`title\`, \`inParams\`, \`outParams\`).` with:

````
## `manifest.json`

Carries the component's identity + IO + declared datasource/flow refs + embedded component refs. `push` uses it to build the type-36 config; changes to IO (new `@Input`/`@Output`) or to `componentRefs` need codegen re-wiring, so re-preview with `--refresh -b <branch>` after editing it. The `datasources` array only *declares* dependencies — it never creates the datasource. Create it with `datasource-creator` on the branch **first** (ideally before materializing) so the harness types the `$datasources.<ref>` stub the body compiles against; see [Reading real data](#reading-real-data-via-datasources).

```json
{
  "displayName": "Outbound Command Center",
  "name": "OutboundCommandCenter",
  "selector": "app-outbound-command-center",
  "displayModes": ["inline", "modal"],
  "inputs":  [ { "name": "warehouseId", "type": "string", "required": false } ],
  "outputs": [ { "name": "cardClick", "type": "any" } ],
  "datasources": [],
  "componentRefs": [
    { "name": "status_dd", "kind": "selector" },
    { "name": "orders_grid", "kind": "grid", "module": "SalesOrders" }
  ]
}
```

The config `title` and `description` are derived from `displayName` — keep `displayName` ≤ 100 chars (platform column limit). `pull` builds `manifest.json` from the config's stored properties (`referenceName`, `title`, `inParams`, `outParams`, `componentReferences`) — so `componentRefs` **round-trip**; `datasources` does not (see [SKILL.md → Phase 2](../SKILL.md#phase-2-materialize-the-harness)).

**`displayModes` is vestigial.** The CLI always writes `["inline", "modal"]`, the server never persists it, and nothing reads it. Leave it as written and never repurpose it — in particular it does **not** say where the CAC will live (widget / tab / page); that comes from the requirements step and is expressed in preview through `"$container"` in `mocks/harness-inputs.json` (see [Authoring for a target](#authoring-for-a-target)).
````

- [x] **Step 4: Replace the `componentRefs` section (lines 139–156)**

Replace from the line `### \`componentRefs\` — embedding another component` through the line `after \`push\`.` (the end of the "Cross-module refs may not materialize in the harness" paragraph) with:

````
### `componentRefs` — embedding another component

A CAC can embed any of **seven** app-generated component kinds. Each entry:

```json
{ "name": "<referenceName>", "kind": "<selector | grid | editor | form | card | list | widget>", "module": "<owning module — omit for your own application>" }
```

- **`kind`** is one of exactly `selector, grid, editor, form, card, list, widget` — lower-case, case-sensitive. Anything else is rejected at `push` (`DXS-NG-056`) and by the server validator (`Embedded component '<name>': kind '<k>' is not supported. Allowed: selector, grid, editor, form, card, list, widget`); in the harness an unknown kind is dropped with a `[codegen][custom-angular]` warning and the tag then fails to compile (`NG8001`).
- **`module`** is the reference name of the application that **owns the target**. Omit it (or leave it blank — the CLI normalizes `""` to omitted) when the target lives in your own application: the host app, or the package the CAC itself lives in. Set it when the target lives in another module. Never set it to the CAC's own module "to be explicit" — it is the same rule every component reference in Studio follows (`moduleId` = the target's package; see [component-wiring.md](../../component-wiring-check/references/component-wiring.md#cross-component-references-use-the-targets-module)).
- A `componentRefs` change is an IO-level change: `dxs ng preview <folder> --refresh -b <branch>` re-materializes the harness with the embedded component, its own dependencies (column selectors, tab content, row-expand components) and its context service generated. Then `dxs ng data generate <folder> -b <branch>` seeds its datasource keys, then `preview`.

#### Generated surface per kind

`<P>` is the reference name of the **target's** application — `app` for a host app, the package name for a component in a module (a same-app ref in a host app is `app-…`; a ref with `"module": "SalesOrders"` is `SalesOrders-…`). It is also the prefix of the generated file `angularapp/src/app/<P>.<ref>.component.ts`. The class is **already imported by codegen** — never re-import it in `__COMPONENT_TYPES__` (that is `TS2300: Duplicate identifier`).

| `kind` | Tag(s) | Class | Binding family | Mock keys `data generate` seeds |
|---|---|---|---|---|
| `selector` | `<P>-<ref>_single` and `<P>-<ref>_multi` (both generated, both imported) | `<P>_<ref>_singleComponent` / `<P>_<ref>_multiComponent` | **Value-bound control:** `[(ngModel)]` or `[formControl]`; `[placeholder]`, `[type]`, `[styles]`, `[tooltip]`, `(displayTextChange)`; one `[<inParamId>]` per datasource parameter. No `refresh()`, no `($refreshEvent)`. | `<ds>.getList`, `<ds>.getByKeys` |
| `grid` | `<P>-<ref>` | `<P>_<ref>Component` | **inParams + refresh:** `[<inParamId>]` (grid inputs are typed `any`); `(<eventId>)`; `(outParamsChange)` (only if the grid declares outParams); `($refreshEvent)`; `($finish)`; `#ref` + `@ViewChild('ref', { read: <P>_<ref>Component })` to call `refresh(skipParent, skipChildren, childToSkip)` | `<ds>.getList` (+ `<ds>.getByKeys` for row reload) |
| `editor` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; inputs **strongly typed**; `(<eventId>)`, `(outParamsChange)` (if outParams), `($refreshEvent)`, `($finish)` | `<ds>.get` |
| `form` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; typed inputs; `(<eventId>)`, `(outParamsChange)` (if outParams), `($refreshEvent)`, `($finish)` | `<ds>.get` (only if the form has a datasource) |
| `card` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; typed inputs; `(<eventId>)`, `(outParamsChange)` (if outParams), `($refreshEvent)`, `($finish)` | none (a card reads through its tabs/fields) |
| `list` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; typed inputs; `(<eventId>)`, `(outParamsChange)` (if outParams), `($refreshEvent)`, `($finish)` | `<ds>.getList` |
| `widget` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; typed inputs; `(outParamsChange)` (pie chart only); `($refreshEvent)`; `($finish)`. No per-event outputs. | `<ds>.get` (fat number, gauges) or `<ds>.getList` (pie) |

Datasources the embedded component *owns* are keyed `"<ref>___<ds>.<method>"`. Everything in the table is derived from the generated code — when in doubt, read the file (below), never guess.

#### Two binding families — markup

**Value-bound (selector).** The tag is a form control; bind the value, not inParams-and-refresh:

```html
<!-- same-app selector in a host app: <P> = app -->
<app-status_dd_single [(ngModel)]="statusId"
                      placeholder="Status"
                      [warehouseId]="inParams.warehouseId"
                      (displayTextChange)="statusText = $event">
</app-status_dd_single>
```

**inParams + refresh (grid, editor, form, card, list, widget).** The tag takes one input per inParam and emits the tab-content events — the same shape codegen writes for a hub/editor tab:

```html
<!-- grid owned by the SalesOrders module: <P> = SalesOrders -->
<SalesOrders-orders_grid #ordersGrid
                         [warehouseId]="inParams.warehouseId"
                         (outParamsChange)="onGridOut($event)"
                         ($refreshEvent)="refresh(false, true, null)">
</SalesOrders-orders_grid>
```

```ts
//#region __COMPONENT_BODY__
// ViewChild is already imported by the generated header, and SalesOrders_orders_gridComponent is
// already imported by codegen because the ref resolved — declare nothing in __COMPONENT_TYPES__.
@ViewChild('ordersGrid', { read: SalesOrders_orders_gridComponent }) ordersGrid: SalesOrders_orders_gridComponent;
statusId: string = null;
statusText = '';
selectedOrderId: number = null;

onGridOut($event: any) { this.selectedOrderId = $event?.selectedOrderId ?? null; }

// The sanctioned refresh override — this exact signature. A tab host calls it with three arguments
// through a typed @ViewChild, so any other arity fails the host's compile (TS2554). A CAC has no
// $refreshChildren(): forward to embedded children yourself.
refresh(skipParent = false, skipChildren = false, childToSkip: string = null) {
  if (skipParent === false) { this.$refreshEvent.emit(); }
  if (skipChildren === false) { this.ordersGrid?.refresh(true, false, null); }
  return Promise.resolve(null);
}
//#endregion __COMPONENT_BODY__
```

`($refreshEvent)="refresh(false, true, null)"` on the child means "when the grid asks its parent to refresh, refresh me but do not bounce back down into my children" — the wrapper-widget pattern (spec A9). Generated tab hosts instead pass the calling child's id: `refresh(false, false, '$tabs_<id>')` (tabs.html.partial.hbs:68); either form is acceptable in a CAC, the point is not to re-refresh the child that raised the event. Declare only the component you place in your template: its own dependencies (column selectors, tab content, row-expand components, its context service) are generated automatically.

#### What to read in the harness

- `angularapp/src/app/<P>.<ref>.component.ts` — `selector:` is the tag; `@Input('<id>')` setters are the inputs; `@Output()` members are the events. For a selector read `<P>.<ref>_single.component.ts` / `<P>.<ref>_multi.component.ts`.
- Your own `angularapp/src/app/<P>.<cacRef>.component.ts` — the `@Component` `imports:` array must contain one `forwardRef(() => <class>)` per resolved ref (two for a selector). **If the class is not in that list, the ref did not resolve** (wrong `name`, `kind`, or `module`): fix `manifest.json` and run `preview --refresh -b <branch>`. Do not add the import yourself.
- An embedded component whose **required** inParam you did not bind renders a `Please provide <id>` block (grid, editor, form, card, pie/gauge widgets), a disabled control (selector), or its empty state (list, fat-number widget). That is the harness telling you to bind the input — or, when it comes from the CAC's own input, to give it a value in `mocks/harness-inputs.json` — not a rendering bug.

#### Preview and push are both strict

The harness compiles with `strictTemplates: true` — the **same** strictness as the real app build. A type-wrong binding on a typed input (editor/form/card/list/widget) or an unknown tag fails `dxs ng preview` with `DXS-NG-057` quoting the compiler line (`NG8001` unknown element, `NG8002` unknown property, `TS2322` type mismatch). Nothing that previews green fails the server's compile gate for a template reason. What preview cannot check is *existence on the branch* and *kind* — `push` checks those first (`DXS-NG-056`).

#### Cross-module refs materialize like same-app refs

A ref with `module` set generates exactly like a same-app one — tag `<Module>-<ref>`, class `Module_<ref>Component` — and previews as a real, bindable component. There is no cross-module stub. What *is* a stub in every harness build, for every component, is `$shell.open<X>…`: the harness's shell service returns inert openers because only your candidate and its closure are generated — unrelated to `componentRefs`. Cross-module mistakes surface as: the class missing from your `imports:` list, `DXS-NG-057` (`NG8001`) in preview, and `DXS-NG-056` at push (whose message names the owning package it did find).
````

- [x] **Step 5: Correct the "only your candidate" sentences in `## The light harness` (lines 160–162)**

Replace:

```
`create`/`pull` don't download the whole generated app. The server generates a **light harness**: **only** the candidate component is a real, fully-generated component + the real typed `$`-context services + mock-reading stub services + a minimal bootstrap — with the other components, the MSAL auth shell, and routing pruned out.
```

with:

```
`create`/`pull` don't download the whole generated app. The server generates a **light harness**: the candidate component **plus the components it embeds via `componentRefs` and their own dependencies** (each with its context service) are real, fully-generated components + the real typed `$`-context services + mock-reading stub services + a minimal bootstrap — with every other component, the MSAL auth shell, and routing pruned out. The harness log line `[codegen][harness] '<candidate>' component closure: …` lists what was generated.
```

and replace:

```
Because only your candidate is real, the full typed surface is still there for authoring — `$datasources`/`$flows`/`$frontendFlows`/`$types` reflect the **real branch** (discover and reuse any of them), and `$shell` exposes every `open<X>Dialog`/`open<X>` — but calls to **other** components (e.g. `$shell.open<X>Dialog(...)`) are compilable, discoverable **stubs**: they won't actually open that dialog/view in preview. Your own component's UI and its `$datasources`/`$flows` reads (served from `mocks/`) are fully live.
```

with:

```
Because only that closure is real, the full typed surface is still there for authoring — `$datasources`/`$flows`/`$frontendFlows`/`$types` reflect the **real branch** (discover and reuse any of them), and `$shell` exposes every `open<X>Dialog`/`open<X>` — but `$shell.open<X>…` calls to **any** component are compilable, discoverable **stubs** in every harness build: they won't actually open that dialog/view in preview. Your own component's UI, its embedded components, and their `$datasources`/`$flows` reads (served from `mocks/`) are fully live.
```

- [x] **Step 6: Add the `DXS-NG-056` row to the error table (lines 187–197)**

Insert directly after the row that begins `| \`DXS-NG-047\` |`:

```
| `DXS-NG-056` | `push` component reference preflight failed: a `manifest.componentRefs` entry has an unsupported `kind`, a duplicate `(name, module)`, an empty name, or names a component that does not exist in that module on the branch (runs even with `--skip-connection-check`) | fix `manifest.json` — `kind` ∈ `selector, grid, editor, form, card, list, widget`, `module` = the target's owning module (omit for your own app); find it with `dxs configuration list <kind> -b <branch>`; then `dxs ng preview <folder> --refresh -b <branch>` and push again |
```

- [x] **Step 7: Re-run the check — expect no stale lines and the counts `2` (or more), `1`, `1`, `1`**

```bash
cd "D:/Git/skills-253347"
F=skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
grep -n "compilable-but-inert\|may not materialize in the harness\|kind\": \"selector\", \"module\": \"<moduleRefName>\"\|silently skipped when its branch resolution fails\|only\*\* the candidate component is a real" "$F"
grep -c "selector, grid, editor, form, card, list, widget" "$F"
grep -c "^#### Generated surface per kind" "$F"
grep -c "^#### Two binding families — markup" "$F"
grep -c "| \`DXS-NG-056\` |" "$F"
```

Expected: first command prints nothing; then `2` (or higher; the kind list sits on the `kind` bullet and the DXS-NG-056 row), `1`, `1`, `1`.

- [x] **Step 8: Commit**

```bash
git -C "D:/Git/skills-253347" add skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
git -C "D:/Git/skills-253347" commit -m "docs(cac): componentRefs contract for seven embeddable kinds" -m "Rewrite the componentRefs section as the Invocation Contract: kind allow-list (selector, grid, editor, form, card, list, widget), module rule, per-kind tag/class/binding/mock table, selector vs inParams+refresh markup, what to read in the harness, strictness note, and the cross-module correction (no stub; \$shell.open* is inert everywhere). Update the manifest example, the displayModes note, the mock coverage paragraph, the light-harness closure sentences, and add the DXS-NG-056 row." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Reference doc — preview-loop corrections and `mocks/harness-inputs.json` (E4)

**Files:**
- Modify: `D:\Git\skills-253347\skills\datex-studio\custom-angular-component-creator\references\custom-angular-components.md` — lines 34–35 (folder tree), 98–111 (`## Mock data` heading + lookup sentence; **insert** a new `## Preview inputs and host frame` section after the `$frontendFlows` paragraph at line 115), 164–180 (`## Preview & the screenshot loop`), 182–197 (error table rows `DXS-NG-042`, `DXS-NG-053`, `DXS-NG-052`; add `DXS-NG-057`), 205 (degraded-path paragraph)
- Test: grep sweep (below)

**Interfaces:**
- Consumes (CLI plan E1/E2/E3): `_ensure_ng_serve` writes `<folder>/.dxs-serve.log` and the `DXS-NG-042` message includes its last ~40 lines; `preview()` waits for this run's `Application bundle generation complete|failed` marker bounded by `DXS_NG_SERVE_TIMEOUT` (default 120s) and raises `DXS-NG-057` ("harness compile failed") with the `✘ [ERROR]`/NG/TS lines and takes no screenshot; `_screenshot` captures the mount element (`--full` fallback) and writes agent-browser `console` + `errors` to `<folder>/render.log`, adding `console_log` to the output record; `_copy_fixtures` copies `harness-mocks.json` + `harness-inputs.json` (`{}` when absent) and warns locally on undeclared keys, missing required inputs, unknown `$container`; `data generate` writes the `mocks/harness-inputs.json` skeleton via `typed_placeholder` under `--force`.
- Consumes (codegen plan E2): `main.harness.hbs` reads `/assets/harness-inputs.json`, binds inputs before first change detection (`inputBinding`), logs outputs as `console.info('[harness][out]', id, v)`, warns on unknown keys, and wraps the mount element for `$container` ∈ `page` (default) | `widget` | `dashboard-widget`.
- Produces: heading `## Preview inputs and host frame — \`mocks/harness-inputs.json\`` (anchor `#preview-inputs-and-host-frame--mocksharness-inputsjson`) referenced by Tasks 3–5; the `DXS-NG-057` row; the fixed order sentence `preview --refresh` → `data generate` → `preview`.

- [x] **Step 1: Write the failing check and run it**

```bash
cd "D:/Git/skills-253347"
F=skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
# stale claims (expected after Task 2: NO output)
grep -n "Type/template errors surface in the render\|not your code\|90s headroom\|drive it via an \`@Input\`/mock\|a real compile failure shows up as \`DXS-NG-042\`" "$F"
# new content (expected after Task 2: 1 / 1 / 1 / 2 or more)
grep -c "^## Preview inputs and host frame" "$F"
grep -c "| \`DXS-NG-057\` |" "$F"
grep -c "mocks/harness-inputs.json *# values" "$F"
grep -c "render.log" "$F"
```

Expected now (failure): the first grep prints lines 174, 176, 180; the counts print `0`, `0`, `0`, `0`.

- [x] **Step 2: Update the folder tree (lines 34–35)**

Replace:

```
  manifest.json                       # identity + IO + datasource/flow refs + displayModes
  mocks/harness-mocks.json            # fixtures the preview's $datasources/$flows read
```

with:

```
  manifest.json                       # identity + IO + datasource/flow refs + componentRefs (+ vestigial displayModes)
  mocks/harness-mocks.json            # fixtures the preview's $datasources/$flows read
  mocks/harness-inputs.json           # values for the CAC's own @Inputs + the "$container" host frame
  render.png / render.log / .dxs-serve.log   # written by `preview`: screenshot, browser console+errors, dev-server output
```

- [x] **Step 3: Insert the preview-inputs section after the `$frontendFlows` paragraph (line 115)**

Insert immediately after the paragraph that begins `**\`$frontendFlows\` are never mocked.**` (and before `## \`manifest.json\``):

````
## Preview inputs and host frame — `mocks/harness-inputs.json`

`dxs ng data generate` also writes `mocks/harness-inputs.json`: one key per manifest input (a typed placeholder) plus the reserved `"$container"` directive. `preview` copies it next to the mocks into the harness assets, and the harness bootstrap binds each value to the matching `@Input` **before** the first change detection — so your `ngOnChanges`/`ngOnInit` see real values exactly as they would under a tab or widget host. Every output the CAC emits is logged as a `[harness][out] <id> <value>` line in `render.log`.

```json
{
  "$container": "widget",
  "warehouseId": "WH-01",
  "orderId": 12345
}
```

- Keys are the manifest `inputs[].name`s; `type`/`required` stay in `manifest.json`, **values** live here. Editing a value is a local, warm edit — no `--refresh` (the file is deliberately outside the IO signature). `preview` warns locally on a key that is not a declared input, a `required` input with no key, and an unknown `$container`.
- `"$container"` picks the host frame the harness wraps the mounted element in: `"page"` (default — bare, as a shell view), `"widget"` (`.blade-wrapper > .blade-content > .datex-hub > .widgets > .widget-container` — the identical 200px box a hub **or** editor gives a widget), `"dashboard-widget"` (`.datex-dashboard > .section > .widgets > .widget-container`). Set it from the target you established in requirements (see [Authoring for a target](#authoring-for-a-target)).
- The CAC has **no** built-in `Please provide …` gate: an unfed required input renders whatever your template renders with `undefined`. If the preview is blank, check this file before the code.
````

- [x] **Step 4: Rewrite `## Preview & the screenshot loop` (lines 164–180)**

Replace from the line `## Preview & the screenshot loop` through the paragraph ending `(Contrast: a real compile failure shows up as \`DXS-NG-042\` \`ng serve did not become ready\`, not \`DXS-NG-053\`.)` with:

````
## Preview & the screenshot loop

```bash
dxs ng preview <folder>              # serve locally + screenshot -> <folder>/render.png (+ render.log)
dxs ng preview <folder> -o out.png   # custom output path
dxs ng preview <folder> --refresh -b <branch>   # after a manifest IO / componentRefs change
dxs ng preview <folder> --clean      # kill a stuck server + reset the browser session, then rebuild
dxs ng stop <folder>                 # stop-only disposal: server + browser session + lock (idempotent)
```

`preview` copies `mocks/` (`harness-mocks.json` + `harness-inputs.json`) into the harness assets, runs `npm install` once, warms `ng serve` (its output goes to `<folder>/.dxs-serve.log`), waits for the build marker of **this** run, and drives a headless browser to screenshot the mounted component. Read the PNG, compare to the target, edit, re-run — the loop is the acceptance test for bespoke UI.

**The order after a `componentRefs` or IO change is fixed:** `dxs ng preview <folder> --refresh -b <branch>` (materialize the embedded components) → `dxs ng data generate <folder> -b <branch>` (seed their datasource keys and the inputs skeleton) → fill values → `dxs ng preview <folder>`. `data generate` before `--refresh` reads a stale harness and tells you so.

**Where failures show up.**

- **Compile/template errors are `DXS-NG-057` (`harness compile failed`)**, not a picture: `preview` reads `.dxs-serve.log`, finds this run's `Application bundle generation failed` marker, quotes the `✘ [ERROR]` / `NG…` / `TS…` lines, and takes **no** screenshot — `render.png` is never a stale bundle. `NG8001` (unknown element) = a `componentRefs` entry did not resolve or the tag is misspelled; `NG8002` = wrong binding family or a misspelled input; `TS2300` = you re-imported an embedded class; `TS2554` = a `refresh` override with the wrong arity.
- **`ng serve` never became ready is `DXS-NG-042`**, now carrying the last ~40 lines of `.dxs-serve.log`. Usually a long cold compile — extend `DXS_NG_SERVE_TIMEOUT` (seconds), re-run, `--clean` if it persists.
- **Runtime problems** (an exception in `ngOnInit`, an `undefined` read, a missing mock key) leave `preview` green and the PNG wrong: read `<folder>/render.log` — the browser console + errors from the render, including the `[harness][out] <output> <value>` lines for every output your CAC emitted.
- **Browser-step failures (`DXS-NG-053` timeout, `DXS-NG-052` other, `DXS-NG-050`/`DXS-NG-055` install)** are raised only after the build succeeded. First move `--clean`, then re-run; if it persists, read `render.log` and `.dxs-serve.log` before touching code, and report a reproducible one as a CLI issue.

`preview` captures the component's **default** rendered state — it doesn't interact. When a mode/variant is switched by in-component UI (not an `@Input`), temporarily set that default to screenshot each variant; when it is driven by an `@Input`, set the value in [`mocks/harness-inputs.json`](#preview-inputs-and-host-frame--mocksharness-inputsjson) (warm, local — no `--refresh`).

**`render.png` is the mounted element**, captured at the harness's default viewport width (so the 1200px responsive rules — including the widget box — behave as in the app), falling back to a viewport capture. It cannot see content hidden inside your own `overflow-y: auto` region; that is faithful to the host, not a bug. To inspect such content, drive `agent-browser` against the served port (`<folder>/.dxs-serve.lock`) and scroll the region: `agent-browser open http://127.0.0.1:<port>` → `wait '<css>'` → `scroll`/`click` → `screenshot out.png`.
````

- [x] **Step 5: Update the error table rows (lines 187–197)**

Replace the row beginning `| \`DXS-NG-042\` |` with:

```
| `DXS-NG-042` | `ng serve` didn't become ready (the message ends with the last ~40 lines of `<folder>/.dxs-serve.log`) | read those lines; extend `DXS_NG_SERVE_TIMEOUT`; re-run; `--clean` if it persists (on CLI ≤0.4.13 also caused by a relative folder argument — pass an absolute path) |
```

Replace the row beginning `| \`DXS-NG-053\` |` with:

```
| `DXS-NG-053` | agent-browser step timed out (raised only after the harness built) | `--clean`, re-run; then read `render.log` / `.dxs-serve.log` |
```

Insert directly after the row beginning `| \`DXS-NG-055\` |`:

```
| `DXS-NG-057` | harness compile failed — this run's build marker was `Application bundle generation failed`; the message quotes the `✘ [ERROR]`/`NG…`/`TS…` lines; no screenshot was taken | fix the quoted line (`NG8001` unresolved ref/tag, `NG8002` wrong binding, `TS2300` re-imported class, `TS2554` `refresh` arity); re-run `preview` |
```

- [x] **Step 6: Update the degraded-path paragraph (line 205)**

Replace:

```
**Degraded-but-honest path when the screenshot step stays blocked:** the visual loop is the acceptance test, but it is not the only gate — `ng serve` becoming ready proves the component compiles (that's the step *before* the browser), and `dxs ng push` still runs the server-side validator.
```

with:

```
**Degraded-but-honest path when the browser step stays blocked (`DXS-NG-053`/`052`/`050`/`055` after `--clean`):** the visual loop is the acceptance test, but it is not the only gate — a `preview` that got past the build marker without `DXS-NG-057` proves the component compiles under `strictTemplates` (that's the step *before* the browser), `render.log` may still exist from the last successful capture, and `dxs ng push` still runs its two preflights and the server-side validator.
```

- [x] **Step 7: Re-run the check — expect no stale lines and the counts `1`, `1`, `1`, `2`+**

```bash
cd "D:/Git/skills-253347"
F=skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
grep -n "Type/template errors surface in the render\|not your code\|90s headroom\|drive it via an \`@Input\`/mock\|a real compile failure shows up as \`DXS-NG-042\`" "$F"
grep -c "^## Preview inputs and host frame" "$F"
grep -c "| \`DXS-NG-057\` |" "$F"
grep -c "mocks/harness-inputs.json *# values" "$F"
grep -c "render.log" "$F"
```

Expected: nothing; `1`; `1`; `1`; a number ≥ `2`.

- [x] **Step 8: Commit**

```bash
git -C "D:/Git/skills-253347" add skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
git -C "D:/Git/skills-253347" commit -m "docs(cac): preview loop reports compile failures, logs, and inputs" -m "Document DXS-NG-057 (harness compile failed, no stale screenshot), .dxs-serve.log and render.log, the mocks/harness-inputs.json fixture with the \$container host frame, and the fixed order preview --refresh -> data generate -> preview. Remove the claims that type errors surface in the render and that DXS-NG-053 is never your code." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Reference doc — "Authoring for a target" (item 4, incl. Widget of type CAC) + cross-references

**Files:**
- Modify: `D:\Git\skills-253347\skills\datex-studio\custom-angular-component-creator\references\custom-angular-components.md` — **insert** a new `## Authoring for a target` section immediately before the line `## The two author regions` (line 44); extend `## Cross-References` (lines 281–288) with the design-system links
- Test: grep sweep + link check (below)

**Interfaces:**
- Consumes (widget-type plan `D:\Git\253347_cac_improvements\docs\superpowers\plans\2026-09-15-cac-widget-type.md`): `EWidgetDesignerType.customAngularComponent`; `customAngularComponentConfig: ReferenceConfig`; Studio Widgets → New → type `Custom Angular Component` → pick a CAC → Settings mirrors `inParams`/`outParams` and default-maps each `configParameters[i].value` to `$widget.inParams.<id>`; wrapper calls the CAC's `refresh(true, false, null)` on host/interval refresh and forwards `outParamsChange`; wrapper renders no title chrome; allowed on mobile; publish reports `Outdated contract` under the widget on drift.
- Consumes (design system, vendored byte-identical at `skills/datex-studio/datex-studio-shared/design-system/`; source `D:\Git\claude-design\datex-studio-app\`): `02-tokens.md:109` spacing 2/4/8/12/20/32/40/48 (no 16), radius 4px fields/buttons/cards/widgets, 8px modal; `03-components.md:262` (widgets ≤2 per screen, max 3) and `04-patterns.md` one primary button, blade ▸ flyout ▸ modal, ≤2 widgets (3 max), sentence case / no period / action verbs; `02-tokens.md:3-7,44` tokens never a hex; `02-tokens.md:99-101` body 14px, `h1` 32px accent; `02-tokens.md:129` widget 42px radius 4px; `02-tokens.md:138-143` Fluent icons on `<i>` only; `03-components.md:54-77` toolbars (`.blade-tools` 40px, `.dataview-tools` 38px, button order main → destructive → common → UI config, ~7 max); `03-components.md:83-104` blade anatomy; `03-components.md:175-185` hub/editor grid areas, ≤3 widgets; `03-components.md:251-264` widgets; `04-patterns.md:3-23` window hierarchy rules.
- Consumes (compiled CSS, `src/Common/WavelengthUi/projects/wavelength-ui/src/styles/main.css` in the platform repo): `.datex-hub .widgets .widget-container { width: 200px }` (12663), `calc(50% - .625rem)` at ≤1200px (12666-12675), `:has(> *:empty:not(.proxy-box)) { display: none }` (12681); identical `.datex-editor` rules (12330-12350); `.datex-dashboard .section .widgets > .widget-container { flex: 1 1 0 }` (12918); `.blade-wrapper .blade-content { padding: 1.25rem; border-radius: 4px; box-shadow: var(--shadow-4); overflow-y: scroll; overflow-x: hidden }` (7322-7336); `html, body { overflow: hidden }` (1234-1239).
- Produces: heading `## Authoring for a target` (anchor `#authoring-for-a-target`) that Tasks 1, 2, 4, 5 link to; the phrases `"$container": "widget"` and `Widget of type Custom Angular Component` that Task 4 rows repeat.

- [x] **Step 1: Write the failing check and run it**

```bash
cd "D:/Git/skills-253347"
F=skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
grep -c "^## Authoring for a target" "$F"                      # expect after: 1
grep -c "customAngularComponentConfig" "$F"                    # expect after: 2 or more
grep -c "design-system/02-tokens.md" "$F"                      # expect after: 1 or more
grep -n "\](D:\\\\\|\](D:/" "$F"                               # expect: NO output (no absolute-path links)
```

Expected now (failure): `0`, `0`, `0`, and no output for the last line.

- [x] **Step 2: Insert the section before `## The two author regions`**

Insert this block (blank line before and after) immediately above the line `## The two author regions`:

````
## Authoring for a target

Establish **where the CAC will live** in Phase 1 (requirements) — it decides size, chrome and the binding contract, and it is not recorded in `manifest.json` (`displayModes` is vestigial; do not repurpose it). Set `"$container"` in `mocks/harness-inputs.json` to match, so `render.png` shows the real box. Design rules come from the vendored [Datex Studio App design system](../../datex-studio-shared/design-system/README.md); the rows below name the parts to read.

| Target | Where it renders | Appearance rules | Binding contract | Preview frame | Read |
|---|---|---|---|---|---|
| **Widget** (hub / editor widget slot, dashboard section) | Inside the host's `.widgets > .widget-container`. Hub and editor size it identically: **200px wide** (`calc(50% - .625rem)` under 1200px); a dashboard section widget flexes to its column (`flex: 1 1 0`). The host hides a container whose only child is empty. | **Compact:** one number or one small chart; **no title of its own** (widgets show none and the wrapper adds none); no scrollbars; a 4px-radius surface; fat-number widgets are 42px tall, so aim for one or two lines; ≤2 widgets per screen (3 max) is the host's budget, not yours to exceed; tokens only. | Create a **Widget of type Custom Angular Component** pointing at the CAC (below). The wrapper binds `[<id>]` from `$widget.inParams.<id>`, forwards `outParamsChange`, and calls your `refresh(true, false, null)` on the host's refresh and the widget's interval — the generated default re-runs `ngOnInit`, so implement the three-parameter `refresh` if your init is not idempotent. | `"$container": "widget"` (hub/editor) or `"dashboard-widget"` | [README](../../datex-studio-shared/design-system/README.md) (widgets ≤2), [03-components → Widgets](../../datex-studio-shared/design-system/03-components.md#widgets--height-42px-radius-4px), [02-tokens](../../datex-studio-shared/design-system/02-tokens.md) |
| **Tab content** (hub, editor, card, dashboard tab) | Fills `.blade-wrapper .blade-content` (`padding: 1.25rem`, 4px radius, `--shadow-4`, `overflow-y: scroll`, `overflow-x: hidden`) beneath the host's tab strip. | Fill the width; own a **vertical** scroll region, never horizontal; if it needs actions, a `.dataview-tools` toolbar (38px) in the strict order main → destructive → common → UI config, ~7 buttons max, **one** primary; tabular data = embed a `grid` ref, don't hand-roll a table. | The tab binds `[<inParamId>]` per configured parameter, `($refreshEvent)` unconditionally and `(outParamsChange)` when a flow is configured; implement `refresh(skipParent = false, skipChildren = false, childToSkip: string = null)` if data must reload; never declare an outParam named `refresh`/`$refreshEvent`/`outParamsChange`. | `"$container": "page"` | [03-components → Toolbars, Tabs, Dataviews](../../datex-studio-shared/design-system/03-components.md), [04-patterns → Window hierarchy](../../datex-studio-shared/design-system/04-patterns.md) |
| **Page / shell view** | A blade (`.blade-header` 40px toolbar + `.blade-content`) opened from navigation or a `$shell` opener. | Full page at blade sizing; **one** primary action, in the blade toolbar; `h1` (32px, accent) is the page title in sentence case; anything it opens follows blade ▸ flyout ▸ modal — never a modal on a modal, no "create new" in a modal. | Inputs arrive from the route/opener as `[<inParamId>]`; navigate and open through `$shell`, not `window.location`. | `"$container": "page"` | [04-patterns](../../datex-studio-shared/design-system/04-patterns.md), [03-components → Blade](../../datex-studio-shared/design-system/03-components.md#blade--blade-wrapper) |
| **Common to all** | — | Sentence case; button labels are action verbs, no trailing period; spacing 2 / 4 / 8 / 12 / 20 / 32 / 40 / 48 px (there is no 16px step); radius 4px (8px only for a modal surface); body text 14px; `var(--…)` tokens, **never a literal hex**; Fluent icons on `<i>` only; mirror the closest existing component's markup and classes rather than inventing. | — | — | [02-tokens](../../datex-studio-shared/design-system/02-tokens.md), [05-voice-and-copy](../../datex-studio-shared/design-system/05-voice-and-copy.md), [06-traps](../../datex-studio-shared/design-system/06-traps.md) |

### Widget of type Custom Angular Component

A CAC becomes a widget through a **companion Widget config (type 8)** whose type is `Custom Angular Component`; hosts keep placing widgets by name, so nothing about hub/editor/dashboard slots changes.

- **Studio:** Widgets → New → type **Custom Angular Component** → pick the CAC. Settings mirrors the CAC's `inParams`/`outParams` onto the widget (read-only in the Data flyouts) and default-maps every parameter to `$widget.inParams.<id>`; Save; Preview shows the CAC inside the 200px box. Then Hub/Editor → Add widget → pick that widget and bind its inputs like any other widget.
- **CLI:** `dxs configuration upsert widget` with a type-8 body of this shape (mirror the CAC's `inParams` yourself; `moduleId` follows the normal reference rule — the CAC's owning module, `null` in a host app). Confirm the accepted shape against a saved one first (`dxs configuration get widget <id> -b <branch>`), per the CLI-first rule:

```json
{
  "id": 0,
  "referenceName": "outboundCommandCenterWidget",
  "title": "Outbound backlog",
  "description": "Outbound backlog fat number (custom Angular component)",
  "configurationTypeId": 8,
  "type": "customAngularComponent",
  "customAngularComponentConfig": {
    "configId": "outboundCommandCenter",
    "moduleId": null,
    "configParameters": [
      {
        "parameter": { "id": "warehouseId", "type": "string", "required": false, "isCollection": false, "objectTypeDef": null, "objectType": null },
        "value": "$widget.inParams.warehouseId"
      }
    ],
    "configOutParameters": null,
    "configEvents": null,
    "outParamsChangeFlowConfig": null
  },
  "inParams": [
    { "id": "warehouseId", "type": "string", "required": false, "isCollection": false, "objectTypeDef": null, "objectType": null }
  ],
  "outParams": null,
  "datasourceConfig": null,
  "fatNumberConfig": null,
  "pieChartConfig": null,
  "vars": null,
  "events": null
}
```

- **Drift:** when the CAC's `inParams`/`outParams` change later, publish reports `Outdated contract` under the widget — re-open the widget's Settings (or re-copy the parameters) to fix. Validation of the widget requires `customAngularComponentConfig.configId` (`Custom Angular Component is required`) and that the target is a CAC.
- **Behavior you inherit:** the widget's interval refresh calls the CAC's `refresh`; the generated default re-runs `ngOnInit`, so a CAC with one-time setup (a chart instance, subscriptions) must implement its own three-parameter `refresh`. The wrapper is never generated in the `dxs ng` harness — `"$container": "widget"` reproduces its **geometry** only, not its refresh/interval semantics; verify those in Studio's widget Preview after `push`.
````

- [x] **Step 3: Extend `## Cross-References` (lines 281–288)**

Insert these bullets directly after the line `- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — reference-name / display-name rules.`:

```
- [../../datex-studio-shared/design-system/README.md](../../datex-studio-shared/design-system/README.md) — the Datex Studio App design system (vendored): tokens, class names, patterns; the per-target rules in [Authoring for a target](#authoring-for-a-target) point into `02-tokens.md`, `03-components.md`, `04-patterns.md`, `05-voice-and-copy.md`, `06-traps.md`.
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — the cross-component `moduleId` rule that `componentRefs[].module` follows, and how the wiring audit treats CAC references.
```

- [x] **Step 4: Re-run the check and the link script**

```bash
cd "D:/Git/skills-253347"
F=skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
grep -c "^## Authoring for a target" "$F"
grep -c "customAngularComponentConfig" "$F"
grep -c "design-system/02-tokens.md" "$F"
grep -n "\](D:\\\\\|\](D:/" "$F"
find skills docs README.md CLAUDE.md -name '*.md' | while read -r f; do
  d=$(dirname "$f")
  grep -oE '\]\(([^)#]+\.md)(#[^)]*)?\)' "$f" | sed -E 's/^\]\(//; s/(#[^)]*)?\)$//' | while read -r t; do
    case "$t" in /*|http*) continue;; esac
    [ -f "$d/$t" ] || echo "BROKEN: $f -> $t"
  done
done | sort -u
```

Expected: `1`; `2` or more; `1` or more; no output for the absolute-path grep; the link script prints exactly one line once filtered with `| grep -v 'docs/superpowers/plans/'` (this plan document's own relative links are reported from its directory and are not skill content) — the pre-existing `BROKEN: docs/superpowers/specs/2026-03-26-skill-split-design.md -> references/file.md` (present at `6036bba`, not touched by this plan) — and nothing else.

- [x] **Step 5: Commit**

```bash
git -C "D:/Git/skills-253347" add skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md
git -C "D:/Git/skills-253347" commit -m "docs(cac): authoring rules per target (widget, tab content, page)" -m "Add the Authoring for a target section: a per-target table (appearance, binding contract, \$container preview frame, design-system reading) grounded in the compiled Datex CSS (200px widget box, .blade-content scroll region), plus the Widget of type Custom Angular Component procedure (Studio and dxs configuration upsert widget with customAngularComponentConfig), drift and refresh semantics. Note that manifest.displayModes is vestigial and must not carry the target." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `SKILL.md` — workflow, lifecycle table, phases, pre-flight (lines 3–252)

**Files:**
- Modify: `D:\Git\skills-253347\skills\datex-studio\custom-angular-component-creator\SKILL.md` — lines 3 (description), 17, 19, 61, 73–76 (tab-content `refresh()` sentence), 109–111 (lifecycle table rows), 143–148 (workflow diagram), 161 (Phase 1 step 2 → add step 3), 170–171 (tree), 203 (Phase 3 seeding), 217 and 219 (Phase 4), 232 (Phase 5 preflight), 239–243 (Pre-Flight items 4–6, add 9), 252 (round-trip claim)
- Test: grep sweep (below)

**Interfaces:**
- Consumes (Tasks 1–3): anchors `#componentrefs--embedding-another-component`, `#two-binding-families--markup`, `#preview-inputs-and-host-frame--mocksharness-inputsjson`, `#authoring-for-a-target` in `references/custom-angular-components.md`.
- Consumes (CLI plan): `push` runs `_preflight_component_references` after `_preflight_datasource_connections`, unconditionally (also with `--skip-connection-check`); `data generate` accepts `--force` and writes both `mocks/harness-mocks.json` and `mocks/harness-inputs.json`.
- Produces: the Phase 1 target step and the Phase 5 `DXS-NG-056` paragraph that Task 5's Common-Mistakes rows reference (`See Phase 5`).

- [x] **Step 1: Write the failing check and run it**

```bash
cd "D:/Git/skills-253347"
S=skills/datex-studio/custom-angular-component-creator/SKILL.md
# stale (expected after Task 4: NO output)
grep -n "selectors first\|is generic over component kind\|Type/template errors surface here too\|drive it from an \`@Input\`/mock\|\`manifest.datasources\`/\`componentRefs\` do \*\*not\*\* round-trip\|\[real data?\] -> dxs ng data generate" "$S"
# new (expected after Task 4: 1 / 1 / 1 / 1)
grep -c "Component reference preflight (\`DXS-NG-056\`)" "$S"
grep -c "Establish the target" "$S"
grep -c "harness-inputs.json (input values" "$S"
grep -c "refresh(skipParent = false, skipChildren = false, childToSkip: string = null)" "$S"
```

Expected now (failure): the first grep prints lines 17, 61, 143, 217, 219, 252; the counts print `0`, `0`, `0`, `0`.

- [x] **Step 2: Line 3 — description**

Replace:

```
description: Author or edit a Datex Studio Custom Angular Component (CAC, configurationTypeId=36) on a branch via the `dxs ng` command family — a screenshot-driven create → edit-regions → preview → push loop for bespoke Angular UI (charts, dashboards, custom widgets).
```

with:

```
description: Author or edit a Datex Studio Custom Angular Component (CAC, configurationTypeId=36) on a branch via the `dxs ng` command family — a screenshot-driven create → edit-regions → preview → push loop for bespoke Angular UI (charts, dashboards, custom widgets) that can embed the app's own generated selectors, grids, editors, forms, cards, lists and widgets, and can itself be placed as a widget, a tab, or a page.
```

- [x] **Step 3: Line 17 — embedding intro**

Replace:

```
A CAC can also **embed an existing app configuration in its template** — declare it as a component reference (selectors first; the contract is generic over component kind) and codegen imports the generated component into the CAC's scope, so a real generated control (e.g. a selector dropdown) renders inside your custom UI.
```

with:

```
A CAC can also **embed existing app configurations in its template** — declare each as a component reference of kind `selector`, `grid`, `editor`, `form`, `card`, `list` or `widget`, and codegen imports the generated component into the CAC's scope, so the real generated control (a selector dropdown, an orders grid, an editor) renders inside your custom UI. The per-kind tags, classes, binding families and two markup examples are in [references → `componentRefs`](references/custom-angular-components.md#componentrefs--embedding-another-component).
```

- [x] **Step 4: Line 19 — embedding clues**

Replace:

```
Clues for embedding: a selector generates in **two variants — `_single` and `_multi`** — so a referenced selector gives you both a single- and a multi-select control to choose from. An embedded control exposes the *configuration's own* properties as component inputs/outputs (e.g. a selector surfaces each of its datasource parameters as an input named by the parameter id, plus its selected value and a display-text output). To find the exact tag and the inputs/outputs a referenced config exposes, **read its generated component in the materialized harness** — the `@Component` selector is the tag to use, and the `@Input`/`@Output` members are what you bind — rather than guessing them.
```

with:

```
Clues for embedding: there are **two binding families**. A **selector** is a *value-bound control* — it generates two variants, `_single` and `_multi`; you bind `[(ngModel)]`/`[formControl]` plus one input per datasource parameter, and it has no `refresh`. **Every other kind** generates *one* component with tag `<P>-<ref>` that takes `[<inParamId>]` inputs and emits the tab-content events (`($refreshEvent)`, `(outParamsChange)`, `($finish)`), and you call its `refresh(skipParent, skipChildren, childToSkip)` through a typed `@ViewChild`. The class is already imported by codegen — never re-import it in `__COMPONENT_TYPES__`. To find the exact tag and inputs/outputs, **read the generated `<P>.<ref>.component.ts` in the materialized harness**, and confirm your own component's `imports:` lists a `forwardRef` for it — if it does not, the reference did not resolve.
```

- [x] **Step 5: Line 61 — one CAC per screen**

Replace:

```
(component references: selectors first) and `$shell` dialog openers, not CAC-in-CAC.
```

with:

```
(component references of any embeddable kind — selector, grid, editor, form, card, list, widget) and `$shell` dialog openers, not CAC-in-CAC.
```

- [x] **Step 6: Lines 73–76 — tab-content `refresh` signature**

Replace:

```
collision is a duplicate-member compile error. The one exception is a body **`refresh()`
method**, the sanctioned override: to re-load the CAC when the container refreshes, implement
`refresh()` in the body region and it replaces the generated default (which re-runs
`ngOnInit()`).
```

with:

```
collision is a duplicate-member compile error. The one exception is a body **`refresh` method**,
the sanctioned override: to re-load the CAC when the container refreshes, implement
`refresh(skipParent = false, skipChildren = false, childToSkip: string = null)` — **this exact
three-parameter signature** (tab hosts and the widget wrapper call it with three arguments through
a typed `@ViewChild`; another arity breaks the host's compile) — in the body region and it replaces
the generated default (which re-runs `ngOnInit()`). A CAC has no `$refreshChildren()`: forward to
embedded children yourself (example in [references → Two binding families](references/custom-angular-components.md#two-binding-families--markup)).
```

- [x] **Step 7: Lines 109–111 — lifecycle table rows**

Replace the row beginning `| \`dxs ng data generate <folder> -b <branch>\` |` with:

```
| `dxs ng data generate <folder> -b <branch> [--force]` | yes | no | Seed `<folder>/mocks/harness-mocks.json` with one `"<ds>.<method>"` key per datasource call in the materialized harness — yours **and** your embedded components' — plus a `mocks/harness-inputs.json` skeleton (one key per manifest input + `"$container"`). Run it **after** `preview --refresh`; it warns when the harness predates your `componentRefs` or a ref was not materialized. |
```

Replace the row beginning `| \`dxs ng preview <folder> [-o out.png] [--refresh] [--clean]\` |` with:

```
| `dxs ng preview <folder> [-o out.png] [--refresh] [--clean]` | **no** (local) | no | Serve the harness locally and screenshot the mounted component → `<folder>/render.png`, with browser console/errors in `<folder>/render.log` and the dev server's output in `<folder>/.dxs-serve.log`. A compile failure is a structured **`DXS-NG-057`** quoting the compiler lines — no screenshot is taken. `--refresh -b <branch>` re-fetches the harness after a manifest IO/`componentRefs` change; `--clean` resets a stuck server **and** tears down the agent-browser session (daemon, Chrome tree, stale state files). |
```

Replace the row beginning `| \`dxs ng push <folder> -b <branch>\` |` with:

```
| `dxs ng push <folder> -b <branch> [--skip-connection-check]` | yes | **yes** | Extract the two regions + `manifest.json` → upsert type-36. Two preflights run first — datasource connections (`DXS-NG-047`, skippable) and component references (`DXS-NG-056`: kind, duplicates, existence on the branch — never skipped). **First push creates the component in Studio**; the server validates on upsert (hard gate). |
```

- [x] **Step 8: Lines 143–148 — workflow diagram**

Replace:

```
[real data?] -> dxs ng data generate <folder> -b <branch>   (seed mocks)
        |
[Phase 4: Preview loop (screenshot-driven)]
dxs ng preview <folder>        -> writes <folder>/render.png
Read render.png. Compare to the target. Edit regions. Re-preview.
Repeat until it matches. (First preview ~15-46s cold; each later ~10s.)
```

with:

```
[componentRefs or IO changed?] -> dxs ng preview <folder> --refresh -b <branch>   (re-wire the harness FIRST)
        |
[real data, inputs, or embedded components?] -> dxs ng data generate <folder> -b <branch>   (seed mocks + inputs)
        |
[Phase 4: Preview loop (screenshot-driven)]
dxs ng preview <folder>        -> writes <folder>/render.png (+ render.log, .dxs-serve.log)
Read render.png. Compare to the target. Edit regions. Re-preview.
A compile error is DXS-NG-057 with the compiler lines, not a picture — fix, re-preview.
Repeat until it matches. (First preview ~15-46s cold; each later ~10s.)
```

- [x] **Step 9: Line 161 — Phase 1: add the target step**

Insert directly after the numbered item that ends `A target screenshot turns Phase 4 into an objective converge-to-target loop.`:

```
3. **Establish the target** — will the CAC live as a **widget** (hub/editor/dashboard widget slot), as **tab content** (hub/editor/card/dashboard tab), or as a **page**? Each has different size, chrome and binding rules; read [references → Authoring for a target](references/custom-angular-components.md#authoring-for-a-target) before Phase 3, and set `"$container"` in `mocks/harness-inputs.json` accordingly so the preview shows the real box. A widget-destined CAC also needs a companion Widget of type Custom Angular Component after `push` (same section).
```

- [x] **Step 10: Lines 170–171 — Phase 2 tree**

Replace:

```
  manifest.json      # identity + IO (inputs/outputs) + datasource/flow refs + displayModes
  mocks/             # fixtures the harness $datasources/$flows read during preview
```

with:

```
  manifest.json      # identity + IO (inputs/outputs) + datasource/flow refs + componentRefs (+ vestigial displayModes)
  mocks/             # harness-mocks.json (datasource/flow fixtures) + harness-inputs.json (input values + "$container")
```

- [x] **Step 11: Line 203 — Phase 3 seeding paragraph**

Replace:

```
If the component reads real data, run `dxs ng data generate <folder> -b <branch>` to seed `mocks/harness-mocks.json`, then fill in realistic values so the preview renders with representative data. Invoke `schema-explorer` first if you're unsure the datasource/entity exists; invoke `datasource-creator` if it needs to be authored.
```

with:

```
If the component reads real data, has inputs, or embeds components, run `dxs ng data generate <folder> -b <branch>` **after** any `preview --refresh` to seed `mocks/harness-mocks.json` (your calls and your embedded components') and the `mocks/harness-inputs.json` skeleton, then fill in realistic values so the preview renders with representative data and real input values. Invoke `schema-explorer` first if you're unsure the datasource/entity exists; invoke `datasource-creator` if it needs to be authored.
```

- [x] **Step 12: Line 217 — Phase 4 failure surfaces**

Replace the sentence:

```
Type/template errors surface here too (the harness compiles the real component).
```

with:

```
A compile or template error does **not** produce a picture: `preview` fails with `DXS-NG-057` quoting the `✘ [ERROR]`/`NG…`/`TS…` lines from `<folder>/.dxs-serve.log`, and no stale screenshot is taken — fix and re-run. Runtime console output and errors from the render land in `<folder>/render.log`; read it alongside the PNG.
```

- [x] **Step 13: Line 219 — default state paragraph**

Replace:

```
For a mode/variant switched by in-component UI (rather than an `@Input`), temporarily set that default (or drive it from an `@Input`/mock) to screenshot each variant.
```

with:

```
For a mode/variant switched by in-component UI (rather than an `@Input`), temporarily set that default to screenshot each variant; for one driven by an `@Input`, set the value in `mocks/harness-inputs.json` (a warm, local edit — no `--refresh`).
```

- [x] **Step 14: Line 232 — Phase 5: add the component-reference preflight paragraph**

Insert directly after the paragraph that begins `**Datasource connection preflight (\`DXS-NG-047\`).**` (i.e. after `… their settings resolve via the reference remap.`):

```
**Component reference preflight (`DXS-NG-056`).** After the datasource check, `push` verifies every `manifest.componentRefs` entry locally and on the branch: non-empty `name`, `kind` ∈ `selector, grid, editor, form, card, list, widget`, no duplicate `(name, module)`, and that a configuration of that kind exists in the referenced module (blank `module` = your own application). It runs **unconditionally** — `--skip-connection-check` does not bypass it. On `DXS-NG-056`: fix `manifest.json` (find the target with `dxs configuration list <kind> -b <branch>`; `module` is the target's owning module), then `dxs ng preview <folder> --refresh -b <branch>` and push again. This is a new gate, not a broken CLI: a CAC that pushed before with a bad reference failed later at the app build with `NG8001`.
```

- [x] **Step 15: Lines 239–243 — Pre-Flight items 4, 5, 6 and a new 9**

Replace item 4:

```
4. **Mocks seeded** (`dxs ng data generate`) and filled with representative values if the component reads `$datasources`/`$flows`, so the preview renders real-looking data.
```

with:

```
4. **Mocks and inputs seeded** (`dxs ng data generate`, run after `preview --refresh`) and filled with representative values if the component reads `$datasources`/`$flows`, has inputs, or embeds components; `"$container"` in `mocks/harness-inputs.json` matches the target.
```

Append to item 5 (after `See the datasource note in Phase 3.`):

```
 Every `componentRefs` entry has a valid `kind` and the target's owning `module`, and your component's `imports:` lists a `forwardRef` per ref (otherwise it did not resolve).
```

Replace item 6:

```
6. **The preview PNG matches the target** — the loop converged, and no compile/template errors remain in the render.
```

with:

```
6. **The preview PNG matches the target** — the loop converged, `preview` exits 0 (a compile error is `DXS-NG-057`, never a picture), and `render.log` shows no errors.
```

Insert after item 8:

```
9. **Target rules applied** — a widget-destined CAC is compact (200px box, no title of its own, no scrollbars) and previewed with `"$container": "widget"`; tab content fills `.blade-content` and implements the three-parameter `refresh` if it reloads; see [references → Authoring for a target](references/custom-angular-components.md#authoring-for-a-target).
```

- [x] **Step 16: Line 252 — round-trip correction**

Replace:

```
`dxs ng pull` re-materializes the two regions + `.html`/`.scss` faithfully, but `mocks/harness-mocks.json`, captured target/notes files, and `manifest.datasources`/`componentRefs` do **not** round-trip — re-seed/re-add them after a re-pull.
```

with:

```
`dxs ng pull` re-materializes the two regions + `.html`/`.scss` + `manifest.componentRefs` faithfully, but `mocks/` (`harness-mocks.json`, `harness-inputs.json`), captured target/notes files, and `manifest.datasources` do **not** round-trip — re-seed/re-add them after a re-pull.
```

- [x] **Step 17: Re-run the check**

```bash
cd "D:/Git/skills-253347"
S=skills/datex-studio/custom-angular-component-creator/SKILL.md
grep -n "selectors first\|is generic over component kind\|Type/template errors surface here too\|drive it from an \`@Input\`/mock\|\`manifest.datasources\`/\`componentRefs\` do \*\*not\*\* round-trip\|\[real data?\] -> dxs ng data generate" "$S"
grep -c "Component reference preflight (\`DXS-NG-056\`)" "$S"
grep -c "Establish the target" "$S"
grep -c "harness-inputs.json (input values" "$S"
grep -c "refresh(skipParent = false, skipChildren = false, childToSkip: string = null)" "$S"
```

Expected: nothing; `1`; `1`; `1`; `1`.

- [x] **Step 18: Commit**

```bash
git -C "D:/Git/skills-253347" add skills/datex-studio/custom-angular-component-creator/SKILL.md
git -C "D:/Git/skills-253347" commit -m "docs(cac): workflow for embedded kinds, targets, and the push gate" -m "SKILL.md: embedding intro/clues for two binding families, kind list in the one-CAC rule, three-parameter refresh signature, lifecycle rows for data generate/preview/push, refresh -> generate -> preview order in the workflow, Phase 1 target step, Phase 3 inputs, Phase 4 DXS-NG-057 and render.log, Phase 5 DXS-NG-056 preflight, pre-flight items, and the corrected round-trip claim (componentRefs do round-trip)." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `SKILL.md` — Common-Mistakes rows (lines 264–289)

**Files:**
- Modify: `D:\Git\skills-253347\skills\datex-studio\custom-angular-component-creator\SKILL.md` — Common Mistakes table: rows at lines 264 (`DXS-NG-042`), 265 (`DXS-NG-053`), 266 (`$shell` stubs), 285 (`data generate` gap), 287 (`render.png` cut off); append eight new rows before the closing bold line at 291
- Test: grep sweep (below)

**Interfaces:**
- Consumes (Tasks 1–4): anchors in `references/custom-angular-components.md` (`#generated-surface-per-kind`, `#authoring-for-a-target`, `#preview-inputs-and-host-frame--mocksharness-inputsjson`); the Phase 5 `DXS-NG-056` paragraph (`See Phase 5`).
- Produces: nothing consumed later; this completes the SKILL.md changes.

- [x] **Step 1: Write the failing check and run it**

```bash
cd "D:/Git/skills-253347"
S=skills/datex-studio/custom-angular-component-creator/SKILL.md
# stale (expected after Task 5: NO output)
grep -n "A screenshot timeout ≠ a render failure\|The harness makes only YOUR candidate a real component\|silently skips a componentRef selector's backing datasource\|capped to one viewport (commonly ~569px)" "$S"
# new rows (expected after Task 5: each 1)
grep -c "^| \`push\` fails with \`DXS-NG-056\`" "$S"
grep -c "^| Binding the wrong family" "$S"
grep -c "^| Re-importing the embedded component's class" "$S"
grep -c "^| Embedded grid/list renders" "$S"
grep -c "^| The CAC renders blank in preview" "$S"
grep -c "^| Authoring a widget-destined CAC as a full page" "$S"
grep -c "^| Declaring \`refresh\` with a different arity" "$S"
grep -c "^| \`preview\` fails with \`DXS-NG-057\`" "$S"
```

Expected now (failure): the first grep prints lines 265, 266, 285, 287; every count prints `0`.

- [x] **Step 2: Replace the `DXS-NG-042` row (line 264)**

Replace the row beginning `| \`preview\` reports \`ng serve did not become ready\` (\`DXS-NG-042\`) |` with:

```
| `preview` reports `ng serve did not become ready` (`DXS-NG-042`) | The message ends with the last ~40 lines of `<folder>/.dxs-serve.log` — read them. Usually the first cold compile running long: extend with `DXS_NG_SERVE_TIMEOUT` (seconds), re-run, `--clean` to reset a stuck server. (A compile *error* is reported as `DXS-NG-057`, not 042.) On CLI ≤0.4.13 a **relative folder argument** also caused this — pass an absolute path there. |
```

- [x] **Step 3: Replace the `DXS-NG-053` row (line 265)**

Replace the row beginning `| \`preview\` fails with \`DXS-NG-053\` (\`agent-browser 'wait' timed out\`) — assuming the component is broken |` with:

```
| `preview` fails with `DXS-NG-053`/`DXS-NG-052` (agent-browser step timed out / failed) — either chasing phantom code bugs or assuming the render was fine | These are browser-step failures, raised only after the harness build succeeded (a failed build is `DXS-NG-057`). First move: `--clean` (fresh serve + fresh browser session) and re-run; then read `<folder>/render.log` and `<folder>/.dxs-serve.log` for the real state before touching code. Reproducible ones are CLI issues to report. |
```

- [x] **Step 4: Replace the `$shell` row (line 266)**

Replace the row beginning `| Expecting to preview/open OTHER components (or \`$shell\` dialogs to them) |` with:

```
| Expecting to open OTHER components through `$shell` in preview (`$shell.open<X>Dialog(...)`) | The harness generates YOUR candidate plus its embedded `componentRefs` and their dependencies; `$shell.open<X>…` openers are compilable stubs that won't open anything in preview — for every component, in every harness build (this is not a cross-module `componentRefs` limitation). `$datasources`/`$flows` (mocked) and your own UI are fully live. |
```

- [x] **Step 5: Replace the `data generate` gap row (line 285)**

Replace the row beginning `| \`dxs ng data generate\` leaves a \`$frontendFlows\` ref or an embedded componentRef selector's datasource with no mock key |` with:

```
| `dxs ng data generate` leaves a `$frontendFlows` ref, an embedded component's *owned* datasource payload, or a not-materialized ref with no usable mock | It seeds every `"<ds>.<method>"` call it finds in the materialized harness (yours and your embedded components'), but not `$frontendFlows` (never mocked), not the field shapes of owned datasources (`"<ref>___<ds>.<method>"` is written with an empty payload), and nothing for a ref the harness did not materialize (it warns). Run it after `preview --refresh`, then open `mocks/harness-mocks.json` and fill what it flagged. |
```

- [x] **Step 6: Replace the `render.png` row (line 287)**

Replace the row beginning `| A full-page/dashboard CAC's \`render.png\` looks cut off partway down |` with:

```
| `render.png` seems to cut the component off | `preview` screenshots the **mounted element** (falling back to the viewport) at the harness's default viewport width, so the 1200px responsive rules stay truthful. What it cannot see is content hidden inside your own `overflow-y: auto` region — faithful to the host, not a bug. To verify such content, drive `agent-browser` against the port in `<folder>/.dxs-serve.lock` and scroll the region. |
```

- [x] **Step 7: Append eight rows**

Insert these rows directly after the last existing row (the one beginning `| Declaring an outParam or \`@Output\` named \`refresh\` / \`$refreshEvent\` / \`outParamsChange\` |`) and before the blank line + closing bold sentence:

```
| `push` fails with `DXS-NG-056` (component reference preflight) | A `manifest.componentRefs` entry has an unsupported or misspelled `kind` (only `selector, grid, editor, form, card, list, widget`, lower-case), a duplicate `(name, module)`, an empty name, or names a component that does not exist in that module on the branch. Find the target with `dxs configuration list <kind> -b <branch>`, set `module` to its owning module (omit for your own app), fix `manifest.json`, `preview --refresh -b <branch>`, push again. Not skippable — see Phase 5. |
| `preview` fails with `DXS-NG-057` (harness compile failed) | Read the quoted compiler lines: `NG8001` (unknown element) = a `componentRefs` entry did not resolve or the tag is misspelled; `NG8002` = wrong binding family / misspelled input; `TS2300` = an embedded class re-imported in `__COMPONENT_TYPES__`; `TS2554` = `refresh` with the wrong arity; `TS2322` = a type-wrong binding on a typed input. Fix, re-run. No screenshot was taken, so `render.png` is not stale. |
| Binding the wrong family — `[(ngModel)]` on an embedded grid, or `[orderId]`-style inParams and `($refreshEvent)` on a selector | A selector is a value-bound control (`[(ngModel)]`/`[formControl]` + `[<datasourceParamId>]`, no `refresh`); every other kind is inParams + refresh (`[<inParamId>]`, `($refreshEvent)`, `(outParamsChange)`, `($finish)`, `@ViewChild` → `refresh(...)`). `DXS-NG-057` with `NG8002` is the symptom. See [references → Generated surface per kind](references/custom-angular-components.md#generated-surface-per-kind). |
| Re-importing the embedded component's class in `__COMPONENT_TYPES__` (`import { app_orders_gridComponent } from './app.orders_grid.component'`) | Codegen already imports it (the `forwardRef` in `imports:`); a second import is `TS2300: Duplicate identifier`. Use the class name directly in `@ViewChild(..., { read: <P>_<ref>Component })` in the body. If the class is *not* in `imports:`, the ref did not resolve — fix the manifest, don't add the import. |
| Embedded grid/list renders "Please provide …" or no rows in preview | Bind its required inParams in your template, then run `dxs ng data generate` **after** `preview --refresh` and fill the grid's `"<ds>.getList"` payload — the order matters (refresh materializes the grid; generate reads the materialized code). A CAC input feeding the grid needs a value in `mocks/harness-inputs.json`. |
| The CAC renders blank in preview and nothing errors | Its `@Input`s are `undefined` — unlike embedded components, a CAC has no built-in `Please provide …` gate. Put values in `mocks/harness-inputs.json` (`dxs ng data generate` writes the skeleton); no `--refresh` for value edits. See [references → Preview inputs](references/custom-angular-components.md#preview-inputs-and-host-frame--mocksharness-inputsjson). |
| Authoring a widget-destined CAC as a full page (own title, toolbar, tall chart, scroll) | In a hub/editor the widget box is 200px wide (50% under 1200px) and shows no title of its own; a dashboard section widget flexes to its column. Author compact — one number or one small chart, no scrollbars — and preview with `"$container": "widget"` so `render.png` shows the real box; then create the Widget of type Custom Angular Component. See [references → Authoring for a target](references/custom-angular-components.md#authoring-for-a-target). |
| Declaring `refresh` with a different arity (`refresh()` / `refresh(force: boolean)`) | Tab hosts and the widget wrapper call `refresh(skipParent, skipChildren, childToSkip)` through a typed `@ViewChild`; another arity fails the host's compile (`TS2554`). Use `refresh(skipParent = false, skipChildren = false, childToSkip: string = null)` and forward to embedded children yourself (a CAC has no `$refreshChildren()`). |
```

- [x] **Step 8: Re-run the check**

```bash
cd "D:/Git/skills-253347"
S=skills/datex-studio/custom-angular-component-creator/SKILL.md
grep -n "A screenshot timeout ≠ a render failure\|The harness makes only YOUR candidate a real component\|silently skips a componentRef selector's backing datasource\|capped to one viewport (commonly ~569px)" "$S"
for p in "^| \`push\` fails with \`DXS-NG-056\`" "^| Binding the wrong family" "^| Re-importing the embedded component's class" "^| Embedded grid/list renders" "^| The CAC renders blank in preview" "^| Authoring a widget-destined CAC as a full page" "^| Declaring \`refresh\` with a different arity" "^| \`preview\` fails with \`DXS-NG-057\`"; do grep -c "$p" "$S"; done
```

Expected: nothing, then eight lines each `1`.

- [x] **Step 9: Commit**

```bash
git -C "D:/Git/skills-253347" add skills/datex-studio/custom-angular-component-creator/SKILL.md
git -C "D:/Git/skills-253347" commit -m "docs(cac): common mistakes for embedding, targets, and preview failures" -m "Rewrite the DXS-NG-042/053, \$shell-stub, data-generate-gap and render.png rows; add rows for DXS-NG-056 on push, DXS-NG-057 in preview, wrong binding family, TS2300 re-import, unseeded embedded grid, blank CAC without harness-inputs, widget-destined CAC authored full-page, and refresh arity." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `component-wiring-check` — CAC `componentReferences` audit section

**Files:**
- Modify: `D:\Git\skills-253347\skills\datex-studio\component-wiring-check\references\component-wiring.md` — append a new `## Custom Angular Component \`componentReferences\`` section after the last paragraph (line 46)
- Modify: `D:\Git\skills-253347\skills\datex-studio\component-wiring-check\SKILL.md` — `depends:` (line 24, append one entry), References list (line 38, append one bullet), Diagnostic Index (line 160, append one row)
- Test: grep + link check (below)

**Interfaces:**
- Consumes (Task 1): `references/custom-angular-components.md#generated-surface-per-kind` and `#componentrefs--embedding-another-component`.
- Consumes (.NET plan): the server checks existence + kind only for CAC references (`GetContract(new BaseReferenceConfig { configId = name, moduleId = NormalizeModuleId(r.moduleId) })` with `expectedConfigurationTypeId`), never `configParameters` — there is no parameter mirror on a CAC reference.
- Produces: the anchor `#custom-angular-component-componentreferences` in `component-wiring.md` (linked from the skill's References bullet).

- [x] **Step 1: Write the failing check and run it**

```bash
cd "D:/Git/skills-253347"
W=skills/datex-studio/component-wiring-check
grep -c "^## Custom Angular Component \`componentReferences\`" "$W/references/component-wiring.md"   # expect after: 1
grep -c "  - custom-angular-component-creator" "$W/SKILL.md"                                        # expect after: 1
grep -c "component-wiring.md#custom-angular-component-componentreferences" "$W/SKILL.md"           # expect after: 2 (References bullet + Diagnostic row)
grep -c "is not a known element" "$W/SKILL.md"                                                      # expect after: 1
```

Expected now (failure): `0`, `0`, `0`, `0`.

- [x] **Step 2: Append the section to `references/component-wiring.md`**

Append after the final paragraph (the one beginning `**Grids additionally carry \`rowVars\`**`), separated by a blank line:

```
## Custom Angular Component `componentReferences`

A Custom Angular Component (type 36) embeds other components through `componentReferences: [{ referenceName, moduleId, kind }]` (`manifest.componentRefs` in the `dxs ng` working folder). The reference is thinner than every other reference site, so the audit is different:

- **`moduleId` follows the rule above verbatim** — the **target's** owning module. Omitted/blank means the CAC's own application (the host app, or the package the CAC lives in). A same-app target with `moduleId` set to the CAC's own module is redundant but harmless; a cross-module target with a blank `moduleId` does not resolve.
- **There is no `configParameters` mirror.** Bindings are hand-written in the CAC's template (`[<inParamId>]="…"`), so the platform checks **existence and kind only** (`validate` on save/publish; `dxs ng push` preflight `DXS-NG-056`). The "missing / extra configParameters" traps do not apply; their equivalents are template bindings.
- **`kind`** must be one of `selector, grid, editor, form, card, list, widget` (case-sensitive) and must match the target's real configuration type — a Grid named like a Selector is reported as the wrong type.

Audit a CAC reference with three checks, in order:

1. `kind` ∈ the list above.
2. The target exists in the module `moduleId` names (or in the CAC's own application when blank): `dxs configuration list <kind> -b <branch>`.
3. Every **required** `inParam` of the target is bound in the CAC template (`dxs configuration get customangularcomponent <id> -b <branch>` → `code.template`); an unbound required input renders the target's `Please provide <id>` block at runtime instead of data.

Tags, classes and the two binding families per kind are documented once, in [custom-angular-components.md → Generated surface per kind](../../custom-angular-component-creator/references/custom-angular-components.md#generated-surface-per-kind). Fixes belong to `custom-angular-component-creator` (edit `manifest.json`, `dxs ng preview --refresh`, `dxs ng push`), never to a JSON round-trip of the type-36 body.
```

- [x] **Step 3: `SKILL.md` — `depends:`**

Insert after the line `  - component-validator` (line 24, the last `depends:` entry):

```
  - custom-angular-component-creator
```

- [x] **Step 4: `SKILL.md` — References bullet**

Insert after the line beginning `- [../tailoring-overlay/](../tailoring-overlay/)` (line 38):

```
- [references/component-wiring.md → Custom Angular Component `componentReferences`](references/component-wiring.md#custom-angular-component-componentreferences) — how the audit applies to a CAC's embedded components (same `moduleId` rule; no `configParameters` mirror; kind ∈ allow-list, target exists, required inParams bound in the template)
```

- [x] **Step 5: `SKILL.md` — Diagnostic Index row**

Insert after the row beginning `| "Outdated contract" at import |` (line 160):

```
| A CAC's embedded component tag "is not a known element" (`NG8001`), or `dxs ng push` fails with `DXS-NG-056` | A `componentReferences` entry has the wrong `kind`, a `moduleId` that is not the target's owning module, or names a component that does not exist on the branch — see [component-wiring.md → Custom Angular Component `componentReferences`](references/component-wiring.md#custom-angular-component-componentreferences) |
```

- [x] **Step 6: Re-run the check and the link script**

```bash
cd "D:/Git/skills-253347"
W=skills/datex-studio/component-wiring-check
grep -c "^## Custom Angular Component \`componentReferences\`" "$W/references/component-wiring.md"
grep -c "  - custom-angular-component-creator" "$W/SKILL.md"
grep -c "component-wiring.md#custom-angular-component-componentreferences" "$W/SKILL.md"
grep -c "is not a known element" "$W/SKILL.md"
find skills docs README.md CLAUDE.md -name '*.md' | while read -r f; do
  d=$(dirname "$f")
  grep -oE '\]\(([^)#]+\.md)(#[^)]*)?\)' "$f" | sed -E 's/^\]\(//; s/(#[^)]*)?\)$//' | while read -r t; do
    case "$t" in /*|http*) continue;; esac
    [ -f "$d/$t" ] || echo "BROKEN: $f -> $t"
  done
done | sort -u
```

Expected: `1`, `1`, `2` (References bullet + Diagnostic row), `1`; the link script prints only the pre-existing `BROKEN: docs/superpowers/specs/2026-03-26-skill-split-design.md -> references/file.md`.

- [x] **Step 7: Commit**

```bash
git -C "D:/Git/skills-253347" add skills/datex-studio/component-wiring-check/references/component-wiring.md skills/datex-studio/component-wiring-check/SKILL.md
git -C "D:/Git/skills-253347" commit -m "docs(wiring-check): audit rules for CAC componentReferences" -m "Add a section on Custom Angular Component componentReferences: the moduleId rule applies verbatim, there is no configParameters mirror (existence + kind only), and the three-check audit (kind in list, target exists in that module, required inParams bound in the template), linking to the per-kind table in the CAC reference. Add the References bullet, a Diagnostic-Index row, and the depends entry." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Walk `docs/cli-release-checklist.md` (§1–§4) and record the CLI version

**Files:**
- Modify: `D:\Git\skills-253347\docs\cli-release-checklist.md` — §2 table (lines 46–48; the row to anchor on is line 48): add one row for the embeddable-kind enumeration
- Test: §1 source check against the CLI worktree, §3 boilerplate grep sweep across `skills/`, §4 link script (all below)

**Interfaces:**
- Consumes (CLI plan): `EMBEDDABLE_KINDS` in `src/dxs/ng/manifest.py`; the `dxs ng` group docstring line listing the kinds (`src/dxs/commands/ng/__init__.py`); error codes `DXS-NG-056` in `src/dxs/commands/ng/api.py` and `DXS-NG-057` in `src/dxs/commands/ng/preview.py`; the released `version` in `pyproject.toml` (base at plan time: `0.5.8`).
- Produces: the recorded CLI version in the final commit message (checklist "Done means").

- [x] **Step 1: §1 behavior drift — verify the CLI source, not the release note (gate for landing order)**

```bash
cd "D:/Git/datex-studio-cli-253347"
grep -rn "DXS-NG-056" src/dxs/commands/ng/api.py | head -3          # expect: at least one line (the preflight code)
grep -rn "DXS-NG-057" src/dxs/commands/ng/preview.py | head -3      # expect: at least one line (harness compile failed)
grep -n "EMBEDDABLE_KINDS" src/dxs/ng/manifest.py | head -3         # expect: the frozenset definition
grep -n "selector, grid, editor, form, card, list, widget" src/dxs/commands/ng/__init__.py   # expect: 1 line (group docstring)
grep -m1 '^version' pyproject.toml                                  # record this value for Step 5
```

Expected: every grep prints at least one line. **If any prints nothing, the CLI plan has not landed — stop here; the skills commits from Tasks 1–6 must not be pushed/merged until it has (landing order: platform → CLI → skills).** The `version` line is the value to record.

- [x] **Step 2: §2 enumeration drift — add the kind table's regeneration row**

In `docs/cli-release-checklist.md`, insert directly after the table row that begins `| \`configurationTypeId\` table in [\`datex-studio-conventions/file-format.md\`]`:

```
| Embeddable-kind table (`kind` allow-list for CAC `componentRefs`) in [`custom-angular-component-creator/references/custom-angular-components.md`](../skills/datex-studio/custom-angular-component-creator/references/custom-angular-components.md#generated-surface-per-kind) | `dxs ng --help` (the group help lists the kinds); source of truth `EMBEDDABLE_KINDS` in the CLI's `src/dxs/ng/manifest.py`, pinned equal to codegen and .NET — a new kind means a new table row **and** its generated tag/class/binding/mock columns |
```

- [x] **Step 3: §3 boilerplate drift — the sweep across `skills/` (expected output listed exactly)**

```bash
cd "D:/Git/skills-253347"
find skills -name '*.md' | xargs grep -n "selectors first"                                         # expect: NO output
find skills -name '*.md' | xargs grep -n "is generic over component kind"                          # expect: NO output
find skills -name '*.md' | xargs grep -n "compilable-but-inert\|may not materialize in the harness" # expect: NO output
find skills -name '*.md' | xargs grep -n "componentRefs\` do \*\*not\*\* round-trip"                 # expect: NO output
find skills -name '*.md' | xargs grep -n "Type/template errors surface"                            # expect: NO output
find skills -name '*.md' | xargs grep -n "not your code\|90s headroom"                             # expect: NO output
find skills -name '*.md' | xargs grep -n "silently skip"                                            # expect: NO output
find skills -name '*.md' | xargs grep -ln "_single"                                                 # expect exactly two files: the CAC SKILL.md and references/custom-angular-components.md
find skills -name '*.md' | xargs grep -n "selector, grid, editor, form, card, list, widget" | wc -l  # expect: 6 or more, all in the two CAC files and component-wiring.md
find skills -name '*.md' | xargs grep -n "hub-widget\|editor-widget\|\"\$container\": \"tab\""       # expect: NO output (only page | widget | dashboard-widget exist)
grep -rn "Wavelength" skills/datex-studio/custom-angular-component-creator skills/datex-studio/component-wiring-check   # expect: NO output (other skills legitimately mention Wavelength)
```

Expected: exactly as annotated on each line. Any stale hit is a copy the earlier tasks missed — fix it in the file it lives in (never a partial fix), amend nothing, add it to this task's commit.

- [x] **Step 4: §4 links**

```bash
cd "D:/Git/skills-253347"
find skills docs README.md CLAUDE.md -name '*.md' | while read -r f; do
  d=$(dirname "$f")
  grep -oE '\]\(([^)#]+\.md)(#[^)]*)?\)' "$f" | sed -E 's/^\]\(//; s/(#[^)]*)?\)$//' | while read -r t; do
    case "$t" in /*|http*) continue;; esac
    [ -f "$d/$t" ] || echo "BROKEN: $f -> $t"
  done
done | sort -u
```

Expected: after filtering with `| grep -v 'docs/superpowers/plans/'`, exactly one line, the pre-existing `BROKEN: docs/superpowers/specs/2026-03-26-skill-split-design.md -> references/file.md`, and nothing else.

- [x] **Step 5: Commit, recording the CLI version from Step 1**

Substitute the version printed by `grep -m1 '^version' pyproject.toml` in Step 1 for `<version>` (e.g. `0.5.9` if that is what `pyproject.toml` says; it is `0.5.8` before the CLI plan's bump):

```bash
git -C "D:/Git/skills-253347" add docs/cli-release-checklist.md docs/superpowers/plans/2026-09-15-cac-embedding-skills.md
git -C "D:/Git/skills-253347" commit -m "docs(release-checklist): embeddable-kind table row; record CLI version for 253347" -m "Walked docs/cli-release-checklist.md for the dxs release that ships DXS-NG-056/057 and the seven embeddable kinds: §1 verified against the CLI source (EMBEDDABLE_KINDS, DXS-NG-056 in commands/ng/api.py, DXS-NG-057 in commands/ng/preview.py, kinds in the ng group help); §2 added the kind-table regeneration row; §3 boilerplate sweep clean (selectors first, cross-module stub, round-trip claim, render-error claims removed everywhere); §4 links resolve (one pre-existing broken link in the 2026-03-26 spec left as is)." -m "Skills checked against dxs <version>." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Expected: the commit succeeds; `git -C "D:/Git/skills-253347" status --short` prints nothing.

---

## Self-review

**Spec coverage — Workstream D, E4 and the checklist walk → tasks**

| Spec item (Workstream D / E4) | Task |
|---|---|
| Rewrite `componentRefs` section: contract line | Task 1 Step 4 (JSON contract line + `kind`/`module` bullets) |
| Per-kind table from "Shared contract" (kind, tags, class, binding family, mock keys) | Task 1 Step 4 (`#### Generated surface per kind`) |
| Two markup examples: selector value-bound; grid inParams + refresh with `@ViewChild` and the sanctioned `refresh(skipParent, skipChildren, childToSkip)` override forwarding to the child | Task 1 Step 4 (`#### Two binding families — markup`) |
| "What to read in the harness": generated `<P>.<ref>.component.ts`; CAC `imports:` must list a `forwardRef` per resolved ref | Task 1 Step 4 (`#### What to read in the harness`) |
| The `module` rule | Task 1 Step 4 (second bullet) + Task 6 (wiring-check section) |
| Note that preview and push are both strict | Task 1 Step 4 (`#### Preview and push are both strict`) |
| Replace the wrong cross-module "`$shell` stub" claim (`$shell.open*` inert in every harness for every component) | Task 1 Steps 4–5; Task 5 Step 4 (SKILL.md `$shell` row) |
| Update the manifest example (~121–135) | Task 1 Step 3 |
| Update the coverage-gap paragraph (~113) | Task 1 Step 2 |
| Add the `DXS-NG-056` row to the error table | Task 1 Step 6 |
| Item 4 — "Authoring for a target" table: Widget row (Widget of type Custom Angular Component, 200px / 50% under 1200px / dashboard section, compact, no internal title, no scrollbars, 4px radius, tokens, `"$container": "widget"`) | Task 3 Step 2 |
| Tab content row (`.blade-content`, own vertical scroll, toolbar conventions from `04-patterns.md`/`03-components.md`, sanctioned `refresh`) | Task 3 Step 2 |
| Page / shell view row (full page, blade sizing, one primary action) | Task 3 Step 2 |
| Common row (sentence case, action-verb buttons, spacing scale, never a literal hex) | Task 3 Step 2 |
| Design-system references to read (README, 02-tokens, 03-components, 04-patterns) | Task 3 Step 2 (row "Read" column, relative links to the vendored byte-identical copies) + Step 3 (Cross-References) |
| No new manifest field; `displayModes` vestigial, must not be repurposed; `$container` from requirements | Task 1 Step 3 (`displayModes` note) + Task 3 Step 2 (intro) + Task 4 Step 9 (Phase 1 step 3) |
| `SKILL.md` pointer in the requirements step | Task 4 Step 9 |
| `SKILL.md` line 17 | Task 4 Step 3 |
| `SKILL.md` line 19 | Task 4 Step 4 |
| `SKILL.md` line 61 | Task 4 Step 5 |
| `SKILL.md` line 232 (push gate) | Task 4 Step 14 |
| `SKILL.md` line 252 (componentRefs DO round-trip; only datasources/mocks/node_modules do not) | Task 4 Step 16 |
| `SKILL.md` line 285 | Task 5 Step 5 |
| Common-Mistakes rows: 056 on push; wrong binding family; TS2300 re-import; grid rows without seeding; widget-destined CAC authored full-page | Task 5 Step 7 (plus 057, blank CAC, refresh arity) |
| `component-wiring.md` short section (moduleId rule; no `configParameters` mirror; audit = kind ∈ list, target exists in that module, required inParams bound) + `SKILL.md` References bullet | Task 6 |
| E4: remove "type/template errors surface in the render" and "DXS-NG-053 is not your code" | Task 2 Steps 4–5 (reference), Task 4 Step 12 and Task 5 Step 3 (SKILL.md) |
| E4: document `DXS-NG-057`, `render.log`, `.dxs-serve.log`, `mocks/harness-inputs.json`, `$container` | Task 2 Steps 2–6; Task 4 Steps 7, 8, 10–13; Task 5 Steps 2, 7 |
| E4: the order `preview --refresh` → `data generate` → `preview` | Task 2 Step 4; Task 4 Steps 7, 8, 11; Task 5 Step 7 |
| Checklist §1 behavior drift (push gains a gate, data generate seeds more) — documented once, source-verified, pre-empting "push is broken" | Task 4 Step 14 ("a new gate, not a broken CLI"); Task 7 Step 1 |
| Checklist §2 enumeration (kind allow-list source recorded) | Task 7 Step 2 |
| Checklist §3 boilerplate sweep for `selectors first`, `_single`, `inert`, `does not round-trip` | Task 7 Step 3 |
| Checklist §4 links | Tasks 3, 6, 7 |
| Record the CLI version checked against | Task 7 Step 5 |

Not mapped to a task (deliberately out of this plan's scope): the CLI-side docs (`docs/dxs-ng-first-local-run.md`, `docs/custom-angular-manual-test-runbook.md`, `commands/ng/__init__.py` docstring) belong to the CLI plan (C5); `README.md` in the skills repo needs no row (no new config type); the pre-existing broken link in `docs/superpowers/specs/2026-03-26-skill-split-design.md` predates this change and is left untouched.

**Placeholder scan:** searched this plan for `TBD`, `TODO`, `add validation`, `handle edge cases`, `similar to Task` — none present. Every replacement is given as full text; every check is an exact command with its expected output. The only substitution the executor performs is `<version>` in Task 7 Step 5, derived by the command in Task 7 Step 1 (not a guess). The `<…>` tokens inside the documentation text (`<folder>`, `<branch>`, `<ref>`, `<P>`, `<id>`) are the skills repo's own placeholder convention for user-supplied values and are intentional.

**Type / contract consistency check:**
- Kind literals appear in canonical order `selector, grid, editor, form, card, list, widget` in every enumeration (Tasks 1, 4, 5, 6, 7 grep asserts the string).
- `module` (manifest) ↔ `moduleId` (envelope / .NET / wiring-check) — both spelled and explained consistently; blank = own application.
- Error codes: `DXS-NG-056` = push component-reference preflight (unconditional); `DXS-NG-057` = harness compile failed (no screenshot); `DXS-NG-042` = `ng serve` not ready (+ log tail); `DXS-NG-053`/`052` = browser step — consistent across reference, SKILL.md rows, and wiring-check.
- Widget type: label `Custom Angular Component`, body `type: "customAngularComponent"`, sub-config `customAngularComponentConfig` with `configId`/`moduleId`/`configParameters`/`configOutParameters`/`outParamsChangeFlowConfig`, mapping `$widget.inParams.<id>`, drift `Outdated contract`, wrapper calls `refresh(true, false, null)` — matches the spec's shared contract and A9/B3/B5.
- `refresh` signature `refresh(skipParent = false, skipChildren = false, childToSkip: string = null)` is identical in the reference example, SKILL.md tab-content section, the Common-Mistakes row, and the target table.
- `$container` values are exactly `page` | `widget` | `dashboard-widget` (Task 7 Step 3 greps that no `hub-widget`/`editor-widget`/`tab` variant slipped in from the research notes).
- Generated surface per kind matches the templates: `$finish` from `close.partial.hbs` is included by grid/editor/form/card/list/widget templates; per-event `@Output`s come from `events.partial.hbs`, included by grid/editor/form/card/list but not the widget templates (hence "No per-event outputs" on the widget row); `(outParamsChange)` only when the target declares outParams (pie widget only among widgets); grid inputs are `any` (`grid.component.hbs:326`), the other kinds use the typed `inputs.partial.hbs`; `Please provide` blocks exist in grid/editor/form/card and the pie/gauge widget HTML, not in list, fat-number widget or selector HTML.
- All new markdown links are relative and resolve (Tasks 3, 6, 7 run the checklist's link script); the vendored design-system files linked (`02-tokens.md`, `03-components.md`, `04-patterns.md`, `05-voice-and-copy.md`, `06-traps.md`) are byte-identical to `D:\Git\claude-design\datex-studio-app\guidelines\guidelines\` at plan time, so the rules cited from the source hold for the linked copies.
