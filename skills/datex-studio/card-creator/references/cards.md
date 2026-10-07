# Cards — Authoring Reference

Authoritative reference for Datex Studio **card** components (`configurationTypeId: 11`, CLI type `card`, `-card.json` suffix). A card renders **one item** as a small framed block — header (title, description, icon or image), content fields, an action bar of buttons, an optional footer and tabs, and a colored border edge. Cards are never opened on their own: a [list](../../list-creator/references/lists.md) renders one card per datasource row through its `itemConfig`, and a [calendar](../../calendar-creator/references/calendars.md) renders each event through a card (`eventContentType: "card"`). Cards can also act as **inline editors**: content fields accept the full editable control union ([../../datex-studio-runtime/control-types.md](../../datex-studio-runtime/control-types.md)).

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Pick a **card** when you need a per-item template inside a repeating host:

- **List item** — one card per row of a list's datasource. The platform has no dynamic control creation, so data-driven repetition is "a list of cards"; nesting is conveyed by styling (indent, border color), not by nested controls.
- **Calendar event** — the calendar's `eventsConfig.eventContentConfig` points at a card and binds `$calendarEvent.entity.<col>` into its inParams.
- **Inline editor per item** — editable fields on the card, gated manually (cards have no form-validate hook).

Pick something else when:

- The UI is a **standalone dialog** that collects input or confirms an action → a form ([../../form-creator/references/forms.md](../../form-creator/references/forms.md)). A card has no shell opener and no `close()`.
- The UI edits **one hydrated entity** as a screen → an editor.
- The data is **tabular** (sortable columns, bulk selection) → a grid, not a list of cards.
- The tile is a **fixed big number or pie** with no click hook, toolbar or events → a widget ([../../widget-creator/references/widgets.md](../../widget-creator/references/widgets.md#purpose--when-to-use)).

A card is always authored together with its host: datasource → **card** → list (or calendar). The card must exist on the branch before the host validates, because the host's validate resolves the card's contract.

## File Location & Naming

- `configurationTypeId: 11`; CLI type `card`.
- Conventional file name `<referenceName>-card.json`; `referenceName` is snake_case and **ends in `_card`** ([../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md#component-naming-matrix)).
- `title` is a designer label (the rendered header comes from `headerConfig.title`); about half of the shipped cards set it equal to `referenceName`. A sentence-case display name is still preferred.
- Defaults: package `Utilities`, `accessModifier: "public"`, `description` mandatory and ≤100 chars ([../../datex-studio-conventions/defaults.md](../../datex-studio-conventions/defaults.md)).
- Param, var, event, field and action ids are snake_case.

## Minimal Valid Skeleton

Passed `dxs configuration validate card` (dxs 0.5.8):

```json
{
  "headerConfig": {
    "title": "$card.inParams.title",
    "description": "",
    "iconConfig": null,
    "imageConfig": null,
    "onTitleClickedFlowConfig": null
  },
  "contentConfig": {
    "fieldsets": [
      { "id": "body", "label": "", "hideTitle": true, "collapsible": false, "expanded": true, "fields": [] }
    ]
  },
  "actionsConfig": { "position": "left", "actionbar": [] },
  "borderConfig": { "position": "left", "color": "creation" },
  "flows": [],
  "onInitFlowConfig": null,
  "configurationTypeId": 11,
  "id": 0,
  "referenceName": "example_item_card",
  "title": "Example item",
  "description": "Renders one example item inside a list.",
  "inParams": [ { "id": "title", "type": "string", "required": true, "isCollection": false } ],
  "outParams": null,
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

Validate is lenient about blocks: an identity-only body (`configurationTypeId`, `id`, `referenceName`, `title`, `description`, `accessModifier`) also passes. Author the header/content/actions blocks anyway — a card without them renders nothing useful.

Verified live: every key sent as explicit `null` above (the header icon/image/click-flow blocks, `onInitFlowConfig`, `outParams`, `vars`, `events`) is dropped by the server on `get` after `upsert` — the same null-stripping behavior as every other component type, so omit a block rather than nulling it.

## Required Top-Level Fields

Key presence across 26 shipped cards in brackets.

| Key | Required | Notes |
|---|---|---|
| `configurationTypeId` | yes | `11`. |
| `id`, `referenceName`, `title`, `accessModifier` | yes | Standard identity. `id: 0` for a new card. |
| `description` | yes (convention) | Non-empty, ≤100 chars. Missing on 5 shipped cards — do not copy that. |
| `inParams` | usual (25) | What the host binds per item. Every inParam must be mirrored by the host's `configParameters` (list validate enforces it). |
| `headerConfig` | usual (24) | `title`, `description` (TS expressions; `""` = empty), `iconConfig` `{icon, text, size?}` (3), `imageConfig` `{src, size}` (1), `onTitleClickedFlowConfig` `{flowId}` (12). |
| `contentConfig` | usual (25) | `{ fieldsets: [ {id, label, hideTitle, collapsible, expanded, fields: [...]} ] }`. Field entries use the form field wrapper `{id, label, required, controlConfig, widthType, ...}` with the full `controlConfig` union. |
| `flows` | usual (25) | Embedded `configurationTypeId: 9` flows: `on_init`, click handlers, value-change handlers. |
| `onInitFlowConfig` | usual (23) | `{flowId}` of the init flow. |
| `borderConfig` | optional (18) | `{position, color}`. `position` is enum `ECardBorderPosition` (observed: `left`). `color` is a free string — validate accepts any value; observed: `creation`, `active`, `status-created`, `attention`, `error`, `important`. The designer (captured from the Studio designer (option lists), dxs 0.5.8) offers `position` `left` / `top` / `right` / `bottom` and exactly these `color` ids: `creation`, `attention`, `important`, `active`, `inactive`, `planned`, `status-created`, `status-a`, `status-b`, `status-c`, `status-d`, `status-complete`, `status-canceled`. `error`, seen in production, is not in the designer's list (validate accepts it, since `color` is a free string). |
| `events` | optional (13) | `[{id, dataType?: {type}}]`. `dataType` types the emit payload (`emit(data: number)`); without it `emit()` takes no argument. |
| `actionsConfig` | optional (11) | `{position, actionbar: [...]}`. `position` is enum `ECardActionPosition` (observed: `left`). Action items: `{id, type: "button", buttonConfig: {label, icon?, buttonDefaultStyleClass?, readOnly, disabled, splitButton, tooltip, buttons, clickFlowConfig: {flowId}}}` or `{id, type: "separator"}`. The designer's actions block has a two-member position enum, `left` and `right` (the member names are inferred from how the designer builds a new block, which starts at `left` with `actionbar: null`; captured from the Studio designer, dxs 0.5.8). |
| `vars` | optional (8) | Card-scoped state; every `$card.vars.<id>` must be declared. |
| `tabsConfig` | optional (3, populated on 2) | `{tabs: [{id, title, contentType: "list", contentConfig: {configParameters, configId, moduleId}, isActive}]}` — a card can host a nested list in a tab. The card's tab designer applies no content-type filter, so it offers the full tab set: `calendar`, `codeEditor`, `customAngularComponent`, `embed`, `footprintQueryManager`, `form`, `grid`, `list`, `report`, `visualization` (captured from the Studio designer (option lists), dxs 0.5.8); a new tab defaults to `grid`. Only `list` is observed in production; the others are `_TODO_ (runtime unverified)` on a card. |
| `outParams` | optional (2) | Values the card publishes to its host via `events.outParamsChange`. |
| `footerConfig` | optional (1) | Same `{fieldsets: [...]}` shape as `contentConfig`. |

All declarative string slots (`headerConfig.title`, `description`, field `value`, button `tooltip`, `label`) are TypeScript expressions — quote literals (`"'Delete'"`). See [../../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).

## Runtime Globals

Card flow code (and the card's own declarative bindings) sees **`$card`**, typed by a generated `ICard` interface whose members exist only for what the body declares:

```ts
interface ICard {
  inParams: { ... };                          // from inParams[]
  outParams: { ... };                         // only when outParams[] is declared
  vars: { ... };                              // only when vars[] is declared
  actionbar: { <id>: IToolModel<IButtonModel> | IToolModel<IControlModel> };  // buttons / separators
  styles: ICardStyles;
  content: { fields: { <id>: IFieldModel<ITextBoxModel | ISelectBoxModel | ...> }; fieldsets: { <id>: IFieldsetModel } };
  footer:  { fields: { ... }; fieldsets: { ... } };   // only when footerConfig is set
  tabs:    { <id>: ITabItemModel };                    // only when tabsConfig has tabs
  events:  { <id>: { emit: (data?: T) => void }; outParamsChange: { emit: () => void } };  // outParamsChange only with outParams
}
interface ICardStyles extends IStyles { setCreationClass(); setAttentionClass(); }
```

- `$card.content.fields.<id>.control.<prop>` — read/write control state (`value`, `readOnly`, `isChanged`, `label`...); `$card.content.fields.<id>.hidden` shows/hides a field. Verified on editable controls in a shipped inline-editor card.
- `$card.actionbar.<id>.control.{label, readOnly, disabled}` and `$card.actionbar.<id>.hidden`.
- `$card.styles` — `setCreationClass()` / `setAttentionClass()` only (anything else, e.g. `setImportantClass`, fails validate), plus the `IStyles` base: `setStyle(nameAndUnit, value)`, `removeStyle`, `clearClasses`, `resetClasses`, `clearStyle`, `resetStyle`. `setStyle` targets the card host (shipped uses: `margin-left` indent, `border-left-color`, `border-left-width`, `touch-action`).
- `$card.tabs.<id>` — `{title, hidden, active (readonly), activate()}`.
- `$card.events.<id>.emit(data?)` — raise a declared event to the host.
- **No `close()`, no `refresh()`, no flow members.** `$card.close()`, `$card.refresh()` and `$card.<flowName>()` all fail validate with `Property '...' does not exist on type 'ICard'`. Four shipped cards call `($card as any).refresh()`; _TODO_ (runtime unverified): whether that cast does anything at runtime.
- Also available in card flows (seen in shipped cards and validate-clean): `$flows`, `$datasources` (9 shipped cards call `$datasources.<Pkg>.<ds>.get(...)` in `on_init`), `$frontendFlows`, `$settings`, `$shell` (`open<ref>Dialog`, `openToaster`, `openConfirmationDialog`), `$utils`, `document` / `window`, enums `EModalSize`, `EToasterType`, `EToasterPosition`. UI-tier calling rules apply — call functions, not actions ([../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md)).

The full shared model typings (`IButtonModel`, `IFieldModel`, `IStyles`...) come from `dxs configuration contexts card -b <branchId> -D body.json` — project `.configuration_contexts.designerContexts[] | select(.id=="cardContext") | .text` and read `.configuration_contexts.globalContext`; never dump the `appContext` entry (≈11 MB).

## Invocation Contract

A card has **no `$shell` opener** — it is only ever instantiated by a host:

- **List host** — `itemConfig: {contentType: "card", contentConfig: {configId: <card referenceName>, moduleId: <card's package>, configParameters, configOutParameters?, configEvents?, outParamsChangeFlowConfig?}, width, height, cardStyle}`. `configParameters` mirror the card's `inParams` one-for-one and bind `$item.entity.<col>` / `$list.inParams.<id>` / literals. See [../../list-creator/references/lists.md](../../list-creator/references/lists.md).
- **Calendar host** — `dayViewConfig.eventsConfig: {eventContentType: "card", eventContentConfig: {configParameters, configEvents?, configId, moduleId}}`, binding `$calendarEvent.entity.<col>` (and `$calendar.inParams.<id>`) into the card's inParams. Shipped calendars carry `configEvents` entries without a `flowConfig` (observed `null`) — unlike the list host, the event mapping is present but left unwired; don't assume a populated `configEvents` array means the card's events actually reach a handler. See [../../calendar-creator/references/calendars.md](../../calendar-creator/references/calendars.md).
- **Events** — every id in the card's `events[]` can be mapped by the host's `configEvents: [{eventConfig: {id, dataType?}, flowConfig: {flowId}}]` to a host flow. The emitted payload arrives in that host flow as `$event`. The host's validate does **not** check that the event id exists on the card or that the flow exists — a typo is a silent no-op.
- **outParams** — when the card declares `outParams`, it sets `$card.outParams.<id>` and calls `$card.events.outParamsChange.emit()`; the host reacts through `contentConfig.outParamsChangeFlowConfig` and mirrors the card's outParams in `configOutParameters`.
- **Nested list in a tab** — `tabsConfig.tabs[].contentConfig` follows the same `configId` / `moduleId` / `configParameters` contract against the inner list's `inParams` (bind `$card.inParams.<id>`).

Audit every host contract against [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md).

## Common Patterns

### Shared helpers on `window` (cards have no cross-flow calls)

Forms can call `$form.<flow>()`; cards cannot call each other's flows. Define shared helpers once per init on `window` — closing over `$utils` / `$flows` / `$shell` and taking the card instance as a parameter — and call them from every flow:

```ts
// on_init — re-assign on every init so a rebuilt bundle never runs stale helpers
const w = window as any; const fl = $flows;
const H: any = {};
H.enterEdit = async (c: any) => { c.content.fields.value_input.hidden = false; await fl.Utilities.some_flow({}); };
w.__exampleCardHelpers = H;
```
```ts
// any other flow
const H = (window as any).__exampleCardHelpers;
await H.enterEdit($card);
```

Annotate helper params (`(c: any)`) — implicit `any` fails the build. Namespace the `window` key per card type.

### Mutate → emit → refresh

A card action calls a backend function, then emits a declared event; the hosting list maps the event to a flow that calls `$list.refresh()`. Emit **once** per user action — a loop that emits per item triggers one reload per item. For a cheaper update, emit the changed row as the payload (`events: [{id: "on_change", dataType: {type: "object"}}]`) and let the list patch `$list.items.find(i => i.entity.id === $event.id).entity` in place (shipped pattern).

### Kind-scoped action bar

`on_init` hides or relabels action buttons from `$card.inParams` (e.g. owner vs shared item; group vs leaf): `$card.actionbar.delete_item.hidden = !$card.inParams.is_mine;`.

### Status styling

`$card.styles.setAttentionClass()` / `setCreationClass()` for the two built-in states; `setStyle('border-left-color', '#0A9A1C')` for any other color; `` setStyle('margin-left', `${depth * 20}px`) `` for tree indentation in a flat list.

### Injected stylesheet

Append one `<style id="...">` to `document.head` from `on_init`, guarded by `document.getElementById(...)`; bump the id when changing rules. Scope selectors to the card's host tag (`<package-lowercase>-<card_referenceName>`, e.g. `utilities-example_item_card`). Inline styles set via `setStyle` can serve as CSS discriminators — a hex color serializes as `rgb(r, g, b)` in the style attribute. Use double-quoted CSS attribute selectors inside the single-quoted TS literal.

### Inline editing

Editable fields start hidden in `on_init`; an "edit" helper flips visibility, seeds values from `inParams`, and gates a Confirm action **manually** — cards have no `onFormValidate` hook, so recompute the gate (`$card.actionbar.confirm.control.readOnly = !valid`) in a helper called from **every** field's `uiValueChangeFlowConfig`. A one-shot assignment in `on_init` leaves the button stuck.

### One editor at a time across card instances

DOM truth beats flags: "busy" = any visible editable input inside any card host (`offsetParent !== null`). Window-level flags go stale when a dialog closes mid-edit.

### Focus

Value controls carry a typed `control.focus()` (`IValueControlModel`); when it is not enough, a capped `setInterval` retry over `document.querySelectorAll('<host-tag> input:not([readonly])')` works best-effort. Keep it null-safe. _TODO_ (runtime unverified): whether `control.focus()` is reliable on cards.

## Pre-Flight Checklist

1. **File basics** — `configurationTypeId: 11`, `referenceName` ends in `_card`, ids snake_case; universal checks ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)); `description` and every embedded flow `description` non-empty and ≤100 chars.
2. **No `$card.<flow>()`, `$card.close()` or `$card.refresh()`** — share logic through the window-helper pattern.
3. **Declarative strings are TS expressions** — a bare word in `tooltip` compiles to `return Word;` and fails the Preview build with `TS2304` even though validate passes it. Quote literals (`"'Delete'"`).
4. **Every `flowId`** (`onInitFlowConfig`, `onTitleClickedFlowConfig`, `clickFlowConfig`, `uiValueChangeFlowConfig`) names a flow in `flows[]` — validate does not catch a dangling `onTitleClickedFlowConfig`.
5. **Every `$card.vars` / `outParams` / `events` member used** is declared in the body (validate catches these as `ICard` type errors).
6. **Events** — declared in `events[]` (with `dataType` when a payload is emitted) **and** mapped in the host's `configEvents`; one emit per user action.
7. **Inline-edit gate** recomputed on every `uiValueChangeFlowConfig`, not only in `on_init`.
8. **Order** — validate and upsert the card **before** the list or calendar that hosts it; then update the host's `configParameters` to mirror any inParam change.
9. **Gates** — `dxs configuration validate card` must be clean; the Preview build is the gate for declarative-string TS errors.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `Property 'x' does not exist on type 'ICard'` | Calling a card flow (`$card.x()`), `close()` / `refresh()`, or reading `outParams` / `vars` that are not declared | Window-helper pattern; declare `outParams` / `vars`; let the host close or refresh. |
| `Property 'x' does not exist on type '{}'` on `$card.events.x.emit()` | Event not declared in `events[]` | Add `{id: "x"}` (plus `dataType` for a payload). |
| `Property 'setImportantClass' does not exist on type 'ICardStyles'` | Only `setCreationClass` / `setAttentionClass` exist on cards | Use `setStyle('border-left-color', ...)` or a class via the injected stylesheet. |
| Card button does nothing, list never refreshes | Host `configEvents` maps the wrong event id or a missing flow (not validated) | Match `eventConfig.id` to the card's `events[].id` and `flowConfig.flowId` to a host flow. |
| N reloads after one click | Event emitted inside a loop | Emit once after the loop. |
| Preview build fails with `TS2304` though validate passed | Bare word in a declarative slot (tooltip) | TS-quote the literal. |
| Confirm button on an inline editor never enables | Gate computed once in `on_init` | Recompute in every value-change flow. |
| Host validate: `Invalid contract. Referenced configuration ... does not exist or has been renamed` | Card not on the branch yet, or renamed | Upsert the card first; keep `configId` = card `referenceName`. |
| Push wiped content | Upserted the envelope instead of the inner `.json` | `jq .json envelope.json > body.json` before editing. |

## Cross-References

- [../../list-creator/references/lists.md](../../list-creator/references/lists.md) — the usual host: `itemConfig` contract, `configEvents`, `$list.refresh()`.
- [../../calendar-creator/references/calendars.md](../../calendar-creator/references/calendars.md) — the other host: `eventContentType: "card"`, `$calendarEvent.entity` bindings.
- [../../form-creator/references/forms.md](../../form-creator/references/forms.md) — the standalone-dialog alternative (card-vs-form decision); shares the field wrapper shape.
- [../../datex-studio-runtime/control-types.md](../../datex-studio-runtime/control-types.md) — `controlConfig` union for content and footer fields.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md), [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI-tier globals and calling rules.
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — host `configParameters` / `moduleId` rules.
- [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md), [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md), [../../datex-studio-conventions/defaults.md](../../datex-studio-conventions/defaults.md).
- [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — get → extract `.json` → edit → validate → upsert.
