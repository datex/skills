# Replacements — Authoring Reference

Authoritative reference for the Datex Studio **replacements** singleton (`configurationTypeId: 33`, CLI type `replacements`, fixed `referenceName: "replacements"`). Every application and package has exactly one. Each entry tells the build: "inside package `applicationReferenceName`, swap the component of type `configurationTypeId` named `referenceName` for this application's `replacementReferenceName`." The swap applies to **every** use of the original, including uses inside other referenced packages. The shared singleton lifecycle (own-row discovery, envelope secrets, write path, edit in place, delete and re-create only from a saved body) lives in [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) and is not repeated here.

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Replacements are the **app-level, build-time swap** behind tailoring. A `tailored_*` overlay or a flattened `custom_*` copy ([../../tailoring-overlay/references/tailoring.md](../../tailoring-overlay/references/tailoring.md)) does nothing on its own — no package component calls it. A replacement entry makes every call to the original resolve to it.

Use this skill to:

- **activate** a tailored/custom component in an application;
- **retire** a swap (remove an entry) so users get the package's component again;
- **answer "what do users actually run"** — read the swaps before reasoning about callers, because reverse-trace cannot see them.

The tailoring doc's [App-Level Replacements](../../tailoring-overlay/references/tailoring.md#app-level-replacements-build-time-swap) section carries the platform-side rules (swap match key, core-change impact rule, hook behaviour on retrofit); this doc does not repeat them.

## File Location & Naming

- `configurationTypeId: 33`; CLI type `replacements`; fixed `referenceName: "replacements"`, `title: "Replacements"`, `description: "Configuration replacements for this application"` — provisioned, never changed.
- Conventional file name: `replacements-replacements.json` if the body is kept on disk — a naming convention only; the branch is the system of record.
- Replacement components follow the provenance prefixes in [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md): `tailored_<base>` (overlay) or `custom_<base>` (flattened copy). Observed exceptions — `customized_<base>`, a `test_` prefix, a `_demo` suffix, and same-name replacements — are legal but not a style to copy.

## Minimal Valid Skeleton

The shape as provisioned (empty on every component package) — recognise and edit against it; push it only as a restore of a deleted row, never as a second instance:

```json
{
  "replacements": [],
  "configurationTypeId": 33,
  "id": <ownId>,
  "referenceName": "replacements",
  "title": "Replacements",
  "description": "Configuration replacements for this application",
  "accessModifier": "public"
}
```

With one entry (an application swapping a package grid for its tailored copy):

```json
"replacements": [
  { "configurationTypeId": 3, "referenceName": "inbound_orders_grid", "applicationReferenceName": "FootprintManager", "replacementReferenceName": "custom_inbound_orders_grid" }
]
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `replacements` | Swap table | `[]` as provisioned. |
| `configurationTypeId` | Type | `33`. |
| `id` | Own singleton id | Must equal the own row's id. |
| `referenceName` / `title` / `description` | Identity | Fixed boilerplate; leave verbatim. |
| `accessModifier` | Visibility | `"public"`. |

Entry fields:

| Field | Meaning | Notes |
|---|---|---|
| `configurationTypeId` | Type of the original **and** the replacement | Observed: `2` hub, `3` grid, `4` editor, `5` form, `7` selector, `9` flow (function), `18` action. Same type on both sides. |
| `referenceName` | The original component's name | Exact, as in its package. |
| `applicationReferenceName` | The package that owns the original | e.g. `FootprintManager`, `Utilities` — not this application. |
| `replacementReferenceName` | The replacing component in this application | May equal `referenceName` (same-name replacement: this application's own same-named component replaces the package's). |
| `replacementApplicationReferenceName` | Package of the replacement | `null` on every observed entry, so fetched bodies omit it (null keys are dropped — [configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md#fetched-bodies-omit-null-keys--absence-is-not-schema-evidence)); `null` means this application. Non-null semantics `_TODO_`. |

**What `validate` does not check** (verified live): that the original package, the original component, or the replacement exists, or that their contracts match — an entry naming nothing real validates clean.

## Runtime Globals

N/A — the replacements config has no code strings and no runtime global. Its effect is at build time: the generated code for every caller binds the replacement.

## Invocation Contract

- **Every caller of the original gets the replacement** — in this application and in every referenced package's code it builds. The replacement is called with the original's arguments and its outputs are read as the original's, so `inParams` / `outParams` (and, for a flow or action, the full signature) must be **identical**. Audit with [`component-wiring-check`](../../component-wiring-check/SKILL.md) against the original fetched as `Module/ref`.
- **Invisible to reverse-trace.** No component names the replacement: `dxs source explore reverse-trace`, grep, and dependency graphs all miss it. A `tailored_*` / `custom_*` component with zero callers may be exactly what users see. Run [`impact-analysis`](../../impact-analysis/SKILL.md) on the **original** before adding, changing, or removing an entry.
- **Where it lives.** Populated only on applications (UI apps and API apps), never on component packages. Effect of an entry on a package is `_TODO_`.
- **Change visibility.** A pending change to the replacements config is reported by `dxs source changes` as `has_replacements`; `dxs source branch replacements <branchId>` is the read-only projection of the own entries.
- **Core changes.** A change to a core component's internals can silently bypass a consuming application's swap even when the public contract is unchanged — see the impact rule in [tailoring.md → App-Level Replacements](../../tailoring-overlay/references/tailoring.md#app-level-replacements-build-time-swap).

## Common Patterns

### Activate a tailored UI component

The tailored/custom grid, editor, hub, form, or selector is authored first in this application (via `tailoring-overlay`), then:

```bash
jq '.replacements += [{"configurationTypeId":4,"referenceName":"purchase_order_editor","applicationReferenceName":"FootprintManager","replacementReferenceName":"tailored_purchase_order_editor"}]' \
  body.json > body.next.json && mv body.next.json body.json
```

### Swap a backend flow or action

API applications swap package actions (`configurationTypeId: 18`) for custom implementations — e.g. a workflow package's `on_order_processed` replaced by the application's `custom_on_order_processed`. Same contract rule; the replacement action must keep the original's in/out parameters.

### Same-name replacement

```json
{ "configurationTypeId": 9, "referenceName": "get_global_context_flow", "applicationReferenceName": "Utilities", "replacementReferenceName": "get_global_context_flow" }
```

The application defines its own `get_global_context_flow`; the entry makes every caller of the Utilities flow use it. Legal and observed on several applications.

### Read what users actually run

```bash
dxs -O json source branch replacements <branchId> \
  | jq '.replacements[] | "\(.applicationReferenceName).\(.referenceName) -> \(.replacementReferenceName) [cti \(.configurationTypeId)]"'
```

## Pre-Flight Checklist

1. **Lifecycle** — branch confirmed; own row by `applicationId == <branchId>` and `isExternal == false`; edit the existing row; delete and re-create only from a saved body, never a second instance ([../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md)). The body's `description` stays the provisioned boilerplate ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)).
2. **Application** — own row `isModule: false`, or the user confirmed a package edit.
3. **Impact first** — `impact-analysis` on the original; existing entries for the same key reviewed; consuming applications' swaps checked for core changes.
4. **Replacement exists** in this application, same `configurationTypeId` as the original.
5. **Contract identical** — `inParams` / `outParams` match one-for-one (component-wiring-check).
6. **Key exact** — `applicationReferenceName` = the original's package; `referenceName` = its exact name.
7. **No duplicate key** — one entry per `{configurationTypeId, applicationReferenceName, referenceName}`.
8. **Validate** before the write (it won't catch bad targets); round-trip read via `dxs source branch replacements`; no lock left held.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| Tailored component never shows up | No replacement entry, or the entry's key has a typo (validate does not catch it) | Add/fix the entry; compare names against the original fetched as `Module/ref`. |
| Callers break after the swap | Replacement's `inParams`/`outParams` differ from the original | Restore parity in the replacement, or remove the entry. |
| A "zero-caller" custom component was deleted and users lost a feature | It was a replacement target; reverse-trace can't see swaps | Restore it; read replacements before declaring a component dead. |
| Customization silently stopped applying after a core release | The core change moved the swap's match key (e.g. standalone → owned datasource) | See tailoring.md's core-change impact rule; retrofit in place. |
| Entry has no effect | Added on a component package, not the application | Move it to the application's replacements (package effect `_TODO_`). |
| Push went to the wrong row | Body `id` from a dependency row | Re-resolve the own row. |

## Cross-References

- [../../tailoring-overlay/references/tailoring.md](../../tailoring-overlay/references/tailoring.md#app-level-replacements-build-time-swap) — tailoring model and App-Level Replacements rules.
- [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) — own-row discovery, envelope secrets, `readonly`, write path.
- [../../impact-analysis/SKILL.md](../../impact-analysis/SKILL.md) — callers of the original before any swap change.
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — the in/out contract the replacement must match.
- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — `tailored_` / `custom_` provenance prefixes.
