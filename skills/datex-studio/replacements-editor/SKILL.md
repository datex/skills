---
name: replacements-editor
description: |
  Use when editing an application's Datex Studio replacements singleton
  (configurationTypeId=33, CLI type `replacements`, fixed referenceName
  `replacements`) on a branch — the build-time swap table that makes every use of
  a package component (`<applicationReferenceName>.<referenceName>` of a given
  type) resolve to a replacement component in this application instead. Owns the
  singleton rule (one per package, edit in place; delete and re-create only from a saved body, edit the
  own row only), the swap-entry shape, the identical-contract rule, the
  impact-analysis-first rule (replacements are invisible to reverse-trace), and
  the reconciliation with tailoring overlays. Triggers: "replace the core grid
  with our tailored one", "swap a package flow for a custom one", "activate a
  tailored component", "which component do users actually see", "my tailored
  grid never shows up", "custom flow has zero callers", "has_replacements",
  "edit replacements", "create a replacements config".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - impact-analysis
  - tailoring-overlay
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Replacements Editor

Edit an application's **replacements** singleton (configurationTypeId=33) on a branch — the swap table that, at build time, substitutes one of this application's components for a component of a referenced package, **everywhere** that component is used (including inside other packages). It is the app-level activator behind tailoring: a `tailored_*` overlay or `custom_*` copy only reaches users once a replacement points at it. Every package already has exactly one replacements config, with the fixed `referenceName: "replacements"`; this skill only ever **edits** it.

**Replacements are invisible to reference-following.** No component names its replacement, so `reverse-trace`, grep, and dependency graphs all miss the swap. Impact analysis comes first, every time.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/replacements.md](references/replacements.md) — Authoritative reference: body shape, entry semantics, contract rule, observed patterns, pre-flight checklist
- [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md) — Shared lifecycle for every auto-provisioned singleton: own-row discovery, envelope secrets, `readonly`, write path, edit in place, delete and re-create only from a saved body
- [../tailoring-overlay/references/tailoring.md](../tailoring-overlay/references/tailoring.md#app-level-replacements-build-time-swap) — the tailoring model and its App-Level Replacements section (core-change impact rule, swap match key)
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — `inParams` / `outParams` contracts the replacement must match
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — envelope vs inner body, `Module/ref` reads

## Dependencies

- **`impact-analysis`** skill — invoked **before** adding, changing, or removing an entry: callers of the original (they all get the replacement) and anything already depending on the current swap
- **`tailoring-overlay`** skill — authoring the `tailored_*` / `custom_*` component the entry points at
- **`component-wiring-check`** skill — confirming the replacement's `inParams`/`outParams` match the original one-for-one
- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context

## CLI Lifecycle

There is **no create path**: the platform provisions the replacements config with the package. Edits go through `dxs configuration` with CLI type **`replacements`**, mapping to `configurationTypeId: 33`. Full rules in [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md).

**Edit the branch's own replacements config:**

```bash
# 0. Quick read of the current swaps (read-only projection)
dxs -O json source branch replacements <branchId>
# 1. Resolve the OWN row — list returns the own row plus one row per direct reference
dxs -O json configuration list replacements -b <branchId> \
  | jq '.configurations[] | select(.applicationId == <branchId> and .isExternal == false) | .id'
# 2. Fetch and extract the body in ONE command (the envelope embeds the appConfig's secrets)
dxs -O json configuration get replacements <ownId> -b <branchId> | jq '.configuration.json' > body.json
# 3. Edit body.json — replacements[] only
# 4. Validate — gates the push; exit 1 = errors found, not a broken CLI (it does NOT check that targets exist)
dxs configuration validate replacements -b <branchId> -D body.json
# 5. Push — path A; fallbacks in the lifecycle doc (Rule 5)
dxs configuration upsert replacements -b <branchId> -D body.json
```

### Round-trip rule (critical)

Never pipe an envelope into `upsert` — it silently destroys configuration content ([../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md)). The replacements envelope also embeds a full copy of the branch's appConfig (plaintext secrets): extract the body in the same command and never print the envelope.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md; confirm the branch with the user
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Is this an application?]
  replacements are populated on applications, never on component packages
  package branch -> stop and ask (effect on a package is unproven)
        |
[Phase 3: Impact analysis FIRST]  -> invoke `impact-analysis`
  callers of <Pkg>.<referenceName> (all will get the replacement)
  current replacements of this app + consuming apps (reverse-trace can't see them)
        |
[Phase 4: Contract parity]
  replacement exists in THIS app, same configurationTypeId,
  inParams/outParams identical to the original  (tailoring-overlay authors it)
        |
[Phase 5: Resolve own row + fetch + edit replacements[]]
        |
[Phase 6: Validate + push + verify]
  validate replacements -> upsert -> source branch replacements shows the entry
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Is this an application?

Every populated replacements config observed belongs to an **application** (UI apps and API apps); component packages carry an empty one. Check the own list row's `isModule` — `false` for an application. On a package branch, stop and ask: whether a package's replacements apply anywhere is `_TODO_`.

### Phase 3: Impact analysis first

Run [`impact-analysis`](../impact-analysis/SKILL.md) on the **original** component (`dxs source explore reverse-trace` with the module-qualified name): every caller, in every package, gets the replacement once the swap lands. Then read this application's existing `replacements[]` — an entry for the same `{configurationTypeId, applicationReferenceName, referenceName}` already exists means you are **changing** a swap, not adding one. When the request is a change to a **core** component, apply the tailoring doc's impact rule: check the replacements configs of consuming applications ([tailoring.md → App-Level Replacements](../tailoring-overlay/references/tailoring.md#app-level-replacements-build-time-swap)).

### Phase 4: Contract parity

The replacement must keep the original's inputs and outputs identical — it is called with the original's arguments. Fetch both bodies (`Module/ref` for the original) and compare `inParams` / `outParams` one-for-one; any difference is a stop. The replacement must exist in **this** application with the **same** `configurationTypeId`. `validate` checks neither existence nor contract (verified: entries naming nonexistent packages and components validate clean).

### Phase 5: Edit

Append one entry per swap:

```json
{ "configurationTypeId": 3, "referenceName": "<original_ref>", "applicationReferenceName": "<OriginalPackage>", "replacementReferenceName": "<replacement_ref>" }
```

`replacementApplicationReferenceName` is omitted from fetched bodies because it is `null` on every observed entry (the replacement resolves from this application); setting it is `_TODO_`. A same-name replacement (`replacementReferenceName` equal to `referenceName`) is legal — this application's own component of that name replaces the package's.

## Pre-Flight Checklist

Walk the full checklist in [references/replacements.md → Pre-Flight Checklist](references/replacements.md#pre-flight-checklist). The fast version:

1. **Lifecycle basics** — branch confirmed; own row by `applicationId == <branchId>` and `isExternal == false`; edit the existing row; delete and re-create only from a saved body, never a second instance ([../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md)); universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — the body's `description` stays the provisioned boilerplate.
2. **Application branch** (`isModule: false`), or the user has confirmed otherwise.
3. **`impact-analysis` ran** on the original; existing swaps for the same key reviewed.
4. **Replacement exists** in this application with the same `configurationTypeId`.
5. **Contract identical** — `inParams` / `outParams` match one-for-one.
6. **Entry key correct** — `applicationReferenceName` is the original's package, `referenceName` its exact name, `configurationTypeId` its type.
7. **Validate** before the write; `dxs source branch replacements` shows the entry; no lock left held.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/replacements.md → Common Failure Modes](references/replacements.md#common-failure-modes). The ones that bite most often:

- **Skipping impact analysis because reverse-trace "found no callers"** — it never sees swaps; the original's callers are the blast radius.
- **Replacement with a different contract** — every caller passes the original's arguments.
- **Wrong key** — `applicationReferenceName` must be the package that owns the original, not this application.
- **Assuming validate checks the targets** — it doesn't; a typo validates clean and silently never swaps.
- **Creating a replacements config** — one already exists; edit the own row.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
