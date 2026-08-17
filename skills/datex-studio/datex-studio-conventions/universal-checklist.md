# Universal Component Checklist

The cross-cutting checks that apply to **every** Datex Studio component, regardless of type. This is the single enumeration of the universal rules; each item's authoritative definition lives in the conventions doc linked beside it. **Type-specific** checks (e.g. a grid's five-location rule, a selector's component-variant rule) are not here — they live in each component's creator skill and its Pre-Flight Checklist.

Walk these on every component before `dxs configuration upsert`:

1. **JSON parses and is single-line minified.** One line, valid JSON. See [file-format.md](file-format.md).
2. **`description` is present, non-empty, and ≤ 100 characters.** Hard SQL column cap on the Footprint side — imports fail with a truncation error when exceeded. See [defaults.md](defaults.md).
3. **`accessModifier` is set** (`"public"` is the default; `"private"` when internal to a single caller). See [defaults.md](defaults.md).
4. **`referenceName` matches the component/file stem** (and `title` typically equals it). See [naming-conventions.md](naming-conventions.md). *Exception:* actions — `referenceName` ends in `_action` while the file suffix is `-footprintFlow.json`.
5. **`configurationTypeId` is correct for the type.** A wrong cti validates clean but breaks Preview / codegen downstream. See the table in [file-format.md](file-format.md).
6. **New `inParams` / `outParams` ids are snake_case** (camelCase neighbors are tolerated legacy carry-over). See [naming-conventions.md](naming-conventions.md).
7. **`id: 0` or `id: null`** for a net-new component (the import / platform assigns the real id — both values verified accepted on live upserts; the grids skeleton uses `null`, most other skeletons use `0`).

> **Tailored overlays** add shadow-marker rules on top of these — see [`../tailoring-overlay/`](../tailoring-overlay/SKILL.md).
>
> **The branch is the source of truth.** Run these against the staged scratch `body.json` (or a fresh `dxs source explore config` fetch), per [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — not a persistent local copy.

## Consumers

This list is referenced (not re-enumerated) by the audit skills `component-validator` and `grid-validator`, the `post-edit-verification` floor, and every component-creator skill's "File basics" pre-flight item. Update a rule's authoritative doc (`defaults.md` / `file-format.md` / `naming-conventions.md`) and this enumeration once; consumers link here rather than restating it.
