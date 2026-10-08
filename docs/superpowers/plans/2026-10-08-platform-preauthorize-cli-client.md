# Platform — pre-authorize the CLI client on every Agent backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Every backend app registration the platform creates or re-provisions lists the Datex Studio CLI client (used by dxs and fpx) as an authorized client application for `access_as_user`, so nobody pre-authorizes it by hand.

**Architecture:** One configurable list of client ids, applied inside the existing `PreAuthorizeFrontendForBackend` step, next to the app's own frontend. Existing apps pick it up through Manager's existing "Provision on Azure" action, which re-runs the idempotent provisioning; no new endpoint.

**Tech Stack:** .NET 9, Microsoft Graph SDK, xUnit.

**Spec/decision source:** `C:\Users\pgyoshev\.claude\plans\now-i-have-got-soft-rain.md` (Part 2, item 1), approved by Parvan 2026-10-08.

## Global Constraints
- Repo `D:\Git\248960_agent`, branch `feature/248960_agent_applications`; commit locally, never push, never `git stash`; never stage the modified spec or untracked files.
- Commit trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- The user's DatexApplicationApi.exe runs: never stop/kill/restart it; build/test with `-c Release`.
- No certificate support, no Manager UI changes, no change to the secret-per-provisioning behaviour.

## Review Focus
1. The frontend stays pre-authorized exactly as before (same app id, same permission ids, `KnownClientApplications` unchanged).
2. Re-provisioning an app that already lists the CLI client produces the same list, with no duplicates.
3. A configured list that is empty, or contains the frontend's own id, behaves sensibly (no duplicate entries, no crash).
4. The permission id used is the backend's `access_as_user` scope id, read from the registration, not a constant.

### Task 1: Configured pre-authorized clients

**Files:** `DatexApplicationApi.Infrastructure/Services/Azure/AzureManagementService.cs` (`PreAuthorizeFrontendForBackend` ~:565-586), the `AzureOptions`/`AppRegistration` options class and `appsettings*.json` where `AppRegistration` is configured, tests in `DatexApplicationApi.Tests` beside any existing Azure service tests.

- [ ] **Failing tests first** (Graph mocked the way existing tests mock it; if `AzureManagementService` has no tests, extract the pre-authorized-list construction into a pure static helper and test that): the patched `PreAuthorizedApplications` contains the frontend and each configured id (deduplicated, frontend first), each with the backend's `access_as_user` scope id; empty config gives the frontend only; `KnownClientApplications` still lists only the frontend.
- [ ] Add `AppRegistration.PreAuthorizedClientIds` (string list) with default `["9640be1f-31b2-4970-85a1-2fc78fab9731"]` in the base `appsettings.json` (check how other `AppRegistration` options are defaulted and documented, follow it).
- [ ] Implement; build `dotnet build -c Release`; run the new tests, then `dotnet test -c Release --filter "FullyQualifiedName~Azure|FullyQualifiedName~Agent"` and the full suite.
- [ ] Commit — `feat(azure): pre-authorize configured CLI clients on every backend registration`.

### Task 2: Live check (Parvan)
Create a new Agent app on dev → its backend registration lists the CLI client under Expose an API → Authorized client applications. For an existing app, click "Provision on Azure" in Manager → same result.
