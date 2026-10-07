---
name: list-creator
description: |
  Use when authoring or modifying a Datex Studio list (configurationTypeId=14,
  *-list.json suffix, CLI type `list`) on a branch — a datasource-bound stack of
  cards (one card per row) with an optional top toolbar, filters, full-text search
  and paging, opened as a dialog or navigated to. Owns the list-vs-grid decision,
  the two one-for-one mirrors (datasourceConfig ↔ datasource inParams,
  itemConfig ↔ card inParams), the datasource → card → list authoring order, the
  card-event wiring (`configEvents` → list flow → `$list.refresh()`), the
  refresh-in-on_init duplicate-rows trap, and full-text search pushdown.
  Triggers: "create a list", "show these rows as cards", "card list", "mobile task
  list", "add a toolbar button/filter to xxx_list", "open the list as a dialog",
  "Outdated contract. Missing input parameter", "Item content type Grid is not
  allowed", "rows appear twice", "list doesn't refresh after the card action",
  "Property 'filters' does not exist on type 'IList'".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - card-creator
  - datasource-creator
  - grid-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# List Creator

Author or modify a Datex Studio list (configurationTypeId=14) on a branch — a UI component that runs a datasource and renders each result row through a card, with an optional top toolbar, filter fields, a built-in full-text search box, and embedded flows. Lists are opened as dialogs (`$shell.<Package>.open<referenceName>Dialog`) or navigated to (`$shell.<Package>.open<referenceName>`), and refresh themselves when their cards report a change.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/lists.md](references/lists.md) — Authoritative list authoring reference: skeleton, fields, `IList` surface, the two mirrors and their validate messages, patterns, pre-flight checklist, failure modes
- [../card-creator/references/cards.md](../card-creator/references/cards.md) — the item template: `ICard`, events, no-cross-flow rule
- [../datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) — the rows source
- [../grid-creator/references/grids.md](../grid-creator/references/grids.md) — the tabular sibling (list-vs-grid decision)
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule (constant `configParameters`, labels, tooltips)
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_list` / `-list.json` suffix, user-facing `title` rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — `$shell` openers and the other UI-tier globals
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — `configParameters` / `moduleId` rules

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`datasource-creator`** skill — invoked to author the rows datasource first when it does not exist
- **`card-creator`** skill — invoked to author the item card before the list
- **`grid-creator`** skill — invoked instead when the requirement is tabular
- **`component-wiring-check`** skill — invoked to audit both mirrors, `configEvents`, and the list's openers

## CLI Lifecycle

List authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs list` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The CLI type is **`list`**, mapping to `configurationTypeId: 14`.

**Create a new list:**

```bash
# 0. The datasource and the card must already be on the branch (validate resolves both)
# 1. Build body.json from scratch (see references/lists.md → Minimal Valid Skeleton)
# 2. Validate — gates the push; exit 1 = errors found, not a broken CLI. Enforces both mirrors ("Outdated contract ...")
dxs configuration validate list -b <branchId> -D body.json
# 3. Create (upsert creates or updates by referenceName)
dxs configuration upsert list -b <branchId> -D body.json
```

**Edit an existing list:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get list <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate list -b <branchId> -D body.json
# 5. Push
dxs configuration upsert list -b <branchId> -D body.json
```

To inspect the generated `IList` / `IListItemEntity` for a body: `dxs -O json configuration contexts list -b <branchId> -D body.json | jq -r '.configuration_contexts.designerContexts[] | select(.id=="listContext") | .text'` — never print the ≈11 MB `appContext` entry.

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. Always `jq .json envelope.json > body.json` before editing. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: List vs Grid decision]
  each row wants a rich card (header, actions, status)   -> list
  sortable/filterable columns, multi-select, export      -> grid (invoke `grid-creator`, stop)
        |
[Phase 3: Order the callees — datasource -> card -> list]
  datasource on branch?  ── NO ─> invoke `datasource-creator`
  card on branch?        ── NO ─> invoke `card-creator`
        |
[Phase 4: Author list body]
  datasourceConfig  (mirror 1: datasource inParams; bind $list.inParams / filters / fullTextSearch)
  itemConfig        (mirror 2: card inParams; bind $item.entity.<col>)
  configEvents      (each card event -> a list flow, usually $list.refresh())
  topToolbar / filters / flows / onInitFlowConfig (no refresh in on_init)
        |
[Phase 5: Validate + push]
dxs configuration validate list -b <branchId> -D body.json
dxs configuration upsert  list -b <branchId> -D body.json
        |
[Phase 6: Wire the opener + verify]
$shell.<Package>.open<referenceName>Dialog(inParams, 'modal'|'flyout', EModalSize.<Size>)
or $shell.<Package>.open<referenceName>(inParams) — upsert the list before its opener
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: List vs Grid decision

A list renders **one card per row**; a grid renders **rows as columns**. Choose a list when each item needs a non-tabular layout — a header with status color, per-item action buttons, multi-line detail — or when the surface is touch/mobile oriented. Choose a grid when users sort and filter by column, select many rows for a bulk action, export, or edit cells inline. A list's `itemConfig.contentType` can only be `card` (`grid` / `form` fail validate). See [references/lists.md → Purpose & When to Use](references/lists.md#purpose--when-to-use).

### Phase 3: Order the callees

Validate resolves every referenced component on the branch: a list whose card or datasource is missing fails with `Invalid contract. Referenced configuration <x> does not exist or has been renamed`. Author and upsert the datasource, then the card, then the list — and a list that another component opens before that opener.

### Phase 4: Author list body

Build `body.json` from [references/lists.md → Minimal Valid Skeleton](references/lists.md#minimal-valid-skeleton). Key points:

1. **File basics.** `configurationTypeId: 14`, suffix `-list.json`, `referenceName` ends `_list` and matches the filename stem; `title` a distinct sentence-case display name. Plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — `description` non-null and ≤100 chars. `pageSize` is an integer.
2. **Mirror 1 — datasource.** `datasourceConfig.configParameters` carries one entry per datasource inParam (unbound optional ones with `"value": ""`); `configOutParameters` mirrors its outParams; `configId` / `moduleId` = the datasource's name and package.
3. **Mirror 2 — card.** `itemConfig.contentConfig.configParameters` carries one entry per card inParam, bound with `$item.entity.<col>` (type-checked against the datasource's result columns), `$list.inParams.<id>`, or a TS literal.
4. **Card events.** `configEvents` maps each card event id to a list flow; validate does **not** check either side, so match ids by hand. The payload arrives as `$event`.
5. **No `$list.refresh()` in `on_init`.** The datasource auto-binds after `on_init`; a second load **appends**, so rows duplicate.
6. **Search and filters.** `"fullTextSearch": true` creates `$list.fullTextSearch` — bind it to the datasource's search inParam. Filter values bind as `$list.filters.<id>.control.value`.
7. **Declarative strings are TS expressions** — constant parameters quoted (`"'mine'"`), booleans bare. See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).

### Phase 6: Wire the opener + verify

The shell generates `open<referenceName>Dialog(inParams, mode?, size?)` (a Promise that resolves on close, carrying `outParams` when declared) and `open<referenceName>(inParams, replaceCurrentView?)` (navigation), under the list's package segment — a top-level application list has no segment instead. The opener carries a `configParameters` contract for every list inParam — audit with `component-wiring-check`. Verify in Preview: rows load once, cards render, a card action refreshes the list.

## Pre-Flight Checklist

Walk the full checklist in [references/lists.md → Pre-Flight Checklist](references/lists.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 14`, suffix `-list.json`, `referenceName` ends in `_list`, distinct `title` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **Both mirrors** exact — datasource inParams and card inParams, no missing, no extra.
3. **`itemConfig.contentType: "card"`**; `pageSize` an integer.
4. **`configEvents`** ids match the card's `events[]`; every `flowId` (events, toolbar) names a flow in `flows[]`.
5. **No `$list.refresh()` in `on_init`.**
6. **`$list.vars` / `filters` / `outParams` / `fullTextSearch`** used only when declared (or the flag is set).
7. **Order** — datasource → card → list → opener.
8. **`description`** non-null, non-empty, ≤100 chars — on the list and every embedded flow.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/lists.md → Common Failure Modes](references/lists.md#common-failure-modes). The gotchas that bite most often:

- **Dropping an optional inParam from a mirror** — validate fails with `Outdated contract. Missing input parameter <id>`; keep the entry with `"value": ""`.
- **Authoring the list before its card or datasource** — `Invalid contract. Referenced configuration ... does not exist`.
- **`$list.refresh()` at the end of `on_init`** — duplicate rows, because loads append.
- **A card event mapped under the wrong id, or to a missing flow** — passes validate, never fires.
- **Binding `$list.fullTextSearch` with `"fullTextSearch": false`** — the member does not exist; bind `""` or turn the search box on.
- **Using a list for tabular, sortable data** — that is a grid.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content; `jq .json envelope.json > body.json` first.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
