# Traps

Places where the real compiled CSS contradicts intuition — or contradicts Datex's own written
documentation. Every one of these was verified against `main.css` by reading computed styles in
a browser, not inferred from the docs.

## A theme class on a nested element only half-works

This is the subtlest trap in the system.

`main.css` declares the derived tokens on **`body`**, as indirections:

```css
body {
  --control-solid-foreground: var(--main-color);   /* primary button, active toggle, checked checkbox */
  --control-hover-overlay:    var(--main-color);
  --theme-color-background:   var(--main-color);
  --app-shell-background:     var(--main-color);
}
```

A custom property's `var()` is substituted **at the element where the property is declared**, not
where it is used. So `--control-solid-foreground` is resolved once, on `body`, and inherited as a
finished colour.

Put `.datex-teal-theme` on a `<div>` and you re-point `--main-color` for that subtree — headings
and links recolour — but **every primary button, active toggle and checked checkbox keeps the old
accent**, because their fill reads the already-resolved `--control-solid-foreground`.

Dark mode escapes this only because `.dark-theme` re-declares the indirections
(`--control-solid-foreground: var(--dark-color)`), which re-resolves them at that element.

**Fix:** apply the theme class to `body`, or re-declare the indirections on whatever element you
put it on:

```css
.my-themed-root {
  --control-solid-foreground: var(--main-color);
  --control-hover-overlay: var(--main-color);
  --theme-color-background: var(--main-color);
  --app-shell-background: var(--main-color);
  --app-shell-background-hover: var(--wht-ovrly-color-solid);
}
```

## `.datex-app` is required for the Material controls

Checkbox, slide toggle, and chips get their Datex geometry from selectors scoped under
`.datex-app` (16px checkbox, 40×20 toggle track, 14px handle). Outside that ancestor the
checkbox background expands to fill its parent. `.datex-platform` is the equivalent scope in the
Manager app — don't use it in new work.

## `.datex-app` paints nothing

It is transparent. The app's `body` supplies `background` and `color`. A dark-themed region that
sets `.dark-theme` but never paints the surface renders white text on a white background.

## `$theme-default` is not the brand

It resolves to the retired pre-2025 **blue** `#0070a0`, and is still the applied default for apps
that have not opted in. The purple brand is `$theme-default-2025` / `.datex-2025-theme` and must
be selected explicitly. The bare `:root` fallback in `main.css` *is* purple, which makes this easy
to misread.

## Dark mode re-points the accent

The 2025 purple lightens from `#5B08B2` to `#b066ff` so it stays legible on `#262829`. And
`--control-solid-foreground` — the fill for primary buttons, active toggles, and checked
checkboxes — resolves to `--main-color` in light but **`--dark-color`** in dark.

Hard-coding `#5B08B2` therefore does not just look wrong in dark mode; it breaks the token the
entire filled-control system pivots on.

## `.blade-title` does not exist

No such selector appears anywhere in the SCSS, even though Datex's own static-HTML starter
template uses it. The blade header exposes only `.blade-header`, `.blade-tools`, and
`.close-btn-container`.

## Several elements are `display: contents`

They contribute **no box**. Giving them width, height, or padding does nothing, and omitting
their children collapses the layout.

Always: `.blade-wrapper`, `.crumb`, `.message-container`, `.toolContainer`, `.card-header`,
`.card-footer`.
Contextually: `.mat-mdc-dialog-surface` and `.blade-content` inside a flyout; `.shell-content` on
mobile.

This is the single most common cause of a "collapsed" Datex layout.

## The shell title is an ID, not a class

It is `#title`. A `.title` class picks up nothing.

## `.creation` on a button is not green text

The bare rule `.creation { color: var(--color-new) }` applies to non-button elements. On a button,
the more specific `button.datex-button.creation` selector — which the compiled CSS groups together
with the toolbar selectors — wins, producing **neutral label text with a green icon**.

`.creation` becomes a solid green filled button **only** inside `.modal-toolbar.commands` (or a
new-row command cell).

`.destructive` inverts the other way: solid red normally, **text-only red inside a toolbar**.

## The active tab class goes on the inner `<h2>`

The rule is the descendant selector `.tab-container .tab .active`. Writing
`<div class="tab active">` matches nothing. Write:

```html
<div class="tab"><h2 class="active">Lines</h2></div>
```

Angular Material's own `.mat-tab-label-active` *is* a compound on the tab element itself — which
is exactly why this is easy to invert.

## Fluent icons only render on an `<i>` element

The three icon fonts bind through three different selectors, and only one is element-typed:

| Family | Selector | Element |
| --- | --- | --- |
| Fluent | `i[class^="icon-ic"]:before, i[class*=" icon-ic"]:before` | **`<i>` only** |
| Datex | `[class^="icon-datex-"], [class*=" icon-datex-"]` | any |
| Fabric | `.ms-Icon` | any |

`<span class="icon icon-ic_fluent_add_20_regular">` silently renders tofu. The `*=` matcher also
requires a *preceding space*, so the Fluent class must come first in the attribute or follow
another class.

## `.datex-button-dropdown` carries no button styling

It appears exactly once in the compiled CSS, and only app-scoped:

```css
.toolbar-designer-container .datex-button-dropdown { padding: 0; margin-right: 0.5rem; }
```

That is spacing inside Studio's toolbar designer — not a button style. Outside that container the
class does nothing. The real split button is `.datex-button.splitbutton` with a
`.splitbutton-drop-icon` child.

## The date box wrapper is `.datex-datecontainer`

Not `.datex-datebox`. That class exists, so using it renders unstyled rather than erroring.

## Toolbars are not all 40px

The blade header is 40px (4px padding × 2 + a 32px button). The dataview toolbar is **38px**
(3px padding). Don't normalize them.

## Status progress bars only render on grid cells

The 2px bar is an `::after` scoped to `.grid-table-cell-data`. Applying `.status-c` to a `<span>`
colors and bolds the text; no bar appears. `.status-created` and `.status-canceled` never draw a
bar at all.

The bar's width is `calc(X% - 24px)`, so in a narrow column a `status-a` (20%) bar can compute to
zero. Correct CSS, but never rely on the bar alone in a dense grid.

## Two grids exist

The modern one is AG Grid (`ag-theme-quartz`); the legacy one is `.grid-table-*`. Targeting
`.grid-table-*` against AG Grid matches nothing.

## The default field style is "filled"

There is no `.filled` class. A field with neither `.outlined-fields` nor `.underlined-fields` on
its `.formdata` ancestor renders filled: `background: var(--background-2)`, transparent border.

## Validation uses an outline, not a border

`.invalid` on a field cell gives descendant controls
`outline: 2px solid var(--color-important); outline-offset: -2px`. Under `.underlined-fields` it
becomes a `box-shadow` instead. And `.invalid-message` injects its own Fluent icon via `::before` —
do not add an icon element.

## The modal surface pads 20px, not 24px

`.datex-modal .mat-mdc-dialog-surface` is `padding: 1.25rem` (20px), `border-radius: 8px`. The
24px figure belongs to the dialog *container*, a different element.

## `main.css` contains no `@font-face`

Those rules live in the sibling `icons/*.css` files and reference `fonts/*.woff` *relatively*. The
design system's own `dist/icons/` output **omits `fonts/`** because its `copyfiles` glob is
non-recursive — copy icons from `src/styles/assets/icons/` or every glyph renders blank.

## Two accent themes are light-only

`deepskyblue` and `cornelius` have no dark-mode definitions and fall back to the generic dark
accent `#249acd`.

## Many controls require Angular Material

`.datex-checkbox`, `.datex-toggle`, `.datex-chip`, `.datex-chip-selector`,
`.datex-checkbox-group`, the select dropdown panel, and the date picker popup are styled through
Angular Material's internal `mat-*` / `mdc-*` DOM. A plain `<input type="checkbox">` receives none
of it. Button hover and disabled states also assume Material button DOM — a bare `<button>` has
the right shape and fill but no hover wash.
