# Interaction patterns

## Window hierarchy — blade ▸ flyout ▸ modal

The most consequential layout decision. Pick the **lightest** window that fits the task.

| Need | Window |
| --- | --- |
| Primary persistent workspace; multi-tab entity; complex creation; navigation | **Blade** |
| A quick task *in the context of* a blade; create-on-the-fly; edit detail; short single-screen task | **Flyout** |
| Force a decision or confirmation; short transactional action; wizard | **Modal** |

Rules that fall out of the hierarchy:

- A flyout opens **over** a blade, preserving its context. At most one sub-flyout.
- **Never stack a modal on a modal.** If you need to, the first should have been a blade.
- **No "create new" inside a modal** — use a flyout or a blade.
- Editors and hubs are *screens* that live in a blade (or, simplified, a flyout) — never a modal.
- Toolbar actions belong on the blade or dataview; modals and flyouts use their bottom control
  buttons instead.

Button order is identical in flyout and modal toolbars: **primary → tertiary → secondary →
destructive** (destructive always last), ≤4 buttons. A flyout's bottom action also closes it.

---

## Create a new item

Choose by complexity. Adding a row to an existing grid or list is a *different* pattern.

**Simple item → flyout** (a new material, a warehouse location, a shipment on an order):

1. Click **New [item]** — a hub toolbar button or a dropdown action.
2. A **flyout** opens with the creation form. It must offer **Create** and **Cancel**.
3. The user fills the required fields and clicks **Create**.
4. The flyout closes, the item exists, and anything referencing it refreshes. If it was launched
   from a dropdown, select the new item automatically.

**Complex item → blade** (a new order, a billing contract, an auto-emailing rule):

1. Click **New [item]**, typically from a hub toolbar.
2. A new **blade** opens with the creation form (**Cancel/Discard**; optionally **Create**).
3. The user fills the required fields.
4. The item is created — automatically, or via **Create**.
5. The creation-form blade is **replaced by an editor blade** for the new item, with the same
   field layout, so it reads as fields and tabs being *added* rather than the screen being
   swapped. The user keeps working.

---

## Confirm an action

**Use when** the cost of a mistake is high, the consequences are serious or possibly unintended,
or you genuinely need the user to interact before continuing.
**Don't use** for routine actions, so often that users stop reading, or as a crutch for ambiguous
design — instead, design the action to assume the most likely result.

Anatomy — a centered modal on an `rgba(0,1,0,0.4)` backdrop, four areas:

- **Summary** — a clear question or statement, larger than the explanation. One complete
  sentence. **Name the objects involved.** Positive phrasing. The phrasing must match the
  command: use "disable" to confirm a Disable.
- **Explanation** (optional) — the outcome and consequences; list affected entities; never
  restate the summary.
- **Buttons** — **restate the action** on the confirm button, not Yes/No. Default action in the
  theme color on the **left**, secondary on the right. ≤2 actions. Add friction for risky
  actions ("Uninstall anyway").
- **Icon** — carries the risk. Routine → no icon. Risky or security-related → warning icon.
  **Never put the word "warning" or "caution" in the text** — that is the icon's job.

Default response: routine → proceed; risky → don't proceed; security → don't proceed.
Avoid dialogs that launch dialogs. For bulk operations, offer "apply to the entire operation".

Common summary phrasings: "Are you sure you want to [action]?" (the direct result of a request) ·
"Do you want to [action]?" (a side effect) · "Would you like to [result]?" (a clarification) ·
"[Action]?" (neutral).

---

## Error surfaces

Three surfaces, escalating:

- **Control validation** — on blur: a 2px `--color-important` outline on the control, an error
  icon inside it, a small red message beneath. Persists until corrected.
- **Local error** — a wide red box at the top of the screen with a large error icon, a plain
  explanation, and links. The user can keep working. Dismiss with ✕. New errors stack on top.
- **Global error** — a centered modal with a `--color-important` accent, a large error icon, a
  title, a plain message, links, and collapsible technical details. Buttons to report, open a
  ticket, or dismiss. Blocks interaction until a button is clicked.

Choosing: **blocking, critical, or irreversible → modal. Non-blocking or informational →
toast** (bottom-right).
