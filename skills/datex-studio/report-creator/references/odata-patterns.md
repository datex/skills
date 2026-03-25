# OData Filter Patterns

Reference for server-side filtering in OData queries. Push filtering to the server whenever possible — it reduces payload size and eliminates complex report expressions.

## Lambda Operators

Filter based on collection contents. These replace SQL subqueries (`IN`, `NOT IN`, `EXISTS`).

```
# Entities where NO child matches condition (empty-after-filter check)
not Items/any(i: i/Archived eq false)

# Entities where ANY child matches
Orders/any(o: o/Status eq 'Completed')

# Entities where ALL children match
Lines/all(l: l/Verified eq true)
```

**Use cases:**
- "Locations with no active license plates" → `not LicensePlates/any(lp: lp/Archived eq false)`
- "Orders with at least one completed line" → `Lines/any(l: l/StatusId eq 4)`
- "Shipments where all lines are verified" → `Lines/all(l: l/Verified eq true)`

## String Functions

Replace SQL `LIKE` patterns:

```
startswith(Name,'04')           # Name LIKE '04%'
endswith(Name,'-10')            # Name LIKE '%-10'
contains(Name,'RUSH')           # Name LIKE '%RUSH%'
```

## Negated Combinations

Complex exclusion rules using `not`, `and`, `or`:

```
# Exclude locations ending in '-10' in zones 04, 05, 06
not (endswith(Name,'-10') and (startswith(Name,'04') or startswith(Name,'05') or startswith(Name,'06')))
```

## Nested `$filter` in `$expand`

Filter child collections within an expand — replaces SQL correlated subqueries:

```
$expand=Lines($select=Id,LineNumber;$filter=StatusId eq 2)
```

This returns only lines matching the filter, rather than all lines for the parent entity.

## Common SQL → OData Mappings

| SQL pattern | OData equivalent |
|-------------|-----------------|
| `WHERE field = value` | `$filter=field eq value` |
| `WHERE field IN (1,2,3)` | `$filter=field eq 1 or field eq 2 or field eq 3` |
| `WHERE field LIKE 'prefix%'` | `$filter=startswith(field,'prefix')` |
| `WHERE field LIKE '%suffix'` | `$filter=endswith(field,'suffix')` |
| `WHERE field LIKE '%term%'` | `$filter=contains(field,'term')` |
| `WHERE NOT EXISTS (subquery)` | `$filter=not Collection/any(c: c/condition)` |
| `WHERE field IS NULL` | `$filter=field eq null` |
| `WHERE field IS NOT NULL` | `$filter=field ne null` |
| `WHERE date >= '2026-01-01'` | `$filter=date ge 2026-01-01T00:00:00Z` |

## Testing Filters

Always test filters incrementally with `$top=1` — add one filter clause at a time and verify the API accepts it before combining. Some OData implementations have partial support for certain operators.

```bash
# Step 1: Test base filter
dxs odata execute -c <id> -q 'Entity?$top=1&$filter=StatusId eq 2'

# Step 2: Add string filter
dxs odata execute -c <id> -q 'Entity?$top=1&$filter=StatusId eq 2 and startswith(Name,'\''04'\'')'

# Step 3: Add lambda filter
dxs odata execute -c <id> -q 'Entity?$top=1&$filter=StatusId eq 2 and not Items/any(i: i/Archived eq false)'
```

If a filter returns a 400 error, the server may not support that operator — note this and handle the filtering in report expressions as a fallback.
