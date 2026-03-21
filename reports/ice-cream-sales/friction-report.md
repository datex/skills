# Friction Report: Report Creator Skill — Test Drive #3

**Date:** 2026-03-21
**Report built:** Ice Cream Sales Report (landscape letter, tablix with 9 columns, 23 sample rows, 3 fictitious stores)
**Phases tested:** Phase 3 (Layout Prototype) — skipped Phases 1-2 (Setup, Schema Discovery) since this was a fictitious dataset
**CLI version:** 0.3.1

## Summary

The core prototyping loop — `report create` → `report batch` → `studio open` → iterate — works well for building reports incrementally. The CLI handled element creation, repositioning, and styling smoothly. Friction emerged around batch ops nesting, cell-by-cell styling, expression escaping, and renderer limitations with advanced tablix features.

## Friction Items

### 1. `"parent"` key silently ignored in batch ops

**Severity:** Medium
**Where:** Phase 3, Step 3 — building layout with `dxs report batch`

The skill documents that batch ops support `"parent": "BoxName"` to nest elements inside rectangle containers. In practice, the CLI warns `unrecognized keys ignored: parent` and places elements at absolute page coordinates instead of relative to the rectangle.

**Impact:** Elements appear in the correct position (since we used absolute coords), but they aren't actually children of the rectangle. Moving the rectangle won't move its "children." The container grouping benefit is lost.

**Recommendation:** Either implement `"parent"` support in batch ops, or update the skill to document that nesting requires `dxs report add ... --parent` (individual commands, not batch).

---

### 2. `set-cell` has no batch mode — one cell at a time

**Severity:** Low-Medium
**Where:** Phase 3 iteration — aligning columns

Changing text alignment on 5 columns (10 cells — header + detail each) required 10 sequential `dxs report table set-cell` calls. There's no way to batch cell style updates.

**Impact:** Slow iteration when styling multiple cells. Each call takes ~0.5s, so 10 cells = 5 seconds of sequential CLI calls. For a table with many columns, this adds up.

**Recommendation:** Support multiple cell names in `set-cell` (e.g., `--cells SalesGrid_Hdr1,SalesGrid_Det1`) or add a `set-cells` batch command. Alternatively, allow `set-cell` to accept a row qualifier like `--row header` or `--row detail` to style all cells in a row at once.

---

### 3. `set-cell --color` double-escapes `!` in expressions

**Severity:** High
**Where:** Phase 3 iteration — conditional Trend coloring

Setting a conditional color expression via `dxs report table set-cell --color '=IIf(Fields!Trend.Value = "Up", "Green", ...)'` wrote `Fields\\!Trend.Value` into the JSON instead of `Fields!Trend.Value`. The double-escaped backslash broke expression evaluation.

**Impact:** The expression silently fails. Required manual JSON editing to fix. Users who don't inspect the JSON would see broken styling with no clear error message.

**Recommendation:** Fix the escaping logic in `set-cell` for expression values containing `!`. The `!` character is fundamental to RDLX-JSON field references (`Fields!Name.Value`) and must not be escaped.

---

### 4. PNG preview fails when SVG contains unevaluated expressions

**Severity:** Medium
**Where:** Phase 3, Step 6 — preview

`dxs report preview ... -o preview.png` fails with `invalid literal for int() with base 16: 'ii'` when the report contains an `=IIf(...)` expression in a color property. The SVG renderer doesn't evaluate the expression — it passes the raw `=IIf(...)` string as a CSS color value. SVG output works fine (browsers ignore invalid colors), but cairosvg's PNG conversion chokes on parsing it as hex.

**Impact:** Can't generate PNG previews for reports with conditional color expressions. SVG preview still works.

**Recommendation:** Either (a) evaluate expressions during preview rendering, or (b) sanitize invalid color values in the SVG before passing to cairosvg (replace unparseable colors with a fallback like black or transparent).

---

### 5. No CLI command for tablix footer/totals rows

**Severity:** Low-Medium
**Where:** Phase 3 iteration — adding totals row

There's no `dxs report table add-footer` or equivalent. Adding a footer row to a tablix required direct JSON editing of both the `TablixRows` array and the `RowHierarchy.TablixMembers` array.

**Impact:** Direct JSON editing for tablix structure is error-prone — you must keep `TablixRows` and `RowHierarchy` in sync. The footer row I added rendered above the detail rows (likely a `KeepWithGroup` issue with the renderer), and debugging required understanding the internal tablix structure.

**Recommendation:** Add `dxs report table add-footer` that handles the row + hierarchy insertion correctly.

---

### 6. Tablix footer row renders above detail rows

**Severity:** High (renderer bug)
**Where:** Phase 3 iteration — tablix with 3-row RowHierarchy

After adding a footer row to the tablix with `KeepWithGroup: "Before"` and `IsStatic: true` (the correct configuration per RDLX spec to place a static row after the detail group), the Studio renderer displayed the totals row immediately after the header — above all detail rows.

**Impact:** Tablix footer rows are unusable in the current renderer. The workaround would be standalone textbox elements positioned below the table, but those can't use aggregate expressions like `=Sum(Fields!Revenue.Value)`.

**Recommendation:** Investigate the renderer's handling of `KeepWithGroup: "Before"` on static tablix members. This is standard RDLX behavior that should place the row after the associated group.

---

### 7. Alternating row shading expression renders as black

**Severity:** High (renderer limitation)
**Where:** Phase 3 iteration — row shading

Setting `BackgroundColor` to `=IIf(RowNumber(Nothing) Mod 2 = 0, "#f0f4f8", "White")` on detail cells rendered all rows with a solid black background. The expression was not evaluated — the raw string was likely interpreted as an invalid/unknown color, defaulting to black.

**Impact:** Alternating row shading via expressions is broken. All data except the Trend column (which had colored text) was invisible — black text on black background. Had to revert all 9 cells to static `"White"` background.

**Recommendation:** This is the same root cause as items #4 and #6 — the preview renderer doesn't evaluate expressions in style properties. Document this limitation in the skill's `common-mistakes.md`, and consider adding expression evaluation for at least `BackgroundColor`, `Color`, and `FontWeight` style properties.

---

## Skill Documentation Issues

| Issue | Location | Fix |
|-------|----------|-----|
| `"parent"` documented as working in batch but doesn't | SKILL.md Phase 3 Step 3 | Note that `parent` only works with individual `dxs report add` commands |
| No mention of renderer expression limitations | common-mistakes.md | Add: "Expressions in style properties (BackgroundColor, Color) are not evaluated by the preview renderer — use static values" |
| No mention of `set-cell` escaping bug | common-mistakes.md | Add: "`set-cell --color` with `Fields!` expressions double-escapes the `!`" |

## What Worked Well

- **Core loop is smooth:** `report create` → `batch` → `studio open` gives fast, visual iteration
- **`dxs report batch` with `--ops-file`** avoids all shell escaping headaches
- **`dxs report set` and `dxs report move`** are intuitive for quick repositioning
- **`dxs report add tablix`** with `--header-cell`/`--detail-cell`/`--header-style`/`--detail-style` creates a well-formatted table in one command
- **`dxs report table set-cell`** works correctly for simple value/style updates (just needs batch mode)
- **Auto-discovery of `.data.json`** companion files by Studio is seamless
- **`dxs report dataset add`** with `--field` handles the Name/DataField mapping automatically
- **SVG preview** renders quickly and reliably (PNG is the one with issues)

## Artifacts

| File | Description |
|------|-------------|
| `ice-cream-sales.rdlx-json` | Final report definition |
| `ice-cream-sales.data.json` | Sample data (23 rows, 3 stores) |
| `ice-cream-sales-preview.svg` | Final SVG preview |
| `friction-report.md` | This report |
