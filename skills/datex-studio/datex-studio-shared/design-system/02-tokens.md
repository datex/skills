# The token contract

The Datex color system is **theme-driven**. A small set of semantic CSS variables is re-pointed
per accent theme and per light/dark mode. **Reference the variables. Never paste a hex.**

Hard-coding `#5B08B2` does not merely look wrong in dark mode — it breaks the one token the
whole filled-control system pivots on (see `--control-solid-foreground` below).

## Applying a theme

Put the theme class on a root element. Everything inside inherits.

```html
<body class="datex-2025-theme">            <!-- light, current Datex Purple brand -->
<body class="dark-theme datex-2025-theme"> <!-- dark -->
```

Seventeen accent themes exist as `.datex-{theme}-theme`: `2025` (the brand), `default`,
`purple`, `green`, `greenyellow`, `teal`, `red`, `orange`, `rose`, `yellow`, `brown`,
`greyblue`, `grey`, `phantomblue`, `platform`, `deepskyblue`, `cornelius`.

⚠️ `deepskyblue` and `cornelius` have **no dark-mode definitions** and fall back to the generic
dark accent `#249acd`. Treat them as light-only.

⚠️ **`$theme-default` is not the brand.** It resolves to the retired pre-2025 blue `#0070a0`.
The current brand is `$theme-default-2025` / `.datex-2025-theme`. Do not read "default" as
"current".

## Accent variables

| Variable | Light (2025) | Dark (2025) | Use for |
| --- | --- | --- | --- |
| `--main-color` | `#5B08B2` | `#b066ff` | accent, `h1`, links, active tab underline |
| `--dark-color` | `#410487` | `#973ff4` | hover/focus, and the dark-mode control fill |
| `--light-color` | `#d5cae0` | `#3a3c3d` | hover / selection background |
| `--ultradark-color` | — | `#5c3d9b` | deepest accent shade |
| `--control-solid-foreground` | `= --main-color` | `= --dark-color` | **filled controls** |

`--control-solid-foreground` is the fill for primary buttons, active toggles, and checked
checkboxes. It deliberately resolves to a *different* variable per mode. Always use it for a
filled control rather than `--main-color`.

## Surfaces and text

Light values are declared on `body`; dark values on `.dark-theme`.

| Variable | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `--background` | `#FFFFFF` | `#262829` | base surface |
| `--background-1` | `#F2F2F2` | `#2b2d2e` | raised surface |
| `--background-2` | `#EFEFF4` | `#303233` | sunken / bar / filled field |
| `--foreground` | `#000100` | `#FFFFFFF2` | primary text |
| `--foreground-1` | `#555555` | `#CCCCCC` | secondary text, field labels |
| `--foreground-2` | `#707070` | `#8C8C8C` | tertiary text, placeholder, inactive tab |
| `--foreground-3` | `#BBBBBB` | `#707070` | borders, dividers, disabled |

## Semantic colors

| Variable | Light | Dark |
| --- | --- | --- |
| `--color-important` (error) | `#C73C3C` | `#e15a5a` |
| `--color-important-hover` | `#CF5757` | `#e97474` |
| `--color-attention` (warning) | `#EB7425` | `#fb9754` |
| `--color-new` (creation/success) | `#0A9A1C` | `#3fbd4f` |
| `--color-new-hover` | `#1cb52f` | `#51cf61` |

Widget tints: `--color-widget-green` / `-red` / `-yellow`, each with a matching `-border`.

## Status progression — fixed, never themed

These are literal hexes, identical in dark mode, because "80% complete" must not change meaning
when someone picks a different accent.

```
.status-created  #707070  grey, not yet processed    no bar
.status-a        #D24D2A  red-orange                 bar 20%
.status-b        #EB8225  orange                     bar 40%
.status-c        #FABF14  yellow                     bar 60%
.status-d        #9EB13A  yellow-green               bar 80%
.status-complete #48A429  green  (alias: .active)    bar 100%
.status-canceled #BE1814  red                        no bar
.planned .inactive #707070 italic
.status-disabled  background #707070, text #CCCCCC   (the only one that sets a background)
```

The 2px progress bar is an `::after` scoped to `.grid-table-cell-data`. Apply `.status-c` to a
`<span>` and you get bold colored text but **no bar**. Its width is `calc(X% - 24px)`, so in a
narrow column a low-progress bar can collapse to zero.

## Typography

```
UI / body    'Segoe UI', 'Segoe UI Web (West European)', -apple-system,
             BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif
numeric      Bahnschrift, <Segoe UI stack>       class: .numeric
monospace    Consolas, 'Courier New', Courier    class: .monospace
```

Base is 16px with a 1.125 ratio, but **`body` renders at 14px**. Applied:
`h1` 32px and colored `--main-color` (it is the page title) · `h2` 24px · `h3` 18px ·
`h4`/`h5` 16px · `a` bold, `--main-color`, underline on hover. Line-height 1.5.

Utility classes: `.text-xl` (32) `.text-lg` (24) `.text-md` (18) `.text-xxl` (48)
`.numeric` `.monospace`.

## Spacing, radii, elevation

```
Spacing   2 / 4 / 8 / 12 / 20 / 32 / 40 / 48 / 52 / 84px    (no 16px step — it jumps 12 → 20)
Radius    2px small · 4px medium (fields, buttons, cards, widgets) · 8px large (modal surface)
Border    1px thin · 2px thick (validation)
Shadow    var(--shadow-4)  attached surfaces (blade header, cards, dataview toolbar)
          var(--shadow-16) floating (toasts)
          var(--shadow-64) blocking (modal surface)
Backdrop  rgba(0, 1, 0, 0.4)
```

Dark mode uses the same shadow geometry at roughly double opacity — always use the variable.

## Key dimensions

```
header 46px · menu rail 50px (open 250px) · breadcrumb 30px · status bar 3px
button 32px · field 32px (radius 4px)
blade toolbar 40px  ·  dataview toolbar 38px      ← these differ; do not normalize
grid header 40px · grid row 40px (compact 34 / relaxed 52)
modal  small 480 / standard 665 / large 1260px (large height 700px)
flyout 480 / 710 / 1600px
widget 42px (radius 4px)
```

## Icons

Three fonts, three different binding selectors:

| Family | Class pattern | Element |
| --- | --- | --- |
| Fluent | `.icon .icon-ic_fluent_{name}_20_{regular\|filled}` | **`<i>` only** |
| Fabric MDL2 | `.ms-Icon .ms-Icon--{Name}` | any |
| Datex domain | `.icon .icon-datex-{Name}` | any |

⚠️ Fluent's rule is `i[class^="icon-ic"]:before, i[class*=" icon-ic"]:before` — element-typed.
A `<span class="icon icon-ic_fluent_add_20_regular">` renders **tofu**. Use `<i>`.
