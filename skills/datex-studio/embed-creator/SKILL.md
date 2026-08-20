---
name: embed-creator
description: |
  Use when authoring or modifying a Datex Studio embed (configurationTypeId=20,
  *-embed.json suffix, CLI type `embed`) on a branch — an iframe-hosting component
  that renders an external URL or an in-memory HTML string in a dialog or inline
  panel. Owns the iframe-only rule (no srcdoc, no inline-HTML type), the
  `data:text/html` URI pattern for rendering an HTML string, the
  `$shell.open<name>Dialog` wiring (package-scoped when the embed lives in a module), and the in-iframe `window.print()` print
  pattern. Triggers: "create an embed", "render HTML in a dialog", "preview/print
  HTML", "embed a map/iframe", "show an external page in a dialog", "$embed iframe
  is blank", "print button does nothing in the preview".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - form-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Embed Creator

Author or modify a Datex Studio embed (configurationTypeId=20) on a branch — a thin UI component whose entire surface is a single `<iframe>`. An embed renders either an **external URL** (a hosted map, dashboard, document viewer) or an **in-memory HTML string** (a generated email/report preview) and is almost always opened as a dialog via `$shell.open<referenceName>Dialog(...)` (prefixed with the embed's package when it's registered under a module).

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/embeds.md](references/embeds.md) — Authoritative embed authoring reference: file shape, minimal-valid skeleton, the iframe-only rule, the `data:` URI HTML-string pattern, dialog wiring, the print pattern, CSP caveats, pre-flight checklist
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule (applies to `iframeConfig.href`)
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_embed`/`-embed` suffix, filename-stem matching, display-name rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — platform-injected globals available in embed code (`$embed`, `$shell`, `$datasources`, `$utils`, ...)
- [../form-creator/references/forms.md](../form-creator/references/forms.md) — sibling component; pick a form when you need field controls/buttons alongside the content (the form-vs-embed decision)
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — host reference contracts, vars-must-be-declared rule, `moduleId` rule for the component that opens the embed

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`form-creator`** skill — invoked when the requirement actually needs field controls or a toolbar next to the content (an embed is iframe-only; it has no button surface)
- **`component-wiring-check`** skill — invoked to audit the `configParameters` ↔ `inParams` contract on the component that opens the embed before push

## CLI Lifecycle

Embed authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs embed` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`embed`** (lowercase), mapping to `configurationTypeId: 20`.

**Create a new embed:**

```bash
# 1. Build body.json from scratch (see references/embeds.md → Minimal Valid Skeleton)
# 2. Validate — gates the push; exit 1 = errors found, not a broken CLI. Catches the "HREF is required" failure before push
dxs configuration validate embed -b <branchId> -D body.json
# 3. Create (upsert creates or updates by referenceName)
dxs configuration upsert embed -b <branchId> -D body.json
```

**Edit an existing embed:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get embed <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate embed -b <branchId> -D body.json
# 5. Push
dxs configuration upsert embed -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. Always `jq .json envelope.json > body.json` before editing. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Embed vs Form decision]
Consult references/embeds.md → "Purpose & When to Use":
  - render a URL or an HTML blob, no controls needed   -> embed
  - needs field inputs, a toolbar, or a Print button
    that lives outside the rendered content            -> form (or put the
                                                          control inside the HTML)
If field controls/toolbar are required -> invoke `form-creator` and stop here.
        |
[Phase 3: Pick the source — URL or HTML string]
  URL          -> iframeConfig.href points at the URL (directly or via a var
                  computed in on_init). Example: a hosted map.
  HTML string  -> on_init sets a var to a data:text/html URI built from the
                  HTML; iframeConfig.href points at that var.
        |
[Phase 4: Author embed body]
Build body.json from references/embeds.md → Minimal Valid Skeleton:
  - type: "iframe"  (the only supported designer type)
  - iframeConfig.href  (REQUIRED — a TS expression, usually $embed.vars.<url>)
  - inParams[]  (the URL / HTML / id the host passes in)
  - vars[]  (the computed href var)
  - onInitFlowConfig -> on_init flow that computes the href var
        |
[Phase 5: Validate + push]
dxs configuration validate embed -b <branchId> -D body.json
dxs configuration upsert  embed -b <branchId> -D body.json
        |
[Phase 6: Wire the opener + verify]
Caller opens it: $shell.open<referenceName>Dialog(inParamsObj, 'flyout', EModalSize.Xlarge)  (+ <Package>. segment if the embed is in a module)
Verify in Studio: iframe renders; if HTML preview, the in-document Print button works
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Embed vs Form decision

An embed's entire visible surface is the iframe — **it has no field controls, no toolbar, and no button surface**. Pick an **embed** when the requirement is purely "render this URL/HTML in a dialog or panel." Pick a **form** instead when the dialog needs inputs, a validate-then-confirm flow, or chrome (a header, a toolbar) around the content. If you need a button *and* rendered HTML, the pragmatic move is to put the button **inside the HTML** (see the Print pattern) rather than reaching for a form — a form cannot host an iframe (there is no iframe field control).

### Phase 3: Pick the source — URL or HTML string

`iframeConfig.href` is the only content channel. There is **no `srcdoc`** and **no inline-HTML embed type** — for this skill `type` is always `iframe` (the enum's other member, `powerBi`, is unsupported by codegen and restricted in the Studio UI; see Common Mistakes). So:

- **External URL** — compute or hardcode the URL into the href var in `on_init`. Build query params from `$embed.inParams`.
- **In-memory HTML string** — convert the string to a `data:` URI in `on_init`:

  ```ts
  $embed.vars.ref_url = "data:text/html;charset=utf-8," + encodeURIComponent($embed.inParams.html);
  ```

  and point `iframeConfig.href` at `"$embed.vars.ref_url"`. This is the canonical way to render generated HTML (an email preview, a report proof) in a dialog. See [references/embeds.md → Rendering an HTML String](references/embeds.md#rendering-an-html-string).

### Phase 4: Author embed body

Build `body.json` from [references/embeds.md → Minimal Valid Skeleton](references/embeds.md#minimal-valid-skeleton). Key points:

1. **File basics.** `configurationTypeId: 20`, suffix `-embed.json`, `referenceName` ends `_embed` and matches the filename stem. Plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — `description` non-null and ≤100 chars.
2. **`type: "iframe"`.** The only codegen-supported `EEmbedDesignerType`. The enum also defines `powerBi`, but it is not fully supported by codegen and is restricted in the Studio UI — **never author it**. Non-member values (`html`, `script`, `content`, `code`) fail validation outright.
3. **`iframeConfig.href` is required and is a TypeScript expression.** A bare `$embed.vars.ref_url` is a raw expression (unwrapped). A literal URL must be a TS string literal (`"'https://example.com'"`) — but prefer computing it in `on_init` and binding the var, as the URL almost always depends on `inParams`. See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).
4. **Declare every `$embed.vars.<id>` you write.** The href var (and any other) must appear in top-level `vars[]`, or the write fails. Same rule as editors/forms.
5. **`on_init` computes the href.** The `onInitFlowConfig` flow (a `configurationTypeId: 9` embedded flow) is where you read `$embed.inParams`, build the URL or `data:` URI, and assign the href var.

### Phase 6: Wire the opener + verify

The component that opens the embed (an editor flow, a hub toolbar button, a grid row action) calls the auto-generated shell method:

```ts
// top-level embed (no package):
await $shell.opencustom_email_preview_embedDialog({ html: previewHtml }, 'flyout', EModalSize.Xlarge);
// embed registered under a package:
await $shell.<Package>.opencustom_email_preview_embedDialog({ html: previewHtml }, 'flyout', EModalSize.Xlarge);
```

The method is `open` + the embed's `referenceName` + `Dialog` (snake_case preserved). It carries a **package segment only when the embed is registered under a package/module** — a top-level application embed is opened as `$shell.open<referenceName>Dialog(...)` with no segment. When there is a package, `<Package>` is the **embed's own** module, not the caller's. The inParam object is generated from the embed's `inParams`; the host must carry a full `configParameters` contract for those inParams (and, for a packaged embed, set `moduleId` to the embed's package) — audit with `component-wiring-check`.

Verify in Studio: the iframe renders the URL/HTML; for an HTML preview, confirm the in-document **Print** button prints just the embedded content (see the Print pattern and its caveats).

## Pre-Flight Checklist

Walk the full checklist in [references/embeds.md → Pre-Flight Checklist](references/embeds.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 20`, suffix `-embed.json`, `referenceName` ends in `_embed` and matches the filename stem, `title` a distinct sentence-case display name — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **`type: "iframe"`** — the only codegen-supported type; never author `powerBi` (defined but unsupported).
3. **`iframeConfig.href` present** — omitting it fails with `HREF is required`.
4. **Href var declared** in top-level `vars[]` and assigned in `on_init`.
5. **HTML-string embeds** build the `data:text/html;charset=utf-8,` + `encodeURIComponent(...)` URI; they do **not** rely on `srcdoc`.
6. **Print button (if a preview)** lives inside the HTML (`onclick="window.print()"`), hidden via `@media print` — never assume the parent can call into the iframe.
7. **Opener contract** — the host declares a `configParameters` entry for every embed `inParam`; audit via `component-wiring-check`.
8. **`description`** non-null, non-empty, ≤100 chars.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/embeds.md → Common Failure Modes](references/embeds.md#common-failure-modes). The gotchas that bite most often when authoring:

- **`srcdoc`, or a non-`iframe` `type` (`html`/`script`/`content`), to inject markup inline** — none are supported; render the HTML through a `data:text/html` URI on `href`.
- **Omitting `iframeConfig.href`** — fails validation with `HREF is required`; it is the only content channel.
- **Writing `$embed.vars.<id>` without declaring it in `vars[]`** — the write fails.
- **Hardcoding a literal URL unwrapped in `href`** — `href` is a TS expression; TS-quote it (`"'https://...'"`) or compute it in `on_init`.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content; `jq .json envelope.json > body.json` first.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
