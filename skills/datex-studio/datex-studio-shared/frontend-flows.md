# Frontend Flows

Frontend flows (`-frontendFlow.json`, `configurationTypeId: 27`) are the **client-side sibling of functions**. They share the function body shape (`nodes[].stepConfig.executeCodeConfig.code`) but execute in the **browser**, not the cloud backend — so they can touch `document`, the DOM, `window`, dispatch `CustomEvent`s, focus elements, read the clipboard, etc. Invoked via the `$frontendFlows.<Package>.<name>(...)` runtime global from UI-tier components (forms, grids, hubs, editors, selectors) and from other frontend flows. See [`runtime-globals.md`](../datex-studio-runtime/runtime-globals.md) (`$frontendFlows`), [`file-format.md`](../datex-studio-conventions/file-format.md) (cti table), [`functions.md`](../function-creator/references/functions.md) (backend sibling), and [`calling-conventions.md`](../datex-studio-runtime/calling-conventions.md).

## Purpose & When to Use

Choose a frontend flow when the logic must run in the user's browser:

- DOM/UI side effects: focus a field, scroll, dispatch a `CustomEvent` other components listen for, read/write the clipboard, trigger a file download.
- UI-orchestration helpers the platform ships externally (e.g. `Utilities.export_data_frontflow`, `Utilities.open_toaster_success_frontflow`).
- Anything needing `document` / `window` — backend **functions** (`$flows`, cloud-tier) cannot access these.

Choose a **function** (`-flow.json`, cti 9) for data/CRUD/business logic that runs server-side. The two are otherwise structurally identical; the cti (9 vs 27) routes execution to backend vs browser **and** decides which global (`$flows` vs `$frontendFlows`) resolves it.

## Confirmed Component Format

Frontend flows are a first-class configuration type: `dxs configuration types` lists `frontendflow`, and a real platform frontflow (`Utilities.export_data_frontflow`) reports `configurationTypeId: 27`. The body shape is identical to a function's (`nodes[0].stepConfig.executeCodeConfig.code`, `start`, `inParams`/`outParams`); **only the `configurationTypeId` differs: 27, not 9**. Confirmed via `dxs configuration validate frontendflow` → `status: valid`.

**The wrong-cti failure mode:** authored with `cti: 9`, the file imports as a backend function (registered under `$flows.<Pkg>`), so `$frontendFlows.<Pkg>.<name>` can't resolve it — the dispatcher proxy throws `TypeError: Cannot read properties of undefined (reading '_<name>')` at invocation (the leading `_` is the platform's `$`→`_` rewrite). Upload as dxs type **`frontendflow`**, not `flow`. A prior `cti: 9` upload may leave an orphaned function of the same name under `$flows` — harmless, but deletable.

## File Location & Naming

The branch is the source of truth (author via `dxs configuration` commands); the conventional export layout:

- Path: `src/frontend-flows/<verb_subject>_frontflow-frontendFlow.json`
- Suffix: `-frontendFlow.json`
- Naming: `_frontflow` reference-name indicator; snake_case; default package `Utilities`.
- Studio listing: **Data and logic → Frontend Flows**; upload as dxs type `frontendflow`.

## Minimal Valid Skeleton

Function-shaped body — only the `configurationTypeId` differs (single-line minified on disk):

```json
{"enableProgressAndCancelation":false,"configurationTypeId":27,"start":"step1","nodes":[{"id":"step1","type":"step","stepConfig":{"type":"ExecuteCodeActivity","executeCodeConfig":{"code":"// client-side TS; document / window available\n"},"next":null,"error":null},"decisionConfig":null}],"fromBaseConfiguration":null,"id":0,"referenceName":"<name>_frontflow","title":"<name>_frontflow","description":"<=100 chars>","inParams":null,"outParams":null,"vars":null,"events":null,"accessModifier":"public"}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `configurationTypeId` | Component kind | **27** — NOT 9. With 9 it imports as a backend function and `$frontendFlows.<pkg>.<name>` won't resolve it (dispatcher throws `Cannot read properties of undefined (reading '_<name>')`). |
| `referenceName` / `title` | Handle / display | snake_case, `_frontflow` suffix, matches filename stem. |
| `description` | Searchable | ≤100 chars (SQL column limit). |
| `accessModifier` | Visibility | `public` default. |
| `nodes[].stepConfig.executeCodeConfig.code` | Body | Same shape as a function; TS executes client-side. |

## Runtime Globals

Browser-tier — `document`, `window`, and DOM APIs are available (unlike backend functions). Platform globals verified usable from frontend-flow code: `$flow` (in/out params), `$flows.<Pkg>.<fn>` (call backend functions), `$frontendFlows.<Pkg>.<fn>` (call peer frontend flows), `$shell` (dialog openers + toasters — **package-scoped**; see the cross-package resolution pattern in [`runtime-globals.md`](../datex-studio-runtime/runtime-globals.md)), `$utils`, and the ambient UI enums (`EModalSize`, `EToasterType`, `EToasterPosition`). `$context.app.name` (the running app's identity) is available in frontend flows and component flow code but NOT in server-tier functions — pass it as an inParam when a backend flow needs it. _TODO: confirm `$apis` and `$datasources` availability client-side._

## Invocation Contract

Invoked as `await $frontendFlows.<Package>.<referenceName>({ ...inParams })` from UI-tier components and other frontend flows — **static member access only**.

**No dynamic dispatch.** `$frontendFlows.<Package>` is a statically-typed object with named methods and **no index signature** (confirmed from the platform type: `{ open_toaster_error_frontflow: (…) => Promise<…>; … }`). A runtime string key — `$frontendFlows[pkg][name]` or `$frontendFlows.<Package>[name]` — does NOT resolve: the transpiler mangles static member names to a `_`-prefixed form at compile time, which a string key can't match. It fails insidiously — the lookup returns a truthy proxy (`typeof fn === 'function'` passes), then `fn({})` throws `Cannot read properties of undefined (reading '_<name>')` **at call time**, not at resolve time. To invoke a flow chosen at runtime, route through a dispatcher frontend flow whose `switch` turns the name into a static call — one `case '<name>': await $frontendFlows.<Pkg>.<name>({}); break;` per dispatchable target. A target with no case silently no-ops, so add the case in the same change that adds the flow.

Backend functions are not expected to invoke `$frontendFlows` (server can't run browser code) — _TODO: confirm._

## Common Patterns

### Object inParams pass by reference (live caller state)

Passing an **object** to a frontend flow passes it **by reference** — the flow reads live state and its mutations are visible to the caller (proven by a shipped export frontflow reading live `$grid` state). This enables single-call wrapper APIs: a host hands the frontflow its state object (e.g. a `$hub.vars` object) and UI handles (a toolbar button model, the host component itself), and the frontflow mutates them in place — sets `state.filter`, restyles `button.control`, calls `component.refresh()` — so each host flow is one `await` with no return-value plumbing. Declare such inParams as `object` with an inline `objectTypeDef` matching the shared shape.

### DOM side effects

- Dispatch a `CustomEvent` on `document`/`window` that sibling components subscribe to (e.g. an app-wide "refresh active view" signal).
- Focus + select a tagged element (`document.querySelector('[data-my-tag]')`).
- One-shot `keydown` capture: attach a listener with `{ once: true, capture: true }`, resolve on the first non-modifier key.

### Browser keyboard handling

Hard-won rules for any frontend flow that listens to keyboard events:

- **`preventDefault` requires bypassing zone.js.** Angular's zone.js patches `addEventListener` and keeps **one shared native registration per (target, phase)** — every patched registration just appends to that registration's task list (`globalZoneAwareCaptureCallback` in a stack trace is the tell). If the shared registration is passive (common for `keydown`), even an explicit `{ passive: false }` on your listener is ignored and `preventDefault()` no-ops with `Unable to preventDefault inside passive event listener`. The escape hatch is the unpatched native API zone.js stashes on the target: `(document as any)['__zone_symbol__addEventListener']` / `['__zone_symbol__removeEventListener']`, called with `{ capture: true, passive: false }`. The robust shape is **two listeners with one job each**: a zone-patched dispatch handler (runs in the Angular zone so invoked flows get change detection; never preventDefaults; never calls `stopImmediatePropagation()` — that would skip sibling listeners on the same node) plus a native `__zone_symbol__` suppressor that only calls `preventDefault()`.
- **Match on `KeyboardEvent.code`, never `.key`.** `code` reflects physical key position (`"KeyP"`, `"Digit1"`, `"Slash"`); `key` reflects the typed character, which differs across QWERTY / AZERTY / QWERTZ / Dvorak layouts. A binding stored as `code: "KeyA"` hits the same physical key on every layout; one stored as `key: "A"` hits the Q key on AZERTY.
- **Some combos cannot be intercepted at all** — the browser/OS acts before or despite `preventDefault`, so treat them as unbindable: `F12` (devtools), `Alt+F4` (OS window close), `Escape`, `Tab` (all modifier variants), `Ctrl+T/N/W`, and — even with Ctrl+Shift held — `T` (reopen tab), `N` (incognito), `W` (close window), `P` (Firefox private window), `R` (hard reload), `I`/`J`/`K`/`C` (devtools), `Q` (quit), `B`/`D`/`O`, `Delete`, `Escape`. Adding `Alt` (Ctrl+Shift+Alt+key) lands in keyspace essentially unclaimed by browsers/OS. `Meta`/`Win` combos should be refused outright.
- **Interceptable-but-risky combos deserve a warning, not a block**: `F5`/`Ctrl+R` (reload), `Ctrl+P/S/F/O/H/J/L/D/G/U/E/K/B`, `Ctrl+C/V/X/A/Z/Y` (editing), `Alt+←/→/Home` (navigation), and bare typing keys. Note `F1` can be preventDefaulted in-page yet Edge still opens its Help page on top (browser-level; cannot be suppressed); `F11`/`F6` may similarly leak.
- **Guard editable targets**: don't fire non-function-key bindings while focus is inside `<input>`, `<textarea>`, `<select>`, or `[contenteditable]` — function keys (F1–F11) don't type characters and can fire regardless.

### Toasters

The `Utilities.open_toaster_*` frontend-flow family wraps `$shell.<Pkg>.openToaster`. Platform facts learned building close/click awareness into it (verified 2026-08-07):

- **`openToaster` returns `void` and `IToasterOptions` has no callback hooks** (confirmed in the designer contexts) — a flow cannot be told natively when its toast closes or is clicked. The working pattern is **DOM-diff detection**: snapshot `#toast-container [toast-component]` before opening, diff after to identify the new toast element, attach a capture-phase click listener, and resolve a close reason (`timeout | close_button | tap`) when the element leaves the DOM — MutationObserver on the container plus an `isConnected` interval as the teardown safety net. A body tap only counts as a close reason when `tapToDismiss` is on.
- **Resolve toast inner elements at event time, not hook-up time.** The toast host attaches synchronously, but its inner template (title/message/close button) is `*ngIf`-inserted on a later change-detection tick — a `querySelector('.toast-close-button')` at hook-up time returns null and misroutes close-button clicks as body taps. Use `event.target.closest('.toast-close-button')` inside the listener; it is immune to the render-timing gap and to Angular re-creating the node.
- **The param type system has no function type.** To accept callbacks, declare the members as optional `object` inside an inline `objectTypeDef` (functions are assignable to object; they type as `any` in the designer, letting function refs pass) and state the payload contract in the member descriptions. Function refs survive the `$frontendFlows` hop because object inParams pass by reference (see above).
- **Wrapper API shape**: the public `open_toaster_{info,success,warning,error}_frontflow` wrappers (and the mobile variants) take behavior flags nested under one `options` object (`play_sound`, `disable_timeout`, `tap_to_dismiss`), a `callbacks: { on_close?({ reason }), on_click? }` object, and a `wait_for_close: boolean` inParam paired with a `close_reason` outParam — the serialization-proof await-style alternative to callbacks.

## Pre-Flight Checklist

1. **`configurationTypeId: 27`** (not 9), and upload as dxs type **`frontendflow`** (not `flow`) — otherwise it registers under `$flows` and `$frontendFlows.<pkg>.<name>` can't resolve it.
2. Body uses only client-safe code; for server data, call a backend function via `$flows.<Pkg>.<fn>`.
3. `description` ≤100 chars; `accessModifier` set; `referenceName` matches the filename stem and carries the `_frontflow` indicator.
4. Declarative-string / `return;`-outparam encoding rules from [`file-format.md`](../datex-studio-conventions/file-format.md) apply (same body shape as functions).
5. If the flow is a runtime-dispatch target, its `case` exists in the dispatcher frontend flow (static-dispatch-only rule above).
6. Keyboard listeners that need `preventDefault` use the `__zone_symbol__` native API and match on `KeyboardEvent.code`.

## Cross-References

- [`functions.md`](../function-creator/references/functions.md) — backend sibling; identical body shape, cti 9.
- [`runtime-globals.md`](../datex-studio-runtime/runtime-globals.md) — `$frontendFlows` entry; `$shell` package-scoping and cross-package resolution.
- [`file-format.md`](../datex-studio-conventions/file-format.md) — cti table (27) + the wrong-cti failure mode.
- [`calling-conventions.md`](../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules.
