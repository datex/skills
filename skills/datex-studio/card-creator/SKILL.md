---
name: card-creator
description: |
  Use when authoring or modifying a Datex Studio card (configurationTypeId=11,
  *-card.json suffix, CLI type `card`) on a branch — the per-item template a list
  renders once per datasource row and a calendar renders once per event. Owns the
  card-vs-form decision (card = one item inside a list/calendar; form = standalone
  dialog), the no-cross-flow-calls rule and its window-helper workaround, the
  declared-events contract (`events[]` → `$card.events.<id>.emit(data)` →
  host `configEvents` → `$event`), the mutate→emit→refresh loop, inline-edit
  gating recomputed on every value change, and the author-the-card-before-its-host
  ordering. Triggers: "create a card", "list item template", "a card for each row",
  "calendar event card", "add a button/field to xxx_card", "make the card editable
  inline", "Property 'x' does not exist on type 'ICard'", "card button does nothing",
  "list doesn't refresh after the card action", "confirm on the card never enables".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - list-creator
  - form-creator
  - calendar-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Card Creator

Author or modify a Datex Studio card (configurationTypeId=11) on a branch — a small framed UI block (header, content fields, action bar, border color, optional footer and tabs) that renders **one item**. A card is never opened on its own: a list instantiates it once per datasource row through `itemConfig`, and a calendar instantiates it once per event through `eventContentType: "card"`. Cards talk back to their host only through declared events.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/cards.md](references/cards.md) — Authoritative card authoring reference: skeleton, block shapes, `ICard` surface, host contracts, patterns, pre-flight checklist, failure modes
- [../list-creator/references/lists.md](../list-creator/references/lists.md) — the usual host: `itemConfig` contract, `configEvents`, `$list.refresh()`
- [../form-creator/references/forms.md](../form-creator/references/forms.md) — the standalone-dialog alternative (card-vs-form decision); shares the field wrapper
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule for declarative string slots
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_card` / `-card.json` suffix, snake_case ids
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md), [../datex-studio-runtime/control-types.md](../datex-studio-runtime/control-types.md) — UI-tier globals and the `controlConfig` union
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — host `configParameters` ↔ `inParams` and `moduleId` rules

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`list-creator`** skill — invoked to author or update the hosting list (or [`calendar-creator`](../calendar-creator/SKILL.md) for a calendar host) once the card is on the branch
- **`form-creator`** skill — invoked instead when the requirement is a standalone dialog, not a per-item template
- **`component-wiring-check`** skill — invoked to audit the host's `configParameters` / `configEvents` against the card

## CLI Lifecycle

Card authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs card` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The CLI type is **`card`**, mapping to `configurationTypeId: 11`.

**Create a new card:**

```bash
# 1. Build body.json from scratch (see references/cards.md → Minimal Valid Skeleton)
# 2. Validate — gates the push; exit 1 = errors found, not a broken CLI. Catches ICard type errors ($card.<flow>(), undeclared events/vars)
dxs configuration validate card -b <branchId> -D body.json
# 3. Create (upsert creates or updates by referenceName)
dxs configuration upsert card -b <branchId> -D body.json
```

**Edit an existing card:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get card <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate card -b <branchId> -D body.json
# 5. Push
dxs configuration upsert card -b <branchId> -D body.json
```

To inspect the generated `ICard` surface for a body: `dxs -O json configuration contexts card -b <branchId> -D body.json | jq -r '.configuration_contexts.designerContexts[] | select(.id=="cardContext") | .text'` — never print the ≈11 MB `appContext` entry.

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. Always `jq .json envelope.json > body.json` before editing. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Card vs Form decision]
  one item rendered inside a list or calendar     -> card
  standalone dialog / input collector / confirm   -> form (invoke `form-creator`, stop)
  tabular rows with columns                       -> grid, not a list of cards
        |
[Phase 3: Design the contract]
  inParams   = what the host binds per item ($item.entity.<col> / $calendarEvent.entity.<col>)
  events[]   = what the card tells the host (with dataType when it carries a payload)
  outParams  = only if the host must read card state (+ outParamsChange)
        |
[Phase 4: Author card body]
  headerConfig / contentConfig / actionsConfig / borderConfig (+ footer/tabs)
  flows[] + onInitFlowConfig; shared logic via the window-helper pattern
        |
[Phase 5: Validate + push — card BEFORE its host]
dxs configuration validate card -b <branchId> -D body.json
dxs configuration upsert  card -b <branchId> -D body.json
        |
[Phase 6: Wire the host + verify]
invoke `list-creator` (itemConfig) or `calendar-creator` (eventContentConfig);
mirror inParams one-for-one; map every event in configEvents
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Card vs Form decision

A card is a **per-item template**: it has no `$shell` opener, no `close()`, and no `refresh()`; it exists only inside a list (`itemConfig.contentType: "card"`) or a calendar (`eventContentType: "card"`). If the requirement is a dialog that collects input, confirms an action, or returns values to a caller, that is a **form**. If it is a screen editing one hydrated entity, that is an **editor**. If the rows want sortable columns and multi-select, that is a **grid** — not a list of cards. See [references/cards.md → Purpose & When to Use](references/cards.md#purpose--when-to-use).

### Phase 3: Design the contract

Decide the card's `inParams` from what the host can bind per item — a list binds `$item.entity.<col>` from its datasource rows, a calendar binds `$calendarEvent.entity.<col>`. Every inParam is mirrored one-for-one by the host's `configParameters`, and list validate enforces that mirror, so adding an inParam later means updating the host too. Declare every event the card raises in `events[]`; add `dataType: {type}` when it carries a payload (the host flow reads it as `$event`).

### Phase 4: Author card body

Build `body.json` from [references/cards.md → Minimal Valid Skeleton](references/cards.md#minimal-valid-skeleton). Key points:

1. **File basics.** `configurationTypeId: 11`, suffix `-card.json`, `referenceName` ends `_card` and matches the filename stem. Plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — `description` non-null and ≤100 chars.
2. **No cross-flow calls.** `$card.<flowName>()` does not exist (`Property '<flow>' does not exist on type 'ICard'`). Put shared logic in helpers assigned to `window` in `on_init` and call them from every flow, passing `$card` — see [references/cards.md → Shared helpers on `window`](references/cards.md#shared-helpers-on-window-cards-have-no-cross-flow-calls).
3. **Declarative strings are TS expressions.** Header title/description, field values, tooltips and labels compile as TypeScript; quote literals (`"'Delete'"`). See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).
4. **Declare what you touch.** `$card.vars.<id>`, `$card.outParams.<id>` and `$card.events.<id>` exist only when declared; `$card.styles` offers only `setCreationClass()` / `setAttentionClass()` plus `setStyle(...)`.
5. **Mutate → emit → refresh.** An action flow calls a function, then emits **one** declared event; the host maps it to a flow that calls `$list.refresh()` (or patches `$list.items` from the payload).
6. **Inline-edit gating.** Cards have no form-validate hook: recompute the Confirm button's `readOnly` in a helper called from **every** field's `uiValueChangeFlowConfig`, not once in `on_init`.

### Phase 6: Wire the host + verify

The host validates the card contract against the branch, so the card must be upserted first (otherwise: `Invalid contract. Referenced configuration <card> does not exist or has been renamed`). In the host, set `configId` = the card's `referenceName`, `moduleId` = the card's package, mirror every inParam in `configParameters`, and map every event in `configEvents` — the event mapping is **not** validated, so check ids by hand. Verify in Preview: the card renders per row, buttons fire, the host refreshes after a mutation.

## Pre-Flight Checklist

Walk the full checklist in [references/cards.md → Pre-Flight Checklist](references/cards.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 11`, suffix `-card.json`, `referenceName` ends in `_card`, ids snake_case — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **No `$card.<flow>()`, `close()` or `refresh()`** — window-helper pattern instead.
3. **Every `flowId`** resolves to a flow in `flows[]` (a dangling `onTitleClickedFlowConfig` passes validate).
4. **Events** declared in `events[]` and mapped in the host's `configEvents`; one emit per user action.
5. **Inline-edit gate** recomputed on every value change.
6. **Declarative strings** TS-encoded (bare-word tooltip passes validate but breaks the Preview build).
7. **Card upserted before its host**; host `configParameters` mirror the card's `inParams`.
8. **`description`** non-null, non-empty, ≤100 chars — on the card and every embedded flow.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/cards.md → Common Failure Modes](references/cards.md#common-failure-modes). The gotchas that bite most often:

- **Calling one card flow from another (`$card.on_save()`)** — the headline mistake. ICard has no flow members; validate fails with `Property 'on_save' does not exist on type 'ICard'`. Use the window-helper pattern.
- **Expecting `$card.refresh()` / `$card.close()`** — neither exists; emit an event and let the list refresh or close.
- **Emitting an undeclared event, or mapping it under a different id in the host** — the first fails validate; the second is a silent no-op.
- **Emitting inside a loop** — one list reload per emit.
- **Gating an inline-edit Confirm once in `on_init`** — the button never re-enables.
- **Authoring the list first** — the list's validate cannot resolve a card that is not on the branch yet.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content; `jq .json envelope.json > body.json` first.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
