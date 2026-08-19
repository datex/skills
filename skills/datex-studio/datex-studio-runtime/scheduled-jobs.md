# `$services.jobs` — Background Jobs & Schedules

The function-tier runtime global for running flows in the background: one-shot **submissions** and recurring **schedules** (cron). This is the platform's only recurring-execution mechanism — there is no separate "scheduler" component type; a schedule is runtime state attached to a target flow, created and managed from flow code.

The patterns below are distilled from shipped scheduling features (inventory snapshotting, outbound-automation engine ticks, async auto-picking dispatch).

## Access Path

```
$services.jobs.<Package>.<flow_referenceName>.<api>
```

The path names the **target flow** (the flow the job will execute), not the calling flow. Function-tier only — actions and UI components cannot reach `$services.jobs`; bridge through a function.

## API Surface

Grown as encountered — verify in designer context before relying on an unlisted member.

| Call | Purpose |
|---|---|
| `.submit(inParams, { impersonate })` | One-shot background run of the target flow. First arg is the target flow's inParams object; `impersonate: true` runs the job as the submitting user (preserves RBAC in the inner flow). Returns before the job completes; there is **no completion callback** — the target flow must surface its own outcome (e.g. an alert flow, or state a poller can observe). Verified in a shipped async auto-picking dispatcher. |
| `.schedule.create(name, { cronExpression, concurrency, inParams })` | Register a recurring schedule. `name` is the schedule's identity for all later calls. |
| `.schedule.update(name, { cronExpression, concurrency, inParams })` | Replace cron/concurrency/inParams on an existing schedule. |
| `.schedule.list({ scheduleName: [name, ...] })` | Look up schedules by name. Returns `{ tasks: [...] }`; each task carries at least `cronExpression` and `isActive`. |
| `.schedule.activate(name)` / `.schedule.deactivate(name)` | Toggle without deleting. A schedule can exist inactive — the canonical "installed but off" state. |
| `.schedule.delete(name)` | Remove a schedule outright. Throws when the name does not exist, so wrap in try/catch when sweeping names that may never have been registered. Use for orphan cleanup — a registration that shrinks from N schedules to fewer must delete the surplus, or the leftover keeps firing on a cadence the user has replaced. Prefer `deactivate` when the schedule should survive in an off state. Verified in `SalesOrders.manage_outbound_automation_rule_flow` (legacy per-rule cleanup) and `SalesOrders.set_outbound_automation_schedule_flow` (slot sweep). |

`concurrency` takes the ambient enum `ScheduleConcurrency` (no import needed in flow code); `ScheduleConcurrency.cancel` cancels the **new** firing when the previous run is still going — the running job continues untouched (operator-confirmed 2026-08-11, correcting an earlier reading that had it superseding the old run). Still the right default for engine-tick patterns: overlap is prevented without ever aborting in-flight work, so long runs are never torn mid-execution by their own schedule.

## Naming Convention

Schedule names are `<feature>:<purpose>` kebab-case, e.g. `inventory-snapshot:main-schedule`, `inventory-snapshot:purge-schedule`, `outbound-automation:engine-tick`. The name is the only join key between your feature and the schedule — keep the literal byte-identical across every flow that touches it (drift = orphaned schedules).

## Canonical Lifecycle Pattern (engine toggle)

The proven shape splits responsibility across two flows:

**`initialize_<feature>_flow`** — idempotent, called from the feature hub's `onInit`:
1. Seed the feature's configuration row/options if absent.
2. `schedule.list` by name; if missing, `schedule.create` with the configured cron, then `schedule.deactivate` so the engine stays off until explicitly enabled. (Always-on schedules, like retention purges, `activate` here instead.)

**`set_<feature>_schedule_flow(is_active, app_name?)`** — the enable/disable toggle:
1. `schedule.list` by name → `create` if missing, `update` if the cron drifted from configuration.
2. `activate`/`deactivate` to match `is_active`.
3. **Only after the schedule ops succeed**, record toggle intent on the feature's config storage (e.g. `engine_enabled`, `enabled_by_app`). If a schedule op throws, control never reaches the write — a failed create/activate never records a false "enabled".

**Schedule state is authoritative** for "is the engine running"; the stored flags are metadata (toggle intent + owning app for cross-app locks). Read runtime state via `schedule.list(...).tasks[0].isActive`, not from storage.

## One-Shot Submission Pattern (sync/async dispatcher)

For work that is usually fast but occasionally huge, wrap the core flow in a dispatcher that picks the tier:

```typescript
if (task_count > THRESHOLD && environment !== 'preview') {
    await $services.jobs.SalesOrders.auto_pick_sales_order_flow.submit({
        inParams: { ...args, is_async: true },
        impersonate: true
    });
    $flow.outParams.is_async = true;
} else {
    const result = await $flows.SalesOrders.auto_pick_sales_order_flow({ ...args });
    $flow.outParams.result = result;
}
```

The `is_async` inParam convention lets the target flow know to push its outcome through a notification path instead of returning it.

## Pre-Flight Checklist

1. **Target flow exists before any flow references its jobs path.** `$services.jobs.<Pkg>.<flow>` fails validation if `<flow>` doesn't exist yet — when scaffolding a new engine, land at least a stub of the target flow on the branch together with the schedule-lifecycle flows.
1a. **Target flow has `enableProgressAndCancelation: true`.** A flow appears under `$services.jobs.<Pkg>` (as an `IJobWorker`) **only** when this top-level flag is set — with it false, validation fails with *"Property '<flow>' does not exist on type '{}'"* even though the flow exists on the branch. Set the flag on the target flow and upsert it **before** validating the flow that schedules it (the jobs registry rebuilds from pushed state). The flag also gives the target `$flow.abortController` for cooperative cancellation of background runs (note: `ScheduleConcurrency.cancel` does **not** abort the running job — it drops the new overlapping firing). Verified live on PrintManager (2026-08-11): `consume_print_queue_flow` was invisible to the jobs typing until flagged; the shipped scheduled PrintNode flows all carry the flag.
2. **Schedule name literal is identical** in every flow that lists/creates/toggles it.
3. **`ScheduleConcurrency.cancel`** for engine ticks (no overlapping runs); choose deliberately if a different policy is intended.
4. **Record enabled-state only after schedule ops succeed** (the order-of-operations contract above).
5. **No completion callback on `.submit`** — design the observable outcome (alert, storage row, status the next tick can observe) before going async.
6. **Idempotent initialization** — `list`-then-`create`, never blind `create`; safe to call on every hub open.
7. **Cron is config-driven** where the user can change frequency: store `cron_expression` in the feature's configuration storage and `schedule.update` on change rather than hardcoding.
