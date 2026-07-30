# Traceability Compliance

> **Reference for `commit-message-generator`.** Defines what counts as a compliant
> ticket reference, how to discover one from branch metadata, how to resolve and
> verify it against a ticket provider, and how to render it in the message.

Every commit should point at the work item that justified it. This reference is
**provider-agnostic** — the compliance contract and discovery rules are the same
for every ticket system; only the *adapter* (how you resolve an identifier to a
record) changes. Dynamics CRM Project Tasks are the primary adapter today.

## The compliance contract

A reference is **compliant** only when all three hold:

1. **Present** — an identifier or URL was found (or supplied by the user).
2. **Resolved** — the adapter fetched the record and it exists.
3. **Rendered** — the reference is written into the message per "Output slot" below.

Pattern-matching alone is *not* compliance. `PR-999999_999` matches the Project
Request shape perfectly and resolves to nothing. Always resolve before claiming
compliance.

### Verdicts

| Verdict | Meaning | Effect on the message |
|---------|---------|-----------------------|
| `COMPLIANT` | Identifier found **and** the record resolved | `Ref:` lines added; no traceability warning |
| `UNVERIFIED` | Identifier found but the lookup failed (record missing, provider unreachable, no CRM/DevOps consent) | `Ref:` lines added with the raw identifier; ⚠ traceability line added stating it could not be verified |
| `MISSING` | No identifier found anywhere, and the user did not supply one | No `Ref:` lines; ⚠ traceability line added |

**This check never blocks.** Always emit the message. A `MISSING` or `UNVERIFIED`
verdict adds a `⚠` title prefix and one body line — the developer decides whether
to fix it before pasting into the commit dialog. Do not withhold output, and do
not loop asking for a ticket the user does not have.

## Phase A — Discover

Scan these surfaces, in order, for anything ticket-shaped. Collect **all**
candidates before resolving any; a branch may legitimately reference more than one.

1. **The user's prompt** — an explicit URL, ID, or "it's for case C260612_0005"
   always wins over anything discovered.
2. **`dxs source branch show <id>`** — exactly two fields carry references:
   - `commitDescription` — the established home of the deep link (see below).
     Present on ~73% of active feature branches.
   - `commitTitle` — present on all of them. Often the *only* surface, and
     references here are bare rather than URLs (e.g. a leading `234787`).
3. **The reverse edge** — ask CRM which Project Task claims this branch. Cheap,
   one query, and *authoritative when it hits*, because the ticket itself
   asserts the link rather than you inferring it. See below.
4. **Diff contents** — occasionally a config description or comment carries the
   work item ID. Low signal; check only if 1–3 turned up nothing.

> **A branch has no name or description field.** `description` is absent on
> feature branches, and `referenceName` is not a per-branch label — it is the
> application definition name, which equals the repository name
> (`FootprintManager`, `ExcelInventoryImport`), with `applicationDefinitionId`
> equal to the repo id. Either way it describes the *repo*, not this branch's
> work, so it is useless for discovery. `commitTitle` and `commitDescription`
> are the whole discovery surface.

### Reverse-edge lookup (branch → ticket)

Project Tasks carry a `cr0c5_commit` field that developers paste Studio branch
URLs into (`https://wavelength.host/studio/application/<branchId>/home`). That
makes the link discoverable from the branch side:

```bash
dxs crm odata msdyn_projecttasks \
  -f "contains(cr0c5_commit,'/<BRANCH_ID>/')" \
  -s "msdyn_projecttaskid,msdyn_subject,statecode,cr0c5_commit"
```

**Run this even when step 2 already found a reference.** It is the only check
that can catch a branch pointing at one ticket while a *different* ticket claims
the branch. If the two disagree, don't pick — report both to the user.

**Wrap the branch id in slashes.** `cr0c5_commit` is free text and routinely
contains other numbers — publish versions like `20260611.170527`, dates, git
SHAs. A bare `contains(...,'82931')` will match those; `'/82931/'` anchors to the
URL path segment and avoids both false positives and prefix collisions
(`8293` vs `82931` vs `829310`).

Interpreting the result:

| Outcome | Meaning |
|---------|---------|
| Exactly 1 hit | **Authoritative.** The task claims this branch. Use it. |
| 2+ hits | Two tasks claim one branch. Report both; ask which is intended. |
| 0 hits | **Proves nothing.** Fall through to keyword search. |

That last row matters. `cr0c5_commit` is populated on only ~145 Project Tasks
tenant-wide, it is maintained by hand, and its contents are unstructured — real
values include `"Publish Version:\n20260611.170527…"`, an Azure DevOps *git
commit* URL, and freeform prose about disabled SQL jobs. Many entries contain no
branch URL at all. So a hit is strong evidence and a miss is no evidence.

One task may legitimately claim several branches — the observed format is
`Link 1: <url>\nLink 2: <url>` — when a requirement spans multiple components.
That is normal; note the sibling branches to the user rather than treating it as
a conflict.

**Project Tasks only.** `incident` has no `cr0c5_commit` field (querying it
returns `Could not find a property named 'cr0c5_commit'`), so there is no
reverse edge for Cases. Azure DevOps work items carry the equivalent in
`acceptance_criteria` as `BRANCH: <studio url>`, but with no working ADO search
(see below) it can only be read from a work item you already have, never
searched.

### Deep-link anatomy (the established convention)

Branches that already follow the convention put a bare Dynamics CRM record URL in
`commitDescription`:

```
https://datexcorp.crm.dynamics.com/main.aspx?appid=ee829a66-fb63-ea11-a811-000d3a37800e&forceUCI=1&pagetype=entityrecord&etn=msdyn_projecttask&id=52c6bf79-36d5-49e7-9657-5426b2c68c0f
```

Two query parameters carry everything you need:

- **`etn`** — the entity logical name → picks the adapter (`msdyn_projecttask`, `incident`, …)
- **`id`** — the record GUID → the lookup key

Parse those two and ignore the rest (`appid`, `forceUCI`, `lid` are UI noise).

### Identifier patterns

Match loosely and let resolution be the arbiter — a near-miss that resolves is a
better outcome than a strict regex that rejects a real ticket. These shapes are
observed in this tenant:

| Shape | Example | Provider / entity |
|-------|---------|-------------------|
| `…etn=msdyn_projecttask&id=<guid>` | see above | CRM Project Task |
| `…etn=incident&id=<guid>` | | CRM Support Case |
| `C` + `yyMMdd` + `_` + 4 digits | `C260612_0005` | CRM Support Case (`ticketnumber`) |
| `PR-` + `yyMMdd` + `_` + 3 digits | `PR-260610_003` | CRM Project Request (`daa_name` prefix) |
| Bare GUID | `52c6bf79-36d5-…` | Entity unknown — probe adapters in order |
| `AB#1234`, `#1234`, bare 5–7 digits | `AB#118432`, `234787 Review Redundant…` | Azure DevOps work item |
| `dev.azure.com/…/_workitems/edit/<n>` | | Azure DevOps work item |
| `<KEY>-<n>` | `ENG-1234` | Linear / Jira — no adapter configured; see "Adding a provider" |

A bare GUID with no `etn` is ambiguous. Probe adapters cheapest-first —
Project Task, then Case, then Project Request, then Internal Datex Ticket —
and stop at the first that returns a row.

A **bare number leading the commit title** is the most commonly missed
reference. `234787 Review Redundant Actions and Print Options in Orders Grid`
resolves to a real ADO work item of the same name. Always try it before
concluding `MISSING`.

### Keyword search — when nothing is found

If no identifier surfaced, make **a few** targeted searches using the branch name
and commit title as the query. This is a *proposal* step: never write a discovered
record into the message without the user confirming it.

```bash
# CRM Project Tasks by subject
dxs crm odata msdyn_projecttasks \
  -f "contains(msdyn_subject,'Net Weight') and statecode eq 0" \
  -s "msdyn_projecttaskid,msdyn_subject,statecode" --limit 10

# CRM Cases by title
dxs crm case search "net weight" --status active --limit 10

# Azure DevOps: NO title search exists. `dxs devops search` is a stub — it returns
# {"message": "Work item search is not yet implemented"} with success: true, so it
# looks like a search that found nothing. Do not use it and do not read "no results"
# as "no matching work item". ADO can only be resolved from a known ID.
```

Cap it at ~2 searches (CRM only, per the above). If they return nothing, or return a spray of
plausible-but-unconvincing hits, ask the user once; if they don't have a ticket,
record `MISSING` and move on. Do not chain further searches hoping to get lucky —
a wrong ticket reference is worse than an honest ⚠.

## Phase B — Resolve (provider adapters)

Each adapter answers: *does this record exist, what is it called, and what does it
say the work is?* The last part matters — pull the descriptive fields and feed them
into the diff analysis. A commit message written with the requirement in hand
describes intent; one written from diffs alone only describes mechanics.

Base URL and DevOps org come from CLI config, not hardcoded:

```bash
dxs config list          # dynamics_crm_url, default_devops_org
```

### Adapter: CRM Project Task (`msdyn_projecttask`) — primary

Project Tasks have **no friendly number**. `cr0c5_id` is a copy of the GUID, so the
GUID *is* the identifier and the deep link is the only human-shareable form.

```bash
dxs crm odata msdyn_projecttasks \
  -f "msdyn_projecttaskid eq <GUID>" \
  -s "msdyn_projecttaskid,msdyn_subject,msdyn_descriptionplaintext,statecode,daa_devopsitemid,daa_devopsdescription,cr0c5_requirementresolution,cr0c5_commit"
```

| Field | Use |
|-------|-----|
| `msdyn_subject` | Display title for the `Ref:` line |
| `msdyn_descriptionplaintext` | **The requirement.** Primary context for the message |
| `statecode` | `Active` / `Inactive` — flag if already Inactive (see Sanity checks) |
| `daa_devopsitemid` | Linked ADO work item → fetch it too for extra context |
| `daa_devopsdescription` | ADO-sourced detail, when present |
| `cr0c5_requirementresolution` | How the requirement was met — useful for release notes |
| `cr0c5_commit` | Points back at the Studio branch, e.g. `https://wavelength.host/studio/application/90161/home`. Confirms the link is bidirectional |

Note `cr0c5_commit` is the reverse edge of this same traceability loop. If it
already names a *different* branch, say so — it may mean the task is claimed by
other work.

### Adapter: CRM Support Case (`incident`)

**Ticket numbers are not unique — `case get` will silently return the wrong case.**
65 of 31,522 ticket numbers in this tenant are shared by two records. `dxs crm case
get` returns a single-record envelope with no indication a second matched, so it can
hand you a resolved, unrelated case while the check still reports `COMPLIANT`.
Observed: `C260710_0017` is both "Missing Attachment" (Resolved, Crane Worldwide)
and "FootPrint Next Gen - Errors when Picking" (Active, JCS Global).

So resolve in this order:

```bash
# 1. Holding a GUID (from a deep link)? Use it — GUIDs are unambiguous.
dxs crm odata incidents \
  -f "incidentid eq <GUID>" \
  -s "incidentid,ticketnumber,title,description,statecode"

# 2. Holding only a ticket number? Enumerate first and check the count.
dxs crm odata incidents \
  -f "ticketnumber eq 'C260612_0005'" \
  -s "incidentid,ticketnumber,title,statecode,createdon"

# 3. Exactly one hit → re-fetch it by GUID via `case get` for readable output.
dxs crm case get C260612_0005                      # markdown body, lookups resolved
dxs crm case get C260612_0005 --include-activity   # when you need the discussion
```

If step 2 returns **more than one row**, do not guess. Compare each candidate's
`title` against the branch's `commitTitle` and pick the match; if that is not
decisive, ask the user which case is intended. Never let a multi-hit resolve
silently — a confidently wrong `Ref:` is the worst output this check can produce.

**Always cross-check the resolved title against the commit title** even on a single
hit. It costs nothing and is the only thing that catches this class of error.

Context: `title`, `description`, `status`, `customer`. Prefer `case get` for the
body — raw `odata` returns `description` as a wall of `<div class="ck-content" …>`
markup you'd have to strip yourself. Case titles redundantly prefix the ticket
number (`C260612_0005 - Would like to add…`) — strip that prefix for the `Ref:`
line so it doesn't read twice.

### Adapter: CRM Project Request (`daa_projectrequest`)

The `PR-` number is a prefix of the primary name, not its own column:

```bash
dxs crm odata daa_projectrequests \
  -f "startswith(daa_name,'PR-260610_003')" \
  -s "daa_projectrequestid,daa_name,statecode"
```

### Adapter: CRM Internal Datex Ticket (`daa_internaldatexticket`)

No friendly number — GUID only. Descriptive fields are HTML; strip tags before use.

```bash
dxs crm odata daa_internaldatextickets \
  -f "daa_internaldatexticketid eq <GUID>" \
  -s "daa_internaldatexticketid,daa_title,daa_description,daa_acceptancecriteria,statecode"
```

`daa_acceptancecriteria` is the highest-value context field here.

### Adapter: Azure DevOps work item

```bash
dxs devops workitem 234787 --org datexCorporation
dxs devops workitem 234787 --org datexCorporation --discussions   # when context is thin
```

Org defaults to `default_devops_org` in config. Use `title`, `description`, `state`,
`type` as context. The response includes a ready-made `url`
(`https://dev.azure.com/<org>/_workitems/edit/<id>`) — use it directly rather than
building one.

`acceptance_criteria` often carries the reverse edge as
`BRANCH: <https://wavelength.host/studio/application/<branchId>/home>` — the ADO
equivalent of `cr0c5_commit`. If it names a different branch than the one you're
writing a message for, flag it.

### Adding a provider (Linear, Jira, …)

No adapter exists for these yet. To add one, supply three things:

1. **A pattern** — how its identifiers look (`ENG-1234`), added to the table above.
2. **A resolve command** — a `dxs` command, an MCP tool, or a documented API call
   returning at minimum: exists?, title, state, description.
3. **A URL template** — how to build the human-clickable link from the identifier.

Until an adapter exists, an identifier matching an unknown pattern resolves to
`UNVERIFIED`, not `MISSING`: the developer *did* reference something, it just
can't be checked from here. Say which system it appears to belong to.

## Phase C — Render

### Output slot

The `Ref:` lines go at the **end of the Description paragraph** — the section the
developer actually sees and edits in the Datex Studio commit dialog. Keep them
inside that paragraph: the downstream parser splits sections on blank lines, so a
blank line before `Ref:` would push the reference into Release Notes and out of the
developer's view.

Order within the paragraph, when both apply: summary text → `⚠` lines → `Ref:` lines.

```
feat(materials): add net weight column to inventory grid

Adds a Net Weight column to the inventory grid on the single material hub,
alongside the existing Gross Weight column.
Ref: Project Task — Materials/Inventory Add Net Weight
https://datexcorp.crm.dynamics.com/main.aspx?appid=ee829a66-fb63-ea11-a811-000d3a37800e&forceUCI=1&pagetype=entityrecord&etn=msdyn_projecttask&id=52c6bf79-36d5-49e7-9657-5426b2c68c0f
```

- **Line 1** — `Ref: <Provider record type> — <resolved title>`. The resolved title
  is what makes the reference readable without clicking.
- **Line 2** — the full deep link, bare and unwrapped. Never wrap or truncate a
  URL; it must stay clickable and copy-pasteable.

Multiple references: repeat the two-line pair, most significant first.

### Building the CRM deep link

When you resolved from a bare ID rather than a URL, construct the link:

```
<dynamics_crm_url>/main.aspx?appid=<appid>&forceUCI=1&pagetype=entityrecord&etn=<entity>&id=<guid>
```

`dynamics_crm_url` comes from `dxs config list`.

The `appid` is the CRM model-driven app the team uses. Most repos have **no** branch
carrying a link to copy from — a sweep of 25 FootprintManager branches found zero —
so don't count on scavenging one. Every observed link in this tenant uses the same
value across both entity types:

```
appid=ee829a66-fb63-ea11-a811-000d3a37800e
```

Use it as the default, and prefer a value from a real link on the branch when one
exists. `appid` is cosmetic — it selects which app chrome wraps the record. If
you're unsure, **omit it**: the record still opens, and a link with no `appid` is
better than one pointing at the wrong app.

### Traceability warnings

`MISSING` — prefix the title with `⚠` and append to the Description paragraph:

```
⚠ No ticket reference found — this commit is untraced. Add a Project Task, Case,
or work item link before committing.
```

`UNVERIFIED` — prefix the title with `⚠` and append:

```
⚠ Ticket reference <ID> could not be verified — <one-line reason>.
```

The `⚠` title prefix is shared with the code-review flag from the Analyze phase.
One prefix regardless of how many concerns fired; the body lines distinguish them.

### Sanity checks (report, don't block)

Resolution succeeding doesn't mean the reference is *right*. These checks split by
where they go:

**Into the commit message, as a `⚠` line:**

- The ticket's description and the branch's diffs describe visibly different work.
  This is a traceability defect, not review chatter — whoever reads the commit is
  the person best placed to catch a wrong link, so it must be visible to them, not
  buried in a chat summary they'll never see. Use the divergence template in
  SKILL.md's Output Format.

**Into your summary to the user only:**

- Referenced record is already `Inactive` / `Resolved` / `Closed`
- The reverse-edge lookup returned a *different* task than the one the branch
  points at — the two disagree about which ticket owns this work
- The claiming task lists sibling branches in `cr0c5_commit` — normal when a
  requirement spans components, but worth naming so the user knows the scope
- Multiple unrelated tickets referenced by one branch — may warrant splitting
- The resolved title didn't obviously match `commitTitle` (see the Case adapter's
  duplicate-ticket-number trap)

These stay out of the message because they're about the *state* of an otherwise
correct link. Divergence is different in kind: it says the link itself may be wrong.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Treating a regex match as compliance | Resolve the record; `PR-999999_999` matches the shape and exists nowhere |
| Trusting `dxs crm case get` on a ticket number | Ticket numbers are not unique — enumerate with `odata` first and cross-check the title against `commitTitle` |
| Reading `dxs devops search`'s empty result as "no work item" | It's an unimplemented stub that reports `success: true` — it never searched |
| Emitting a URL with `&amp;` instead of `&` | Deep links must be raw and clickable; HTML-escaping breaks them |
| Blocking output until a ticket is supplied | This check warns, never blocks — always emit the message |
| Inventing a plausible ticket ID or link | Only reference records you actually resolved, or the user supplied |
| Putting `Ref:` after a blank line | It lands in Release Notes, invisible to the developer — keep it in the Description paragraph |
| Hardcoding the CRM host or DevOps org | Read `dynamics_crm_url` / `default_devops_org` from `dxs config list` |
| Searching endlessly for a ticket that isn't there | Cap at ~3 searches, ask once, then record `MISSING` |
| Using ticket context but not the diffs | The ticket says what was *asked for*; the diffs say what was *done*. Describe what was done |
