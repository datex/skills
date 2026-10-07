# Localization (configurationTypeId 16, CLI type `localization`)

> Stub reference doc — no component-creator skill exists for this type yet, and may never need one. See [`datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md) for the cti table and the "documented gap" note. This doc follows the component-doc-template shape so it can be extended in place once an instance exists to observe.

A localization configuration is a registered platform type with **zero authored instances** anywhere in the organization's applications as of this writing.

> **Platform team answer (October 2026):** the type is registered but there is **no localization feature behind it yet**. Nothing is expected to be authored, and nothing consumes an instance. Keep this doc as the probe record for when the feature ships; until then, treat any request to "add localization" as a question for the platform team, not an authoring task. The working theory below is retained as context only. Everything below that isn't backed by a live probe is marked `_TODO_` — do not invent field shapes or behavior for this type.

## Purpose & When to Use

_TODO_ (no instance exists to observe; confirmed unused by the platform team; revisit when the feature ships). The registered CLI type and the route being fully wired (list/get/validate/contexts all respond, see Probe Recipe below) indicate the platform treats this as a first-class configuration kind, not a stub left over from a removed feature. The most defensible working theory, pending confirmation: a `localization` configuration is meant to register per-package language resources — consistent with the `ILocalizationService` shape observed in the generated runtime context (see Runtime Globals below), which exposes a `selectedLanguage` getter **per referenced package** alongside a single, global `setLanguage()`. Under that reading, authoring a `localization` config would be how a package declares/supplies its translated strings; whether any instance is strictly *required* for `ILocalizationService` to function, or whether the service runs off zero instances by design, is unknown.

Do not treat this doc as covering the full type until an instance exists and this section is rewritten from one.

## File Location & Naming

No instance exists anywhere to confirm an export path or file suffix. By the platform's general naming pattern (stem + camelCase type name), a conventional name would be `<name>-localization.json`, but this is an inference by analogy with other types, not an observed fact — `_TODO_ (no instance exists to observe)`.

- CLI type: `localization` (confirmed — `dxs configuration list localization` and `get`/`validate`/`contexts` all resolve against this type name).
- `configurationTypeId`: 16 (confirmed against the platform's own `configurationtypes` enumeration).
- Package / `accessModifier` / `description` conventions: presumed to follow the platform defaults (`Utilities`, `public`, non-empty ≤100 chars) per [`datex-studio-conventions/defaults.md`](../datex-studio-conventions/defaults.md) — unconfirmed for this specific type since `validate` only checks the fields present in a probe body (see below), not a full required-field set.

## Minimal Valid Skeleton

No instance exists to copy. The smallest body that **passed `validate`** in a live probe (never upserted — there is nothing to upsert against, since no branch has ever carried one) was the bare top-level tail every configuration type shares:

```json
{
  "configurationTypeId": 16,
  "id": 0,
  "referenceName": "example_localization",
  "title": "example_localization",
  "description": "One-line purpose under 100 chars.",
  "accessModifier": "public"
}
```

`validate` returned `"status": "valid"` with no warnings for this body. That only proves the platform's validator doesn't reject an empty-of-content localization config — it does **not** prove this is a complete or useful instance. Whatever fields actually carry language/translation data (a `languages[]` array? a `values`/resource-key map?) are unobserved — `_TODO_ (no instance exists to observe)`.

## Required Top-Level Fields

Confirmed only for the universal tail shared by every configuration type:

| Field | Purpose | Notes |
|---|---|---|
| `configurationTypeId` | Component identity | `16` for this type |
| `id` | Component identity | `0` for new |
| `referenceName` | Code-facing handle | Snake_case |
| `description` | Searchable description | Non-empty, ≤100 chars (platform limit) |
| `accessModifier` | Visibility | `public` by default |

Everything a real localization config would need beyond this tail (how languages/translations are declared, whether there's a datasource-like binding, whether it's per-package or global) is `_TODO_ (no instance exists to observe; confirmed unused by the platform team; revisit when the feature ships)`.

## Runtime Globals

The platform's generated runtime context for **other** component types (verified by inspecting the shared `appContext` TypeScript surface generated for a visualization and a footprint-query-manager component — this interface is declared globally, not scoped to the localization type itself) exposes:

```typescript
class Language {
  name: string;
  code: string;
}

interface ILocalizationService {
  get selectedLanguage(): Language;
  setLanguage(lang: Language): void;

  // one entry per package the current application references, e.g.:
  FootprintManager: { get selectedLanguage(): Language };
  Utilities: { get selectedLanguage(): Language };
  // ...one such block per referenced package
}
```

This is a per-package language-resource surface with one global language switch (`setLanguage`) and a per-package read accessor. What global variable this interface is bound to (the equivalent of `$visualization` or `$queryManager` for this type), and whether a `localization` configuration is what *populates* a package's entry here, are both `_TODO_ (no instance exists to observe; confirmed unused by the platform team; revisit when the feature ships)`.

Calling `configuration contexts localization` against a probe body returns a `localizationContext` designer context that is **empty** (zero-length text) and, unlike every other probed type, no `appContext` entry at all alongside it — i.e. the authoring-time context for this type's own flow code (if it has any) is unobserved. Whether a `localization` component even supports flows/code at all is `_TODO_`.

## Invocation Contract

_TODO_ (no instance exists to observe). No other component type has been observed referencing a `localization` configuration by `moduleId`/`configParameters` the way hubs/forms/grids reference each other — see [`component-wiring-check/references/component-wiring.md`](../component-wiring-check/references/component-wiring.md) for the general cross-component reference rules if/when a wiring pattern is found.

## Common Patterns

_TODO_ (no instance exists to observe).

## Pre-Flight Checklist

There is nothing to ship yet — do not author a `localization` config from this doc alone. Before creating one for real:

1. Confirm with the platform team that the localization feature has shipped and what a `localization` config is *for*, rather than guessing from the runtime typing alone.
2. Once an instance exists anywhere (your own first one, or one someone else ships), re-run the Probe Recipe below against it and rewrite Purpose, Minimal Valid Skeleton, Required Top-Level Fields, Runtime Globals, and Invocation Contract from the observed body and its generated contexts.
3. Standard tail sanity still applies regardless: non-empty `description` ≤100 chars, `accessModifier` set — see [`datex-studio-conventions/universal-checklist.md`](../datex-studio-conventions/universal-checklist.md).

### Probe recipe (for the next author, once an instance exists)

```
dxs configuration list localization -b <branch>          # find a real id
dxs configuration get localization <id> -b <branch>      # extract configuration.json
dxs -O json configuration contexts localization -b <branch> -D <body.json>
  # project: .configuration_contexts.designerContexts[] | select(.id!="appContext") | .text
  # — never dump the appContext entry; it's shared platform-wide and can run into the tens of MB
```

As of this probe (no instance anywhere), the readable facts were:

- `dxs configuration list localization -b <branch>` → `{"configurations": []}` with `"success": true` — an empty result is not an error for this type.
- `dxs configuration get localization <nonexistent-id> -b <branch>` → `DXS-404-001` ("Resource not found") — the route is wired, it's just that every id 404s because none exist.
- `dxs configuration validate localization -b <branch> -D <body.json>` against the minimal tail body above → `"status": "valid"`, no warnings.
- `dxs -O json configuration contexts localization -b <branch> -D <body.json>` → a `localizationContext` designer context with empty text, and no `appContext` entry.

## Cross-References

- [`datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md) — cti table and the "documented gap" note covering this type.
- [`datex-studio-conventions/defaults.md`](../datex-studio-conventions/defaults.md) — package/accessModifier/description defaults assumed (unconfirmed) above.
- [`datex-studio-runtime/runtime-globals.md`](../datex-studio-runtime/runtime-globals.md) — where the eventual `$localization`-equivalent global, if any, would be documented once found.

---
Distilled from a live probe against a Footprint Manager package and its generated designer contexts, dxs 0.5.8.
