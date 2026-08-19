# Naming Conventions

Every component's name carries a type indicator that makes its kind legible at a glance in cross-references, search results, and editor tabs.

## Component Naming Matrix

| Component type | Name pattern | Example filename |
|---|---|---|
| Selector (dropdown) | `<name>_dd` | `color_dd-selector.json` |
| Selector datasource | `ds_<name>_dd` | `ds_color_dd-datasource.json` |
| Datasource | `ds_<name>` | `ds_invoicing_options-datasource.json` |
| Footprint-datasource | `fpds_<name>` | `fpds_get_material-footprintDatasource.json` |
| Function | `<name>_flow` | `format_schedule_flow-flow.json` |
| Action | `<name>_action` | `do_something_action-footprintFlow.json` |
| Hub | `<name>_hub` | `invoicing_rules_hub-hub.json` |
| Form | `<name>_form` | `invoicing_rules_configuration_form-form.json` |
| Editor | `<name>_editor` | `auto_invoicing_rule_editor-editor.json` |
| Embed | `<name>_embed` | `custom_example_map_embed-embed.json` |
| Grid | `<name>_grid` | `invoicing_rules_grid-grid.json` |
| Interface (customType) | `i_<name>` | `i_auto_invoice_rule-customType.json` |
| Enum (customType) | `e_<name>` | `e_allocation_base_strategy-customType.json` |
| Storage | `<name>_storage` | `widget_rule_storage-storage.json` |

**Actions are the one asymmetric case.** The `_action` indicator is carried by the component's `referenceName` (stored inside the JSON), not by the file suffix — the file suffix remains `-footprintFlow.json` per the platform file-format convention. All other types — Storage included — carry the indicator in both the component name *and* the filename stem.

**Missing type indicator = flaw.** A component whose name lacks the appropriate indicator is a naming violation. When you encounter one, call it out and list it for cleanup; do not replicate the pattern when authoring new components. Rename the existing one as a targeted edit only when the surrounding work already touches the file (renames ripple into every cross-reference).

**`_dd` reserved for dropdown backing.** The `_dd` suffix is reserved for datasources (and their selectors) dedicated to backing a dropdown selector. General-purpose datasources — even ones that happen to be queried by key or return a collection — do not use `_dd`. Reserve the suffix for the selector-backing case so the name signals intent at a glance.

## Parameter and Variable Ids Are snake_case

New `inParams[].id` / `outParams[].id` entries on any component (grid, datasource, flow, form, hub, selector, editor, action, etc.) — including embedded flows and datasources — use **snake_case**: `warehouse_id`, `project_ids`, `capture_date`, not `warehouseId` / `projectIds` / `captureDate`. The same rule covers:

- `configParameters[].parameter.id` on caller references — these mirror the target's inParam ids verbatim, so wiring a caller's `warehouse_id` at the reference site means the target grid/selector/datasource must also declare `warehouse_id`.
- Component-level `vars[].id` and `rowVars[].id` — snake_case for new declarations.

Many existing components carry camelCase param ids (`fullTextSearch`, `warehouseId`, `captureDate`, `projectIds`). Those are **legacy** — do not replicate the casing when adding new params next to them; new ids are snake_case even when every neighbor is camelCase. Conversely, don't rename existing camelCase params when only *adding* new ones nearby — renames ripple into every caller and belong in their own dedicated change.

## Tailored and Custom Prefixes — Grid Provenance Variants

Grids (and the flows/datasources authored alongside them) come in three provenance variants. The same convention extends by analogy to other tailorable component types:

| Variant | Name pattern | When to use |
|---|---|---|
| Core-library grid | `<intuitive_name>_grid` (no prefix) | Shipped as part of a core package; the canonical base. E.g. `contact_addresses_grid`, `invoicing_rules_grid`. |
| **Tailored grid** | `tailored_<base_name>_grid` | Overlay that extends a core grid via `baseConfiguration`, adding/overriding columns, flows, and datasources without forking. See [tailoring.md](../tailoring-overlay/references/tailoring.md). E.g. `tailored_contact_addresses_grid`. |
| **Standalone custom grid** | `custom_<base_name>_grid` | Net-new grid authored for a specific customer, not tied to a base. Typically the result of flattening a tailored grid once the customer's needs diverge enough that overlay semantics stop paying off. E.g. `custom_contact_addresses_grid`. |

Internal flows, datasources, and selectors authored alongside a tailored or custom grid carry the matching prefix: `tailored_on_save_row`, `tailored_ds_contact_addresses_grid`, `custom_ds_contact_addresses_grid`, `custom_ds_countries_dd`, etc. The prefix travels with the component, not with the package.

## Display Text Conventions

User-facing derived text — dropdown display labels, grid column headers, form field labels, formatted keys in enum dropdowns, and any other UI text generated at runtime — uses **sentence case**: capitalize the first word, lowercase the rest. Acronyms are preserved as-is (e.g. `API`, `XML`, `WMS`, `OData`, `SKU`, `ID`).

Examples:
- `RoyalBlue` → `Royal blue`
- `SomeOtherColor` → `Some other color`
- `XMLParser` → `XML parser` (acronym preserved)
- `SkuVerification` → `SKU verification` (acronym preserved)

This applies to **derived** display text — text the code generates at runtime from code identifiers. It does **not** apply to component names, file names, or stored values (e.g. enum `value` strings, which have their own convention per [type-definitions.md](../type-definition-creator/references/type-definitions.md)).

`formatKey` helpers in datasource flow code, grid column label configuration, and form field label text should all follow this rule.

## Display Names for User-Facing Components

A component's top-level **`title`** field is what users see when the component renders — this is the canonical user-facing display name across forms, editors, hubs, and grids. (Forms typically leave the top-level `name` field as `null`; the Studio import modal's "Name *" input maps to `title`. Editors sometimes carry the same string in both `title` and `name`; the canonical source is still `title`.) For **user-facing component types** the `title` lands on a real screen as a header, dialog title, tab label, or list-row display column. For **backend types** (functions, actions, datasources, footprint-datasources, custom types, storage, backend-tests) the `title` never leaves the component metadata — users never see it.

This is a hard rule for the visible-types group only.

### Rule

User-facing components must carry a user-friendly display `title` distinct from the internal `referenceName`:
- **Sentence case** per the [Display Text Conventions](#display-text-conventions) section above — capitalize the first word, lowercase the rest, acronyms preserved.
- **Descriptive of what the user is interacting with**, not the internal identifier. The reader of the title should understand what they're looking at without prior context about the codebase.
- **No raw snake_case from the referenceName** — that's a tell-tale sign the `title` was left at the default. If the JSON's `title` field is byte-identical to `referenceName`, that's a violation.
- **For forms / editors**: usually a noun phrase naming what's being authored or selected (`Frequency`, `Allocation configuration`, `Recommend license plate location configurations`). Pluralize when the form/editor handles a list rather than a single record.
- **For hubs / grids**: same noun-phrase rule, naming the entity collection or workspace (`Inventory adjustments hub`, `Replenishment rules grid`).
- **No verb-led naming for the component `title`** — keep verbs for in-page action labels (button text), not for the component-level display name. The component's `title` answers "what is this?" not "what does it do?".

### Which component types are bound

| Component | `title` is user-facing? | Display-name rule applies? |
|---|---|---|
| Form | yes (modal title, flyout heading, Import-modal `Name *`) | **yes** |
| Editor | yes (page title, lock dialog, Import-modal `Name *`) | **yes** |
| Hub | yes (page title, breadcrumb) | **yes** |
| Grid | yes (when surfaced as a hub tab or dialog) | **yes** |
| Embed | yes (dialog title, flyout heading) | **yes** |
| Selector | indirectly (control's placeholder when used standalone) | yes if standalone; doesn't matter in field-bound use |
| Function | no — internal callable | no |
| Action | no — internal callable | no |
| Datasource / Footprint-datasource | no — internal data fetch | no |
| Custom type (interface / enum) | no — type-level metadata | no |
| Storage | no — internal data store | no |
| Backend-test | no — test runner output only | no |

### Examples

| Component referenceName | Bad `title` | Good `title` |
|---|---|---|
| `recommend_anchor_rules_form` | `recommend_anchor_rules_form` (raw snake_case — original violation, fixed in same session) | `Anchor strategy resolution chain` (noun phrase describing content; matches the form's fieldset label) |
| `allocation_configuration_editor` | `allocation_configuration_editor` | `Allocation configuration` |
| `recommend_license_plate_location_configurations_editor` | `recommend_license_plate_location_configurations_editor` | `Recommend license plate location configurations` (current good example) |
| `invoicing_rules_hub` | `invoicing_rules_hub` | `Invoicing rules` |
| `schedule_frequency_form` | `schedule_frequency_form` | `Frequency` (current good example — terse where the surrounding context already provides "schedule") |

When in doubt, open a working example of the same component type in another package and match its `title`-vs-`referenceName` pattern. The `auto_invoicing_rule_editor` (title: `Auto invoicing rule`), `awi_replenishment_rules_form` (title: `Replenishment rules`), and `schedule_frequency_form` (title: `Frequency`) are good references.

### Detection

Easy to spot manually — open a component JSON and compare `title` vs `referenceName`. If they're byte-identical for a user-facing type, that's a violation. (`name` being null is normal on forms; ignore that field for this check.) Worth folding into a component-validator subagent pass on visible types.

## Known Violations

**Storage naming.** Some pre-existing storage components may predate the `_storage` suffix convention and lack the type indicator. They're treated as violations per the "Missing type indicator = flaw" rule above and should be renamed when surrounding work already touches them — don't replicate the pattern when authoring new storage components.
