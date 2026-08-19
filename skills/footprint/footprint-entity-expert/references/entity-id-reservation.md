# Entity Id Reservation — `$api.ReserveEntityIdBatch`

How to pre-reserve a block of entity Ids before bulk creates, and the one semantic that trips everyone: **the returned value is the top of the range, not the bottom.**

## Contract

`$api.ReserveEntityIdBatch({ Entity, BatchSize })` returns `{ NewIdCeiling: number }`.

- `NewIdCeiling` is the **highest** Id in the reserved range — not "the next available Id after reservation."
- For `BatchSize = N`, the reserved Ids are `[NewIdCeiling - N + 1, NewIdCeiling]` inclusive.
- The underlying call is **atomic**: two parallel callers get non-overlapping ranges.

Used for pre-reserving entity Ids before bulk create calls (e.g. minting a batch of `ShippingContainer` rows and wiring child records to the not-yet-created parents by Id).

## Common idiom

```typescript
const ceiling = (await $api.ReserveEntityIdBatch({
    Entity: 'ShippingContainer',
    BatchSize: containers.length
})).NewIdCeiling;
for (let i = 0; i < containers.length; i++) {
    const newId = ceiling - containers[i].plan_idx;  // assumes plan_idx is [0..BatchSize-1]
    // ...
}
```

## The `ceiling - idx` safety rule

The formula `ceiling - idx` cleanly maps a 0-indexed sequence `[0, BatchSize-1]` onto the reserved range `[ceiling - BatchSize + 1, ceiling]` — **but only when the source counter is 0-indexed and dense**. If the counter has gaps, starts at 1, or carries over from a previous batch, some computed Ids fall **outside** the reserved range and can collide with Ids reserved by other callers. When tracing Id-collision bugs, check that the formula's input counter is actually 0-indexed and dense.

Note that flow-code module scope resets per invocation (module-level `let`/`const` do not persist across calls), so a counter is naturally fresh each call — the density requirement only has to hold *within* one invocation's batch.
