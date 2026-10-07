# Datetime Stamping Semantics

**When to consult:** any date/time filter, window, or comparison against Footprint data — OData
`$filter` clauses, dynamic-filter conditions, in-memory criteria evaluation, report date ranges, or
anything that converts between a user's timezone and stored values.

## The schema lies about less than the data does

Every datetime property in the Footprint OData schema is `Edm.DateTimeOffset` (there are no
offset-less `Edm.Date` / `Edm.TimeOfDay` properties), and every stored value is **serialized with
a `Z` (UTC) stamp**. The stamp is uniform; the *meaning* of the value is not.
A `Z`-stamped value may actually be:

| Value class | What the digits mean | Instant correct? |
|---|---|---|
| True UTC | A real UTC instant | Yes |
| Server wall clock stamped `Z` | The server's local clock reading, mislabeled as UTC | Off by the server's offset |
| Submitted explicit time | Whatever the integration/client sent, stamped `Z` verbatim | Depends on the submitter |

There is a platform effort underway to normalize all stored datetimes to true UTC. Until it lands,
correctness of any instant-based comparison is **per-column**, and nothing in `metadata.xml`
distinguishes the classes. `*SysDateTime` columns (system-stamped at write time) are the most
likely to track the server clock; integration-fed dates are the most likely to be verbatim
submissions.

## Consequences for date filtering

- **OData comparisons are instant comparisons.** `ge 2026-07-14T04:00:00Z` compares points on the
  timeline. For true-UTC columns this is exact. For wall-clock-stamped-`Z` columns the stored
  "instant" is shifted by the pretended offset, and so is every comparison against it.
- **UTC-midnight day windows match mislabeled columns by construction.** Values that are wall clock
  for calendar day D stamped `Z` all fall in `[D 00:00Z, D+1 00:00Z)` — so a window anchored at UTC
  midnight selects exactly the stamped calendar day, regardless of which zone the wall clock came
  from. This is why legacy date filters "worked" against mislabeled data: the match was accidental
  but reliable.
- **Zone-shifted windows break that accidental match.** A window for "today in America/New_York"
  (`[04:00Z, …)`) applied to a wall-clock-stamped column misses the first 4 wall-clock hours of the
  day and includes 4 hours of the next. Choosing a non-UTC zone is only correct against true-UTC
  columns.

## Practical guidance

1. **Default date filters to UTC** until the normalization lands. A filter-building UI should seed
   new date conditions with `UTC` for exactly this reason, and switch to the user's browser zone
   only once stored values are known to be true UTC.
2. **Picking a real zone is safe only when the column is known true UTC.** Zone-aware anchors and
   whole-day windows can be computed correctly on the timeline — the limiting factor is the data,
   not the math.
3. **No migration is needed when a column is normalized.** Saved filter conditions store the
   *intended* IANA zone plus absolute-instant values; the moment the underlying column becomes true
   UTC, existing zone-stamped filters against it become correct automatically.
4. **When a zone-aware filter "looks shifted by a few hours"**, suspect the column's value class
   before the filter math — compare a known row's stored value against when it actually happened.
