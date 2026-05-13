---
name: commit-message-generator
description: |
  Use when generating a commit message for a Datex Studio feature branch. Reads the
  branch's pending changes, config diffs, and dependencies, then drafts a well-formed
  title + body. Trigger for: "generate a commit message for branch X", "write a commit
  message", "draft a commit for this branch", "what should the commit say",
  "suggest a commit message". For reviewing the branch's code quality, use
  `branch-code-reviewer` instead.
---

# Commit Message Generator

Review a Datex Studio feature branch's pending changes and produce a quality
commit message suitable for recording against the branch. This skill reads the
branch server-side via `dxs` — it does not run `git commit`; Datex Studio has
its own commit flow and the message produced here is intended to be pasted into
the branch's commit UI (or into whatever downstream delivery the user chose).

## References

- [../shared/branch-setup.md](../shared/branch-setup.md) — Branch selection (the Branch ID Policy applies: always ask, never assume)

## Prerequisites

- Branch ID for a feature branch on a Datex Studio repo
- Target environment (defaults to `prod`; pass `--target qa` or `--target dev` only
  if the user explicitly says so)

## Workflow

```
[Phase 1: Setup]
Get branch ID from user (branch-setup.md rules)
Confirm target environment (default: prod)
        |
[Phase 2: Gather]
dxs source branch show <id>        → metadata (name, author, status, app)
dxs -b <id> source changes         → inventory of added/updated/deleted configs
dxs -b <id> source changes --with-diffs → actual diffs for analysis
dxs -b <id> source deps            → dependency surface (optional, when diffs are ambiguous)
        |
[Phase 3: Analyze]
Read each diff. Identify the dominant theme (feature / bug fix / refactor / chore).
Flag anything that looks like a significant issue (bug, security concern, dead code) —
do NOT list the issues in the commit message; note that a review is recommended instead.
        |
[Phase 4: Draft Message]
Build the title + body per the "Output Format" section.
        |
[Phase 5: (optional) Persist to knowledge base]
If CreateKnowledgeNode is available in this session, save the message as an Article
under CommitMessages/<Org>/<App>/<BranchId>_<yyyyMMdd>_<hhmm>.md. Otherwise print
the intended path and skip.
        |
Return the message to the user.
```

## Phase Details

### Phase 1: Setup

1. Get the branch ID from the user. Follow the Branch ID Policy in
   [branch-setup.md](../shared/branch-setup.md) — ask, never assume, even if a
   branch ID appeared earlier in the session.
2. Determine the target environment. Default to `prod` unless the user said
   otherwise. `dxs` accepts `--target prod|qa|dev`; if unspecified, `prod` is used.

### Phase 2: Gather

Run all four commands in parallel where possible — they are read-only and
independent:

```bash
dxs source branch show <BRANCH_ID>
dxs -b <BRANCH_ID> source changes
dxs -b <BRANCH_ID> source changes --with-diffs
dxs -b <BRANCH_ID> source deps
```

Purposes:

- **`branch show`** — branch name, author, status, application/repo. You need
  the `organization` name and `application definition` name if Phase 5 runs
  (they form the KB folder hierarchy).
- **`source changes`** — the inventory: which configs were added, updated, or
  deleted.
- **`source changes --with-diffs`** — the actual code/configuration contents to
  analyze.
- **`source deps`** — external dependencies (component packages this branch
  references). Useful when the diffs mention types or flows from outside the
  branch itself, or when dependency updates account for the bulk of the change.

### Phase 3: Analyze

Read the diffs. The goal is to understand the **intent** of the branch well
enough to describe it in one sentence, and to spot anything a reviewer should
know about.

For each changed config, evaluate briefly:

- Does the change match a coherent theme (feature X, fix Y, refactor Z)?
- Are there logic errors, unhandled edge cases, missing error handling?
- Security red flags: unsanitized input in expressions, injection vectors in
  dynamic filters, sensitive data in params?
- Design smells: dead code, duplicated logic across configs, obviously-broken
  patterns?

If you spot **significant issues**, do NOT enumerate them in the commit message.
Instead, set the warning flag in the title and add a single line to the body
recommending a code review (see Output Format). The `branch-code-reviewer`
skill is the tool for enumerating issues — this skill's job is to describe
what changed.

### Phase 4: Draft Message

Produce a three-section message. The downstream parser splits the output on
blank lines:

1. **Title** — the first line. Conventional commits style, ~72 chars.
   Prefix with ⚠ when Phase 3 surfaced something that warrants review.
2. **Description** — the second paragraph (everything up to the next blank
   line). Short, human-readable summary. This is the only part the developer
   sees and edits in the Datex Studio commit dialog, so keep it focused.
3. **Release Notes** — everything from the third paragraph onward. The
   detailed body. Never shown to the developer; consumed only by downstream
   release-note tooling.

See "Output Format" below for the exact shape. Wrap each section at a
reasonable line width.

### Phase 5 (optional): Persist to Knowledge Base

Check whether the `CreateKnowledgeNode` tool is available in this session. If
it is, save the drafted message as a Knowledge Product of type **Article**:

- **Path:** `CommitMessages/<Organization>/<ApplicationDefinitionName>/<BranchId>_<yyyyMMdd>_<hhmm>.md`
  - Example: `CommitMessages/Colorado Cold Connect/Footprint Cloud/67388_20260127_1419.md`
  - Create the folder hierarchy if it does not exist.
- **Tag:** key `branch`, value = the branch ID.
- **Schema:** check the schema for the `article` artifact type before calling
  `CreateKnowledgeNode` — field names may differ across knowledge-base versions.

The organization name and application definition name come from the `dxs source
branch show` response in Phase 2. Convert the current local time to
`yyyyMMdd_hhmm` (24-hour) for the filename.

If `CreateKnowledgeNode` is **not** available (most CLI-only sessions), skip
this step. Print what the path would have been so the user has the option of
saving manually.

## Output Format

```
<Title — single line. Conventional commits style. Prefix with ⚠ when Phase 3
surfaced something that warrants review.>

<Description — one paragraph, ~1-3 sentences, summarizing the change in
human terms. This is what the developer sees and edits in the commit dialog,
so keep it focused on the "what" and "why" at a high level. If the title is
⚠-prefixed, end this paragraph with:
"⚠ Recommend running a code review before merging — <one-line reason>.">

<Release Notes — the detailed body, never shown to the developer. Typically
two paragraphs:
(1) what was added/changed/deleted at the config level — counts and notable
    config names;
(2) how it works at a high level — one or two sentences explaining the
    mechanism, not individual line changes.>
```

The three sections are **separated by blank lines**: the parser uses those
blank lines as boundaries, so do not omit them and do not introduce extra
blank lines inside a section.

**Example (clean branch):**

```
feat(mobile): add Mobile Configurator hub for per-warehouse settings

Adds a new Mobile Configurator hub with sub-tabs for warehouses, owners,
order classes, and equipment types, so Settings exposes per-warehouse
configuration to mobile users.

Adds 29 new configs: one hub (mobile_configurator_hub), four sub-tabs
(Warehouses, Owners, Order Classes, Equipment Types), and the grids/editors/
flows that back them. Existing Settings navigation is updated to expose the
hub.

The hub reads/writes warehouse-scoped settings via a new storage collection
and a pair of crud flows; per-owner and per-equipment-type overrides are
layered on top in the respective sub-tabs.
```

**Example (flagged branch):**

```
⚠ fix(udf): correct TypeId remap in custom_field_editor

Fixes a UDF type-remap bug where Text fields rendered as Selection lists,
with a small refactor that inlines a datasource and refreshes three hubs
after the editor closes.
⚠ Recommend running a code review before merging — the save flow has
duplicated error handling that can show two dialogs on failure.

Updates custom_field_editor to remap TypeId 5→1 so "Text" UDFs no longer
render as "Selection list". Inlines ds_get_custom_field_options into
custom_field_options_grid (deletes the standalone datasource) and adjusts
three hubs to await the editor dialog and refresh on close.
```

## Tips

- **Title voice** — imperative mood, per conventional commits style
  (`feat(scope): add X`, `fix(scope): correct Y`, `refactor(scope): simplify Z`).
  Scope is optional; use it when a single area clearly dominates.
- **Don't restate diffs line by line** — the diff is already the source of
  truth. The message's job is to give a human the gist in 30 seconds.
- **Dependency-only commits** — if `source changes` is empty but `source deps`
  shows updates, describe it as "Pull in dependency updates: <list>". These
  are sync commits, not features.
- **Author attribution** — the branch's author is in the `branch show` output;
  you do not add an author line in the message (Datex Studio records the
  author on the branch itself).
- **Never run `git commit`** — this skill only produces text. Datex Studio
  commits happen in the platform UI, not via `git`.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Assuming a branch ID from earlier in the session | Follow the Branch ID Policy — ask explicitly |
| Running `git commit` or editing repo state | This skill is read-only; it produces text only |
| Enumerating review findings in the commit body | List only the theme; delegate detail to `branch-code-reviewer` and just flag with ⚠ |
| Calling `CreateKnowledgeNode` without checking availability | Gate Phase 5 on tool availability; skip cleanly if missing |
| Using `--target dev`/`qa` by default | Default is `prod`; only override when the user explicitly says which environment |
