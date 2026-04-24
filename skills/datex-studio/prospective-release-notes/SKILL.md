---
name: prospective-release-notes
description: |
  Use when generating Datex Studio release notes for an application over a time
  range instead of between two explicitly chosen branches. Discovers which two
  published releases to compare — the last one strictly before `range_start` and
  the last one inside `[range_start, range_end]` — then delegates to
  `release-notes-generator` for the actual notes. Designed for unattended weekly
  runs (e.g. every Monday covering the prior Mon–Sun week), but works for any
  range. Trigger for: "weekly release notes", "release notes for <app> last
  week", "what shipped in <app> between <date> and <date>", "scheduled release
  notes run". For release notes between two explicitly-named branches, use
  `release-notes-generator` directly.
---

# Prospective Release Notes

Pick the two anchor branches for a time range, then hand off to the Release
Notes SOP. The anchor picking is scoped to the application's **default
application group** — Service Pack hotfix groups are explicitly excluded so a
mid-week hotfix cannot skew the comparison.

## Execution Posture

This skill is designed to run **unattended on a schedule** in a non-interactive
environment. There is no caller to prompt mid-run. Every step that hits
ambiguity, missing input, or a tool error must fail with a clear,
self-describing message in the agent's output — the operator reads the
scheduler log after the fact and re-runs with corrected input.

**Do not guess. Do not pick "the first match". Fail loud.**

When invoked interactively (a user typing "weekly release notes for <app>"),
the same posture still applies to ambiguity — but the operator is the user in
front of you, so print the error and ask them to disambiguate.

## Dependencies

- **`release-notes-generator`** skill — invoked with the two resolved branch
  IDs once Step 3 determines both anchors exist.

## Prerequisites

- **Organization name** and **application definition name** — both required.
  Application names are unique only within an organization, so org is not
  optional even when there's an obvious one.
- **Time range:** `range_start` (inclusive) and `range_end` (inclusive). If
  unspecified, default to **last Monday 00:00 → last Sunday 23:59:59** in the
  user's local zone.

Published releases live in the Datex Studio marketplace. They are
deployment-agnostic — "published" means available to any environment, not that
any environment is currently running the version. This skill reads marketplace
metadata and does not need a deployment target.

## Workflow

```
[Step 1: Resolve org / repo / defaultApplicationGroup]
dxs --output json organization search "<ORG_NAME>"
  → <ORG_ID> (fail hard on 0 or >1 match)
dxs --output json organization app list --org <ORG_ID>
  → find entry where name == <APP_NAME>
  → <REPO_ID>, <defaultApplicationGroupId>
  (fail hard on 0 matches)
        |
[Step 2: Collect release branches in the Default group]
dxs --output json source branch list \
  --repo <REPO_ID> --default-group --status published -n 0
        |
[Step 3: Pick the two anchors]
Sort filtered releases by releaseDate descending.
  last_before   = largest releaseDate strictly less than range_start
  last_in_range = largest releaseDate in [range_start, range_end]
        |
        +--- Outcome 1: no last_in_range     → emit "No releases …" and stop
        |
        +--- Outcome 2: last_in_range but no last_before
                                             → emit Initial Release note and stop
        |
        +--- Outcome 3: both exist           → Step 4
        |
[Step 4: Delegate]
Invoke release-notes-generator with --from=<last_before.id> --to=<last_in_range.id>
(Use `dxs source release-notes --enrich-workitems --output json` as the source call
 if the target skill wants structured data; otherwise pass the branch IDs and let
 release-notes-generator drive its own workflow.)
        |
[Step 5: Return]
Return the Technical + Customer notes as the agent's response. No persistence
to KB / file / chat — the caller decides downstream delivery.
```

## Step Details

### Step 1: Resolve `(orgId, repoId, defaultApplicationGroupId)`

```bash
# 1a. Organization name → organization ID
dxs --output json organization search "<ORG_NAME>"

# 1b. Apps in that org
dxs --output json organization app list --org <ORG_ID>
```

From the app list, pick the entry where `name == <APP_NAME>` and capture its
`id` (= `<REPO_ID>`) and `defaultApplicationGroupId`.

**Hard-failure conditions (do NOT guess or pick the first match):**

- Either input (organization name or application name) is missing.
- The org search returns zero or more than one match.
- The app lookup within the org returns zero matches.

Each failure message must include **what was searched**, **what was returned**,
and **what the caller needs to provide** to fix it. Example:

> "Organization search for 'Datex' returned 3 matches: [1 Datex, 47 Datex Demo,
>  88 Datex Partners]. Re-run with a more specific organization name, or pass
>  the organization ID directly."

**At the end of Step 1 you must have:** `<REPO_ID>` (used as `--repo` in
Step 2) and `<defaultApplicationGroupId>` (used as a client-side safety check
in Step 2).

### Step 2: Collect Release Branches in the Default Group

```bash
dxs --output json source branch list \
  --repo <REPO_ID> --default-group --status published -n 0
```

- `--default-group` scopes to the repo's Default application group (excludes
  Service Pack groups).
- `--status published` restricts to branches with `applicationStatusId=3`.
  Older releases are NOT demoted — they stay PublishedMain and are
  differentiated by `releaseDate` and `isLatest`.
- `-n 0` disables paging so every release comes back.

The fields that matter per release: `id`, `releaseDate`, `versionName`,
`marketplaceApplicationVersionId`, `isLatest`.

No client-side group filter is needed — the CLI stamps the known group ID on
each branch, so the result is definitive. (The `defaultApplicationGroupId`
captured in Step 1 is retained only as a sanity check in case of future CLI
changes.)

### Step 3: Pick the Two Anchor Branches

Sort the filtered releases by `releaseDate` descending. Select:

- **`last_before`** — the entry with the largest `releaseDate` **strictly less
  than** `range_start`.
- **`last_in_range`** — the entry with the largest `releaseDate` where
  `range_start ≤ releaseDate ≤ range_end`.

**Handle all three outcomes explicitly:**

1. **No `last_in_range`** — no release happened in the range. Emit a one-line
   summary:

   > "No releases between <range_start> and <range_end> for <app>."

   Stop. Do NOT invoke `release-notes-generator`.

2. **`last_in_range` exists but no `last_before`** — first-ever release. Emit
   a short Initial Release note summarizing `last_in_range.versionName`,
   `releaseDate`, and any `releaseNotes` text on the branch record. Stop. Do
   NOT invoke `release-notes-generator` — there is no baseline to diff against.

3. **Both exist** — proceed to Step 4.

### Step 4: Delegate to `release-notes-generator`

Invoke the `release-notes-generator` skill with:

- `--from` = `last_before.id`
- `--to` = `last_in_range.id`

The `release-notes-generator` skill handles the *Compare → Work Items → Diffs
→ Dependencies → Write* pipeline, produces both Technical and Customer
variants, and applies the mandatory work-item-link / business-context / author
requirements. Do not duplicate that guidance here — cross-referencing the
existing skill (rather than duplicating) keeps both in sync as the SOP evolves.

If the operator wants a single pre-enriched structured payload for the target
skill to consume, `dxs source release-notes --from <…> --to <…>
--enrich-workitems --output json` is the command that returns it. Otherwise,
passing just the branch IDs and letting `release-notes-generator` run its own
commands is fine and is the default.

### Step 5: Return the Notes

Return the Technical and Customer notes as the agent's response. This skill
does **not** persist the output to a Knowledge Node, a file, or a messaging
channel — the caller (scheduler, user, downstream automation) decides delivery.

## Tips

1. **Time zones.** `releaseDate` is ISO 8601 with offset. Convert both it and
   `range_start`/`range_end` to the same zone (UTC is safest) before comparing.
   A mismatched zone can shift a release in or out of the range.
2. **Service Pack noise.** Without `--default-group`, `dxs source branch list
   --repo <id>` returns branches from **all** groups, including Service Packs.
   A mid-week Service Pack hotfix could be picked as `last_in_range` and skew
   the comparison. `--default-group` prevents this.
3. **`createdDate` vs `releaseDate`.** They differ by only milliseconds for
   release branches, but this skill uses `releaseDate` because it is the
   semantic field and survives future schema tweaks cleanly.
4. **Idempotency.** Repeated runs for the same `(app, range_start, range_end)`
   yield identical anchor pairs because published releases are immutable. Safe
   to re-run.
5. **Scheduling is external.** Windows Task Scheduler, cron, Azure Functions,
   or a manual invocation all trigger this skill the same way. The scheduler
   is out of scope; this skill only describes the work once invoked.
6. **Empty weeks are normal.** Most low-release-cadence weeks hit Outcome 1 in
   Step 3. "No releases this week" is a valid, expected result — not a failure.

## Example Session

```bash
# Range: 2026-04-13 00:00 UTC → 2026-04-19 23:59:59 UTC
# Application: "thedevapp" in organization "Datex"

# Step 1
dxs --output json organization search "Datex"
# → id: 1 (Datex)

dxs --output json organization app list --org 1
# → name=="thedevapp": id=1, defaultApplicationGroupId=1

# Step 2
dxs --output json source branch list --repo 1 --default-group --status published -n 0
# → branches:
#     id=60  releaseDate=2026-01-06  isLatest=true
#     id=3   releaseDate=2025-10-23  isLatest=false

# Step 3 — anchors for [2026-04-13, 2026-04-19]
# last_before   = branch 60   (largest releaseDate strictly before range_start)
# last_in_range = none          (no release inside the range)
# → Outcome 1: emit "No releases between 2026-04-13 and 2026-04-19 for thedevapp" and stop.

# If last_in_range had existed, Step 4 would run:
#   invoke release-notes-generator with --from=60 --to=<last_in_range.id>
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Picking the first org / app match silently | Fail hard on 0 or >1 match; print candidates and what to do |
| Omitting `--default-group` | Service Pack branches leak into the list and can skew anchors |
| Using `createdDate` instead of `releaseDate` for sorting | Use `releaseDate` — it's the semantic field |
| Invoking `release-notes-generator` when `last_in_range` is absent | Outcome 1: emit the one-line summary and stop |
| Forgetting the "first-ever release" case | Outcome 2: emit Initial Release note; don't diff against nothing |
| Persisting output inside the skill | This skill returns text only; the caller handles delivery |
| Mismatched time zones in range comparison | Convert everything to UTC before comparing |
