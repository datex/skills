---
name: footprint-entity-expert
description: |
  Use when designing OData queries, datasources, flows, or reports that touch
  Footprint WMS data — i.e. anything querying entities like Tasks, Shipments,
  ArchivedShippingLicensePlateContents (ASLPC), LicensePlate, Lot, Material,
  Project, Owner, or any Footprint operational concept (receiving, shipping,
  inventory archive, license plates, fixed/catch weight, packaging). Captures
  the navigation chains, filter conventions, weight calculations, and exclusion
  rules that the OData metadata alone doesn't reveal. Use BEFORE building a
  flow datasource over a Footprint entity. Skip for non-Footprint apps (custom
  apps with no WMS data).
---

# Footprint Entity Expert

Reference for Footprint WMS domain knowledge that isn't derivable from OData metadata alone — navigation chains, business-rule filters, weight calculations, and other context you'd otherwise have to reverse-engineer from existing reports.

This skill sits **above** `schema-explorer` and `datasource-creator`: it tells you *which* entities to explore and *what* the gotchas are, before those skills do the mechanical work of validating fields and generating configs.

## When to use this skill

| Working on… | Use this skill? |
|-------------|-----------------|
| A report or flow that queries Tasks, Shipments, License Plates, Inventory, Materials, Lots, etc. | **Yes** — start here before schema exploration |
| A datasource over an `Archived...` entity (shipping or receiving history) | **Yes** — archive entities have specific nav chains |
| A weight or unit-of-measure calculation (case weight, pallet weight, totals) | **Yes** — fixed vs catch weight branching is non-obvious |
| An app or report that has nothing to do with WMS data (custom org settings, generic dashboards) | **No** — this skill won't apply |
| A report on data the customer added themselves (custom Material extension fields, etc.) | Partial — use the entity references for the standard fields, then verify customer extensions with `schema-explorer` |

If you're not sure whether the data is Footprint-shaped, the connection's `apiConnectionTypeName` is a good signal: `FootPrintApi` → yes, anything else → probably no.

## How to use it (progressive disclosure)

This SKILL.md is an **index**, not the content. Don't try to absorb everything below — find the topic you need in the table, then read that one reference file. Each reference is self-contained: the entity definition, the nav chain, the gotchas, and a worked OData query example.

The index covers entities and cross-cutting concerns separately because some patterns (weight logic, owner navigation) recur across many entities.

## Entity references

| Entity / area | Reference file | When to consult |
|---------------|----------------|-----------------|
| `ArchivedShippingLicensePlateContents` (ASLPC) — historical shipped inventory | [references/archived-shipping-lpc.md](references/archived-shipping-lpc.md) | Building shipping-history reports, billing-by-shipped-volume queries, anything that historically would have been the SQL `ShippingActivityRaw` view |
| `Tasks` filtered to receiving | [references/receiving-tasks.md](references/receiving-tasks.md) | Building receiving-activity reports, dock-to-stock metrics, anything counting received units / pallets / weight |

## Cross-cutting references

| Topic | Reference file | When to consult |
|-------|----------------|-----------------|
| Owner / Project navigation chain | [references/owner-navigation.md](references/owner-navigation.md) | Any report that groups, filters, or labels by owner or project — the path differs by entity |
| Weight calculations (fixed vs catch weight) | [references/weight-and-units.md](references/weight-and-units.md) | Any total-weight or per-LP weight calculation — the formula depends on `Material.IsFixedWeight` |

## What's NOT in here (deliberately)

- **Per-customer business rules** — order class IDs to exclude, custom statuses, billing tiers, etc. These vary by customer and belong in customer-specific docs, not here. Where this skill mentions exclusions (e.g., common receiving order classes), it flags them as "common but verify per-customer."
- **OData mechanics** — how `$expand`, `$filter`, paging work. That's in `schema-explorer`, `datasource-creator`, and [../../datex-studio/shared/flow-code-patterns.md](../../datex-studio/shared/flow-code-patterns.md).
- **Standard CRUD entities with no surprises** — Warehouse, Carrier, Pack, etc. Use `schema-explorer` directly; they don't need a reference page.
- **UI / hub configuration** — how Footprint hubs and grids are wired. That's `datex-studio/hub-editor`.

When you discover new entity gotchas during a session, add a reference file here rather than letting the knowledge live only in commit history.

## Relationship to other skills

```
[user asks for a Footprint report]
        |
[footprint-entity-expert]   ← THIS SKILL: which entities, what gotchas?
        |
[schema-explorer]           ← validate the entity exists on this connection,
        |                     confirm property names and types
[datasource-creator]        ← generate the OData/flow datasource using
        |                     the validated schema + the rules from this skill
[report-creator]            ← assemble the report
```

This skill is consulted **once per entity**, not per query. The output is a mental model: which OData entity backs the business concept, what to expand, what to filter, how to handle weight, and which navigation chain reaches the owner. Pass that understanding into `datasource-creator` so its schema-validation work has direction.
