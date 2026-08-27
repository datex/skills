# Custom Angular Components

A **Custom Angular Component** (CAC, `configurationTypeId: 36`) is an **author-written standalone Angular component** that runs inside the generated Datex Studio app with the platform context injected. It is the escape hatch for UI that the declarative components (grid, form, hub, selector, editor) can't express — bespoke charts, dashboards, visualizations, and custom layouts. Unlike every other component type, a CAC is not a declarative JSON body: you write the actual `component.ts` / `.html` / `.scss`. Author it with the **`dxs ng`** command family and the screenshot-driven preview loop (see the parent [SKILL.md](../SKILL.md)). This doc is the authoring reference; for the platform `$`-globals see [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md).

> _Template note:_ this doc deviates from [docs/component-doc-template.md](../../../../docs/component-doc-template.md) — the template's JSON-body sections (Minimal Valid Skeleton, Required Top-Level Fields) are N/A because a CAC is a `dxs ng` working folder, not a single JSON body; `manifest.json` and the two author regions play those roles here.

## Purpose & When to Use

Reach for a CAC when the requirement is genuinely custom UI: a chart/visualization, a dashboard tile arrangement, a bespoke interaction, or a layout no declarative component produces. If the requirement is a tabular list use a **grid**; a single-entity view/edit use an **editor**; transient input a **form**; a dropdown a **selector**; a container a **hub**. A CAC is more powerful and more expensive to maintain than any of those — choose it only when the declarative components can't do the job.

## Authoring model — why this is different

Every other component type is authored as a JSON body through `dxs configuration`. A CAC is authored as **real code** through `dxs ng`:

1. **`dxs ng create` / `pull`** ask the server to generate a **light harness** for the branch and materialize it locally.
2. You edit the **two author regions** (and the template/styles) — real TypeScript/HTML/SCSS.
3. **`dxs ng preview`** renders the component locally to a **PNG** so you iterate visually.
4. **`dxs ng push`** extracts your regions and upserts the type-36 config — the only step that touches Studio.

The branch is still the system of record; the local folder is a throwaway working copy the harness materializes. Nothing exists in Studio until `push`.

## File Location & Naming

`dxs ng create <Name> -b <branch> [-d <dir>]` materializes this layout (the folder is a local working copy, not the system of record):

```
<name>/
  angularapp/                         # the runnable light-harness Angular app
    src/app/
      app.<referenceName>.component.ts    # ← you edit the two regions here
      app.<referenceName>.component.html  # ← template
      app.<referenceName>.component.scss  # ← styles
      … (generated context services: app.datasource.index.ts, app.shell.service.ts, …)
  manifest.json                       # identity + IO + datasource/flow refs + displayModes
  mocks/harness-mocks.json            # fixtures the preview's $datasources/$flows read
```

- **`<Name>` (the `create` arg): PascalCase** (`OutboundCommandCenter`).
- **`referenceName`: camelCase** derived from it (`outboundCommandCenter`) — the code-facing handle.
- **selector:** kebab-case `app-<kebab-case-name>` (e.g. `app-outbound-command-center`) — auto-derived into `manifest.json`; you never set it.
- **`configurationTypeId`: 36**; CLI type name (for `dxs api` / generic tooling): `customangularcomponent`.
- **Working-dir convention:** `-d <dir>` sets the **parent** directory (default: current dir). Pass `-d components` so working copies land under a shared `components/<Name>/` directory (`dxs ng create OutboundCommandCenter -d components` → `components/OutboundCommandCenter/`) rather than scattering them in the current directory.

## The two author regions

You edit **only** these two regions inside `app.<referenceName>.component.ts`, plus the `.html` and `.scss`:

```ts
//#region __COMPONENT_TYPES__
//   imports, interfaces, type declarations  — spliced verbatim on push
//#endregion __COMPONENT_TYPES__

@Component({ selector: 'app-<ref>', templateUrl: …, styleUrls: […], imports: [SharedModule], … })
export class app_<Ref>Component implements OnInit, OnChanges, OnDestroy {
  // generated inputs / constructor (DO NOT EDIT) — injects the $-context:
  constructor(
    protected $utils: UtilsService,
    protected $settings: SettingsValuesService,
    protected $shell: app_ShellService,
    protected $datasources: app_DatasourceService,
    protected $flows: app_FlowService,
    protected $frontendFlows: app_FrontendFlowService,
    protected $reports: app_ReportService,
    protected $localization: app_LocalizationService,
    protected $operations: app_OperationService,
    protected $userSettings: app_UserSettingsService,
  ) { }

  //#region __COMPONENT_BODY__
  //   fields, methods, getters, lifecycle body  — spliced verbatim on push
  //#endregion __COMPONENT_BODY__

  // generated lifecycle stubs (DO NOT EDIT)
}
```

**Hard rule:** never edit the wrapper `class` line, the `@Component` decorator, the constructor, or the `//#region … //#endregion` sentinels. `dxs ng push` extracts your code from **between** the sentinels (byte-for-byte); damaging them makes `push` fail locally before any network call. `SharedModule` is imported, so template directives (`*ngFor`, `*ngIf`, `[ngClass]`, `[style.*]`, `[attr.*]`) and the platform's UI libraries (Angular Material, AG-Grid, ApexCharts, ActiveReports) are available.

## Runtime Globals (the injected `$`-context)

The constructor injects the real, branch-typed platform services — use these, **never** raw `HttpClient`/`fetch`:

| Global | Service | Use |
|---|---|---|
| `this.$datasources` | `app_DatasourceService` | read data (OData/flow datasources on the branch) |
| `this.$flows` | `app_FlowService` | run backend flows |
| `this.$frontendFlows` | `app_FrontendFlowService` | run client-side flows |
| `this.$shell` | `app_ShellService` | dialogs, toasts, navigation |
| `this.$utils` | `UtilsService` | date/format/http helpers |
| `this.$settings` | `SettingsValuesService` | app settings |
| `this.$reports` | `app_ReportService` | run/preview reports |
| `this.$localization` | `app_LocalizationService` | i18n |
| `this.$operations` | `app_OperationService` | operation assignments |
| `this.$userSettings` | `app_UserSettingsService` | per-user settings |

During `preview` (no backend), `$datasources`/`$flows` read from `mocks/harness-mocks.json` instead of calling the server, so the component renders with representative data offline. See [calling-conventions](../../datex-studio-runtime/calling-conventions.md) for the UI-tier rules.

## Mock data — `mocks/harness-mocks.json`

`dxs ng data generate <folder> -b <branch>` seeds this file with typed placeholders for the `$datasources`/`$flows` the component references; fill in realistic values so the preview looks real. Lookup order the harness stubs use: `mocks["<ref>.<method>"]` → `mocks["<ref>"]` → a typed empty default (so an un-fixtured call never throws).

```json
{
  "ds_orders":       { "get": { "result": { "…": "…" } },
                       "getList": { "result": [ { "…": "…" } ], "totalCount": 2 } },
  "ds_order_lines":  { "getList": { "result": [ { "…": "…" } ], "totalCount": 1 } },
  "fn_submit_order": { "run": { "success": true } }
}
```

Keys are datasource/flow `referenceName`s; datasource sub-keys are `get` / `getList` / `getByKeys`, flow sub-key is `run`.

**Coverage gaps to check by hand.** `dxs ng data generate` does not seed a key for every reference: `$frontendFlows` refs aren't seeded at all, and a componentRef selector's backing datasource is silently skipped when its branch resolution fails during generation (no error, no key). After generating, open the file and confirm every datasource the component — and any embedded componentRef selector — reads has a key; add whatever is missing by hand.

**`$frontendFlows` are never mocked.** Unlike `$datasources`/`$flows`, `$frontendFlows` run as real, computed client-side code in the harness during preview — a mock entry seeded for a frontendFlow key is inert. The preview always shows the flow's actual computed result.

## `manifest.json`

Carries the component's identity + IO + declared datasource/flow refs. `push` uses it to build the type-36 config; changes to IO (new `@Input`/`@Output`) need codegen re-wiring, so re-preview with `--refresh -b <branch>` after editing it. The `datasources` array only *declares* dependencies — it never creates the datasource. Create it with `datasource-creator` on the branch **first** (ideally before materializing) so the harness types the `$datasources.<ref>` stub the body compiles against; see [Reading real data](#reading-real-data-via-datasources).

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
    { "name": "statusSelector", "kind": "selector" },
    { "name": "regionSelector", "kind": "selector", "module": "Waves" }
  ]
}
```

The config `title` and `description` are derived from `displayName` — keep `displayName` ≤ 100 chars (platform column limit). `pull` builds `manifest.json` from the config's stored properties (`referenceName`, `title`, `inParams`, `outParams`).

### `componentRefs` — embedding another component

Each entry: `{ "name": "<referenceName>", "kind": "selector", "module": "<moduleRefName>" }`
— `module` is the owning module's reference name (e.g. `"Waves"`); omit it for a
same-app component. A referenced selector materializes both generated variants
(`_single` and `_multi`) in the harness; read the generated component files to get
the exact tag (`@Component` selector) and the `@Input`/`@Output` names to bind.
A manifest `componentRefs` change is an IO-level change: re-run
`dxs ng preview <folder> --refresh -b <branch>` to re-wire the harness.

**Cross-module refs may not materialize in the harness.** A same-app componentRef
(no `module`) generates a real, bindable component. A cross-module componentRef
(`module` set) can instead come back as a compilable-but-inert stub — a `$shell`
dialog-opener with `const component = null as any;` — with no real
`.component.ts`/`.html` generated for it anywhere in the harness. Preview cannot
validate a cross-module componentRef in that state; keep it as styled static
content for preview purposes and verify the real embedded control in Studio
after `push`.

## The light harness

`create`/`pull` don't download the whole generated app. The server generates a **light harness**: **only** the candidate component is a real, fully-generated component + the real typed `$`-context services + mock-reading stub services + a minimal bootstrap — with the other components, the MSAL auth shell, and routing pruned out. That's what makes the loop fast: the app compiles in ~15s (not minutes) and boots straight into the component with no login. The pruning + light bootstrap are server-side; you just get a folder that previews quickly.

Because only your candidate is real, the full typed surface is still there for authoring — `$datasources`/`$flows`/`$frontendFlows`/`$types` reflect the **real branch** (discover and reuse any of them), and `$shell` exposes every `open<X>Dialog`/`open<X>` — but calls to **other** components (e.g. `$shell.open<X>Dialog(...)`) are compilable, discoverable **stubs**: they won't actually open that dialog/view in preview. Your own component's UI and its `$datasources`/`$flows` reads (served from `mocks/`) are fully live.

## Preview & the screenshot loop

```bash
dxs ng preview <folder>              # serve locally + screenshot -> <folder>/render.png
dxs ng preview <folder> -o out.png   # custom output path
dxs ng preview <folder> --refresh -b <branch>   # after a manifest/IO change
dxs ng preview <folder> --clean      # kill a stuck server + reset the browser session, then rebuild
dxs ng stop <folder>                 # stop-only disposal: server + browser session + lock (idempotent)
```

`preview` copies `mocks/` into the harness assets, runs `npm install` once, warms `ng serve`, and drives a headless browser to screenshot the component. Read the PNG, compare to the target, edit, re-run — the loop is the acceptance test for bespoke UI. Type/template errors surface in the render (the real component compiles).

`preview` captures the component's **default** rendered state — it doesn't interact. When a mode/variant is switched by in-component UI (not an `@Input`), temporarily set that default (or drive it via an `@Input`/mock) to screenshot each variant.

**A full-page/dashboard CAC's `render.png` may be capped to one viewport.** The platform shell's global stylesheet forces `html, body { overflow: hidden }`, so `preview`'s full-page screenshot can only capture the outer document box (commonly ~569px tall) — it can't see past your own inner `overflow-y: auto` container no matter how much content that container holds. This is a platform-shell constraint, not a bug in your layout. To confirm content beyond the first viewport renders correctly, drive `agent-browser` directly against the harness's served port with a taller viewport rather than relying on `render.png` alone.

**A failed screenshot is not a failed render.** If `preview` errors with `DXS-NG-053` (`agent-browser 'wait' timed out`), the component usually compiled and served fine — the browser wait/capture step is the flake, not your code. (The wait step has 90s headroom to absorb the first compile, so a timeout usually means something real is stuck, not just a slow build.) A reused warm `ng serve` can also serve a **stale** build (edits not yet picked up). Before assuming your component is broken: re-run with `--clean` (fresh serve + fresh browser session), then confirm the real state by opening the served port (from `<folder>/.dxs-serve.lock`) with `agent-browser` and checking the mounted element actually has content — `agent-browser open http://localhost:<port>` then `agent-browser get html app-<referenceName>`. A non-empty `app-<ref>` with a blank capture is a screenshot-timing issue; a genuinely empty one points at your component/data. (Contrast: a real compile failure shows up as `DXS-NG-042` `ng serve did not become ready`, not `DXS-NG-053`.)

### Preview error codes & session lifecycle

`dxs ng preview` raises its own error codes for the screenshot toolchain (older dxs ≤0.4.13 leaked report-preview codes `DXS-RPT-042/043` here — if you see those, the CLI is outdated):

| Code | Meaning | First move |
|---|---|---|
| `DXS-NG-045` | folder not materialized (no `angularapp/`) | `dxs ng create` / `dxs ng pull` |
| `DXS-NG-043` | `npm install` failed in the harness | check Node/npm; `--clean` |
| `DXS-NG-042` | `ng serve` didn't become ready | extend `DXS_NG_SERVE_TIMEOUT`; re-run; `--clean` if it persists (on CLI ≤0.4.13 also caused by a relative folder argument — pass an absolute path) |
| `DXS-NG-047` | `push` datasource connection preflight failed (datasource missing on branch, or its `apiSettingName` not defined in branch settings) | regenerate the datasource against this branch; wire a connection in Studio; `--skip-connection-check` for mock-only dev |
| `DXS-NG-048` | `pull` target folder already exists | `preview --refresh` to keep local work, or `pull --force` to take server truth |
| `DXS-NG-049` | `pull --force` refused/failed to overwrite (not a CAC working copy, or files still locked) | check the target path; close whatever holds files, retry |
| `DXS-NG-050` | agent-browser not installed | `npm i -g agent-browser && agent-browser install` |
| `DXS-NG-053` | agent-browser step timed out | see "failed screenshot" above |
| `DXS-NG-055` | browser build missing/incompatible | `agent-browser install` |
| `DXS-NG-052` | other agent-browser failure | `--clean`, re-run; report if reproducible |

**Session lifecycle (self-healing):** each preview runs agent-browser in a transient named session (`dxs-ng-preview-<port>`), torn down completely (daemon, Chrome tree, `~/.agent-browser/<session>.*` state files) after every run. The historical Windows named-session launch flake ("Chrome exited early … without writing DevToolsActivePort") is **auto-retried once** after tearing down the wedged session — you only see it if the retry also fails. `--clean` additionally reaps stale `dxs-ng-preview-*` state files left by crashed runs. Net effect: **a wedged preview is reset with `--clean`; manual killing of Chrome/daemon PIDs or hand-deleting `~/.agent-browser` files is never required** — if you find yourself needing that, it's a CLI regression to report (see [SKILL.md → CLI-first — no workarounds](../SKILL.md#cli-first--no-workarounds-hard-rule)).

**Disposal:** the warm dev server survives across previews by design (fast re-previews). When done, `dxs ng stop <folder>` tears down the server (identity-checked PID+image kill), the agent-browser session, and the lock file — idempotent, safe to call unconditionally. `--clean` is the same teardown followed by a fresh serve (reset); `pull --force` runs it implicitly before replacing the working copy. Manual lock-reading / `taskkill` is never required on a CLI that has `stop`.

**Remaining known gap:** leaked `agent-browser-chrome-*` temp profile dirs can still accumulate under `%LOCALAPPDATA%\Temp` — a toolchain gap to report, not to script around.

**Degraded-but-honest path when the screenshot step stays blocked:** the visual loop is the acceptance test, but it is not the only gate — `ng serve` becoming ready proves the component compiles (that's the step *before* the browser), and `dxs ng push` still runs the server-side validator. If the user agrees to proceed without the screenshot, push, then say explicitly that the visual check was skipped and the rendered component must be eyeballed in Studio. Never present a push made this way as visually verified.

## Prerequisites

1. **Datex API in Development** on `https://localhost:5101` (harness codegen is dev-only). `dxs settings set api_base_url https://localhost:5101/api`; `dxs settings set verify_ssl false`.
2. **Authenticated** (`dxs auth status`, `@datexcorp.com`).
3. **agent-browser** — the **unscoped** package: `npm install -g agent-browser` then `agent-browser install`. (Not `@anthropic-ai/agent-browser`.)

## Timings (local, indicative)

| Phase | Cost |
|---|---|
| First `preview` after `create` | one-time `npm install` (minutes) + ~15–46s compile |
| Each later `preview` (warm) | ~10s |
| Edit → hot-reload (in-session) | ~4s |

Seconds-not-minutes after the one-time install — the light harness is what buys this.

## Common Patterns

### Data-driven visual from a computed getter

Body region holds the data + a computed value; the template renders it with `*ngFor` + style bindings (no chart lib needed for simple visuals):

```ts
//#region __COMPONENT_BODY__
bars = [ { label: 'Mon', value: 40 }, { label: 'Tue', value: 65 }, { label: 'Fri', value: 72 } ];
get total(): number { return this.bars.reduce((s, b) => s + b.value, 0); }
//#endregion __COMPONENT_BODY__
```

```html
<div class="bars">
  <div class="bar" *ngFor="let b of bars">
    <div class="fill" [style.height.%]="b.value"></div>
    <span>{{ b.label }}</span>
  </div>
</div>
<p>Total: {{ total }}</p>
```

### Reading real data via `$datasources`

**Create the datasource before you materialize the harness.** `$datasources.<ref>` resolves only for a real branch config — author it with `datasource-creator` (`dxs datasource generate` → `validate` → `dxs configuration upsert datasource`) **first**, then `dxs ng create`/`pull`, so the generated harness types the stub. `manifest.datasources` records the dependency; it never creates the datasource. (Added it after materializing? Re-materialize with `dxs ng pull` / `preview --refresh -b <branch>` and confirm it's listed in `angularapp/src/app/app.datasource.index.ts`.)

**Need the datasource's field shape for the row mapping? Use the CLI — never hand-parse the config JSON.** You must upsert before materializing anyway, so read the authoritative shape from the branch with `dxs report datasource-fields <ref> -b <branch>` (result type + `in_params` + flat field paths + collection nav-props). Validate the local generated file with `dxs datasource validate <file> -b <branch>` — exit **1** means it found errors (read `validation_errors` and fix; it is not a CLI malfunction) — and get its TypeScript type defs with `dxs datasource context <file> -b <branch>`. Do **not** reach for `jq`/`python` (or eyeball `outParams`/`queryOptionsObjectTypeDef`) to pull fields out of the JSON — that hand-parsing is a bad-experience workaround for commands that already exist. And after `dxs ng create`, the harness types `this.$datasources.<ref>` directly, so you often don't need a hand-written row interface at all — let the generated types drive the mapping.

Read it with **typed** access and keep the body clean — no cast, no embedded sample data, real empty/loading/error states. The body is spliced verbatim into the pushed config, so anything here ships to Studio:

```ts
//#region __COMPONENT_BODY__
rows: OrderRow[] = [];
loading = false;
error: string | null = null;

async ngOnInit() {
  if (this.inParams.orderId == null) { return; }   // real empty state — not fake data
  this.loading = true;
  try {
    const res = await this.$datasources.ds_orders.getList({ orderId: this.inParams.orderId });
    this.rows = res.result ?? [];                    // typed; in preview served from mocks
  } catch {
    this.error = 'Could not load orders.';
  } finally {
    this.loading = false;
  }
}
//#endregion __COMPONENT_BODY__
```

A missing datasource makes `this.$datasources.ds_orders` a **compile error** — that fail-fast is intended. Never cast it away (`$datasources as any`) or ship a fixture to hide it. Representative preview data goes in `mocks/harness-mocks.json` (seed with `dxs ng data generate`, then fill from a real dxs datasource/query) — transient, never pushed.

## Pre-Flight Checklist

The checklist lives in one place so it can't drift: run [../SKILL.md → Pre-Flight Checklist](../SKILL.md#pre-flight-checklist) before `push`. (Verification caveats — e.g. `dxs source explore configs`/`trace` not indexing type-36 — are in the parent skill's Common Mistakes table.)

## Cross-References

- [../SKILL.md](../SKILL.md) — the workflow and CLI lifecycle for this component type.
- [../../datex-studio-shared/branch-setup.md](../../datex-studio-shared/branch-setup.md) — branch selection (never assume a branch ID).
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) — the `$`-globals injected into the component.
- [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules (flows/datasources, not raw HTTP).
- [../../datasource-creator/references/datasources.md](../../datasource-creator/references/datasources.md) — authoring the datasources/flows a CAC reads.
- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — reference-name / display-name rules.
