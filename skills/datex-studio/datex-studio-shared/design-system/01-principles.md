# Design principles

Datex software follows **Microsoft Fluent 2** and the Microsoft Writing Style Guide. Four
principles, **ranked** — when two pull against each other, the higher-ranked one wins.

1. **Consistency.** Visual (shapes, colors, typography, icons follow Fluent 2) and behavioral
   (layout and interactions are predictable; users subconsciously know what to expect).
   Mirror existing screens. Do not invent.
2. **Simplicity and predictability.** Visual simplicity, no clutter, foolproof and
   easy-to-remember flows, **progressive disclosure** — hide complexity until it is needed.
3. **Clear intentions and outcomes.** Users always know where they are in the system and what
   an action will do.
4. **Feedback.** Users always know whether something worked, and can understand any error.

## The rule that governs everything else

**Mirror, don't invent.** The system is consistency-first. Before creating something new, find
the closest existing component or pattern and copy it. A screen that looks unfamiliar is a bug,
even when it is prettier.

## What this means when you build

- Reach for an existing component before composing a new one.
- Pick the **lightest** window that fits the task: blade ▸ flyout ▸ modal.
- One **primary** button visible on screen at a time.
- Style exactly one column in a grid — usually status — so visual weight stays meaningful.
- Never rely on color alone; 8% of men are color-blind. Pair color with text or an icon.
- Full keyboard operability. Logical reading order. Meaningful alt text.
- Avoid flashing content, and keep important information visible rather than remembered.
