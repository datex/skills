# Sales Order Line Creation — Singular vs Batch Actions

Footprint ships two extended actions for creating sales order lines. They are **not interchangeable**: the batch action demands fully-specified lines and cannot derive anything, while the singular action carries the derivation logic wizard/UI callers depend on. Routing wizard lines through the batch action caused a production regression ("Material Id has an undefined value" blocking outbound order creation, hotfixed 2026-08-13).

## The two actions

| | `create_sales_order_line_action` (singular) | `create_sales_order_lines_action` (batch) |
|---|---|---|
| Built for | Wizard / UI-driven creation (inventory-selection pickers) | EDI / import-style callers with fully-specified lines |
| Material | **Derived from the lot** when only `lotId` is supplied | `MaterialId` required on every line — cannot derive from lot |
| Amount | Computed by the action's own paths | Computed `Amount` required on every line |
| Packaging | Handled per creation branch | `packagingId` + amount required |
| License plate | Native LP branch — pass `licenseplateId` and it forwards to `CreateSalesOrderLineByLot` | No LP derivation |
| Serial-only lines | Supported | Not supported (the serial-only gap) |

The batch action's three full-spec requirements (packaging+amount, no serial-only, `MaterialId`+`Amount`) were each discovered as production failures — none are stated in its parameter descriptions. Treat "batch" as meaning *batch transport for complete line specs*, not *bulk version of the singular semantics*.

## Rules

1. **Wizard/UI-driven creation loops the singular action per line** — server-side, so the client still pays one round trip and one version check. Inventory-selection wizards supply only `{lotId, packagingId, packagedAmount, licenseplateId}`; only the singular action can complete a line from that.
2. **Reach for the batch action only when every line already carries the full spec** (`MaterialId`, computed `Amount`, packaging) — i.e. EDI/import flows.
3. **Failure semantics differ.** A singular-action loop is sequential-partial on failure (lines before the failure exist); the batch action validates its payload up front. Neither is transactional — plan reconciliation accordingly.
4. **Pass `licenseplateId` to the singular action rather than post-writing the LP** with a separate `crud_update` — the action's LP branch is the maintained path and saves a call.

## Cross-references

- Dispatch cost of per-line action loops: [calling-conventions.md → Dispatch Cost](../../../datex-studio/datex-studio-runtime/calling-conventions.md#dispatch-cost) — the loop is a known platform cost; there is no batch CRUD primitive to swap in.
- Order/line status semantics: [footprint-status-codes.md](footprint-status-codes.md).
