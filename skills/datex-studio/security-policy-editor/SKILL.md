---
name: security-policy-editor
description: |
  Use when editing a package's Datex Studio security policy singleton
  (configurationTypeId=28, CLI type `securitypolicy`, fixed referenceName
  `securityPolicy`) on a branch — the app's Content Security Policy additions as
  `contentSecurityPolicy.directives[]` rows of `{directive, value, note}`. Owns
  the singleton rule (one per package, edit in place; delete and re-create only from a saved body, edit
  the own row only), the camelCase directive names (`frameSrc`, `scriptSrcElem`,
  `connectSrc`, ...), one-source-per-row encoding with CSP keyword quoting
  (`"'unsafe-eval'"`, `"'sha256-...'"`), the narrowest-source rule, and the
  embed link (an HTML-string embed needs `frameSrc data:`). Triggers: "allow
  this iframe", "embed renders blank", "add a CSP directive", "Refused to frame",
  "Refused to load the script", "Refused to connect", "edit securityPolicy",
  "EContentSecurityPolicyDirectiveType", "create a security policy".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - embed-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Security Policy Editor

Edit a package's **security policy** singleton (configurationTypeId=28) on a branch — the list of Content Security Policy (CSP) sources the app adds on top of the platform's own policy. Each row allows **one source** for **one directive** (`frameSrc` → `*.powerbi.com`). Every package already has exactly one security policy, with the fixed `referenceName: "securityPolicy"`, and it is empty on nearly every package; this skill only ever **edits** it.

Every row you add loosens the browser's protection. Add the narrowest source that works, say why in `note`, and tell the user what was opened.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/security-policy.md](references/security-policy.md) — Authoritative reference: body shape, directive names, value encoding, observed patterns, pre-flight checklist
- [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md) — Shared lifecycle for every auto-provisioned singleton: own-row discovery, envelope secrets, `readonly`, write path, edit in place, delete and re-create only from a saved body
- [../embed-creator/references/embeds.md](../embed-creator/references/embeds.md#csp-caveats-runtime-not-caught-by-validate) — the embed-side CSP caveats (`frameSrc` for `data:` and URL embeds, `scriptSrc` for an in-document Print button)
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — envelope vs inner body, validate exit codes

## Dependencies

- **`embed-creator`** skill — the usual reason for a `frameSrc` row; read its CSP caveats when the request comes from a blank embed
- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context

## CLI Lifecycle

There is **no create path**: the platform provisions the security policy with the package. Edits go through `dxs configuration` with CLI type **`securitypolicy`** (lowercase), mapping to `configurationTypeId: 28`. Full rules in [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md).

**Edit the branch's own security policy:**

```bash
# 1. Resolve the OWN row — list returns the own row plus one row per direct reference
dxs -O json configuration list securitypolicy -b <branchId> \
  | jq '.configurations[] | select(.applicationId == <branchId> and .isExternal == false) | .id'
# 2. Fetch and extract the body in ONE command (the envelope embeds the appConfig's secrets)
dxs -O json configuration get securitypolicy <ownId> -b <branchId> | jq '.configuration.json' > body.json
# 3. Edit body.json — contentSecurityPolicy.directives[] only
# 4. Validate — gates the push; exit 1 = errors found, not a broken CLI. Catches an unknown directive name
dxs configuration validate securitypolicy -b <branchId> -D body.json
# 5. Push — path A; fallbacks in the lifecycle doc (Rule 5)
dxs configuration upsert securitypolicy -b <branchId> -D body.json
```

### Round-trip rule (critical)

Never pipe an envelope into `upsert` — it silently destroys configuration content ([../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md)). The security-policy envelope also embeds a full copy of the branch's appConfig (plaintext secrets): extract the body in the same command and never print the envelope.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md; confirm the branch with the user
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Identify the blocked load]
  browser console "Refused to frame / load the script / connect"
  -> which directive, which exact source (scheme, host, hash)
  blank embed -> embed-creator CSP caveats (frameSrc data: or the URL origin)
        |
[Phase 3: Resolve own row + fetch]
        |
[Phase 4: Add rows]
  one {directive, value, note} per source; camelCase directive;
  CSP keywords and hashes keep their single quotes inside the JSON string
        |
[Phase 5: Validate + push]
        |
[Phase 6: Runtime check — user's Preview]
  the blocked load now succeeds; nothing broader was opened
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Identify the blocked load

Work from the actual violation, not a guess: the browser console names the CSP directive (kebab-case, e.g. `frame-src`) and the blocked source. Translate to the camelCase directive name (`frameSrc`) and the narrowest source that covers it — a specific host or `*.vendor.com` subdomain wildcard, a script hash, or the `data:` scheme for an HTML-string embed. Never `*`, and never `'unsafe-inline'` / `'unsafe-eval'` unless the library genuinely requires it and the user accepts the trade-off.

### Phase 4: Add rows

- **One source per row.** Three hosts for `connectSrc` = three rows.
- **`directive`** is a member of `EContentSecurityPolicyDirectiveType`, camelCase. In production: `scriptSrc`, `scriptSrcElem`, `connectSrc`, `frameSrc`. Validate also accepts the other fetch directives (`styleSrc`, `imgSrc`, `fontSrc`, ...) but **not** `defaultSrc`, `childSrc`, `manifestSrc`, or the non-source directives — see the [accepted-names table](references/security-policy.md#directive-names). An unknown name fails validate with `Error converting value "<x>" to type '...EContentSecurityPolicyDirectiveType'`.
- **`value`** is the CSP source expression exactly as it appears in a policy header. Keyword and hash sources keep their single quotes inside the JSON string (`"'unsafe-eval'"`, `"'sha256-<base64>'"`); host and scheme sources do not (`"*.powerbi.com"`, `"data:"`).
- **`note`** — say what needs the source (the integration or component), so a later reader can tell whether the row is still needed.

### Phase 6: Runtime check

`validate` checks shape and the directive enum only; whether the browser now allows the load is a runtime fact — `_TODO_ (runtime unverified)` until the user confirms in Preview. Whether a package's policy merges into a consuming application's policy, or only the hosting application's policy applies, is `_TODO_` — populated policies exist on both an application and a package, so the observed bodies don't settle it. Until proven, add the row to the package that owns the component needing the source **and** tell the user the hosting application may need the same row.

## Pre-Flight Checklist

Walk the full checklist in [references/security-policy.md → Pre-Flight Checklist](references/security-policy.md#pre-flight-checklist). The fast version:

1. **Lifecycle basics** — branch confirmed; own row by `applicationId == <branchId>` and `isExternal == false`; edit the existing row; delete and re-create only from a saved body, never a second instance ([../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md)); universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — the body's own `description` stays the provisioned boilerplate.
2. **Directive** camelCase and a known enum member (validate enforces it).
3. **One source per row**; keyword/hash sources single-quoted inside the JSON string.
4. **Narrowest source** — no bare `*`; unsafe keywords only with the user's explicit agreement.
5. **`note`** names the consumer of the source.
6. **No duplicates** — the same `{directive, value}` is not already present.
7. **Validate** before the write; round-trip fetch; no lock left held; user confirms the load in Preview.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/security-policy.md → Common Failure Modes](references/security-policy.md#common-failure-modes). The ones that bite most often:

- **Kebab-case directive** (`frame-src`) — the enum is camelCase (`frameSrc`); validate rejects it. So does `defaultSrc` — there is no fallback directive; add the specific one.
- **Several sources in one `value`** — one source per row.
- **Unquoted keyword** (`unsafe-eval` instead of `'unsafe-eval'`) — the browser reads it as a host name.
- **`*` or `'unsafe-inline'` to "just make it work"** — opens far more than the blocked load needed.
- **Creating a security policy** — one already exists; edit the own row.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
