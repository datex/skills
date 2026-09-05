# Package Cascade — Troubleshooting

## `cascade plan` reports `cycleDetected: true`
A package in the affected subgraph references (transitively) one of its own dependents. STOP —
do not run. Report the packages involved and ask the user to break the circular reference first.

## `reference set` aborts with a version/circular conflict
The new version would leave a package pinned to two different versions of the same transitive
dependency (or introduce a cycle). The CLI refuses to write. Report the conflicting package and
its versions; the user must reconcile (e.g. also update the other direct dependency that pins the
older version) before re-running.

## Publish fails validation ("Cannot publish an invalid application")
That node's feature branch is left intact for inspection. Surface the validation errors, fix the
branch (or hand back to the user), then resume with `--select` of the remaining nodes.

## Publish fails with missing access
The user lacks package-publish rights. Nothing after the failing node ran. Resolve access, then
`dxs source cascade run --plan plan.json --select <remaining uids…>`.

## `cascade run` 404s immediately (`createFeatureBranch` / "There is no application with id <n>")
You are **not logged into the target org**. `cascade plan` is read-only and traverses cross-tenant, so it
plans fine from any identity, but the write side (`createFeatureBranch` → re-pin → publish) is gated to the
owning tenant and 404s on the node's `mainApplicationId` under the wrong identity. **Nothing was mutated**
(the 404 is on branch creation itself — no branch left behind). Fix: confirm the target with the user, then
switch identity into that tenant with `dxs auth login --tenant-id <tenantId>` (the tenantId is on the origin
package's `marketplace search` metadata). Do **not** use `dxs auth switch <name>` — an org *name* only resolves orgs the
current identity already sees and fails `DXS-AUTH-013: Organization '<name>' not found`. After
`dxs auth status` confirms the target org is active, re-plan and re-run. See interaction-patterns.md →
"Target org you're not logged into".

## Publish call times out on a slow build (handled automatically — do NOT abort or re-run)
Publishing can block on a build: in **local dev the API runs codegen + `ng build` inline**, which
often outlasts a normal HTTP timeout. `cascade run` handles this itself, so a `DXS-API-TIMEOUT`
during publish is **not** a failure to react to:
- The publish call already uses a longer, dedicated timeout — the `publish_timeout` setting
  (default 300s).
- If it still times out, `cascade run` **confirms the version exists server-side** (the version
  record is committed before the build runs) and continues, feeding that version forward to
  dependents. The node comes back flagged `confirmedAfterTimeout: true` and is narrated as
  `✓ <pkg> → <version> (publish call timed out; version confirmed on server — build may still be running)`.
  **Treat this as success** — the version published; only its container image may still be building.
- Only if no matching version is found after the timeout does the run stop with a real error. Then
  resume the remaining nodes with `--select` once resolved.

So on a timeout: do nothing special — let the run finish. Do **not** re-run the whole cascade (that
would try to republish already-published nodes). For a genuinely slow machine, raise the ceiling
once with `dxs settings set publish_timeout <seconds>`.

## Lock contention on `appConfig`
Another branch/user holds the lock. Use `dxs source locks --repo <id>` to find the holder; resolve,
then re-run the affected node via `--select`.

## `branch commit` returns a non-null `newBranchId`
Not all changed configs on that feature branch were committed, so the API split the remainder off
into a new feature branch (`newBranchId`). Report that branch id to the user so they can inspect
or finish it separately. This is unusual for the cascade specifically, since each node's commit
only touches `appConfig` (the re-pin) — nothing else should be left uncommitted.

## Resume after a partial run
Completed nodes are already committed + published (their versions are final). Re-run with
`--select` listing only the nodes that did not complete. Because published versions are read back
from the server and fed forward, a fresh `cascade plan` + `cascade run` also converges (already-
current pins are detected by `reference set` as no-ops).

## Plan is empty or missing packages you expected (reads as "up to date" / nothing to do)
Two common causes — check in this order:

1. **Wrong origin `uniqueIdentifier` (the display name was passed to `-p`).** `-p` must be the package's
   resolved `uniqueIdentifier`, not its display name. The uniqueIdentifier strips spaces/underscores from the
   name (display `pkg_cascade_mid` → uid `pkgcascademid`), and `cascade plan` matches it by **exact string
   equality** — so a display name such as `pkg_cascade_leaf` matches no published package and yields an empty
   plan with no error, indistinguishable from "no consumers." Re-resolve via
   `dxs -O json marketplace search "<name>" --type componentmodule` and confirm the id finds consumers with
   `dxs -O json source referenced-from <uid> --org <orgId>` before re-planning.
2. **Wrong target org (or none).** `--org <id>` scopes the traversal to a single tenant; consumers owned by
   other orgs are excluded by design. Re-check the org you resolved in Phase 0 (`dxs -O json organization
   list` / `organization mine`) and re-run `cascade plan` with the right `--org`. Omitting `--org` traverses
   every tenant — usually not what you want.

## A stale application needs updating
Applications are never auto-published. For each entry in `staleApplications`, update it separately
(e.g. via its own feature branch: `dxs source reference set -b <appFeature> -p <package> -v
<newVersion>` → commit), following the application's own release process.
