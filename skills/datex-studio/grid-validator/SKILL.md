---
name: grid-validator
description: |
  Use when auditing a Datex Studio grid configuration before merge or
  diagnosing grid rendering/filter/sort/toolbar bugs — the mandatory
  final gate after grid-creator. Carries grid-specific gotchas the
  generic component-validator doesn't catch: envelope shape, text-display
  coercion, five-location dynamic-filter wiring sync, imperative cell
  API mismatches, and tailored vs custom provenance conformance.
  Triggers: "audit a grid", "check a grid before merge", "diagnose grid
  rendering / filter / sort / toolbar bugs", "final gate after
  grid-creator". For non-grid components, use component-validator.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - grid-creator
  - tailoring-overlay
  - datasource-creator
  - component-wiring-check
  - component-validator
---

# Grid Validator

Audit a single Datex Studio grid file (`*-grid.json`) against grid-specific authoring rules — the mandatory final gate after `grid-creator` has authored or modified a grid, and before the change is upserted to the branch. This skill is **grid-only**: it carries gotchas the generic `component-validator` does not catch (envelope-vs-body shape, text-display coercion, five-location dynamic-filter sync, imperative cell API mismatches, tailored vs custom provenance). For non-grid component files, route to `component-validator` instead.

This validator **reads**; it does not edit. It returns a structured punch-list (Blockers / Warnings / Nits) — never a rewrite. The parent (typically `grid-creator`, or the user directly) owns the fix.

> **See also:** `component-validator` — generic dispatcher for non-grid component files (actions, functions, forms, editors, hubs, storage, selectors, customTypes, backendTests, datasources). Falls back to `grid-creator/references/grids.md` for grids if `grid-validator` is unavailable, but the generic dispatcher does not carry the grid-specific gotchas listed below.
>
> **See also:** `component-wiring-check` — cross-component reference contracts (one component pointing at another). This validator only audits a single grid file in isolation; it flags obvious wiring drift it can see in that one file (e.g. a `configParameters` block that does not mirror the file's own `inParams`) but does not chase external references.

## References

- [../grid-creator/references/grids.md](../grid-creator/references/grids.md) — authoritative grid reference (envelope shape, columns, datasources, queryOptions, dynamic filters, imperative cell API)
- [../tailoring-overlay/references/tailoring.md](../tailoring-overlay/references/tailoring.md) — overlay shadow-marker rules when the grid is a tailored variant (`tailored_*-grid.json`)
- [../datasource-creator/references/odata-datasources.md](../datasource-creator/references/odata-datasources.md) — OData envelope rules for backing datasources embedded in `datasources[0]`
- [../datasource-creator/references/flow-datasources.md](../datasource-creator/references/flow-datasources.md) — flow-backed datasource envelope rules (when the grid is backed by a function rather than OData)
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — `configParameters` ↔ `inParams` mirror rules and `moduleId` conformance
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table, single-line minified JSON rule, TypeScript-expression encoding (`'literal'` quoting, backtick-wrapping)
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — Suffix table, `referenceName` ↔ file-stem rule, `tailored_` / `custom_` prefix conformance
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — `$grid.*`, `$row.*`, `$col.*` runtime globals available inside grid TS expressions

## Dependencies

- **`grid-creator`** — the creator skill whose `references/grids.md` is the authoritative rulebook this validator audits against. Update that document and this validator picks up the new rules automatically.
- **`tailoring-overlay`** — overlay-specific shadow-marker rules invoked when the grid is a tailored variant rather than a base grid.
- **`datasource-creator`** — backing-datasource rules (OData and flow) applied to the embedded `datasources[0]` block.
- **`component-wiring-check`** — cross-component audit invoked when the punch-list surfaces wiring drift the parent wants to chase further.
- **`datex-studio-conventions`** — generic cross-cutting rules (file format, naming, defaults) that apply on top of the grid-specific checklist.
- **`datex-studio-shared`** / **`datex-studio-runtime`** — branch-setup primitives and platform-runtime globals referenced by the grid rule doc.
- **`component-validator`** — sibling generic dispatcher for non-grid component files. Mutually exclusive: a grid file is `grid-validator`'s territory; any other suffix routes to `component-validator`.

## Workflow

This skill is typically invoked by `grid-creator` at the end of its authoring loop, or by the user directly with "audit this grid before merge". The invocation pattern is a Task-tool sub-agent dispatch — give the prompt template in the `## Sub-agent` section below to the sub-agent along with the target file path.

### Invocation (orchestrator side)

1. **Confirm the target is a grid body** — the grid the parent has just authored or modified. The branch is the source of truth, so the target is either the staged scratch `body.json` about to be `dxs configuration upsert`-ed, or a fresh fetch (`dxs source explore config <referenceName> --branch <id>`, or `dxs configuration get grid <id> -b <id> -O envelope.json && jq .json envelope.json > body.json`). Its `referenceName` must end in `-grid` (or `tailored_*-grid` / `custom_*-grid` for overlay variants). If it's any other component type, stop and route to `component-validator` instead. Never audit a persistent local `src/` copy as authoritative.
2. **Dispatch the sub-agent** — use the Task tool with the prompt template from the `## Sub-agent` section. The sub-agent has `Read`, `Grep`, `Glob` access; it does not edit.
3. **Apply the punch-list** — the sub-agent returns a markdown punch-list grouped by severity. Treat each finding as follows:
   - **Blockers** — must be fixed before upserting. Route the fix back to `grid-creator`.
   - **Warnings** — review and decide. May be deliberate; the sub-agent never assumes intent.
   - **Nits** — optional cleanup. Defer unless the parent is already touching that area.
4. **Re-validate after fixes** — if Blockers were fixed, run the validator again. The validator is cheap (one Read + one Grep through the rule doc) and should be the last step before the push.

### Scope discipline (validator's contract)

- The validator **reads**; it does not edit. The parent owns the fix.
- The validator returns a **punch-list**; it does not return a rewrite.
- The validator audits **one grid file**; it does not chase cross-component references (that is `component-wiring-check`'s territory).
- The validator does not load raw OData schema documents. If the embedded backing datasource needs entity / property validation against the live schema, the validator recommends the parent invoke `schema-explorer` separately.
- The validator does not speculate about intent. If a rule violation could be deliberate, it is flagged as a Warning with a note, not as a Blocker.

## Sub-agent

The prompt template below is what the orchestrator passes to the Task-tool sub-agent dispatch. The sub-agent is read-only (`Read`, `Grep`, `Glob`).

---

You validate a single Datex Studio grid component file (`*-grid.json`) against the platform's grid authoring rules. You do not edit files. You return a punch list.

### Workflow

1. **Load the target grid body.** The parent gives you the path to a single JSON file — the scratch `body.json` staged for upsert, or a config just fetched from the branch (its `referenceName` is `<name>-grid`, `tailored_<name>-grid`, or `custom_<name>-grid`). This is a throwaway temp file, not a persistent source-of-truth copy. Read it in full. The minified JSON envelope is the surface you will audit against the checklist.

2. **Load the grid rulebook.** Read [`../grid-creator/references/grids.md`](../grid-creator/references/grids.md) — its checklist sections are the rulebook. If the file is a tailored or custom-provenance overlay, also read [`../tailoring-overlay/references/tailoring.md`](../tailoring-overlay/references/tailoring.md). The docs explain the *why* behind each rule; don't re-derive them from memory.

3. **Walk the checklist item-by-item.** For each issue, record:
   - **Severity** — `blocker` (silent runtime failure, import error, or clear rule violation), `warning` (drift or inconsistency that may or may not bite), `nit` (style / naming / optional cleanup).
   - **Rule** — which checklist item it maps to.
   - **Location** — `<filename>:<line>` or JSON path (e.g. `datasources[0].queryOptionsObjectTypeDef`).
   - **Evidence** — short quote or description.

4. **If the grid is OData-backed**, verify `queryOptions.selects` includes every field declared in the entity-shape locations. Consult [`../datasource-creator/references/odata-datasources.md`](../datasource-creator/references/odata-datasources.md) for the OData envelope rules. If the parent authorizes invoking the `schema-explorer` skill, use it to confirm entity / property / navigation names against the live OData schema; otherwise flag unverified names as warnings.

   **If the grid is flow-backed** (the backing datasource resolves to a function rather than an OData entity), consult [`../datasource-creator/references/flow-datasources.md`](../datasource-creator/references/flow-datasources.md) for the flow-datasource envelope rules.

5. **Always probe these grid-specific failure modes explicitly** — they are not caught by a casual checklist walk and the generic `component-validator` does not carry them:

   a. **Embedded datasource component-identity envelope (envelope shape).** Confirm `datasources[0]` carries all of `referenceName` (must equal `datasourceConfig.configId` verbatim), `title`, `description`, `hasKey`, `hasResult`, `id`, `linkedDatasources`, `customColumns`, `inParams`, `outParams`, `vars`, `events`, `accessModifier`, and the correct `configurationTypeId` per [`../datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md). Also confirm the `datasourceConfigs` array and `componentReference` (when present) line up with the grid's own envelope. Missing `referenceName` is a **blocker** — it produces `Invalid contract. Referenced own configuration <name> does not exist or has been renamed` and cascades into `Cannot find name 'get'/'getList'/'inParams'/'refresh'` TS errors at import.

   b. **Text-display string coercion.** For every column with `displayControl.type: "text"` whose `textConfig.value` dereferences `$row.entity.<Field>`, look up `<Field>`'s declared `type` in `queryOptionsObjectTypeDef`. If it's anything other than `string`, the binding must coerce (e.g. `"$row.entity.Id?.toString()"` for numbers, template-literal backtick-wrapping for compositions, `$utils.date.format(...)` for dates). An uncoerced non-string binding is a **blocker** — import fails with `Type '<number|boolean|...>' is not assignable to type 'string'`. Apply the TS-expression encoding rules from [`../datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md): declarative string slots that are literal text need `'literal'` single-quoting; compositions need backtick-wrapping.

   c. **Five-location dynamic-filter wiring sync.** When a column declares a dynamic filter, the same field name must appear consistently across all five locations: (1) `datasources[0].queryOptions` (the `$filter` / `selects` clause), (2) `datasources[0].queryOptionsObjectTypeDef` (the type declaration), (3) the column's `dynamicFilter` block, (4) the grid's `dynamicFilters[]` registry, and (5) the `filterChange` flow / handler that propagates filter state. Drift in any one location is a **blocker** — the filter silently no-ops or throws a TS error at import. Cross-reference against the dynamic-filter section of [`../grid-creator/references/grids.md`](../grid-creator/references/grids.md).

   d. **Imperative cell API mismatches.** Columns that use imperative cell handlers (`onCellClick`, `onCellRender`, `cellTemplate`, etc.) must reference handler names that exist in the grid's `flows` block (or in a linked flow file). Confirm the handler signature matches the API expected by the grid runtime (consult the imperative-cell section of [`../grid-creator/references/grids.md`](../grid-creator/references/grids.md)). A handler reference with no matching definition is a **blocker**; a signature mismatch (e.g. wrong arity, wrong return type) is a **warning**.

   e. **Tailored vs custom provenance conformance.** If the file stem starts with `tailored_`, the file is an overlay and the shadow-marker rules in [`../tailoring-overlay/references/tailoring.md`](../tailoring-overlay/references/tailoring.md) apply on top of the base grid's checklist. If the file stem starts with `custom_`, the file is a customer-specific variant and the `custom_` provenance rules in [`../datex-studio-conventions/naming-conventions.md`](../datex-studio-conventions/naming-conventions.md) apply. Mixing the two prefixes (e.g. `tailored_custom_foo-grid.json`) or omitting the prefix on a tailored variant is a **blocker**.

   f. **`$grid.*` runtime usage.** If the grid uses `$grid.*` / `$row.*` / `$col.*` globals inside TS expressions, confirm the globals exist and are used per [`../datex-studio-runtime/runtime-globals.md`](../datex-studio-runtime/runtime-globals.md). Unknown global identifiers are a **blocker** (TS error at import); deprecated globals are a **warning**.

6. **Always probe the universal cross-cutting failure modes** even if the grid checklist does not restate them. These are enumerated once in [`../datex-studio-conventions/universal-checklist.md`](../datex-studio-conventions/universal-checklist.md) — walk that list (description ≤ 100 chars, `accessModifier` set, `referenceName` ↔ stem, single-line minified JSON, correct `configurationTypeId`, snake_case new `inParams`/`outParams` ids, `id: 0` if net-new). Plus one grid-relevant wiring check:
   - `configParameters` block, when present, mirrors the file's own `inParams` per [`../component-wiring-check/references/component-wiring.md`](../component-wiring-check/references/component-wiring.md). A mismatch the validator can see from the grid file alone is a **warning** (recommend the parent invoke `component-wiring-check` for the full cross-component audit).

7. **Report.** Return a short markdown punch list grouped by severity, each item one or two lines. No preamble, no rewrites, no code suggestions beyond one-line pointers. If nothing is wrong, say `No issues found.`

### Scope Discipline

- You read. You do not edit.
- You return a punch list. You do not return a rewritten file.
- You do not chase references into other component files — cross-component wiring is `component-wiring-check`'s territory. If a wiring issue is obvious from the grid alone, flag it and let the parent decide whether to follow up.
- You do not load raw OData schema documents. If entity / property / navigation validation is needed, recommend the parent invoke the `schema-explorer` skill separately.
- You do not speculate about intent — if a rule violation could be intentional (e.g. an empty `displayControl.value` that's legitimate imperative population), flag it as a warning with a note, not a blocker.
- If the file is not a grid (suffix is not `-grid.json` and not a `tailored_*-grid.json` / `custom_*-grid.json` overlay variant), reply `Cannot validate: file is not a grid. Route to component-validator instead.` and stop.

### Output Format

```
## Blockers
- [`datasources[0].queryOptionsObjectTypeDef`] `warehouse_id` missing (present in locations 2, 3, 4, 5). Five-location sync drift.
- [`columns[2].textConfig.value`] `$row.entity.OrderTotal` is `number`; needs `.toString()` coercion or template-literal wrapping.

## Warnings
- [`columns[3].dynamicFilter`] targets `accounts` (collection) directly; needs a scalar sidecar per array-field caveat.
- [`columns[5].onCellClick`] handler `confirmDelete` arity mismatch — declared 1 arg, runtime passes 2.

## Nits
- [`description`] 118 chars — exceeds the ≤100-char soft limit.
- [`title`] equals `referenceName`; a human-readable title is more discoverable in Datex Studio listings.
```

Omit any bucket that is empty. If all three buckets are empty, return `No issues found.`
