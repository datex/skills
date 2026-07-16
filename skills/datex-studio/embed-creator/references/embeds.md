# Embeds — Authoring Reference

Authoritative reference for Datex Studio **embed** components (`configurationTypeId: 20`, CLI type `embed`, `-embed.json` suffix). An embed is a single-`<iframe>` UI component used to render an external URL or an in-memory HTML string, almost always opened as a dialog.

> Provenance: distilled from the Watco `custom_atlist_map` embed (renders a hosted map) and the `custom_email_preview` embed (renders a generated appointment-email HTML string with an in-iframe Print button). Body shapes and validation behavior below were confirmed against `dxs configuration validate embed` on a live branch (CLI 0.4.9).

## Purpose & When to Use

Pick an **embed** when the requirement is "render this URL or this HTML in a dialog/panel," with **no** field inputs, toolbar, or chrome of your own. The embed's entire surface is the iframe.

Pick a **form** ([../../form-creator/references/forms.md](../../form-creator/references/forms.md)) instead when the dialog needs inputs, a validate-then-confirm flow, or a toolbar. A form **cannot** host an iframe (there is no iframe field control), so when you need both rendered HTML *and* a button, either:

- put the button **inside** the HTML you render (see [The Print Pattern](#the-print-pattern)), or
- host the URL/HTML in an embed and treat any surrounding controls as a separate concern.

## File Location & Naming

- `configurationTypeId: 20`
- File suffix `-embed.json`; `referenceName` matches the filename stem and **ends in `_embed`** — the type indicator is mandatory (a name lacking it is a naming violation per [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md#component-naming-matrix)). E.g. `custom_email_preview_embed`, `custom_atlist_map_embed`.
- `title` is the **user-facing** display name (embeds open as dialogs), so it must be a distinct, sentence-case phrase — **never** byte-identical to `referenceName` (see [../../datex-studio-conventions/naming-conventions.md → Display Names for User-Facing Components](../../datex-studio-conventions/naming-conventions.md#display-names-for-user-facing-components)).
- `description` mandatory, non-empty, ≤100 chars (SQL column limit).
- Provenance prefix per [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) (`custom_` for bespoke app components, `tailored_` for overlays).

## Required Top-Level Fields

Top-level keys on the embed body (the inner `.json`, not the envelope):

| Key | Required | Notes |
|---|---|---|
| `type` | yes | `EEmbedDesignerType`. **Always `"iframe"`** — the only codegen-supported type. The enum also defines `powerBi`, but it is not fully supported by codegen and is restricted in the Studio UI; **never author it**. Non-member values (`html`/`script`/`content`/`code`) are rejected outright. |
| `iframeConfig` | yes | `{ "href": <TS expression> }`. `href` is **required** (`HREF is required` otherwise). No `srcdoc` support. |
| `onInitFlowConfig` | usually required | `{ "flowId": "on_init" }` — the lifecycle hook that computes the href. **Effectively mandatory whenever `href` binds to a var** (the common case): without it the bound var is never assigned and the iframe renders blank. Omit only when `href` is a self-contained literal. |
| `flows` | usually required | Embedded flows (`configurationTypeId: 9`), including `on_init`. Present whenever `onInitFlowConfig` is. |
| `inParams` | usual | What the opener passes (a URL, an HTML string, an entity id used to build the URL). |
| `outParams` | optional | Values the embed hands back to its opener; declare any the flows set. |
| `vars` | usual | Component-scoped state — at minimum the computed href var. Every `$embed.vars.<id>` written in code must be declared here. |
| `events` | optional | Component events the embed exposes to its host. |
| `icon` | optional | Icon identifier for the embed component. |
| `configurationTypeId` | yes | `20`. |
| `id`, `referenceName`, `title` | yes | Standard identity. `title` is the user-facing display name — sentence case, distinct from `referenceName` (see [File Location & Naming](#file-location--naming)). |
| `accessModifier` | yes | `"public"` for a normally-openable embed. |

`href` follows the **TypeScript-expression encoding rule** ([../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)): a bare `$embed.vars.ref_url` is a raw expression; a literal string must be TS-quoted (`"'https://example.com'"`). Compute the URL in `on_init` and bind the var — the URL almost always depends on `inParams`.

## Runtime Globals

Inside embed flow code:

- `$embed.inParams.<id>` — values the opener passed.
- `$embed.vars.<id>` — component-scoped state (declared in `vars[]`).
- `$datasources`, `$utils`, `$flows`, `$frontendFlows`, `$shell`, etc. — the standard UI-tier globals ([../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md)). UI-tier calling rules apply ([../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md)): call functions, not actions.

## Minimal Valid Skeleton

### URL embed (render a hosted page)

```json
{
  "type": "iframe",
  "iframeConfig": { "href": "$embed.vars.ref_url" },
  "onInitFlowConfig": { "flowId": "on_init" },
  "flows": [
    {
      "enableProgressAndCancelation": false,
      "configurationTypeId": 9,
      "start": "step1",
      "nodes": [
        {
          "id": "step1",
          "type": "step",
          "stepConfig": {
            "type": "ExecuteCodeActivity",
            "executeCodeConfig": {
              "code": "let url = 'https://my.example.com/map';\nif ($utils.isDefined($embed.inParams.marker)) {\n    url += `?marker_id=${encodeURIComponent($embed.inParams.marker)}`;\n}\n$embed.vars.ref_url = url;\n"
            }
          }
        }
      ],
      "referenceName": "on_init",
      "title": "on_init",
      "accessModifier": "public"
    }
  ],
  "configurationTypeId": 20,
  "id": null,
  "referenceName": "custom_example_map_embed",
  "title": "Example map",
  "description": "Renders the example map for a given marker in an iframe dialog.",
  "inParams": [
    { "id": "marker", "required": false, "type": "string", "isCollection": false, "isSecured": false }
  ],
  "vars": [
    { "id": "ref_url", "type": "string", "isCollection": false, "isSecured": false }
  ],
  "accessModifier": "public"
}
```

### HTML-string embed (render generated HTML)

Identical shape; only `on_init`, `inParams`, and `description` change:

```jsonc
// inParams:
[ { "id": "html", "required": true, "type": "string", "isCollection": false, "isSecured": false } ]

// on_init code:
"// Render the supplied HTML inside the iframe via a data URI.\n$embed.vars.ref_url = \"data:text/html;charset=utf-8,\" + encodeURIComponent($embed.inParams.html);\n"
```

## Rendering an HTML String

There is **no `srcdoc`** and **no inline-HTML embed type**. To render an in-memory HTML string, encode it as a `data:` URI and feed it through the (required) `href`:

```ts
// on_init
$embed.vars.ref_url = "data:text/html;charset=utf-8," + encodeURIComponent($embed.inParams.html);
```

Notes:

- Pass the **full** document (`<!DOCTYPE html>…</html>`) as `inParams.html`. The iframe gives it its own document, so its `<head>`/CSS won't bleed into Studio.
- `encodeURIComponent` is required — raw `#`, `&`, `%`, and newlines in the HTML otherwise truncate or corrupt the URI.
- Large documents (inline base64 images, barcodes) are fine; modern browsers allow multi-MB `data:` iframes.

## The Print Pattern

To let the user print just the rendered content, put the Print control **inside the HTML**, not in the host. Define the bar once as a string constant so you can concatenate it wherever it's needed:

```ts
const printBar = `
<div class="dxs-print-bar" style="position:sticky;top:0;z-index:2147483647;background:#1a3a5c;padding:10px 16px;text-align:right;font-family:Arial,Helvetica,sans-serif;">
  <button type="button" onclick="window.print()" style="background:#fff;color:#1a3a5c;border:0;border-radius:4px;padding:8px 18px;font-weight:700;cursor:pointer;">Print</button>
</div>
<style>@media print { .dxs-print-bar { display:none !important; } }</style>`;
```

**Prefer** concatenating `printBar` directly after `<body>` when you generate the HTML yourself — build it into the template and skip the injection code below entirely.

When you must inject it into HTML you didn't author, insert it as the first child of `<body>`, and use a **replacer function** so any `$` in the markup isn't treated as a `replace` substitution token:

```ts
// in the opener flow, before building the data: URI (printBar defined above)
// tolerates `>` inside quoted attribute values so the <body> tag isn't matched short
const bodyOpen = /<body\b(?:[^>"']|"[^"]*"|'[^']*')*>/i;
html = bodyOpen.test(html)
  ? html.replace(bodyOpen, (open) => open + printBar)  // inject after <body ...>
  : printBar + html;                                   // fragment (no <body>): prepend
```

The `bodyOpen` pattern steps over `>` characters inside single- or double-quoted attribute values (`<body data-x="a>b">`), so it matches the whole opening tag instead of splitting it. The `else` branch is for a **fragment** with no `<body>` at all, where prepending is correct; a full `<!DOCTYPE html>` document always has a `<body>` the pattern will find, so it never falls through to prepend-before-doctype — which would otherwise push content ahead of the doctype and force the iframe into quirks mode. If you pass a full document, make sure it carries a literal `<body>` tag.

**Why inside the HTML:** a `data:` URI iframe is cross-origin, so the parent flow **cannot** call `iframe.contentWindow.print()` into it. A `window.print()` call that the iframe's own button initiates **is** allowed (self-initiated print is not blocked by cross-origin). `@media print` hides the bar from the printout, so the preview HTML stays faithful to what is actually sent/used.

## CSP Caveats (runtime, not caught by Validate)

These only surface in the running app:

- **`frame-src`** must permit the source. For an HTML-string preview the app CSP must allow `data:`; for a URL embed it must allow that origin. A disallowed source renders a **blank iframe**.
- **`script-src`** governs the in-document Print button. Under a strict policy (no `'unsafe-inline'`), the inline `onclick` may be blocked — the preview still renders and `Ctrl+P` still works, but the button is inert. Confirm the app's CSP before depending on the button.

`dxs configuration validate embed` checks body shape only (it catches a missing `href`, a bad `type`); it does not and cannot check CSP or print behavior.

## Generated iframe markup

Codegen emits a fixed iframe — you author the `href`, not the surrounding attributes:

- **`href` binds to the iframe `[src]` as a `SafeResourceUrl`, via a `safeUrl` pipe.** This sanitizer pass is what lets a `data:text/html` URI render at all; keep `href` to `https:` or `data:text/html` — other schemes (e.g. `javascript:`) may be sanitized and blanked.
- **`allow` and `frameBorder` are hardcoded** (`allow="accelerometer; gyroscope"`, `frameBorder="0"`) and are **not** settable from the embed body. Framed content is not granted anything outside that `allow` list — no camera, microphone, clipboard, or fullscreen.

## Invocation Contract

The opener calls the auto-generated shell method: `open` + the embed's `referenceName` (snake_case preserved, no camelCasing) + `Dialog`. Whether it carries a package segment depends on where the embed is **registered** ([../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md)):

- **Top-level application embed** (no package) → `$shell.open<referenceName>Dialog(...)`, no segment.
- **Embed registered under a package/module** → `$shell.<Package>.open<referenceName>Dialog(...)`, where `<Package>` is the **embed's own** module — not the caller's.

```ts
// top-level embed (no package):
await $shell.opencustom_email_preview_embedDialog({ html: previewHtml }, 'flyout', EModalSize.Xlarge);
// embed registered under a package:
await $shell.<Package>.opencustom_email_preview_embedDialog({ html: previewHtml }, 'flyout', EModalSize.Xlarge);
```

- First arg: an object matching the embed's `inParams`.
- Second arg: presentation mode (`'flyout'` is typical).
- Third arg: `EModalSize` (`Small | Standard | Large | Xlarge`).

Match the segment to the embed's registration: adding a segment for a top-level embed, dropping it for a packaged one, or using the **caller's** package instead of the embed's are the wiring traps.

The host that opens the embed must declare a `configParameters` entry for **every** embed `inParam` (unused ones with `value: null`) and, for a packaged embed, set `moduleId` to the embed's package. Audit via [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md).

## Pre-Flight Checklist

1. **File basics** — `configurationTypeId: 20`, suffix `-embed.json`, `referenceName` ends in `_embed` and matches the filename stem, `title` a distinct sentence-case display name (not equal to `referenceName`); universal checks ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)); `description` ≤100 chars.
2. **`type: "iframe"`** — the only codegen-supported type; never author `powerBi` (defined in the enum but unsupported and restricted in the Studio UI).
3. **`iframeConfig.href` present** — and a correctly-encoded TS expression (raw `$embed.vars.<id>`, or TS-quoted literal).
4. **Href var declared** in `vars[]` and assigned in `on_init`.
5. **HTML-string embeds** build the `data:text/html;charset=utf-8,` + `encodeURIComponent(...)` URI; no `srcdoc`.
6. **Print button (if a preview)** is inside the HTML, hidden via `@media print`.
7. **`inParams`** cover exactly what the opener passes; the opener carries the matching `configParameters` contract.
8. **Validate clean** — `dxs configuration validate embed -b <branchId> -D body.json`.
9. **Runtime smoke test** — iframe renders (CSP `frame-src` allows the source); Print button works (or note CSP blocks it).

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `HREF is required` on validate | `iframeConfig.href` missing | Add `href`; it's mandatory. |
| `Error converting value "..." to type 'EEmbedDesignerType'` | `type` set to a non-member value (`html`/`script`/`content`/`code`) | Use `iframe` — the only codegen-supported type (never `powerBi`); wrap inline markup in a `data:` URI. |
| Blank iframe, no console error | CSP `frame-src` blocks the source (`data:` or the URL origin) | Allow the source in the app CSP, or host the content at an allowed origin. |
| Preview renders, Print button does nothing | Strict `script-src` blocks the inline `onclick` | Acceptable degradation (`Ctrl+P` works), or relax CSP / use a CSP-compatible trigger. |
| Garbled/truncated HTML | HTML not URL-encoded into the `data:` URI | Wrap in `encodeURIComponent(...)`. |
| `iframe.contentWindow.print()` from the host throws/no-ops | `data:` iframe is cross-origin | Move the Print trigger inside the HTML (`window.print()`). |
| Push wiped content | Upserted the envelope instead of the inner `.json` | `jq .json envelope.json > body.json` before editing. |

## Cross-References

- [../../form-creator/references/forms.md](../../form-creator/references/forms.md) — sibling; pick a form when the dialog needs field inputs, a toolbar, or a validate-then-confirm flow (the form-vs-embed decision).
- [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule that governs `iframeConfig.href`.
- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — the mandatory `_embed` indicator and the user-facing display-name (`title` ≠ `referenceName`) rule.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) — `$embed`, `$shell`, and the other UI-tier globals available in embed flow code.
- [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules (call functions, not actions).
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — host `configParameters` ↔ `inParams` contract and `moduleId` rule for the opener.
