---
name: post-edit-verification
description: |
  Use after editing or writing any Datex Studio component file —
  invoked by every creator skill's closer ("After your edit, invoke
  post-edit-verification"). Runs the verification stack cheapest-first:
  Edit/Write tool succeeded → JSON parses → description is non-null,
  non-empty, ≤100 chars (platform limit) → grep for obvious typos.
  Escalates to component-validator subagent for non-trivial edits.
  Replaces Mitch's PostToolUse validate-component.py hook with a
  skill-based pattern. Triggers: invoked by every component-creator's
  closer; rarely invoked directly by users.
depends:
  - datex-studio-conventions
  - component-validator
---

# Post-Edit Verification

After editing a component file, the natural instinct is to re-read the full file to confirm the edit landed. **Don't, by default.** Component JSON files are minified single-line documents, often 20–100 KB, and re-reading them after every edit consumes parent-conversation context that the actual work needs. Several lighter-weight signals do the same job — apply them in this order.

> **Hook-replacement context.** Mitch's repo carried a `PostToolUse` hook (`hooks/validate-component.py`) that auto-blocked any Edit/Write of a tracked component suffix when the `description` was null/empty/>100 chars or the JSON failed to parse. The Datex Skills repo has no `PostToolUse` mechanism — skills are not auto-invoked by tool events. This skill is the substitute: every component-creator skill ends with *"after your edit, invoke `post-edit-verification`"*, so the same two platform invariants are enforced in one place (DRY) at the skill layer instead of the harness layer.

## Platform invariants (the minimum checks)

These two rules are non-negotiable for every component file. They are the rules the former hook enforced and they remain the floor of this skill — every invocation must confirm both, regardless of how trivial the edit looked.

1. **`description` is present and within the platform limit.** The top-level `description` must be non-null, non-empty, and ≤ 100 characters. The Footprint platform stores `description` in a SQL column capped at 100 characters; imports fail with a SQL truncation error if exceeded. See [../datex-studio-conventions/defaults.md](../datex-studio-conventions/defaults.md) for the canonical "Descriptions Are Mandatory" rule and [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) for the 100-char SQL limit. If the field is missing or too long, **fix it as part of the same edit cycle** — do not ask whether to backfill, just author a ≤100-char description (the user can override the wording afterward like any authored value).

2. **The JSON parses cleanly.** After the edit, the file must still be valid JSON. Run `python -c "import json; json.load(open(r'<path>')); print('OK')"`. A mismatched brace, stray quote, or bad escape sequence will surface here. Free, no parent-context cost. Run it once after a sequence of edits to the same file, not after each one.

If either invariant fails, the edit is **not** done. Fix the violation and re-verify before claiming completion or moving on.

## Verification stack (cheapest first)

1. **The Edit tool's success message.** The tool reports "The file ... has been updated successfully." That message means `old_string` matched and was replaced verbatim. If you crafted a precise `old_string` and the tool reported success, the textual edit is in. The remaining question is whether the *result* is structurally and semantically valid — which the next layers cover.

2. **JSON-parse check.** `python -c "import json; json.load(open(r'<path>')); print('OK')"`. Confirms the edit didn't break the JSON envelope (mismatched braces, stray quotes, escape errors). Free, no parent-context cost. Run this once after a sequence of edits to the same file, not after each one. **This is platform invariant #2.**

3. **Description check.** After the JSON parses, confirm `description` is non-null, non-empty, and ≤ 100 characters:

   ```
   python -c "import json; d=json.load(open(r'<path>'))['description']; assert d and len(d) <= 100, (d, len(d) if d else 0); print('OK', len(d))"
   ```

   **This is platform invariant #1.** If the assertion trips, fix the field as part of the same edit cycle.

4. **`Grep` with `-C` context.** To confirm a *specific* edit landed where you intended, target the changed section by name, not the whole file:
   - `Grep "while \(pickTasks" -C 30` returns ~60 lines around the loop instead of the entire 30 KB file.
   - `Grep "concurrency_limit" -C 5` confirms an inParam was added without dumping the whole schema.
   - Order-of-magnitude context win without sacrificing precision.

5. **`component-validator` subagent.** For substantial structural validation after a non-trivial refactor — the kind of audit a final-gate review runs but file-by-file — invoke `component-validator`. The subagent reads the file in *its own* context; only the punch list comes back to the parent. For grids specifically, use `grid-validator` instead — it carries grid-specific gotchas (envelope shape, text-display coercion, five-location invariant) the generic dispatcher does not catch.

6. **Re-read the full file (last resort).** Reach for `Read` only when you genuinely need to see the entire structure end-to-end and don't yet know what to grep for — e.g. chasing an obscure layout issue, debugging a case where the validator's punch list was empty but something still feels wrong. Should be the *last* signal you reach for, not the first.

## When to delegate to the component-validator agent

**Delegate when:**

- You finished a non-trivial edit (loop refactor, schema change, multi-step fix) on a single component file.
- The file is > 20 KB minified (most component files).
- You want a structured punch list rather than your own free-form spot-check.
- The change touched `description`, `inParams` / `outParams`, `accessModifier`, or other contract fields the type's Pre-Flight Checklist covers.

**Don't delegate when:**

- The edit is a single-character or single-line tweak. `Grep -C` is faster.
- You're mid-edit and need to decide on the next change. The parent needs the local context.
- The change is purely formatting / whitespace (validator has no rules for those).
- You already invoked the validator after a prior edit and only made small subsequent changes.

For grid files (`*-grid.json`), prefer `grid-validator` over `component-validator` — it is mandatory for grids regardless of edit size, because the grid-specific gotchas (envelope shape, dynamic-filter mirror drift, partial lookupcode/id syncs) are not caught by the generic dispatcher.

## Risk-proportional verification

Apply verification cost in proportion to the change's risk surface. Platform invariants (#1 and #2 above) are the floor — they apply to every row. The right-hand column lists *additional* checks beyond the floor.

| Edit type | Verification (beyond the two platform invariants) |
|---|---|
| Single-character / comment fix | Trust the Edit success message — nothing more. |
| Single-block content change in a non-contract field | (Floor only.) |
| Schema or contract change (`inParams` / `outParams` / `accessModifier`) | Targeted `Grep -C` of the changed schema. |
| Multi-edit refactor across the same file | `component-validator` subagent at the *end* of the sequence, not per-edit. |
| Cross-component change (multiple files coordinated) | `component-validator` on each file at the end + `component-wiring-check` skill. |
| Grid file (`*-grid.json`) — any edit | `grid-validator` subagent (mandatory; replaces the generic validator for grids). |

Verification is insurance, not confirmation. Match the premium to the risk — but never skip the floor.

## References

- [../datex-studio-conventions/defaults.md](../datex-studio-conventions/defaults.md) — Canonical "Descriptions Are Mandatory" rule (non-null, non-empty, ≤ 100 chars).
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — Canonical file-format rules including the 100-char SQL limit on `description` and the single-line minified-JSON convention.
- [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md) — The fuller cross-cutting checklist beyond this skill's two-invariant floor. This skill enforces the floor (description + JSON parse); `component-validator` walks the full list on escalation.
- `component-validator` — generic per-type audit dispatcher; escalation target for non-trivial edits.
- `grid-validator` — grid-specific audit; mandatory for `*-grid.json` regardless of edit size.
