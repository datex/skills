# Datex Studio App — design system (vendored)

The **Datex Studio App design system** (Microsoft Fluent 2 + the Microsoft Writing Style Guide):
design principles, the theme-token contract, component class names, interaction patterns, voice &
copy, and the compiled-CSS "traps". This is the reference for making **hand-authored** UI — most
importantly a **Custom Angular Component (CAC)**, which does not get Datex styling for free — look
native: use `var(--…)` tokens (never a hex), compose the real `datex-*` class names, and mirror
existing components rather than inventing.

## Files

- [01-principles.md](./01-principles.md) — the four ranked principles; "mirror, don't invent".
- [02-tokens.md](./02-tokens.md) — theme classes, accent/surface/text/semantic variables, the fixed status progression, typography, spacing/radii/elevation, icon fonts.
- [03-components.md](./03-components.md) — real class names to compose: buttons, toolbars, windows, forms/fields, tabs, grids, cards, widgets, toasts, controls.
- [04-patterns.md](./04-patterns.md) — window hierarchy (blade ▸ flyout ▸ modal), create-item, confirm-action, error surfaces.
- [05-voice-and-copy.md](./05-voice-and-copy.md) — sentence case, button-label vocabulary, titles, formats, error-message structure.
- [06-traps.md](./06-traps.md) — where the compiled CSS contradicts intuition (theme-on-nested-element, `display:contents`, `.creation`/`.destructive` inversion, Fluent `<i>` requirement, filled-by-default fields, outline validation, two grids, Material-required controls…).

## Provenance — this is a VENDORED MIRROR, not the source of truth

Source: the **Datex Studio App Design System** published on **Claude Design** (claude.ai/design),
source-controlled in the **`claude-design`** repo at
`datex-studio-app/guidelines/guidelines/`.

Vendored here **verbatim** (byte-for-byte) so the skills repo is self-contained and doesn't assume
`claude-design` is checked out wherever a skill runs. Snapshot: `claude-design` @ **`b46d0a6`**
(2026-07-20).

### Refresh (when the design system changes)

The design system is refreshed on the Claude Design platform, then mirrored into `claude-design`
(`scripts/pull-headless.py`). To re-sync this vendored copy:

```bash
# from a claude-design checkout, after pulling its latest:
cp datex-studio-app/guidelines/guidelines/0[1-6]-*.md \
   <skills-repo>/skills/datex-studio/datex-studio-shared/design-system/
```

Then update the snapshot commit above, review `git diff`, and commit. Keep these files
**verbatim** — do not paraphrase; the traps are verified against the compiled `main.css`, so a
hand-edited copy can become subtly wrong.
