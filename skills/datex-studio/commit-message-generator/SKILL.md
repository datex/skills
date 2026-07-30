---
name: commit-message-generator
description: |
  Use when generating a commit message for a Datex Studio feature branch. Reads the
  branch's pending changes, config diffs, and dependencies, resolves the work item the
  branch traces back to, then drafts a well-formed title + body carrying that reference.
  Trigger for: "generate a commit message for branch X", "write a commit
  message", "draft a commit for this branch", "what should the commit say",
  "suggest a commit message", "does this commit reference a ticket", "traceability
  check". For reviewing the branch's code quality, use `branch-code-reviewer` instead.
depends:
  - datex-studio-shared
---

# Commit Message Generator

Review a Datex Studio feature branch's pending changes and produce a quality
commit message suitable for recording against the branch. This skill reads the
branch server-side via `dxs` — it does not run `git commit`; Datex Studio has
its own commit flow and the message produced here is intended to be pasted into
the branch's commit UI (or into whatever downstream delivery the user chose).

Every message must carry a pointer to the work item that justified the change.
That traceability check is a first-class phase, not a formatting detail — see
[references/traceability.md](references/traceability.md).

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch selection (the Branch ID Policy applies: always ask, never assume)
- [references/traceability.md](references/traceability.md) — Ticket-reference discovery, provider adapters (CRM Project Task / Case / Project Request, Azure DevOps), compliance verdicts, and the `Ref:` output slot

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
dxs source branch show <id>        → metadata (author, status, app, commit title/description)
  └─ GUARD: is this a feature branch? If isCommit/isRelease/isMainBranch, STOP and ask.
dxs -b <id> source changes         → inventory of added/updated/deleted configs
dxs -b <id> source changes --with-diffs → actual diffs for analysis
dxs -b <id> source deps            → dependency surface (optional, when diffs are ambiguous)
        |
[Phase 3: Trace]  ← traceability compliance check
Scan prompt + commitTitle/commitDescription for a ticket ref, AND ask CRM which
Project Task claims this branch (reverse edge on cr0c5_commit) — always both.
Resolve it against its provider (CRM Project Task / Case / Project Request, Azure DevOps).
Verdict: COMPLIANT | UNVERIFIED | MISSING. Keep the resolved ticket's description —
it feeds Phase 4's analysis and its divergence check. Warns, never blocks.
        |
[Phase 4: Analyze]
Read each diff, informed by the ticket's stated requirement. Identify the dominant
theme (feature / bug fix / refactor / chore).
Flag anything that looks like a significant issue (bug, security concern, dead code) —
do NOT list the issues in the commit message; note that a review is recommended instead.
        |
[Phase 5: Draft Message]
Build the title + body per the "Output Format" section, including the Ref: lines.
        |
[Phase 6: (optional) Persist to knowledge base]
If CreateKnowledgeNode is available in this session, save the message as an Article
under CommitMessages/<Org>/<App>/<BranchId>_<yyyyMMdd>_<hhmm>.md. Otherwise print
the intended path and skip.
        |
Return the message to the user.
```

## Phase Details

### Phase 1: Setup

1. Get the branch ID from the user. Follow the Branch ID Policy in
   [branch-setup.md](../datex-studio-shared/branch-setup.md) — ask, never assume, even if a
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

Four more are worth knowing — reach for them when the four above are ambiguous:

```bash
# Confirm a single config really is unchanged (cheap second opinion on a no-op)
dxs source diff --from <BASE_BRANCH_ID> --to <BRANCH_ID> --config <referenceName>

# Upstream changes in base not yet pulled into this branch (proves drift)
dxs source diff --branch <BRANCH_ID>

# Dependency deltas WITH direction — `source deps` alone has no notion of it
dxs source deps-diff --from <BASE_BRANCH_ID> --to <BRANCH_ID>

# Linked Azure DevOps work items (note: -b, not positional)
dxs -b <BRANCH_ID> source workitems --description
```

`base_branch_id` for the `--from` arguments comes from the `source changes`
response.

> `source workitems` returns an empty list and `devops_organizations: []` in
> tenants where branch-level DevOps linking isn't wired up — including every
> branch tested here, one of which an ADO work item explicitly points at. Check
> it during Phase 3, but treat an empty result as "no data", never as "no
> work item exists".

#### Guard: confirm it's actually a feature branch

Check `branch show` **before** analyzing anything. This skill drafts a message
for work that has not been committed yet; the other branch kinds have either
already been committed or are not development work at all.

| Flags | What it is | Do |
|-------|-----------|-----|
| `isFeatureBranch: true`, `isCommit: false` | Feature branch, work pending | Proceed |
| `isCommit: true` (status `WorkspaceHistory`) | A commit snapshot — already committed, with a `commitTitle` and `commitDescription` on it | **Stop and ask** |
| `isRelease` / `isCurrentRelease` / `isMainBranch` | Release or main | **Stop and ask** |

For a non-feature branch, say what the branch actually is, quote its existing
`commitTitle` and `commitDate`, and ask whether the user meant a different
branch or genuinely wants a retroactive message. Do not silently proceed — a
message drafted for an already-committed snapshot has nowhere to be pasted, and
reads as if the work were still pending.

If the user confirms they want it anyway, proceed normally and note in your
summary (not in the message) that it is retroactive.

Purposes:

- **`branch show`** — author, status, and the branch-kind flags the guard above
  reads. Also `commitTitle` / `commitDescription`, the primary hunting ground for
  the Phase 3 ticket reference. Note it returns **no** branch `name` or
  `description`; `referenceName` is the application definition name
  (e.g. `FootprintManager`), and `applicationDefinitionId` is the repo id.
- **`source changes`** — the inventory of pending configs.

  > **`changes_by_type` is always empty — ignore it.** The `created` /
  > `updated` / `deleted` buckets come back empty even on branches with three
  > substantive config updates. Read **`all_changes`**; the buckets tell you
  > nothing either way.
  >
  > **A row in `all_changes` is not proof of work.** Check `has_changes` from
  > `--with-diffs` per entry — that is the authoritative signal:
  >
  > | Signal | Meaning |
  > |--------|---------|
  > | `has_changes: true` | Real content change. This is work. |
  > | `has_changes: false` | No-op. Checkout artifact or metadata-only; the config is identical to base. |
  > | `has_changes: null` (with `modificationTypeId: "add"`) | New config, no base to diff against. Treat as work. |
  >
  > `modificationTypeId` is a weaker hint: `"unspecified"` has always meant
  > `has_changes: false` (checked out, never edited), but `"update"` appears
  > with `has_changes: false` too. Trust `has_changes`, not the type.
  >
  > **If every entry is a no-op, the branch is empty** — see "Empty branches" below.
- **`source changes --with-diffs`** — the actual code/configuration contents to
  analyze, and the `has_changes` flag per entry.

#### Guard: empty branches

A feature branch can be legitimately open, have configs listed in
`all_changes`, and still contain **no work** — the developer checked configs
out in the designer and never saved an edit. Every entry comes back
`has_changes: false`.

This is common enough to check for explicitly, and it is the single most
important thing to say about such a branch. When it happens:

1. **Confirm it** before asserting it. `--with-diffs` reporting `has_changes:
   false` is one signal; `dxs source diff --from <baseBranchId> --to <BRANCH_ID>
   --config <referenceName>` returning `unchanged` is a cheap second opinion.
   The base branch id is `base_branch_id` in the `source changes` response.
2. **Say so plainly, and don't invent a change.** Title it as an empty branch
   rather than straining to describe work that isn't there. Imperative mood
   doesn't apply — there is no action to name — so a descriptive title is
   correct here and overrides the conventional-commits tip.
3. **Use the "no work" ⚠ line**, not the divergence line, when a ticket
   resolved (see Output Format). An empty branch with a correctly-linked ticket
   is not a wrong reference; it's unsaved work.
4. **Do not add the code-review ⚠ line.** That flag is for problems found *in
   diffs*; with no diffs there is nothing to review. The empty-branch warning
   already carries the ⚠ title prefix.
5. Note which configs were checked out — if they're exactly the ones the ticket
   implicates, that's worth telling the user, since it suggests the work was
   started and lost rather than never begun.
- **`source deps`** — external dependencies (component packages this branch
  references). Useful when the diffs mention types or flows from outside the
  branch itself, or when dependency updates account for the bulk of the change.

### Phase 3: Trace (traceability compliance check)

Establish which work item this branch traces back to. Full rules, provider
adapters, and command syntax are in
[references/traceability.md](references/traceability.md); the shape is:

1. **Discover** — scan, in priority order: the user's prompt, then
   `commitDescription` and `commitTitle` from Phase 2 (those two fields are the
   entire surface — a branch has no name or description). Candidates come in
   several shapes — a CRM deep link (`…&etn=msdyn_projecttask&id=<guid>`), a
   case number (`C260612_0005`), a project request (`PR-260610_003`), an ADO
   work item (`AB#118432`), or a bare GUID. Collect all candidates before
   resolving any.
2. **Reverse-edge lookup** — ask which Project Task claims this branch:
   `dxs crm odata msdyn_projecttasks -f "contains(cr0c5_commit,'/<BRANCH_ID>/')"`.
   One hit is authoritative — the ticket asserts the link, so it beats anything
   inferred from a title. **Run it even when step 1 succeeded**: it's the only
   way to catch a branch pointing at one ticket while another claims the branch.
   Zero hits proves nothing (the field is hand-maintained and sparse) — fall
   through. Details and the slash-anchoring rule are in
   [references/traceability.md](references/traceability.md).
3. **Search** — only if 1 and 2 came up empty: up to ~2 CRM keyword searches
   using the commit title. (`dxs devops search` is an unimplemented stub — do
   not use it, and never read its empty result as "no work item exists".)
   Propose hits to the user for confirmation; never adopt a search result
   silently.
4. **Resolve** — fetch the record through its provider adapter. Keep the
   descriptive fields (`msdyn_descriptionplaintext`, case `description`, ADO
   `description`): they state what was *asked for*, which sharpens Phase 4.
5. **Verdict** — `COMPLIANT` (found and resolved), `UNVERIFIED` (found, lookup
   failed or no adapter), or `MISSING` (nothing found).

**This check warns, it never blocks.** `UNVERIFIED` and `MISSING` add a `⚠`
title prefix and one body line; the message is still produced in full.

Sanity-check observations split by destination. **Divergence** — the ticket
describes visibly different work than the diffs — goes **into the message** as a
⚠ line, because the person reading the commit is the one who can catch a wrong
link. Everything else (ticket already closed, ticket claimed by a different
branch, resolved title not matching `commitTitle`) goes **to the user** in your
summary only. See "Sanity checks" in
[references/traceability.md](references/traceability.md).

### Phase 4: Analyze

Read the diffs. The goal is to understand the **intent** of the branch well
enough to describe it in one sentence, and to spot anything a reviewer should
know about.

If Phase 3 resolved a ticket, read its description first and use it as the
frame. The ticket says what was requested; the diffs say what was built.
Describe **what was built** — but let the requirement supply the vocabulary and
the "why".

**Divergence check.** Compare the ticket's stated requirement against what the
diffs actually do. If they describe visibly different work, the commit message
always describes the **diffs** — never the ticket — and the message carries a
`⚠` divergence line (see Output Format). A divergence means one of two things,
both worth a human's attention: the branch is linked to the wrong ticket, or the
branch did something other than what was asked.

Be concrete about the threshold. This fires on a subject-matter mismatch — a
billing-filters ticket against a dependency-version sync, a picking-bug ticket
against an empty branch. It does **not** fire merely because the branch is a
partial implementation, refactors along the way, or fixes an adjacent bug; that
is normal. When unsure, don't fire it — and say so in your summary instead.

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

### Phase 5: Draft Message

Produce a three-section message. The downstream parser splits the output on
blank lines:

1. **Title** — the first line. Conventional commits style, ~72 chars.
   Prefix with ⚠ when Phase 3 returned `MISSING`/`UNVERIFIED` or Phase 4
   surfaced something that warrants review. One prefix regardless of how many
   concerns fired.
2. **Description** — the second paragraph (everything up to the next blank
   line). Short, human-readable summary, then any `⚠` lines, then the `Ref:`
   lines. This is the only part the developer sees and edits in the Datex
   Studio commit dialog, so keep it focused — and keep the reference *inside*
   this paragraph, since a blank line before `Ref:` would push it into Release
   Notes and out of view.
3. **Release Notes** — everything from the third paragraph onward. The
   detailed body. Never shown to the developer; consumed only by downstream
   release-note tooling.

See "Output Format" below for the exact shape. Wrap each section at a
reasonable line width.

### Phase 6 (optional): Persist to Knowledge Base

Check whether the `CreateKnowledgeNode` tool is available in this session. If
it is, save the drafted message as a Knowledge Product of type **Article**:

- **Path:** `CommitMessages/<Organization>/<ApplicationDefinitionName>/<BranchId>_<yyyyMMdd>_<hhmm>.md`
  - Example: `CommitMessages/Colorado Cold Connect/Footprint Cloud/67388_20260127_1419.md`
  - Create the folder hierarchy if it does not exist.
- **Tag:** key `branch`, value = the branch ID.
- **Schema:** check the schema for the `article` artifact type before calling
  `CreateKnowledgeNode` — field names may differ across knowledge-base versions.

The two names come from **different** commands — `branch show` alone does not
provide them:

| Name | Source |
|------|--------|
| `<Organization>` | `dxs auth status` → `active_identity.organization` (e.g. `Datex`). Also on each row of `dxs source repo list` as `organization.name`. |
| `<ApplicationDefinitionName>` | `dxs source branch show` → `referenceName` (e.g. `FootprintManager`). This equals the repo `name`, and `applicationDefinitionId` equals the repo `id`. |

Convert the current local time to `yyyyMMdd_hhmm` (24-hour) for the filename.

If `CreateKnowledgeNode` is **not** available (most CLI-only sessions), skip
this step. Print what the path would have been so the user has the option of
saving manually.

## Output Format

```
<Title — single line. Conventional commits style. Prefix with ⚠ when Phase 3 or
Phase 4 surfaced something that warrants attention.>

<Description — one paragraph, ~1-3 sentences, summarizing the change in
human terms. This is what the developer sees and edits in the commit dialog,
so keep it focused on the "what" and "why" at a high level. Then, still inside
this same paragraph and in this order:
  ⚠ lines, when applicable — use these four templates verbatim:
    "⚠ Recommend running a code review before merging — <one-line reason>."
    "⚠ No ticket reference found — this commit is untraced. Add a Project Task,
     Case, or work item link before committing."
    "⚠ Ticket reference <ID> could not be verified — <one-line reason>."
    "⚠ Referenced ticket describes different work than these changes — <ticket
     subject> vs <what the diffs do>. Verify the reference before committing."
    "⚠ Branch contains no changes — <n> config(s) are checked out but identical
     to base. The work described by the referenced ticket does not appear to
     have been saved."
  Ref: lines, when a reference resolved — two lines per reference:
    "Ref: <record type> — <resolved title>"
    "<full deep link, bare and unwrapped>">

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

**Example (clean branch, traced):**

```
feat(mobile): add Mobile Configurator hub for per-warehouse settings

Adds a new Mobile Configurator hub with sub-tabs for warehouses, owners,
order classes, and equipment types, so Settings exposes per-warehouse
configuration to mobile users.
Ref: Project Task — Mobile Configurator for Warehouse Settings
https://datexcorp.crm.dynamics.com/main.aspx?appid=ee829a66-fb63-ea11-a811-000d3a37800e&forceUCI=1&pagetype=entityrecord&etn=msdyn_projecttask&id=52c6bf79-36d5-49e7-9657-5426b2c68c0f

Adds 29 new configs: one hub (mobile_configurator_hub), four sub-tabs
(Warehouses, Owners, Order Classes, Equipment Types), and the grids/editors/
flows that back them. Existing Settings navigation is updated to expose the
hub.

The hub reads/writes warehouse-scoped settings via a new storage collection
and a pair of crud flows; per-owner and per-equipment-type overrides are
layered on top in the respective sub-tabs.
```

**Example (flagged branch — review concern + traced to a case):**

```
⚠ fix(udf): correct TypeId remap in custom_field_editor

Fixes a UDF type-remap bug where Text fields rendered as Selection lists,
with a small refactor that inlines a datasource and refreshes three hubs
after the editor closes.
⚠ Recommend running a code review before merging — the save flow has
duplicated error handling that can show two dialogs on failure.
Ref: Case C260612_0005 — Text UDFs render as Selection list
https://datexcorp.crm.dynamics.com/main.aspx?appid=ee829a66-fb63-ea11-a811-000d3a37800e&forceUCI=1&pagetype=entityrecord&etn=incident&id=6364eb8e-6266-f111-a825-000d3a3037d2

Updates custom_field_editor to remap TypeId 5→1 so "Text" UDFs no longer
render as "Selection list". Inlines ds_get_custom_field_options into
custom_field_options_grid (deletes the standalone datasource) and adjusts
three hubs to await the editor dialog and refresh on close.
```

**Example (traced, but the ticket doesn't match the work):**

```
⚠ chore(deps): sync Carriers, Manifesting, and PackVerification packages

Pulls in the 2026-07-30 builds of three component packages — Carriers,
Manifesting, and PackVerification — with no application configuration changes
of its own.
⚠ Referenced ticket describes different work than these changes — "Billing
Queries" (custom billing contract line filters) vs a dependency version sync.
Verify the reference before committing.
Ref: Project Task — Billing Queries
https://datexcorp.crm.dynamics.com/main.aspx?appid=ee829a66-fb63-ea11-a811-000d3a37800e&pagetype=entityrecord&etn=msdyn_projecttask&id=5ed1a581-9d40-4c05-87ef-a12902234fc5

Updates 1 config: appConfig, a metadata-only change recording the new
dependency versions. No configs added or deleted.

Dependency versions move from the 2026-07-29 afternoon builds to the
2026-07-30 morning builds. The other 56 dependencies are unchanged.
```

Note the message describes the **diffs** (a package sync), not the ticket
(billing filters). The ⚠ line is what connects them.

**Example (empty branch — configs checked out but never edited):**

```
⚠ chore(manufacturing): no changes to commit — branch is empty

Two configurations are checked out on this branch —
manufacturing_order_lines_grid and order_line_manufacturing_confirmation_editor
— but both are identical to base, so there is nothing to commit.
⚠ Branch contains no changes — 2 configs are checked out but identical to base.
The work described by the referenced ticket does not appear to have been saved.
Ref: Case C260714_0012 — Manufacturing orders only look at the Staging Location when consuming materials
https://datexcorp.crm.dynamics.com/main.aspx?appid=ee829a66-fb63-ea11-a811-000d3a37800e&pagetype=entityrecord&etn=incident&id=a670499b-947f-f111-9b47-7ced8d70177e

Updates 0 configs. Both entries in the pending list report has_changes: false;
the only difference from base is the branch-local config row id assigned at
checkout. No configs added or deleted.

The two checked-out configs are exactly the ones the referenced case implicates,
which suggests the work was started in the designer but never saved.
```

Note this uses the "no changes" ⚠ line, **not** the divergence line — the ticket
reference is correct, the work is simply absent. No code-review line either:
there are no diffs to review.

**Example (untraced branch — `MISSING` verdict):**

```
⚠ refactor(shipping): consolidate rate lookup into a single flow

Collapses three near-duplicate rate-lookup flows into one parameterized flow
and repoints the four callers at it.
⚠ No ticket reference found — this commit is untraced. Add a Project Task,
Case, or work item link before committing.

Deletes ds_rate_lookup_ltl, ds_rate_lookup_parcel, and ds_rate_lookup_ftl;
adds ds_rate_lookup with a carrier-mode parameter. Four callers updated.

The consolidated flow branches on carrier mode internally, so callers pass a
mode instead of choosing a flow.
```

## Tips

- **Title voice** — imperative mood, per conventional commits style
  (`feat(scope): add X`, `fix(scope): correct Y`, `refactor(scope): simplify Z`).
  Scope is optional; use it when a single area clearly dominates.
- **Don't restate diffs line by line** — the diff is already the source of
  truth. The message's job is to give a human the gist in 30 seconds.
- **Dependency-only commits** — a sync commit shows up as no substantive config
  changes plus moved dependency versions. Describe it as "Pull in dependency
  updates: <list>". **Check the direction first** — `dxs source deps-diff --from
  <baseBranchId> --to <BRANCH_ID>` reports "updated" for versions moving in
  *either* direction. Versions moving **backward** mean the base branch has
  advanced since your branch was cut; that is upstream drift, not work this
  branch did, and it must stay out of the message. Only forward moves are a
  sync. `dxs source diff --branch <BRANCH_ID>` lists upstream changes not yet
  pulled in, which confirms drift.
- **Traceability is a warning, not a gate** — a `MISSING` verdict never
  suppresses the message. Emit it with the ⚠ line and let the developer decide.
- **Never invent a ticket reference** — only cite records you actually resolved
  or the user supplied. A confidently wrong link is worse than an honest ⚠.
- **Project Tasks have no friendly number** — the GUID is the identifier, so the
  deep link is the only shareable form. Cases (`C260612_0005`) and Project
  Requests (`PR-260610_003`) do have readable IDs; prefer those when available.
- **Author attribution** — the branch's author is in the `branch show` output;
  you do not add an author line in the message (Datex Studio records the
  author on the branch itself).
- **Never run `git commit`** — this skill only produces text. Datex Studio
  commits happen in the platform UI, not via `git`.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Assuming a branch ID from earlier in the session | Follow the Branch ID Policy — ask explicitly |
| Drafting a message for a commit snapshot or release | Run the Phase 2 guard — check `isFeatureBranch` / `isCommit` before analyzing |
| Treating a row in `all_changes` as proof of work | Check `has_changes` per entry; `false` means the config is identical to base |
| Reading `changes_by_type` | It is always empty, even on branches with real updates — use `all_changes` |
| Describing an empty branch as if it did something | Say it's empty, use the "no changes" ⚠ line, and skip the code-review line |
| Reporting backward dependency moves as a sync | Backward = base advanced since the branch was cut; that's drift, keep it out |
| Describing the ticket when the diffs say something else | The message always describes the diffs; add the ⚠ divergence line to connect them |
| Burying a ticket/diff mismatch in the chat summary | Divergence goes in the message — the commit's reader is who catches a wrong link |
| Running `git commit` or editing repo state | This skill is read-only; it produces text only |
| Enumerating review findings in the commit body | List only the theme; delegate detail to `branch-code-reviewer` and just flag with ⚠ |
| Treating a regex match as a valid ticket reference | Resolve the record through its adapter — shape-valid IDs can point at nothing |
| Refusing to output a message because no ticket was found | The check warns, never blocks; emit with the ⚠ traceability line |
| Putting `Ref:` after a blank line | It lands in Release Notes, invisible to the developer — keep it in the Description paragraph |
| Guessing a ticket from a fuzzy search without confirming | Propose candidates to the user; adopt only what they confirm |
| Calling `CreateKnowledgeNode` without checking availability | Gate Phase 6 on tool availability; skip cleanly if missing |
| Using `--target dev`/`qa` by default | Default is `prod`; only override when the user explicitly says which environment |
