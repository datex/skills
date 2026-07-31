---
name: commit-message-generator
description: |
  Use when generating a commit message for a Datex Studio feature branch. Reads the
  branch's pending changes, config diffs, and dependencies, resolves the work item the
  branch traces back to, then drafts a well-formed title + body carrying that reference.
  Trigger for: "generate a commit message for branch X", "write a commit
  message", "draft a commit for this branch", "what should the commit say",
  "suggest a commit message", "does this commit reference a ticket", "traceability
  check". Runs interactively or unattended — one-shot mode, signalled in the prompt,
  never asks and delivers through a named tool. For reviewing the branch's code
  quality, use `branch-code-reviewer` instead.
depends:
  - datex-studio-shared
---

# Commit Message Generator

Review a Datex Studio feature branch's pending changes and produce a quality
commit message suitable for recording against the branch. This skill reads the
branch server-side via `dxs` — it does not run `git commit`; Datex Studio has
its own commit flow and the message produced here is intended to be pasted into
the branch's commit UI (or into whatever downstream delivery the user chose).

It makes **one** write, and only one: when a branch resolves to a Project Task,
it stamps the branch URL onto that task's `cr0c5_commit` field so the link is
discoverable from both ends (Phase 5c). Nothing else is mutated — not the branch,
not any configuration, not the repo.

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

## Execution modes

This skill runs in two modes. **Default to interactive.** Switch to one-shot only
on an explicit signal in the prompt — wording like "one-shot mode", "this request
comes from an automated system", "no user is present", or an instruction to
deliver the result through a named tool.

|  | **Interactive** | **One-shot** |
|--|-----------------|--------------|
| A user is present | Yes | No |
| Output channels | The message **and** a summary to the user | The message only |
| When something is ambiguous | Ask | Decide per the rules below, never ask |

The difference that matters is **channels, not quality**. Interactively you have
two: the commit message, and a conversational summary carrying everything the
message shouldn't. One-shot has one. So observations that would have gone to the
user must either be promoted into the message or lost — and losing them is the
one outcome that turns a compliance check into theatre.

### One-shot rules

1. **Never ask. Never block.** Always produce a message. There is nobody to
   answer, so a question is a silent failure.
2. **Promote user-facing observations into the message** as `⚠` lines in the
   Description — ticket already closed, ticket claims sibling branches, resolved
   title not matching `commitTitle`, message is retroactive. Interactively these
   stay in the summary; one-shot they go in the message or nowhere.
3. **Be conservative about references.** Never cite a reference that would have
   needed confirmation. Specifically:
   - Reverse-edge or ticket-number lookup returning **2+ candidates** →
     `UNVERIFIED`. Do not pick one. Name the candidates in the ⚠ line, emit no
     `Ref:` lines.
   - Keyword-search hits, which interactively you'd propose for confirmation →
     **do not adopt**. Verdict is `MISSING`; name the near-misses in the ⚠ line
     so a human can finish the job.
   - Adopt only self-asserting references: an explicit ID or deep link in the
     prompt or commit fields, or a **single** reverse-edge hit.

   A wrong link committed unattended is worse than an honest `MISSING` — it
   launders a guess into an audit trail nobody will re-check.
4. **Branch ID must come from the prompt.** The Branch ID Policy's "always ask"
   cannot apply. If no branch ID is supplied, emit nothing and report that the
   request was unusable — do not guess one from context.
5. **Deliver through the tool the prompt names** (e.g. `SaveCommitMessage`). If
   the named tool isn't available in the session, fall back to returning the
   message as your final output and say the tool was missing — never drop the
   result on the floor.

### Keeping ⚠ lines readable

Promotion can stack warnings, and the Description is the one section a developer
actually reads. Keep it useful:

- **Cap at 3 `⚠` lines.** Past that, keep the three that most affect trust in the
  reference and fold the rest into one line.
- **Order by consequence:** traceability defects first (missing / unverified /
  divergent reference), then branch-state warnings (empty, retroactive), then
  the code-review line.
- Merge naturally related observations rather than emitting near-duplicates —
  "ticket is closed and also claims branch 83001" is one line, not two.

## Workflow

```
[Phase 0: Mode]
Interactive (default) or one-shot? One-shot = explicit signal in the prompt.
One-shot: never ask, never block, promote observations into the message,
be conservative about references, deliver via the named tool.
        |
[Phase 1: Setup]
Get branch ID from user (branch-setup.md rules; one-shot: from the prompt)
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
[Phase 5b: Deliver]  ← one-shot only
Call the delivery tool the prompt named (e.g. SaveCommitMessage).
        |
[Phase 5c: Stamp reverse edge]  ← both modes, only when a Project Task resolved
dxs crm commit-ref append <task> <branch-url> --label <app>  (idempotent)
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

0. Determine the mode (see "Execution modes"). Everything below assumes
   interactive unless the prompt signalled one-shot.
1. Get the branch ID from the user. Follow the Branch ID Policy in
   [branch-setup.md](../datex-studio-shared/branch-setup.md) — ask, never assume, even if a
   branch ID appeared earlier in the session.
   **One-shot:** take the branch ID from the prompt. If none was supplied, stop
   and report the request as unusable — never infer one.
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

**One-shot:** there is nobody to ask, so proceed — but say so in the message.
Add the retroactive ⚠ line (see Output Format) carrying the existing
`commitTitle` and `commitDate`, so the receiving system can tell this describes
work already committed rather than work awaiting a commit.

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
   **One-shot:** 2+ hits → `UNVERIFIED`, name the candidates, emit no `Ref:`.
3. **Search** — only if 1 and 2 came up empty: up to ~2 CRM keyword searches
   using the commit title, plus `dxs devops search` for ADO work items.
   Propose hits to the user for confirmation; never adopt a search result
   silently.
   **One-shot:** never adopt a search hit — there is no confirmation available.
   Verdict is `MISSING`; name the near-misses in the ⚠ line so a human can
   finish the job.
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
   detailed body. In the interactive path this is never shown to the developer
   and is consumed only by downstream release-note tooling. In one-shot
   delivery there is no separate parameter for it, so it rides inside the
   tool's `description` field — write it as something a human could reasonably
   read, not as tooling-only scratch.

See "Output Format" below for the exact shape. Wrap each section at a
reasonable line width.

### Phase 5b (one-shot only): Deliver

In one-shot mode the message has to reach the requesting system — returning it
as prose is not delivery.

Call the tool the prompt names. The known delivery tool is `SaveCommitMessage`:

| Parameter | Type | What to pass |
|-----------|------|--------------|
| `branch_id` | integer | The branch ID — as a **number, not a string** |
| `title` | string | The Title line, **including the `⚠` prefix** when one applies |
| `description` | string | The **whole message** — Title, blank line, Description paragraph, blank line, Release Notes |
| `environment` | enum | `production` \| `qa` \| `dev` — **not** the CLI's `prod` |

All four are required; `environment` has a default but must still be sent.

Three things to get right:

1. **`description` is the full message, not just the middle section.** Its
   contract is "first line concise, then a blank line, then additional
   information" — the standard subject-plus-body shape. So the Title line is
   repeated: once in `title`, and again as the first line of `description`.
   That duplication is intended; don't strip it.
2. **The three sections collapse into two fields.** There is no separate
   release-notes parameter, so Release Notes rides inside `description` after
   the Description paragraph. Keep the blank-line separators exactly — they are
   what lets anything downstream split the sections back apart.
3. **Map the environment name.** `dxs` uses `--target prod`; this tool wants
   `production`. `qa` and `dev` match. Sending `prod` fails schema validation.

**Keep the `⚠` prefix on `title`.** This is a settled decision, not an oversight
— do not strip it for being non-ASCII or for fear of how a downstream UI renders
it. The prefix is the signal that something needs a human's attention, and a
title that silently loses it is worse than one that renders imperfectly.

If the named tool is **not available** in the session, do not silently drop the
result: return the full message as your final output and state plainly that the
delivery tool was missing, so the caller can tell delivery failed rather than
generation. Return the message in your final output as well as calling the tool
— it costs nothing and makes failures diagnosable from the transcript.

Skip this phase entirely in interactive mode.

### Phase 5c: Stamp the reverse edge (both modes)

When Phase 3 resolved a **Project Task**, write this branch's Studio URL into that
task's `cr0c5_commit` so the link is discoverable from the ticket side too. This
is what makes the reverse-edge lookup in Phase 3 work for the *next* branch —
today that field is populated on only ~145 tasks because it is maintained by hand.

```bash
dxs crm commit-ref append <TASK_GUID> \
  "https://wavelength.host/studio/application/<BRANCH_ID>/home" \
  --label <ApplicationDefinitionName>
```

This runs automatically, in **both** interactive and one-shot mode, whenever:

- the verdict is **`COMPLIANT`** — never stamp a guess, so never on `UNVERIFIED`
  or `MISSING`; **and**
- the resolved record is a **Project Task**. Cases, Project Requests, Internal
  Datex Tickets and ADO work items have no `cr0c5_commit` field — skip them.

Details that matter:

- **It is idempotent.** If the URL is already present the command writes nothing
  and returns `changed: false` with `reason: "value already present"`. Re-running
  the skill on a branch is safe. **Do not pass `--allow-duplicate`** — that
  defeats the guard and grows the field without limit.
- **`--label` is the application definition name** (`referenceName` from
  `branch show`, e.g. `FootprintManager`). It matches the convention already in
  the field, where a label line sits above the URL.
- **A failed write does not invalidate the message.** Report the failure and
  carry on — the commit message is the deliverable; the stamp is a side effect.
- **Report the outcome** (`changed: true` / `false`) in your interactive summary.
  In one-shot, mention it only if the write failed — a successful stamp is not
  worth a ⚠ line.

> **Why this is safe unattended.** One-shot only adopts self-asserting references
> — an explicit ID or link, or a single reverse-edge hit — so it can never stamp a
> task it merely guessed at from a keyword search. The write inherits the
> conservative-resolution rule rather than needing its own.

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

  One-shot only — promoted from what would have been the chat summary. Use only
  in one-shot mode; interactively these belong in your summary:
    "⚠ Referenced ticket is <state> — verify it is the right reference."
    "⚠ Ticket reference is ambiguous — <n> candidates matched (<ids or
     subjects>); none adopted. Add an explicit link before committing."
    "⚠ No ticket reference found; closest matches were <candidates>. Not adopted
     without confirmation — add a link before committing."
    "⚠ This message is retroactive — the branch was already committed on <date>
     as \"<existing commitTitle>\"."
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

**Example (one-shot — observations promoted into the message):**

The same branch as the traced example above, but generated unattended. The
closed-ticket and sibling-branch notes would have gone to the user in chat;
one-shot they go here or nowhere.

```
⚠ feat(pallet-build): accept tote ID alongside cart and job IDs

Extends pallet build with serials so a tote barcode works anywhere a cart or
job number does, moving toward a single barcode carrying the whole flow.
⚠ Referenced ticket is Inactive (closed) and also claims branch 83001 — verify
it is the right reference.
⚠ Recommend running a code review before merging — widening the job lookup in
reset_pickJob_fields makes its silent multi-match early-return more reachable.
Ref: Project Task — Update to use tote ID instead of job ID
https://datexcorp.crm.dynamics.com/main.aspx?appid=ee829a66-fb63-ea11-a811-000d3a37800e&pagetype=entityrecord&etn=msdyn_projecttask&id=3e6b6a20-b38b-4265-b34a-8578f7f53329

Updates 3 configs: two flows (get_orderJob_by_cart, reset_pickJob_fields) and
one hub (pallet_build_with_serials_hub). No configs added or deleted.

Both flows widen their jobs_header predicates to match on toteId in addition to
jobId and cartId, and reset_pickJob_fields now normalizes its inparam to the
real jobId so downstream lookups are unaffected by which barcode was scanned.
```

Note the two closed/sibling observations merged into **one** ⚠ line rather than
two, and traceability ordered ahead of the code-review line.

Delivered via `SaveCommitMessage`, that message maps to:

```json
{
  "branch_id": 82931,
  "title": "⚠ feat(pallet-build): accept tote ID alongside cart and job IDs",
  "description": "⚠ feat(pallet-build): accept tote ID alongside cart and job IDs\n\nExtends pallet build with serials so a tote barcode works anywhere a cart or\njob number does, moving toward a single barcode carrying the whole flow.\n⚠ Referenced ticket is Inactive (closed) and also claims branch 83001 — verify\nit is the right reference.\n⚠ Recommend running a code review before merging — widening the job lookup in\nreset_pickJob_fields makes its silent multi-match early-return more reachable.\nRef: Project Task — Update to use tote ID instead of job ID\nhttps://datexcorp.crm.dynamics.com/main.aspx?...&etn=msdyn_projecttask&id=3e6b6a20-b38b-4265-b34a-8578f7f53329\n\nUpdates 3 configs: two flows (get_orderJob_by_cart, reset_pickJob_fields) and\none hub (pallet_build_with_serials_hub). No configs added or deleted.\n\nBoth flows widen their jobs_header predicates to match on toteId in addition to\njobId and cartId, and reset_pickJob_fields now normalizes its inparam to the\nreal jobId so downstream lookups are unaffected by which barcode was scanned.",
  "environment": "production"
}
```

`branch_id` is a number. The title appears twice — once as `title`, once as the
first line of `description`. All three sections are inside `description`,
separated by the blank lines that let them be split apart again.

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
- **Never run `git commit`** — Datex Studio commits happen in the platform UI,
  not via `git`. The skill's only write is the `cr0c5_commit` traceability stamp
  in Phase 5c; it never modifies the branch, its configurations, or the repo.
- **Never pass `--allow-duplicate`** to `commit-ref append` — the duplicate guard
  is what makes re-running the skill on a branch safe.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Assuming a branch ID from earlier in the session | Follow the Branch ID Policy — ask explicitly (one-shot: take it from the prompt, never infer) |
| Asking a question in one-shot mode | Nobody will answer; a question is a silent failure. Decide per the one-shot rules |
| Losing summary observations in one-shot | Promote them to ⚠ lines — one-shot has no second channel |
| Adopting a search hit unattended | One-shot never adopts what would have needed confirmation; verdict is MISSING with the near-misses named |
| Generating in one-shot but not calling the delivery tool | Returning prose is not delivery; call the named tool, and say so if it's unavailable |
| Sending `environment: "prod"` to `SaveCommitMessage` | The tool's enum is `production` \| `qa` \| `dev`; only `dxs --target` uses `prod` |
| Passing only the middle section as `description` | `description` is the **full** message — title, blank line, body. The repeated title is intended |
| Dropping Release Notes because the tool has no field for it | It rides inside `description` after the Description paragraph, blank lines intact |
| Drafting a message for a commit snapshot or release | Run the Phase 2 guard — check `isFeatureBranch` / `isCommit` before analyzing |
| Treating a row in `all_changes` as proof of work | Check `has_changes` per entry; `false` means the config is identical to base |
| Reading `changes_by_type` | It is always empty, even on branches with real updates — use `all_changes` |
| Describing an empty branch as if it did something | Say it's empty, use the "no changes" ⚠ line, and skip the code-review line |
| Reporting backward dependency moves as a sync | Backward = base advanced since the branch was cut; that's drift, keep it out |
| Describing the ticket when the diffs say something else | The message always describes the diffs; add the ⚠ divergence line to connect them |
| Burying a ticket/diff mismatch in the chat summary | Divergence goes in the message — the commit's reader is who catches a wrong link |
| Running `git commit` or editing repo state | The only sanctioned write is the Phase 5c `cr0c5_commit` stamp; the branch and repo are never touched |
| Stamping `cr0c5_commit` on an UNVERIFIED or MISSING verdict | Only stamp a resolved Project Task — never write a guess into a ticket |
| Enumerating review findings in the commit body | List only the theme; delegate detail to `branch-code-reviewer` and just flag with ⚠ |
| Treating a regex match as a valid ticket reference | Resolve the record through its adapter — shape-valid IDs can point at nothing |
| Refusing to output a message because no ticket was found | The check warns, never blocks; emit with the ⚠ traceability line |
| Putting `Ref:` after a blank line | It lands in Release Notes, invisible to the developer — keep it in the Description paragraph |
| Guessing a ticket from a fuzzy search without confirming | Propose candidates to the user; adopt only what they confirm |
| Calling `CreateKnowledgeNode` without checking availability | Gate Phase 6 on tool availability; skip cleanly if missing |
| Using `--target dev`/`qa` by default | Default is `prod`; only override when the user explicitly says which environment |
