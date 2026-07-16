# Package Cascade — Interaction Patterns

## Choosing the target organization (Phase 0)
The cascade runs within ONE tenant — the org whose packages get re-pinned and republished. Resolve
it before planning with `dxs -O json organization list`:

- **One org returned** → use it and say nothing. A non-Datex user only ever sees their own tenant,
  so there is nothing to choose.
- **Several returned** (Datex members see all tenants) → offer three shapes:
  - **Use current** — the active identity's org (`dxs -O json organization mine`). Default; pre-select it.
  - **Pick from the list** — present each org as `name (id)` and let the user choose one.
  - **Enter it** — accept an organization NAME or a TENANT ID. Match the input against the
    `organization list` payload (each row has `name`, `id`, and `tenantId`). On a misspelled name
    with no exact hit, present the closest matches from that same list as a fresh pick list
    ("did you mean…") instead of failing.

Pass the resolved id to Phase 1 as `--org <id>`. Publishing the planned packages needs rights in
that org: a Datex member can publish across every tenant, a tenant user only within their own —
which is exactly why a non-Datex user has just one org to sync and never needs to choose.

## Presenting the plan (Phase 2)
Render an indented tree rooted at the origin, annotated with the pin change and execution level.
Circled numbers = execution level (all ① before any ②):

```
Changed: Module1 → 20260714.1000

Packages to update & republish (bottom-up, 3 total):
  ① Module2   "Module 2"   pin Module1: 1101 → 20260714.1000    (Main #3001)
  ① Module4   "Module 4"   pin Module1: 1102 → 20260714.1000    (Main #3040)
  ② Module0   "Module 0"   pin Module2: (resolved after ①)       (Main #3005)

Applications left stale (NOT republished — update separately):
  • App 1   (consumes Module0)   Main #9001
  • App 2   (consumes Module4)   Main #9002
```

## The pick prompt
Offer three shapes:
- **Update all** — run every package node.
- **Pick a subset** — multi-select by `uniqueIdentifier`; pass each as `--select`.
- **Review only** — stop after showing the plan.

If a subset deselects a package that others depend on, explain the prune: "skipping Module2 means
Module0 has nothing to update and will also be skipped." (`cascade run` will error if an
intermediate dependency's new version is unknown — deselecting mid-chain is not supported.)

## Progress narration (Phase 3)
One concise line per completed node with the resulting version and an `n of N` counter, e.g.
`✓ Module2 published as 20260714.1102 (1 of 3)`. Never silently continue past a failure — pause,
report, and ask retry / skip / abort.

## Final report (Phase 4)
```
Done. Republished: Module2 (20260714.1102), Module4 (20260714.1103), Module0 (20260714.1104).
⚠ Stale applications to update separately:
  • App 1 → pin Module0 20260714.1104
  • App 2 → pin Module4 20260714.1103
```
