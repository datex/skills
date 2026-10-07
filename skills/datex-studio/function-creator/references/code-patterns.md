# Function Code Patterns

Common patterns for writing Datex Studio function code. All code runs inside the function's execution scope with access to `$flow`, `$utils`, and the services from `dxs function context`.

> **See also** — [../../datex-studio-shared/flow-code-patterns.md](../../datex-studio-shared/flow-code-patterns.md) for cross-skill patterns that apply equally to functions, flow datasources, and hub click flows: `$utils.isDefined()` semantics, date defaulting, `$shell.Reports.open{ref}()` from click flows, and OData pagination (the 5,000-record cap).

## Setting Output

Functions set their return values via `$flow.outParams.*`. Do NOT use `return`.

```typescript
// CORRECT: assign to outParams
$flow.outParams.result = computedValue;
$flow.outParams.success = true;

// WRONG: return is not used for output
return { result: computedValue, success: true };
```
// UI tier: save / open files (fileName defaults to "Untitled" — always pass it for a Blob built in code)
await $utils.blob.saveFile(blob, { fileName: 'export.xlsx' });
const file = await $utils.blob.openFile();
`$utils.excel` is SheetJS (`IExcelService`). Full surface from the designer typings: `readBlob(blob)`, `writeBlob(wb)`, `read(data, { type })`, `write(wb, { type: 'array' | 'buffer' | 'base64' | 'binary' | 'string' })`, `aoa_to_sheet`, `sheet_add_aoa`, `json_to_sheet`, `sheet_add_json`, `sheet_to_json`, `book_new`, `sheet_new`, `book_append_sheet`, `book_modify_sheets`, `book_set_sheet_visibility`, `format_cell`, `cell_set_number_format`, `cell_set_hyperlink`, `cell_set_internal_link`, `cell_add_comment`.

// Array-of-arrays → workbook → bytes (the typed options omit `compression`; SheetJS honours it where built in)
const ws2 = $utils.excel.aoa_to_sheet([headers, ...rows]);
const wb2 = $utils.excel.book_new();
$utils.excel.book_append_sheet(wb2, ws2, 'Sheet1');
const bytes = $utils.excel.write(wb2, { type: 'array', compression: true } as any) as ArrayBuffer;
Full surface: `openFile`, `saveFile(blob, { fileName })`, `toBase64`, `fromBase64`, `isBlob`, `isFile`, `humanSize`, `isBrowserSupportedImgFormat`, `isValidDataUrl`. `openFile`/`saveFile` are UI-tier only (they drive the browser's file picker/download); the rest work at both tiers.

**The function-tier `Blob` is not the browser's `Blob`.** `blob.slice()` and `blob.arrayBuffer()` throw `Not supported` at the function tier, even though `size`, `type`, and `new Blob([Uint8Array, …], { type })` work there. To reach a stored blob's bytes at function tier, go through `$utils.blob.toBase64(blob)` and decode (try `Buffer.from(b64, 'base64')` first, then `atob`, then a manual decoder if neither is available) — cut ranges from the decoded byte array and re-wrap them in a fresh `Blob` rather than calling `.slice()`/`.arrayBuffer()` directly. **A flow's `outParams` may carry exactly one `blob`-typed param and nothing else** — the platform rejects more with *"Only one item with type blob is allowed exclusively"* — so return any accompanying metadata (filename, size, content type) from a sibling outParam or a separate call, not alongside the blob itself.
**No streaming API, and every method materializes the whole workbook in memory.** `aoa_to_sheet` allocates one object per cell, and `write` builds the complete sheet XML as a string before zipping — a large sheet (tens of thousands of rows by dozens of columns) can peak near a gigabyte of worker memory. Above a few thousand rows, write the OOXML package yourself instead of going through SheetJS: inline strings, typed numbers/booleans/dates, a hand-built ZIP, DEFLATE via `CompressionStream('deflate-raw')` when the runtime has it (feature-detect with `eval('typeof CompressionStream')`, then fall back to Node's `zlib`, then to uncompressed STORE), feeding rows page by page rather than building the full sheet in one pass. The function tier's runtime is Node-based: `Buffer.from(b64, 'base64')` is available and is the fastest base64 decoder, and `zlib`/`CompressionStream` DEFLATE support means a hand-streamed workbook can still come out compressed. Verify a hand-built workbook's output against both a reference Excel-reading library and SheetJS's own reader before trusting it.

## Calling Other Functions

```typescript
// From app code referencing own functions (no module prefix):
const result = await $flows.other_flow({ param1: value1 });

// From module code referencing same or other module's functions:
const result = await $flows.ModuleName.other_flow({ param1: value1 });
```

## Calling Datasources

```typescript
// From app code referencing own datasources (no module prefix):
const resp = await $datasources.ds_name.get({ paramId: value });
const data = resp.result;

// From module code referencing same or other module's datasources:
const resp = await $datasources.ModuleName.ds_name.get({ paramId: value });
const data = resp.result;

// Collection datasources return arrays:
const listResp = await $datasources.ds_orders.getList({ statusId: 1 });
const orders = listResp.result; // array
```

**Rule of thumb:** The `dxs function context` output defines the exact interface. Check `IFlowsService` and `IDatasourceService` in the `appContext` — if services are nested under a module namespace, use the module prefix. If they're at the root level, no prefix needed.

### Paginated calls (5,000-record OData cap)

OData endpoints cap responses at 5,000 records. A function that aggregates `Tasks`, `ArchivedShippingLicensePlateContents`, `Shipments`, or any high-volume entity over a date range must call its source datasource in a paged loop — the standalone datasource must declare a `skip` inParam:

```typescript
const PAGE_SIZE = 5000;
const results = [];
let skip = 0;
while (true) {
    const resp = await $datasources.Reports.ds_recv_tasks.getList({ warehouseId, fromDate, toDate, skip });
    const page = resp.result ?? [];
    results.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
}
```

See [../../datex-studio-shared/flow-code-patterns.md#odata-pagination--the-5000-record-cap](../../datex-studio-shared/flow-code-patterns.md#odata-pagination--the-5000-record-cap) for the full pattern, including the datasource query shape and the `--detect-params` wiring that makes `skip` an actual parameter. The truncation is silent — no error fires when a function blindly trusts a single non-paginated call.

## Utilities ($utils)

```typescript
// Date operations
const now = $utils.date.now();
const tomorrow = $utils.date.add(1, 'day');
const formatted = $utils.date.format(dateStr, 'YYYY-MM-DD');
const startOfMonth = $utils.date.startOf('month');

// Misc
const guid = $utils.createGuid();
const isDef = $utils.isDefined(value);       // ← always use this for null/undefined checks
const allDef = $utils.isAllDefined(a, b, c); // ← multi-arg variant

// OData formatting
const formattedId = $utils.odata.formatNumber(42);
const formattedStr = $utils.odata.formatString('hello');
```

## HTTP Calls ($utils.http)

```typescript
// GET
const data = await $utils.http.get('https://api.example.com/data');
const typed = await $utils.http.get<MyType>('https://api.example.com/data');

// POST
const result = await $utils.http.post('https://api.example.com/submit', body);

// With headers
const authed = await $utils.http.get('https://api.example.com/data', {
  headers: { 'Authorization': 'Bearer token' }
});
```

## Backend Services ($services)

```typescript
// Email
await $services.email.send({
  to: 'user@example.com',
  subject: 'Processing Complete',
  text: 'Your order has been processed.',
  html: '<p>Your order has been processed.</p>'
});

// Logging
$services.logging.info('Processing started', { orderId: 123 });
$services.logging.error('Processing failed', error, { orderId: 123 });

// Jobs — submit a progress-enabled function as a background job
const jobId = await $services.jobs.heavy_task_flow.submit({ items: largeArray });

// Scheduling — create a recurring schedule for a progress-enabled function
await $services.jobs.daily_sync_flow.schedule.create('daily-sync', {
  cronExpression: '0 6 * * *',
  concurrency: ScheduleConcurrency.cancel,
  inParams: { mode: 'full' }
});
```

## Footprint API Actions ($apis)

```typescript
// Direct API action
const response = await $apis.fpapiconn.GetApiInfo();

// Grouped API actions
const result = await $apis.fpapiconn.Orders.CreateSalesOrder({
  ProjectId: 1,
  SalesOrderClassId: 1,
  LookupCode: 'SO-001'
});

// Async API action
const token = await $apis.fpapiconn.Orders.ProcessSalesOrderAsync({
  OrderId: result.SalesOrderId,
  ProcessingStrategyWorkflowCode: 'default'
});
```

## Progress-Enabled Functions

When `--enable-progress` is used, the function's scope includes `abortController` and `reportProgress`:

```typescript
const items = $flow.inParams.items;
for (let i = 0; i < items.length; i++) {
  // Check for cancellation
  if (abortController.signal.aborted) {
    $flow.outParams.cancelled = true;
    $flow.outParams.processedCount = i;
    return;
  }

  // Report progress
  reportProgress(0, items.length, i);

  // Process item...
  await processItem(items[i]);
}

$flow.outParams.processedCount = items.length;
$flow.outParams.cancelled = false;
```

## XML Processing

```typescript
// Parse XML
const parsed = $utils.parseXml<MyType>(xmlString);

// Build XML
const xml = $utils.buildXml(jsonObj);

// XSLT transform (backend only)
const transformed = await $services.xml.transform(xmlData, xsltData);
```

## Excel Operations ($utils.excel)

```typescript
// Create workbook from data
const ws = $utils.excel.json_to_sheet(data);
const wb: IExcelWorkBook = { SheetNames: ['Sheet1'], Sheets: { Sheet1: ws } };

// Read worksheet to JSON
const rows = $utils.excel.sheet_to_json(worksheet);
// Round-trip a Blob (works for CSV too) — the cheapest structural check of a generated file
const back = $utils.excel.sheet_to_json((await $utils.excel.readBlob(blob)).Sheets['Sheet1'], { header: 1 } as any);
```

## File Operations ($utils.blob)

```typescript
// Check types
const isBlob = $utils.blob.isBlob(value);

// Convert
const base64 = await $utils.blob.toBase64(blob);
const blob = await $utils.blob.fromBase64(base64DataUrl);

// Human-readable size
const size = $utils.blob.humanSize(bytes); // e.g., "1.5 MB"
```

## Auth Service ($auth)

```typescript
// Search users
const { result: users } = await $auth.getUsers('john', 10);

// Get users by ID
const users = await $auth.getUsersByIds(['user-id-1', 'user-id-2']);
```

## Execution Context ($context)

```typescript
// Organization info
const orgName = $context.org.name;
const tenantId = $context.org.tenantId;

// App info
const appName = $context.app.name;
const appType = $context.app.type; // 'web', 'api', 'portal', etc.

// Environment
const envName = $context.env.name;
const siteUrl = $context.env.app.site;
```
