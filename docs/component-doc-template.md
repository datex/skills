> **This is the authoring template for component _reference docs_** — the `references/<type>.md` files inside a creator skill that describe how to author one component type. It is not a component doc itself and is not consulted at config-authoring time. Copy this shape when writing a reference doc for a component type that doesn't have one yet, so all the docs stay uniform. Leave a `_TODO_` marker for sections you can't fill yet; write `N/A — <reason>` when a section genuinely doesn't apply.

---

# _Component Type Title_

_One-paragraph opening: what this component type is and the role it plays in the platform. Link to peer docs it interacts with (e.g. `datasources.md`, `grids.md`) and to the cross-cutting references under `datex-studio-conventions/` (file-format, naming-conventions, defaults) and `datex-studio-runtime/` (runtime-globals, calling-conventions, control-types)._

## Purpose & When to Use

_What problems this component type solves. When to choose it over adjacent component types. Typical use cases._

## File Location & Naming

_The filename convention — the component lives on the branch (authored via the dxs CLI round-trip), so this is a naming convention, not a local path:_

- File name: `<name>-<suffix>.json` (`referenceName` stem + suffix)
- Suffix: `-<suffix>.json`
- `configurationTypeId`: _the numeric id (a body field)_; CLI type argument: _the lowercase `KNOWN_TYPES` name_
- Naming conventions: _e.g. `_dd` for dropdown variants, default package, casing._

## Minimal Valid Skeleton

_A copy-pasteable JSON skeleton showing the smallest valid component of this type, with placeholder values. Include only top-level fields that must be present — don't show every optional field._

```json
{
  "id": 0,
  "referenceName": "<name>",
  "description": "<≤100 chars>",
  "accessModifier": "public",
  "...": "..."
}
```

## Required Top-Level Fields

_Table describing each required top-level field and what it controls. Include non-obvious defaults and gotchas._

| Field | Purpose | Notes |
|---|---|---|
| `id` | Component identity | `0` for new; the platform assigns the real id on import |
| `referenceName` | Code-facing handle | Snake_case; matches the filename stem |
| `description` | Searchable description | Non-empty, ≤ 100 chars (platform limit) |
| `accessModifier` | Visibility | Default `public` (see `datex-studio-conventions/defaults.md`) |

## Runtime Globals

_What's available inside code strings belonging to this component type (`$flow`, `$datasource`, `$grid`, `$hub`, `$row`, etc.), and the distinctions from adjacent component types. For components with no code strings, write `N/A — <reason>`._

## Invocation Contract

_How other components reference or invoke this one: `moduleId` rules, `configParameters` contract-matching, `inParams` expectations, event subscriptions. See `component-wiring-check/references/component-wiring.md` for the cross-component reference rules._

## Common Patterns

_Two or three recurring patterns with short snippets._

### _Pattern name_

_Brief description, minimal example, when to use._

## Pre-Flight Checklist

_Numbered "don't ship without this" rules. Each item either prevents a known class of error or keeps a known invariant. Prefer linking to the specific section in this doc or a peer doc rather than restating._

1. _Required-field sanity (description non-empty ≤ 100 chars, accessModifier set, etc.)._
2. _Cross-component references have correct `moduleId` and full `configParameters` contract._
3. _Any sync rules between this component type and others are met (e.g. grids' "five locations")._

## Cross-References

- _Peer docs this component type interacts with, with one-line notes on the relationship._
- _Cross-cutting docs (`datex-studio-conventions/*`, `datex-studio-runtime/*`, `datex-studio-shared/*`) when this component leans on their rules._
