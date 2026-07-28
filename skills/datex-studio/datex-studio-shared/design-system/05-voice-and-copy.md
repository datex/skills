# Voice, tone, and copy

Datex follows the Microsoft Writing Style Guide. Be **warm and relaxed**, **ready to lend a
hand**, **crisp and clear**. Lead with what is important. Emphasize action. Keep it short.

- **Natural** — write the way you speak; avoid jargon.
- **Simple and direct** — short words and sentences, active voice.
- **Consistent** — the same word for the same concept, everywhere.
- **Engaging** — address the user as **"you"**. Use imperatives for tasks. Never "I" for the app;
  "we" only for the app's own perspective.
- **Helpful and empathetic** — emphasize what users *can* do. Never blame the user.

## Style conventions

- **Sentence case everywhere** — including headings, buttons, labels, and titles.
- **Periods** end full sentences (tooltips, error messages, dialogs). **No period** on buttons,
  labels, checkboxes, or radio buttons.
- **Contractions** — use the natural ones; never force an awkward one to save space.
- **Abbreviations** — define on first use; avoid when localizing.
- **Buttons** are an action verb, a couple of short words at most.

## Button-label vocabulary — use these verbatim

**Create family**

| Label | Meaning |
| --- | --- |
| **New** | Opens a creation **form** in a flyout or blade. "New material", "New customer". |
| **Add** | Creates a child **in a dataview without opening a view** — a grid row, a list card. "Add line". |
| **Create** | Confirms/submits a new item in a flyout or modal, usually closing it. Becomes **Save** once the entity exists. |
| **Save** | Updates with changed fields; closes a flyout. |

**Destructive / dismiss family**

| Label | Meaning |
| --- | --- |
| **Cancel** | (a) Cancels an *entity* — destructive, include the noun: "Cancel order". (b) Aborts a process or form — secondary: "Save / Cancel". (c) Confirms a cancel in a modal — destructive and explicit: "Cancel order / Don't cancel order". **Never use "Cancel" to abort a cancellation.** |
| **Close** | Closes a flyout or modal, when it is the only button. Secondary. |
| **Delete** | Deletes the current or selected item. Destructive; confirm. No need to say "selected". |
| **Archive** | Soft delete. Destructive; confirm. |

Don't repeat the affected entity on a blade or toolbar button when it is obvious — on an order
editor, "Process order" should just be "Process". Include the noun only when a *different* entity
is affected ("Add inventory" in a list of license plates). Group variants under a sub-menu
("Move ▸ Move license plate / Move inventory").

## Titles

- **Blade** — `[entity] [identifier]`: "Purchase order 156654", "LP 123".
- **Flyout** — what the user is doing, plus context: "New material for Medical Supplies LTD. -
  Default Project".
- **Confirmation** — the situation as a question with single-entity context: "Move license plate
  RG-16854?" The description carries the consequences and affected entities.

## Formats

| Thing | Format | Example |
| --- | --- | --- |
| Date | `[Month] [day], [year]` | July 7, 2023 |
| Material | `[code] - [description]` | 38411154 - RASP Cables Kcl |
| Address | `[First] [Last], [Line 1], [Line 2], [City], [State] [Zip], [Country]` | omit empty fields *and their commas* |
| Measurements | `[L]x[W]x[H] [dist UOM]; [gross wt] [wt UOM]`, 1 decimal | 12x12x8 inches; 2 pounds |
| Entity codes | "Order code", "Account code" | (not "Lookup code") |
| Revert | "Revert status" | |
| Packaging | say "Packaging", not "UOM" | |

## Error messages

Structure: **what happened → why (if helpful) → how to fix → what next.**

Plain language. Actionable. Specific — name values, fields, and locations, never "syntax error".
Only surface errors the user can act on. Human and professional; don't over-apologize.

Prefer **passive voice** where active voice would read as the user's fault, and avoid "you/your"
when assigning blame.

| Don't write | Write |
| --- | --- |
| error, failure | **problem** |
| failed to | **unable to** |
| illegal, invalid, bad | **incorrect**, **not valid** |
| abort, kill, terminate | **stop** |
| catastrophic, fatal | **serious** |
| OK (to dismiss) | **Close** |

No error sounds. Don't rely on color alone. Keep the error type prominent and any error code
secondary. Modals only for critical, blocking errors; inline or banner for everything else.
