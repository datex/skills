# Package Cascade — Runbook

Exact `dxs` commands for each phase. Assumes the origin package is already published.

## Phase 0 — Establish origin + target org (input = a package name)
1. Resolve the package name the user gave → its `uniqueIdentifier`:
   ```bash
   dxs -O json marketplace search "<name>" --type componentmodule   # returns uniqueIdentifier
   ```
   Use `marketplace search` / `marketplace list` here, **not** `source repo search`: the cascade origin
   is an already-published package, and only the marketplace surface returns packages visible to the
   caller across orgs. A customer re-pinning a **referenced Datex package** would not find it via
   `repo search` (that lists only the caller's own-org repos). `--type componentmodule` maps to
   `MarketPlaceApplicationType` (6), NOT the `applicationDefinitionTypeId` value `3` the plan uses; the CLI
   does the name→id mapping, and the two enums overlap, so never hand-pass raw numbers. If more than one package matches, show them and let the user pick
   the right `uniqueIdentifier`. If a Datex package returns nothing, it isn't public or granted to the
   target org yet — resolve that first, or the re-pin cannot resolve its version.

   **Pass the resolved `uniqueIdentifier` to `-p` verbatim — never the display name the user typed.** The
   uniqueIdentifier is a normalized form of the name with spaces and underscores stripped (display name
   `pkg_cascade_mid` → uid `pkgcascademid`); `cascade plan` matches it by **exact string equality**, so a
   display name — even one that already looks like an identifier (e.g. `pkg_cascade_leaf`) — matches no
   published package and returns an empty plan with no error, reading as "nothing to do." Do **not** skip
   this resolution just because the name the user gave looks id-shaped. Sanity-check the resolved id before
   planning: `dxs -O json source referenced-from <uid> --org <orgId>` should list the expected consumers; an
   empty result here means the id (or org) is wrong, not that nothing depends on the package.
2. Establish the origin's newly-published `versionName`. The user published the origin themselves,
   so **take the version from them** — do not look it up. If they are unsure, they must find the
   version they just published before continuing.
3. Choose the **target organization** — the tenant whose packages will be re-pinned and republished.
   This is the *consumer* org and may differ from the org that owns the origin package (e.g. sync
   your own org's packages that reference Datex's `Utilities`). Resolve it:
   ```bash
   dxs -O json organization list
   ```
   - Exactly **one** org returned **and the user did not name a different one** → use it silently, no prompt.
   - **More than one** (Datex members see every tenant) → run the org-selection prompt in
     [interaction-patterns.md](interaction-patterns.md) → "Choosing the target organization".
   - **The user named an org that is NOT in the list** (e.g. "sync the Datex org" while your identity
     only sees your own tenant) → you are **not logged into the target**. Do **not** silently fall back
     to a visible org, and do **not** just plan-and-fail. Go to step 3a.
3a. **Target org you're not logged into → confirm + switch identity.** `organization list`/`show`/`search`
   only surface orgs the *active identity* can see, and `cascade plan` is read-only and traverses
   cross-tenant, so it will happily plan an org you cannot write to — the failure surfaces only at
   `cascade run` (a 404 on the node's `mainApplicationId`). When the named target isn't visible:
   1. **Identify** it: `dxs -O json organization show <id>` returns 404, `organization search "<name>"`
      is empty, or a run 404s on `createFeatureBranch`. (`dxs auth switch <name>` also fails
      `DXS-AUTH-013: Organization '<name>' not found` — `switch` only resolves orgs the current identity
      already knows, so it is the wrong tool here.)
   2. **Confirm the target and the switch** with the user via two interactive prompts — see
      [interaction-patterns.md](interaction-patterns.md) → "Target org you're not logged into". Never
      switch identity without an explicit go-ahead.
   3. **Log into the target tenant** (device-code flow — **interactive, the user completes it in a
      browser**; you cannot finish it for them, so surface the code + URL and wait):
      ```bash
      dxs auth login --tenant-id <tenantId>   # reliable — bypasses org-name resolution. The tenantId is on
                                              # the origin package's marketplace metadata: `dxs -O json
                                              # marketplace search "<name>" --type componentmodule` → tenantId
      dxs auth login <OrgName>                # documented alt (auth login --help); may not resolve for an
                                              # org your identity can't see, so prefer --tenant-id
      ```
   4. **Verify** before proceeding: `dxs auth status` shows the target org active and
      `dxs organization show <id>` now returns (it 404'd before). Then **re-plan under the new identity**
      (Phase 1) and continue — the plan is stable, but re-planning confirms write access.
4. **Confirm with the user**: "origin = `<uniqueIdentifier>` @ `<versionName>`, syncing packages in
   org `<orgName>` (id `<orgId>`) — correct?" A wrong version poisons every downstream pin and a
   wrong org syncs the wrong tenant, so this is a gate. If the origin has no published version,
   STOP — the user must publish it first (their job, not this skill's).

## Phase 1 — Plan
```bash
dxs -O json source cascade plan -p <uniqueIdentifier> -v <versionName> --org <orgId> > plan.json
```
`--org` scopes the whole traversal to the target org: only that tenant's packages are planned;
consumers in other tenants are excluded (they could not be republished anyway — publishing is
gated to the owning org). Read `plan.json`. If `cycleDetected` is `true`, STOP and report the cycle
(see troubleshooting).

The `-O json` output wraps the plan under a `cascade_plan` envelope key. Keep the redirected file
as-is — Phase 3's `--plan` accepts the wrapped file directly (`cascade run` unwraps the envelope
itself). Unwrap only when *reading* plan fields, e.g. `jq .cascade_plan.levels plan.json` (the
unwrapped shape is documented in [plan-schema.md](plan-schema.md)).

## Phase 2 — Present & select
Render the plan as a tree and ask ALL / subset / review-only — see
[interaction-patterns.md](interaction-patterns.md). The plan shape is documented in
[plan-schema.md](plan-schema.md). If the user picks a subset, pass `--select` per chosen
package in Phase 3 — but note the CLI does **not** prune dependents for you. Deselecting a
package while leaving one of its dependents selected makes `cascade run` fail when it reaches
that dependent (its dependency's new version is unknown) — and by then nodes on earlier levels
have already published. So when the user deselects an intermediate package, **you drop every
node that depends on it (directly or transitively) from `--select` as well**, by following the
`updates` edges in the plan the CLI produced, and tell the user which nodes were pruned and why
(see [interaction-patterns.md](interaction-patterns.md) → "The pick prompt").

## Phase 3 — Execute (bottom-up)
Default (let the CLI run the mechanical loop, feeding each publish's version forward):
```bash
dxs source cascade run --plan plan.json                       # all
dxs source cascade run --plan plan.json --select <uid> --select <uid>   # subset
dxs source cascade run --plan plan.json --dry-run             # preview the ordered steps only
dxs source cascade run --plan plan.json --release-notes "<notes>"       # attach release notes
```
`--release-notes` applies the **same** text to every node republished in that run — it is not
per-node (see below for per-node notes). Narrate progress from the CLI's per-node output
(`✓ <package> → <version>`). A node may come back flagged `confirmedAfterTimeout: true` — the
publish HTTP call timed out on a slow local build but `cascade run` confirmed the version landed and
continued. This is a **success**, not an error (the build may still be finishing); do not re-run. See
[troubleshooting.md](troubleshooting.md) → "Publish call times out on a slow build".

**Richer commits/release notes (known limitation):** `cascade run` performs the whole
create → re-pin → commit → publish loop itself, forking each node's feature branch directly off
the plan's `mainApplicationId` via the source-control endpoint. `dxs source branch create --repo`
is **not** a substitute for that step: `--repo` expects a *repository* (ApplicationDefinition) id
and resolves that repo's Main branch internally, whereas a plan node's `mainApplicationId` is
already a specific Main branch's own Application id — a different id space that `branch create`
does not accept.

For a node-specific touch, the current recommendation is to run `cascade run --plan plan.json
--select <uid> --release-notes "<notes>"` once per node instead of one batch run — this gives
per-node release notes, but the commit message stays generic (the CLI always writes
`chore(deps): cascade update <uid>`; there is no `--commit-message` flag). Fully custom per-node
commit messages via the raw primitives (`branch create` / `reference set` / `branch commit` /
`branch publish`) would require first resolving each node's *repository* id separately, which the
plan does not provide — treat this as a known limitation rather than passing a Main-branch id to
`branch create`.

Capture each publish's `published_version.versionName` and use it as the `toVersion` for that
package's dependents (the CLI's `cascade run` does this automatically).

## Phase 4 — Report
Summarise: packages republished (with new versions) from the run output's `published[]`, and the
`staleApplications[]` the user must update separately (each with the package + new version to pin).
