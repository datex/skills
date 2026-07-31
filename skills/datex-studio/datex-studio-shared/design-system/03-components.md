# Component anatomy

Datex is a **class-based** design system. There are no importable components — you compose real
markup and apply the real class names below. That markup drops straight into a Datex Angular
template.

Hierarchy: **Shell** holds **Windows** (blade ▸ flyout ▸ modal); windows hold **Screens**
(hub, editor, form, messages); screens hold **Containers** (tabs, toolbars, fieldsets, fields)
and **Dataviews** (grid, list, card, calendar); the smallest pieces are **Controls**.

---

## Buttons — `button.datex-button` + one style class

Base: height 32px, padding `0 .75rem`, radius 4px, font 14px/400.

| Class | Treatment | Use for |
| --- | --- | --- |
| `.primary` | fill `var(--control-solid-foreground)`, white text, weight 600 | the one happy-path action. **Only one on screen.** |
| `.secondary` | `outline: 1px solid var(--foreground-3)` (an outline, not a border) | the passive counterpart — Cancel, Close, No |
| `.tertiary` | transparent, `outline: 2px solid var(--main-color)`, accent text | an alternate primary-flavored branch; only alongside a primary |
| `.destructive` | fill `var(--color-important)`, white text | irreversible actions; pair with a confirmation |
| `.creation` | see below | add / create new |
| `.link` | no padding, transparent, accent text | low-weight navigation. **Prefer a link over a button for navigation.** |

Inner structure:

```html
<button class="datex-button primary">
  <div class="button-label">
    <div class="button-icon"><i class="ms-Icon ms-Icon--Add"></i></div>
    <div class="button-text">New order</div>
  </div>
</button>
```

**Semantic classes invert by container — this trips everyone up:**

- `.creation` on a bare button is **not green text**. `button.datex-button.creation` renders
  *neutral* label text with a **green icon**. It becomes a solid green filled button **only**
  inside `.modal-toolbar.commands`.
- `.destructive` is solid red standalone, but **text-only red** inside a toolbar
  (`.blade-tools`, `.dataview-tools`, `.grid-tools`, `.form-tools`).

Split button: `button.datex-button.splitbutton` with a `<div class="splitbutton-drop-icon">`
child. `.datex-button-dropdown` is **not** a button style — its only rule is app-scoped
(`.toolbar-designer-container .datex-button-dropdown`) and sets spacing only.

Layout: dialogs and panels right-align; single-page forms left-align; **primary on the left**.
Sentence case, an action verb, no period. Never default-focus a destructive button.

---

## Toolbars

| Class | Height | Notes |
| --- | --- | --- |
| `.blade-header` > `.blade-tools` | **40px** (4px padding ×2 + 32px button) | radius 4px, `var(--shadow-4)` |
| `.dataview-tools` | **38px** (3px padding) | collapses to 0 when `:empty` |
| `.modal-toolbar` | — | `justify-content: flex-end`; add `.commands` for solid status buttons |
| `.grid-tools` / `.form-tools` / `.hub-tools` | — | flex wrappers |

Inside a **flyout**, `.modal-toolbar` is overridden to `justify-content: flex-start` — buttons
sit on the **left**, the opposite of a modal.

Separator: `<div class="tool-separator"></div>`. `.toolContainer` is `display: contents`.

**Strict left→right order**, divided by separators:

1. **Main actions** — primary first, then most-common → less-common. Often a New/Add.
2. **Destructive** — Revert status → Cancel → Delete. Kept together, separated.
3. **Common** — Attachments → Discussions → History → Print → `…` overflow.
4. **UI config** — Refresh → Column options.

~7 buttons is a comfortable maximum. Increase distance between safe and destructive actions.
**Disable** a button when the action exists but is unavailable; **hide** it only when the action
does not apply at all.

---

## Windows

### Blade — `.blade-wrapper`

The main workspace, like browser tabs. Hosts hubs, editors, and creation forms.

⚠️ **`.blade-wrapper` is `display: contents`** — it contributes no box. `.blade-header` and
`.blade-content` become direct children of `.workspace`. Giving the wrapper width, height, or
padding does nothing.

⚠️ **There is no `.blade-title` class.** The header exposes only `.blade-header`,
`.blade-tools`, and `.close-btn-container`.

```html
<div class="blade-wrapper">
  <div class="blade-header">
    <div class="blade-tools">…</div>
    <div class="close-btn-container">…</div>
  </div>
  <div class="blade-content">…</div>
</div>
```

Blade title text: `[entity] [identifier]` — "Purchase order 156654".

### Flyout — `.flyout-panel` (480 / `.large` 710 / `.xlarge` 1600px)

A temporary panel over a blade that keeps the blade's context. Use for create-on-the-fly,
editing extra detail, short single-screen tasks.

Inner content: `.modal-container` > `.modal-header` (`.modal-icon`, `.modal-title`,
`.modal-close-button`) + `.modal-content` + `.modal-toolbar`.

Title: one line, sentence case, no period, usually naming the selected element. For creation:
`New [entity] for [parent]`. **Avoid paging** — if it will not fit one scroll, use a blade.
Bottom toolbar ≤4 buttons (ideally 2). A bottom action also **closes** the flyout. At most one
sub-flyout.

### Modal — `.datex-modal` + `.small` (480) / `.standard` (665) / `.large` (1260×700)

Blocks progress; dismissal requires a choice. Surface: `padding: 20px`, `border-radius: 8px`.
Backdrop `rgba(0,1,0,0.4)`.

Two uses: **confirmations** and **short actions / wizards**. **Never stack a modal on a modal.**
**No "create new" inside a modal** — use a flyout or blade. No tabs. No scrolling for fields.

**Button order in both flyouts and modals: primary → tertiary → secondary → destructive**
(destructive always last).

---

## Screens

### Form — `.datex-form`

```
.datex-form > .formdata > .fieldsetsContainer > .fieldsetsGroup > .field-container
```

`.formdata` carries the render-style class. `.fieldsetsGroup` is the actual grid
(`repeat(auto-fill, minmax(250px, 1fr))`).

Render styles (on `.formdata`):
- `.outlined-fields` — `1px solid var(--foreground-3)` border, `var(--background)` background.
- `.underlined-fields` — bottom border only.
- **neither** — the *default*, a **filled** field: `var(--background-2)`, transparent border.
  There is no `.filled` class; filled is what you get by default.

On the **field cell**: `.double` (spans 2 columns), `.full` (spans all), `.title-field` (entity
identifier, 32px accent, label hidden), `.subtitle-field` (secondary line, label hidden).

The first fieldset holds high-level identity and is **unlabeled**. Required fields go in it.
Split when a fieldset exceeds 6 fields. Collapsible fieldsets signal secondary content.
**Avoid buttons in forms** — the exception is an "Additional options" link opening a flyout.

### Fields — `.field-container` (32px, radius 4px)

```html
<div class="field-container">                <!-- + .double .full .field-container-disabled .invalid -->
  <div class="label-container">
    <label class="datex-label">Carrier</label>
    <span class="required-asterisk">*</span>
  </div>
  <input class="datex-numberbox">
  <span class="invalid-message">Select a carrier.</span>
</div>
```

- Read-only: `.readonly` on the **control**.
- Disabled: `.field-container-disabled` on the **cell**.
- Invalid: `.invalid` on the **cell** → descendant controls get
  `outline: 2px solid var(--color-important)` (an outline, not a border).
- `.invalid-message` injects its **own** Fluent warning icon via `::before`. Do not add an icon.

### Editor — `.datex-editor` · Hub — `.datex-hub`

Both use the same grid: `minmax(540px,2fr) minmax(0,3fr)` / areas `"maindata widgets" "tabs tabs"`,
32px column gap; single column on mobile.

- Editor: `.formdata` + `.widgets` + `.datex-tabcontrol`. Use when the primary job is *editing
  the main entity*.
- Hub: `.hubdata` (`.hubname`, `.hubdesc`, `.hub-filters`, `.hub-tools`) + `.widgets` +
  `.datex-tabcontrol`. A jumping-off point to act on data **en masse**. Description starts with
  a verb ("Manage…", "Receive…"). **Action buttons belong in the blade toolbar, not the hub
  panel.** ≤3 widgets (2 recommended). Hub filters apply to every tab; limit to ~2.

---

## Containers

### Tabs — `.datex-tabcontrol`

```html
<div class="datex-tabcontrol">
  <div class="tab-container">
    <div class="tab"><h2 class="active">Lines</h2></div>
    <div class="tab"><h2>Shipments</h2></div>
  </div>
</div>
```

⚠️ **`.active` goes on the inner `<h2>`**, not on the `.tab` div — the rule is the descendant
selector `.tab-container .tab .active`. Active = `--foreground`, weight 600, 2px
`--main-color` underline. Inactive = `--foreground-2`.

≤5 tabs. First tab is the most important. Tabs show tangible entities, not concepts. No forms,
editors, hubs, or reports inside a tab.

---

## Dataviews

### Grid — two implementations, do not conflate

- **Modern: AG Grid.** `<ag-grid-angular class="ag-theme-quartz">`. Style through the AG Grid
  theme. `.grid-table-*` matches **nothing** against it.
- **Legacy: `.grid-table-*`**, pure CSS `display: table`. This is what you can write by hand.

```html
<div class="dataview-grid">
  <div class="grid-container">                     <!-- + .compact | .relaxed -->
    <div class="grid-table grid-table-striped">
      <div class="grid-table-header">
        <div class="grid-table-cell-header">Order</div>
      </div>
      <div class="grid-table-row">
        <div class="grid-table-cell-data status-b"><span class="datex-text">Picking</span></div>
      </div>
    </div>
  </div>
</div>
```

Special columns: `.grid-table-cell-checkbox` (40px, sticky left), `.grid-table-row-expander`
(50px), `.grid-table-cell-command` (sticky right).

Rules: show just enough data; group related data into one column (`[code] - [description]`);
format for humans (1,000,000; "July 7, 2023"); **never show system IDs** — use codes and names;
friendly status names; ~15 rows per page; style **one** column (usually status); read-only
booleans render as a green check icon, not a live checkbox; buttons rarely in cells; row actions
(`…`) are for one-at-a-time operations and never for primary actions. Filters: date boxes,
toggles, and selectors only — ≤4, and **never a button in filters**.

### Cards — `.card.datex-card`

Grid `1fr auto`, gap 14px, padding 10px, radius 4px, `var(--shadow-4)`. `.card-header`,
`.card-content > .formdata`, and `.card-footer` are all `display: contents`. Emphasis border:
add a status class plus a side, e.g. `class="card datex-card status-a border-left"` → 6px left
border in the status color.

### Widgets — height 42px, radius 4px

```html
<div class="widget-container">
  <div class="fat-container good">
    <span class="fat-title">Lines shipped</span>
    <div class="fat-content"><span class="fat-number">18</span></div>
  </div>
</div>
```

Modifiers on `.fat-container`: `.key` (accent fill), `.good`, `.medium`, `.bad`, `.not-found`.
Glanceable, personalized, live. **≤2 per screen** (max 3). Interacting with a widget filters the
grid. The pie-chart variant requires ApexCharts.

### Toasts — `.ngx-toastr`

Passive and **non-blocking**. Variants `.toast-success` `.toast-error` `.toast-info`
`.toast-warning`, each a 0.5rem colored left border with an injected `::after` glyph. Positioned
bottom-right by the ngx-toastr library, not by `main.css`.

**Blocking / critical / irreversible → modal. Non-blocking / informational → toast.**
≤1–2 sentences, ideally under one. No punctuation. Always a close button.

---

## Controls — these require Angular Material

`.datex-checkbox`, `.datex-toggle`, `.datex-chip`, `.datex-chip-selector`,
`.datex-checkbox-group`, the select **dropdown panel**, and the date **picker popup** are all
styled through Angular Material's internal `mat-*` / `mdc-*` DOM. A plain
`<input type="checkbox">` gets **none** of the styling.

Plain HTML works for: `.datex-numberbox` (add `.numeric` for the Bahnschrift digits),
`.datex-selectcontainer` (the trigger), `.datex-datecontainer` (the trigger — **not**
`.datex-datebox`, which exists but is unstyled on its own), `.datex-label`, and every button.

Usage rules: a **check box** is a deferred binary status — label it as the field *value*, phrase
it so checked = true, never negate. A **toggle** is an immediate on/off action. A **chips
selector** defaults to *all selected* and the user deselects; over 8 options, use a dropdown.
Use a **select box** for large or unknown counts (>8); under 5 items use radios (single) or
checkboxes (multi). Check-box groups ≤7 options; radio groups ≤5, never two radios for a binary.
