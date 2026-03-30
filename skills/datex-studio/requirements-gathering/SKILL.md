---
name: requirements-gathering
description: |
  Produces a standardized requirements brief from any source: DevOps work items,
  mockups, natural language descriptions, existing reports, or documents. This is
  a utility skill — it gathers and structures requirements but does not build
  anything. If the goal is to create a report, datasource, or other artifact,
  use the appropriate creation skill as the entry point; it will invoke this
  skill when it needs requirements.
---

# Requirements Gathering

Gather and structure requirements from any source into a standardized brief that downstream skills (`schema-explorer`, `datasource-creator`, `report-creator`) can consume.

## When to Use

- Before creating a report (`report-creator` invokes this as Phase 1)
- Before creating a datasource (`datasource-creator` invokes this when requirements are unclear)
- Whenever the user provides a work item ID, mockup, spec, or description and you need to extract structured requirements before building anything

## Output Contract

Regardless of source, produce a **requirements brief** with these sections:

```markdown
## Requirements Brief

**Title:** [name of the report/datasource/feature]
**Purpose:** [1-2 sentence summary]
**Source:** [work item #ID / user conversation / document / existing report]

### Data Requirements

#### Fields with Semantic Roles
For each field, identify WHAT it is and WHERE it belongs:

| Field | Semantic Role | Report Section / Usage |
|-------|--------------|----------------------|
| ownerName | Goods principal name | Shipper/Consignor header |
| accountName | Customer name | Consignee header |
| materialLookupCode | Product identifier | Line item grid |
| tareWeight | Packaging weight | Calculated: gross = raw + qty * tare |

#### Entity Keywords
[List of OData entity search terms derived from requirements]

### Layout Expectations
- **Page size:** [letter/legal/A4/custom]
- **Orientation:** [portrait/landscape]
- **Key sections:** [header, detail grid, footer, etc.]
- **Special elements:** [barcodes, logos, signatures, images]

### Business Rules
- [Calculated fields with formulas]
- [Conditional visibility rules]
- [Date null-guard requirements]
- [Filtering/exclusion rules]

### Parameters
- [Input parameters with types]

### Reference Materials
- [List of attachments, screenshots, documents consulted]
```

## Source Routing

### DevOps work item

When the user provides a work item ID or URL:

1. **Invoke the `devops-requirements` skill** — it handles fetching, relations, attachments, and extraction
2. **Enhance the output** with semantic field mapping (see below)
3. Save the brief to the artifact directory

### Mockup or screenshot

When the user provides an image (mockup, screenshot, PDF):

1. **Read every visible element** — labels, column headers, data values, section boundaries, logos, barcodes
2. **Map labels to data fields** — each visible label implies a field. "SHIPPER" is not just text, it's a data source (who is the shipper entity?)
3. **Identify sections** — header, address blocks, detail grid, footer, signatures
4. **Ask clarifying questions** about ambiguous elements before finalizing the brief

### Natural language description

When the user describes what they want in conversation:

1. **Extract nouns as candidate entities** — "customer shipping address" → Account, ShippingAddress
2. **Extract qualifiers as candidate fields** — "the warehouse phone number" → Warehouse.Contact.Phone
3. **Ask structured questions** to fill gaps:
   - What data does this show? (entities + fields)
   - Who uses this? (determines layout: print vs screen, page size)
   - What filters/parameters drive it? (input params)
   - Are there calculations or business rules? (expressions)
   - Is there a similar existing report? (reference)
4. **Present the draft brief** for confirmation before proceeding

### Existing report (.rdl or .rdlx-json)

When the user provides an existing report file:

1. **For .rdlx-json**: Use `dxs report inspect` to extract structure, DataSets, field names, and expressions
2. **For .rdl (SSRS)**: Scan for `<CommandText>` elements containing SQL — the SELECT columns and FROM/JOIN tables map to OData entities and fields
3. **Map extracted fields** to semantic roles based on element names and positions in the layout

### Document or spec

When the user provides a document (Word, PDF, Excel):

1. **Extract field lists** — look for tables, SQL queries, column definitions
2. **Extract layout sketches** — any visual representation of the output
3. **Extract business rules** — formulas, conditions, filtering logic

## Semantic Field Mapping

This is the critical step that prevents downstream errors. After extracting raw fields from any source, assign each field a **semantic role** — what it means in the domain context.

**How to assign roles:**

1. **From SQL field names**: Read prefixes as domain clues
   - `owner*` → goods principal / shipper (in BOL context)
   - `account*` → customer / bill-to party
   - `shipTo*` → delivery destination / consignee
   - `warehouse*` → facility / 3PL location
   - `carrier*` → transport provider
   - `material*` / `lot*` → inventory item details
   - `order*` → order-level data (reference numbers, dates, notes)

2. **From mockup labels**: Map visual labels to data entities
   - "SHIPPER/CONSIGNOR" → Owner entity (NOT Account)
   - "CONSIGNED TO" → Account / Ship-To entity
   - "CARRIER" → Carrier entity
   - "FREIGHT BILL NUMBER" → may be BOL, or may be a reference number — ask

3. **From natural language**: Map described concepts to entities
   - "the customer's address" → Account.Address or ShipToContact.Address
   - "who shipped it" → Owner (the goods principal, not the carrier)

4. **When ambiguous**: Flag the ambiguity and ask the user. Do NOT guess — a wrong semantic assignment cascades into wrong datasource fields and wrong report layout.

## Anti-Patterns

- **Flat field list without roles** — listing fields without semantic mapping causes downstream skills to guess which field goes where. Always assign roles.
- **Skipping fields that seem "obvious"** — `packUOM`, `tareWeight`, `vlDescription` may not be in the report title or main columns, but they're required. List ALL fields from the source.
- **Assuming SQL = OData** — SQL views pre-flatten joined data. The same data in OData may require multiple `$expand` levels or linked datasources. Note complex join paths in the brief.
- **Generic legal text** — if the source includes specific legal language (e.g., carrier liability clauses), capture it verbatim. Don't substitute generic boilerplate.
- **Ignoring images/signatures** — if the source shows a logo, signature, or image field, note it. These require special handling (embedded images, database-sourced images, or flow datasources).
