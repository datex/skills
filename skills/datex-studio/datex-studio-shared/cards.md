# Cards (`-card.json`, configurationTypeId 11)

> Sections 1–9 are filled from verified behavior in shipped card components; remaining gaps are marked `_TODO_`.

## 1. Purpose

A card renders **one item** — usually one row of a [list](lists.md) (`-list.json`, cti 14) via its `itemConfig` — as a small framed UI block: clickable header title, optional content fields, an action bar of buttons, and a colored border edge. Cards are the repeater primitive: the platform has no dynamic control creation, but a list bound to a datasource renders one card per result row, so data-driven repetition = flat list of cards (indent/styling conveys nesting).

Cards can also act as **inline editors**: content fields support the full editable control union (selectBox with dropdownConfig, textBox, numberBox, dateBox, checkBox, radio), verified end-to-end in a shipped inline condition-editor card.

## 2. File Location & Naming

The branch is the source of truth (author via `dxs configuration` commands); the conventional export layout is `src/cards/<name>_card-card.json`. Reference name snake_case ending `_card`. Package defaults to `Utilities`; `accessModifier: "public"`; `description` mandatory, ≤100 chars.

## 3. Minimal Valid Skeleton

```json
{"headerConfig":{"title":"$card.inParams.title","description":"","iconConfig":null,"imageConfig":null,
  "onTitleClickedFlowConfig":null},
 "contentConfig":{"fieldsets":[{"id":"body","label":"","hideTitle":true,"collapsible":false,"expanded":true,
  "fromBaseConfiguration":null,"removed":null,"action":null,"info":null,"fields":[]}]},
 "actionsConfig":{"position":"left","actionbar":[]},
 "footerConfig":null,
 "borderConfig":{"position":"left","color":"status-created"},
 "tabsConfig":null,
 "flows":[],
 "onInitFlowConfig":null,
 "configurationTypeId":11,"id":0,
 "referenceName":"example_card","title":"example_card",
 "description":"One-line purpose under 100 chars.",
 "inParams":[],"outParams":null,"vars":null,"events":null,"accessModifier":"public"}
```

## 4. Required Top-Level Fields

`headerConfig`, `contentConfig`, `actionsConfig`, `footerConfig`, `borderConfig`, `tabsConfig`, `flows`, `onInitFlowConfig`, `configurationTypeId` (11), `id`, `referenceName`, `title`, `description`, `inParams`, `outParams`, `vars`, `events`, `accessModifier`. Field entries inside `contentConfig.fieldsets[].fields` use the same wrapper shape as forms: `{id,label,required,controlConfig,widthType,defaultStyleClass,onValidationFlowConfig,...}` with the full `controlConfig` union.

## 5. Runtime Globals & Imperative Surface

- `$card.inParams.<id>` — read.
- `$card.content.fields.<id>.control.<prop>` — read/write control state (`value`, `readOnly`, `label`…); `$card.content.fields.<id>.hidden` — show/hide a field. **Verified for editable controls.**
- `$card.actionbar.<id>.control.<prop>` and `$card.actionbar.<id>.hidden` — action-bar buttons (`label`, `readOnly`).
- `$card.styles.setStyle(prop, value)` — inline style on the card host (used for `margin-left` depth indent and `border-left-color`).
- `$card.events.<id>.emit()` — raise a declared event; the hosting list maps it via `itemConfig.contentConfig.configEvents` to a list flow (the mutate→`$list.refresh()` loop).
- Available in card flow code: `$flows`, `$shell` (incl. `open<ref>Dialog` + `openToaster`), `$utils`, `document`/`window` (browser tier), enums `EModalSize`, `EToasterType`, `EToasterPosition`. `$frontendFlows` _TODO: unverified on cards_. `$datasources` _TODO: unverified on cards — avoid; call a function via `$flows` instead._

### ⚠ Cards have NO cross-flow calls (unlike forms)

`$form.<flowname>()` works on forms; **`$card.<flowname>()` does NOT exist** — Studio Validate fails with `Property 'X' does not exist on type 'ICard'`. Card-local flows cannot invoke each other.

**Pattern (verified in production):** define shared helpers once per init on `window` — closing over `$utils`/`$flows`/`$shell` and taking the card instance as a parameter — and call them from every flow:

```ts
// on_init (re-assign every init so a rebuilt bundle never runs stale helpers)
const w = window as any; const u = $utils; const fl = $flows; const sh = $shell;
const H: any = {};
H.doThing = async (c: any) => { c.content.fields.x.hidden = false; await fl.Utilities.some_flow({}); };
w.__myCardHelpers = H;
// any other flow
const H = (window as any).__myCardHelpers; await H.doThing($card);
```

Annotate helper params (`(c: any)`) — implicit-any fails the build.

## 6. Invocation Contract

Hosted by a list: `itemConfig.contentType: "card"`, `contentConfig.configId` = card referenceName, `moduleId` = card's package, `configParameters` mirroring the card's `inParams` one-for-one (bind `$item.entity.<col>` / `$list.inParams.<id>`), `configEvents` mapping each declared card event to a list flow. Mismatched ids fail silently — audit against the [component-wiring rules](../component-wiring-check/references/component-wiring.md).

## 7. Common Patterns

- **Mutate → emit → refresh:** card action flow calls a backend function, then `$card.events.changed.emit()`; the list handles it with `$list.refresh()`. Emit **once** per user action (a loop that emits per item causes N reloads).
- **Kind-scoped action bar:** `on_init` hides/relabels buttons from `$card.inParams` (e.g. group vs condition; owner vs shared).
- **Depth indent:** `setStyle('margin-left', `${depth * 20}px`)`.
- **Injected stylesheet:** one `<style id="...">` appended to `document.head` from `on_init` (guarded by `getElementById`); bump the id when changing rules. Scope all selectors to the host tag (`utilities-<card_ref>`). Inline-style markers set via `setStyle` (e.g. a border color) can serve as CSS discriminators — hex serializes to `rgb(r, g, b)` in the style attribute. **Use double-quoted CSS attribute selectors** inside the single-quoted TS literal (no escaping needed).
- **Inline editing:** editable fields default-hidden in `on_init`; an `enter_edit` helper flips visibility, seeds state from `inParams`, and gates a Confirm action manually (cards have **no** `onFormValidate` — recompute the gate on every `uiValueChangeFlowConfig`).
- **Single-editor lock across card instances:** DOM truth beats flags — `editBusy()` = any visible editable input inside any card host (`offsetParent !== null`); window flags go stale when dialogs close mid-edit.
- **Focus:** no native focus API; capped `setInterval` retry over `document.querySelectorAll('<host-tag> input:not([readonly])')`, first visible = first field, last visible = value field. Best-effort, null-safe.

## 8. Pre-Flight Checklist

1. `configurationTypeId` 11; `description` non-empty ≤100; every embedded flow description ≤100.
2. **No `$card.<flow>()` calls** — use the window-helper pattern (§5).
3. Declarative string slots are TS expressions: a bare word in `tooltip` compiles to `return Word;` → `TS2304` in the **Preview build** (Validate passes it!). Quote literals: `"'Delete'"`. (`placeholder` on form textBoxes rendered literally in testing; on cards, assume expression until verified.)
4. Every `clickFlowConfig`/`uiValueChangeFlowConfig`/`onTitleClickedFlowConfig` flowId resolves to an embedded flow; every `$card.content.fields/actionbar/vars/inParams` reference is declared.
5. Events used by `emit()` are declared in top-level `events` AND mapped in the hosting list's `configEvents`.
6. New param ids snake_case; helper lambdas annotated `: any`.
7. After deploy: Studio **Validate** catches ICard-surface and reference errors; the **Preview build** is the gate for declarative-string and TS errors — both must be clean.

## 9. Cross-References

- Hosting list contract: [lists.md](lists.md).
- Control union details: [control-types.md](../datex-studio-runtime/control-types.md). Wiring rules: [component-wiring.md](../component-wiring-check/references/component-wiring.md).

## 10. Runtime Globals Reference

_TODO: exhaustive ICard member list (pending a captured generated class)._
