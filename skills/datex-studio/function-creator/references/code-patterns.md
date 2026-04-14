# Function Code Patterns

Common patterns for writing Wavelength function code. All code runs inside the function's execution scope with access to `$flow`, `$utils`, and the services from `dxs function context`.

## Setting Output

Functions set their return values via `$flow.outParams.*`. Do NOT use `return`.

```typescript
// CORRECT: assign to outParams
$flow.outParams.result = computedValue;
$flow.outParams.success = true;

// WRONG: return is not used for output
return { result: computedValue, success: true };
```

## Calling Other Functions

```typescript
// From app code referencing own functions (no module prefix):
const result = await $flows.fn_other_function({ param1: value1 });

// From module code referencing same or other module's functions:
const result = await $flows.ModuleName.fn_other_function({ param1: value1 });
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

## Utilities ($utils)

```typescript
// Date operations
const now = $utils.date.now();
const tomorrow = $utils.date.add(1, 'day');
const formatted = $utils.date.format(dateStr, 'YYYY-MM-DD');
const startOfMonth = $utils.date.startOf('month');

// Misc
const guid = $utils.createGuid();
const isDef = $utils.isDefined(value);
const allDef = $utils.isAllDefined(a, b, c);

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
const jobId = await $services.jobs.fn_heavy_task.submit({ items: largeArray });

// Scheduling — create a recurring schedule for a progress-enabled function
await $services.jobs.fn_daily_sync.schedule.create('daily-sync', {
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
