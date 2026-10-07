# Security Policy — Authoring Reference

Authoritative reference for the Datex Studio **security policy** singleton (`configurationTypeId: 28`, CLI type `securitypolicy`, fixed `referenceName: "securityPolicy"`). Every application and package has exactly one. It holds the Content Security Policy (CSP) sources the app adds to the platform's own policy, one `{directive, value, note}` row per source. The shared singleton lifecycle (own-row discovery, envelope secrets, write path, edit in place, delete and re-create only from a saved body) lives in [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) and is not repeated here.

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Edit the security policy when the browser blocks something the app legitimately needs:

- an **embed** whose iframe renders blank — a `data:` HTML-string embed or an external URL ([../../embed-creator/references/embeds.md → CSP Caveats](../../embed-creator/references/embeds.md#csp-caveats-runtime-not-caught-by-validate));
- a **third-party script** (a feedback widget, an analytics or reporting library) that must load or call home;
- an **embedded dashboard** or document viewer from an external host (e.g. Power BI).

Do not use it to "fix" a problem the console doesn't attribute to CSP. The policy is empty on nearly every package; a populated one is the exception.

## File Location & Naming

- `configurationTypeId: 28`; CLI type `securitypolicy`; fixed `referenceName: "securityPolicy"`, `title: "Security Policy"`, `description: "Security Policy"` — provisioned, never changed.
- Conventional file name: `securityPolicy-securityPolicy.json` if the body is kept on disk — a naming convention only; the branch is the system of record.
- Directive names are camelCase members of `EContentSecurityPolicyDirectiveType` (the browser's kebab-case `frame-src` is `frameSrc` here).

## Minimal Valid Skeleton

The shape as provisioned (empty) — recognise and edit against it; push it only as a restore of a deleted row, never as a second instance:

```json
{
  "contentSecurityPolicy": { "directives": [] },
  "configurationTypeId": 28,
  "id": <ownId>,
  "referenceName": "securityPolicy",
  "title": "Security Policy",
  "description": "Security Policy",
  "accessModifier": "public"
}
```

With one row allowing HTML-string embeds (validated clean):

```json
"contentSecurityPolicy": {
  "directives": [
    { "directive": "frameSrc", "value": "data:", "note": "HTML-string preview embeds" }
  ]
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `contentSecurityPolicy.directives` | CSP source rows | `[{ directive, value, note }]`; `[]` as provisioned. |
| `configurationTypeId` | Type | `28`. |
| `id` | Own singleton id | Must equal the own row's id. |
| `referenceName` / `title` / `description` | Identity | Fixed boilerplate; leave verbatim. |
| `accessModifier` | Visibility | `"public"`. |

Row fields:

| Field | Meaning | Encoding |
|---|---|---|
| `directive` | Which CSP directive the source is added to | camelCase enum member (below). |
| `value` | **One** CSP source expression | As written in a CSP header: keyword/hash sources keep single quotes inside the JSON string (`"'unsafe-eval'"`, `"'sha256-<base64>'"`); host and scheme sources do not (`"*.vendor.com"`, `"https://api.vendor.com"`, `"data:"`). |
| `note` | Why the source is needed | Free text; name the integration or component. Empty string is accepted. |

### Directive names

`EContentSecurityPolicyDirectiveType` has exactly 16 members, all camelCase strings, and the designer's directive dropdown lists exactly these (captured from the Studio designer (option lists), dxs 0.5.8): `baseUri`, `connectSrc`, `fontSrc`, `formAction`, `frameAncestors`, `frameSrc`, `imgSrc`, `mediaSrc`, `objectSrc`, `scriptSrc`, `scriptSrcAttr`, `scriptSrcElem`, `styleSrc`, `styleSrcAttr`, `styleSrcElem`, `workerSrc`. `validate` names the enum on a bad value but never lists its members; probing the standard CSP directive names against it agrees with the designer list:

| Accepted | Rejected |
|---|---|
| `scriptSrc`, `scriptSrcElem`, `scriptSrcAttr`, `styleSrc`, `styleSrcElem`, `styleSrcAttr`, `connectSrc`, `frameSrc`, `imgSrc`, `fontSrc`, `mediaSrc`, `workerSrc`, `objectSrc`, `formAction`, `frameAncestors`, `baseUri` | `defaultSrc`, `childSrc`, `manifestSrc`, `sandbox`, `reportUri`, `reportTo`, `upgradeInsecureRequests`, `prefetchSrc`, `navigateTo`, `requireTrustedTypesFor`, `trustedTypes`, `blockAllMixedContent`, `pluginTypes`, and any kebab-case name (`frame-src`) |

Only `scriptSrc`, `scriptSrcElem`, `connectSrc`, and `frameSrc` appear in production bodies. Being accepted by validate does not prove the directive reaches the served policy — the runtime effect of the 12 members not seen in production bodies is `_TODO_ (runtime unverified)` (the designer only edits the list). Parsing is case-insensitive (`FrameSrc` validates), but write the camelCase form.

## Runtime Globals

N/A — the security policy has no code strings and no runtime global. Its effect is the CSP the browser enforces on the running app.

## Invocation Contract

- Nothing references the security policy by name; there is no `configParameters`/`moduleId` wiring and nothing for `reverse-trace` to find. The coupling is to whatever **loads** the source (an embed `href`, a script tag a library injects, a `fetch` target) — note it in `note`.
- **Removing a row** can silently break that integration at runtime; ask the user, using `note` to identify the consumer.
- **Merge scope** — whether a package's rows merge into a consuming application's served policy, or only the hosting application's policy applies, is `_TODO_`. Populated policies exist on both an application and a package. Until proven, add the row to the package that owns the component needing the source and tell the user the hosting application may need the same row.
- Runtime effect of any edit is `_TODO_ (runtime unverified)` until the user confirms the blocked load succeeds in Preview.

## Common Patterns

Observed in production policies (sources generalised):

### Embedded external dashboard

```json
{ "directive": "frameSrc", "value": "*.powerbi.com", "note": "Power BI embedded reports" }
```

An embedded analytics vendor needs a `frameSrc` row for its embed host **and** a `connectSrc` row for its API host — two rows.

### Third-party feedback widget

The widget's loader is pinned by hash and its host allowed for script elements, plus the hosts it calls:

```json
{ "directive": "scriptSrcElem", "value": "'sha256-<base64>'", "note": "feedback widget loader" },
{ "directive": "scriptSrcElem", "value": "*.widgetvendor.com", "note": "feedback widget" },
{ "directive": "connectSrc",    "value": "*.widgetvendor.com", "note": "feedback widget" },
{ "directive": "connectSrc",    "value": "*.amazonaws.com",    "note": "feedback widget uploads" }
```

Prefer a hash over a broader host where the script content is fixed. One leftover hash row with the note "not sure" was observed — exactly what a good `note` prevents.

### Reporting library that evaluates code

```json
{ "directive": "scriptSrc", "value": "'unsafe-eval'", "note": "reporting library viewer" }
```

`'unsafe-eval'` weakens the policy for the whole app — add it only when the library requires it and the user accepts it.

### HTML-string embed

```json
{ "directive": "frameSrc", "value": "data:", "note": "HTML-string preview embeds" }
```

Pairs with an embed whose `href` is a `data:text/html` URI ([../../embed-creator/references/embeds.md](../../embed-creator/references/embeds.md#rendering-an-html-string)). An in-document Print button may additionally depend on the script policy for its inline `onclick`.

### Remove a directive row

Nothing references the policy by name, so `reverse-trace` cannot show who still needs a source. Before removing a row, search every component body on the branch (embeds, custom Angular components, script loaders, `fetch` targets) for the row's host or URL, and read the row's `note` for the consumer; if any component still needs the source, keep the row.

```bash
jq 'del(.contentSecurityPolicy.directives[] | select(.directive=="<directive>" and .value=="<value>"))' \
  body.json > body.next.json && mv body.next.json body.json
```

Match on both `directive` and `value`: the same value is often present under several directives (`frameSrc` and `connectSrc` for one vendor), and each row is removed on its own. As with adding a row, the runtime effect is unverified until the user confirms in Preview that the integration still loads.

## Pre-Flight Checklist

1. **Lifecycle** — branch confirmed; own row by `applicationId == <branchId>` and `isExternal == false`; edit the existing row; delete and re-create only from a saved body, never a second instance ([../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md)). The body's `description` stays the provisioned boilerplate ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)).
2. **Evidence** — the row answers a specific console violation (directive + blocked source), not a guess.
3. **Directive** — camelCase, in the accepted table.
4. **One source per row**, encoded per the table (keywords and hashes single-quoted).
5. **Narrowest source** — specific host or subdomain wildcard; never bare `*`; `'unsafe-inline'` / `'unsafe-eval'` only with explicit user agreement.
6. **`note`** names the consumer.
7. **No duplicate** `{directive, value}` pair.
8. **Scope** — only `contentSecurityPolicy.directives` edited; tail unchanged.
9. **Validate** before the write; round-trip fetch; no lock left held; Preview confirmation requested from the user.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `Error converting value "<x>" to type '...EContentSecurityPolicyDirectiveType'` | Kebab-case or unsupported directive (`frame-src`, `defaultSrc`, `childSrc`) | Use the camelCase accepted name for the specific directive. |
| Embed still blank after the edit | Wrong directive/source, or the row sits in a policy that isn't served for the hosting app (merge scope `_TODO_`) | Re-read the console violation; try the hosting application's policy. |
| Source still blocked | Several sources in one `value`, or a keyword without its single quotes (read as a host) | One source per row; `"'unsafe-eval'"`, `"'sha256-…'"`. |
| Integration broke after a cleanup | A row removed whose consumer wasn't obvious | Restore it; write a `note` that names the consumer. |
| Push went to the wrong row | Body `id` from a dependency row | Re-resolve the own row. |

## Cross-References

- [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) — own-row discovery, envelope secrets, `readonly`, write path.
- [../../embed-creator/references/embeds.md](../../embed-creator/references/embeds.md) — embed CSP caveats and the `data:` URI pattern.
- [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — validate exit codes, lock failure modes.
