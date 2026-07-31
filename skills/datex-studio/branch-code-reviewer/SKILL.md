---
name: branch-code-reviewer
description: |
  Use when reviewing the code/configuration changes on a Datex Studio feature
  branch. Traces dependencies, reads unified diffs across all changed configs,
  and produces a structured review with bugs / quality / security / performance
  / simplification / alignment findings plus a verdict. Trigger for: "review
  branch X", "code review this branch", "review the changes on <branch>",
  "audit branch before merge", "quality check this branch". For drafting a
  commit message on the same branch, use `commit-message-generator`.
depends:
  - datex-studio-shared
---

# Branch Code Reviewer

AI-assisted code review of Datex Studio branches using the `dxs` CLI. Reads
the branch's changes, traces dependencies of affected configs, reads unified
diffs, and produces a structured review summary with explicit severity tags
and a verdict.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch selection when the branch ID was not provided

## Dependencies

- **`impact-analysis`** skill — invoked in Step 4 (Dimension F) whenever a
  changed config is a `delete`. It runs `dxs source explore reverse-trace` and
  categorizes callers, which is the authoritative way to decide whether a
  delete is safe. Do not emulate this manually with forward-traces —
  forward-trace cannot answer "is anything still referencing the deleted
  name?" (see the limitation note in Step 2).

## Prerequisites

- Branch ID for a Datex Studio feature branch.

## Workflow

```
[Step 1: Gather Context]
Parallel:
  dxs source changes --branch <ID>
  dxs source workitems --branch <ID> --description --comments
        |
[Step 2: Trace Dependencies of Changed Configs]
For each significantly-changed or deleted config:
  dxs source explore trace <config_name> --branch <ID>
        |
[Step 3: Review Diffs]
dxs source changes --branch <ID> --with-diffs
        |
[Step 4: Analyze Each Change]
For each changed config, evaluate against six dimensions:
  A. Bugs
  B. Code Quality
  C. Security
  D. Performance
  E. Simplification Opportunities
  F. Alignment & Risk
        |
[Step 5: Deeper Dive (as needed)]
If diffs are ambiguous:
  dxs source explore config <config_name> --branch <ID>
        |
[Step 6: Produce Review Summary]
Branch Overview → Changes Table → Detailed Findings (severity-tagged) →
Questions for Developer → Verdict
```

## Step Details

### Step 1: Gather Context

Run these two commands in parallel — they are independent:

```bash
dxs source changes --branch <ID>
dxs source workitems --branch <ID> --description --comments
```

The first gives a quick inventory of changed configs. The second gives the
intent (bug / feature), the assignee, sprint context, and (via `--comments`)
any in-thread discussion that might influence how a reviewer should read the
change.

### Step 2: Trace Dependencies of Changed Configs

```bash
dxs source explore trace <config_name> --branch <ID>
```

Trace shows a config's **forward dependencies** — what it references
(datasources, flows, grids, dialogs, backend flows) and which library each
one comes from.

**When to trace:**

- **Deleted configs** — trace them to see what they depended on. Then
  cross-reference with traces of other configs to check whether anything
  still references the deleted config by name.
- **Configs with significant changes** — trace to understand the structure
  (what flows does this editor call? what datasources does this grid use?)
  *before* reading the diff. Reading a diff with the dependency surface in
  mind is far more productive.
- **Cross-library references** — trace reveals when a config depends on
  shared platform flows (e.g., `crud_create_flow` from Utilities) or dialogs
  from other modules. These are the seams where breakage is most likely.

While tracing changed configs, watch for references to configs that this
same branch *deletes*. A changed config whose trace still lists a
just-deleted datasource or flow is a sign of incomplete cleanup — flag it,
even though delete-safety itself is handled by `impact-analysis` in Step 4.

**Limitation:** trace shows forward deps only, never reverse. To check whether
a deleted config is safe to remove, trace the configs that might reference it
and look for the deleted name in their dependency lists.

### Step 3: Review Diffs

```bash
dxs source changes --branch <ID> --with-diffs
```

Full unified diffs for every changed configuration. This is the primary input
for Step 4.

### Step 4: Analyze Each Change

For each changed config, evaluate against all six dimensions. Not every
dimension applies to every config — skip dimensions where there is nothing
to say, but consider each one before skipping.

#### A. Bugs

- Logic errors, off-by-one, inverted conditions
- Unhandled edge cases (null entities, empty collections)
- Error handling gaps (missing catch blocks, unchecked flow results)
- Dead code or unreachable paths introduced

#### B. Code Quality

- Is the intent of the change clear from reading the code?
- Does it match patterns used in surrounding code?
- Unnecessary duplication
- Meaningful variable names
- Proper use of platform APIs (Datex Studio helpers, `$utils`, `$flows`)

#### C. Security

- Unsanitized user input in expressions or templates
- Injection risks in dynamic filter expressions
- Sensitive data exposure in params, logging, or returned payloads
- Missing authorization checks on newly-exposed operations

#### D. Performance

- Unnecessary API calls or redundant data fetches
- N+1 query patterns in datasources
- Oversized payloads where a projection (`$select`/`$expand` with `$select`)
  would do
- Inefficient loops or repeated DOM operations

#### E. Simplification Opportunities

- Overly complex expressions that could be clearer
- Redundant null checks or optional chaining
- Duplicate logic across configs that could be shared
- Unused parameters or dead config properties

#### F. Alignment & Risk

- **Work item alignment** — does the change actually address the stated
  bug/feature?
- **Fix altitude** — is this a root-cause fix, or a workaround at the wrong
  layer? A UI-level remap (e.g. rewriting a bad `TypeId` in a binding) may
  mask a data-layer bug that will resurface everywhere else the entity is
  read. If you can't tell which was intended, raise it in Questions for
  Developer rather than guessing a severity.
- **Scope creep** — are there unrelated changes bundled in?
- **Regression risk** — could this break existing behavior?
- **Deleted-config safety** — is the deleted config truly unused elsewhere?
  For any config whose `modification` is `delete` in the changes inventory,
  invoke the **`impact-analysis`** skill with that reference name and the
  branch ID. It runs reverse-trace and returns the list of remaining callers.
  Fold the result into the review:
  - **No callers** → `[OK]` Safe to delete.
  - **Callers exist and are updated in this same branch** → `[INFO]` with the
    updated caller list for reference.
  - **Callers exist and are NOT updated in this branch** → `[ISSUE]` — the
    delete will break those callers at runtime.

  Do not try to emulate this with forward-traces. Forward-trace cannot answer
  "what still references this deleted name?" (see Step 2's limitation note).

### Step 5: Deeper Dive (as needed)

Evaluate whether the diffs gave you enough context to make clear
determinations. If not, read larger contiguous chunks of the affected configs
so you can understand the surrounding logic:

```bash
dxs source explore config <config_name> --branch <ID>
```

This is especially important when a one-liner change *looks* like a fix but
may introduce side effects that are only visible in the surrounding code. A
diff without context can hide the fact that the "fix" breaks something else.

### Step 6: Produce Review Summary

Use the exact structure in Output Format below. The severity tags are the
primary signal for what a reviewer should act on.

## Output Format

```markdown
# Review — Branch <ID>

## Branch Overview
- **Branch:** <ID> (<status>)
- **Work Item:** <type> <NNNNNN> — <title>
- **Assigned to:** <Author>
- **Sprint:** <sprint name>

## Changes Table

| Config | Type | Action | Summary |
|---|---|---|---|
| `<name>` | <type> | <add/update/delete> | <one-line summary> |
| …      | …    | …                 | …                     |

## Detailed Findings

### Bugs
**`[ISSUE]` <headline>** (`<config>`)
<explanation, with inline code where helpful>

**`[WARNING]` <headline>** (`<config>`)
<explanation>

### Code Quality
…

### Security Concerns
…

### Performance
…

### Simplification Opportunities
…

### Work Item Alignment
…

### Scope
…

## Questions for Developer
1. <question>
2. <question>

## Verdict
**<Approve | Request Changes | Needs Discussion>** — <one-line rationale>.
```

### Severity Tags

| Tag | Meaning |
|---|---|
| `[ISSUE]` | Must fix before merge |
| `[WARNING]` | Should fix; potential problem |
| `[INFO]` | Observation, no action required |
| `[OK]` | Reviewed, no concerns |

`[OK]` is worth including for dimensions that matter (security, alignment) so
the reader knows the reviewer actually checked — an unmentioned dimension
reads as "skipped", which is a different message.

## Example (abbreviated)

```markdown
## Detailed Findings

### Bugs

**`[ISSUE]` Duplicate error check in save flow (`custom_field_editor`)**
The new create path checks `result.reason` twice:

    if (result.reason) { /* show error */ } else { /* save option */ }
    if (result.reason) { /* show error AGAIN */ } else { ... }

If `result.reason` is truthy, the error dialog shows twice. Looks like a
refactor artifact — the option-saving logic was inserted in the middle,
duplicating the error branch.

**`[WARNING]` `save_result` is unused (`custom_field_editor`)**
`const save_result = await $flows.Utilities.crud_create_flow({...});` — the
result is captured but never checked. If the create fails silently, the UDF
is created but its initial option value is lost with no error shown.

### Security Concerns
**`[OK]`** No new injection vectors. The datasource filter uses a template
literal with `$datasource.inParams.custom_field_id`, which is a typed number
param — low risk.

## Questions for Developer
1. The TypeId 5→1 remap is applied at the binding level — is this a display
   fix, or does the API return the wrong TypeId and the data layer needs the
   fix instead?
2. `save_result` from creating the initial option value is never checked —
   is silent failure acceptable here?

## Verdict
**Request Changes** — the duplicate error handling will show two dialogs on
failure. The unchecked `save_result` is a secondary concern worth addressing.
```

## Tips

1. **Trace before you diff.** Knowing what a config references changes how
   you read its diff. Five minutes in `explore trace` saves an hour of
   misreading a diff out of context.
2. **Severity discipline.** `[ISSUE]` means "must fix" — reserve it for real
   blockers. Overusing it trains reviewers to ignore the tag.
3. **Don't restate the diff.** The diff is already available. Your job is to
   name the *problem* (or the *reason it's fine*), not to paraphrase the
   code.
4. **Alignment is the highest-value dimension.** "The change does what the
   work item asked for" is the single most important question; it's easy to
   pass all the other dimensions and still ship the wrong thing.
5. **Deleted configs deserve a trace sweep.** A single missed reference can
   cause a runtime error in production. When in doubt, trace the top-N
   configs that might reference the deleted name.
6. **Whitespace-only diffs are noise.** Call them out as `[INFO]`; don't let
   them dilute the findings section.
7. **When you can't tell intentional from accidental, ask.** Some findings
   hinge on intent you can't see in the diff — is the unchecked flow result
   acceptable? Is the UI-level remap deliberate or a stopgap? Those belong in
   **Questions for Developer**, not in the findings with a guessed severity.
   A wrong `[ISSUE]` costs credibility; a sharp question gets an answer.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Reading diffs without first tracing the affected configs | Step 2 first — context before content |
| Marking everything `[ISSUE]` | Reserve `[ISSUE]` for real blockers; use `[WARNING]` / `[INFO]` for the rest |
| Skipping the Work Item Alignment check | Alignment is the most important dimension — do not skip it |
| Deleting a config without checking reverse references | Invoke `impact-analysis` on the deleted reference name; don't emulate with forward-trace |
| Relying on the diff alone when the change is subtle | Step 5: pull the full config with `dxs source explore config` to see surrounding logic |
| Enumerating whitespace/formatting noise as findings | Mark once as `[INFO]` (or suppress) — don't pad the report |
| Assigning a severity to something that hinges on unknowable intent | Move it to Questions for Developer instead of guessing |
