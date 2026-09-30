---
name: fpx
description: |
  Use when RUNNING commands against a deployed Datex Agent application with the fpx CLI —
  pointing fpx at the app (`fpx use`), signing in (Datex, dedicated External ID, or customer
  tenant), listing and calling its commands, exporting large datasources to a file and
  aggregating them in a script, and diagnosing 401/403/404/500 or FPX-* errors. Triggers:
  "fpx use", "fpx commands", "call the agent app", "export all rows", "script against the
  agent", "fpx returns 401", "FPX-061", "sign in to the agent app". For AUTHORING the agent
  (its commands, skills and profile in Datex Studio), use `agent-creator`.
---

# fpx — operating a deployed Agent application

Verified against **fpx 0.1.0** and **dxs 0.6.0**. Run `fpx --version` first; a newer fpx may
have moved an option this skill names.

`fpx` (`@datex/fpx` on npm) is one generic CLI. It reads the **manifest** a deployed Agent
application serves at `GET /api/$agent/manifest` and turns every command in it into an `fpx`
subcommand named by the command's alias. It talks to the Agent application only: that app
compiled in exactly the functions and datasources it exposes, so what `fpx commands` lists is
what the app can execute.

## Install

```bash
npm i -g @datex/fpx      # or run without installing: npx @datex/fpx --help
fpx --version
```

## Point fpx at the app

`dxs agent url -b <branch> --env <environment>` prints the app URL, the backend scope, the
tenant, and a ready `fpx_use` line. Paste that line:

```bash
fpx use <url> --app-scope <scope>                                  # Datex-tenant users
fpx use <url> --app-scope <scope> --account you@customer.com       # customer-tenant users
fpx use <url> --app-scope <scope> --account you@customer.com --tenant-id <tenant>
fpx commands
```

- `--account` sends your address as the login hint and discovers the tenant from its domain.
  `--tenant-id` is the explicit form.
- The first `use` opens the browser once. Later commands mint tokens from the stored refresh
  token; no browser opens again.
- Without a terminal (CI, a script) and nobody signed in, `use` refuses with `FPX-AUTH-002` and
  prints both ways forward. Sign in once from a terminal, then scripts work.
- Headless machines: add `--use-device-code`, or set `FPX_NO_BROWSER=1`.

## Call one command

```bash
fpx <alias> --help                         # the alias's parameters, from the manifest and the app
fpx <alias> --params '{"warehouseId": 12}' --top 20
```

One call is fine for a lookup. For anything that counts, joins, ranks or reads more than a
page, export and script instead (next section). Never page rows through a conversation.

## Scripts: export, then aggregate locally

`--all --out <file>` pages the whole result to a JSONL file (5000 rows a page, retried on
429/5xx/network errors) and prints only the counts. Write parameters to a file and pass
`-D <file>`: it avoids shell quoting entirely, in bash, Git Bash and PowerShell alike.

```bash
printf '{"warehouseId": %s, "skip": 0}' 12 > params.json
fpx <alias> -D params.json --all --out rows.jsonl && node summarise.mjs rows.jsonl
```

- Keep each script's stdout to the final summary. Intermediate data stays in files.
- `&&` matters: if an export fails, the file is **partial** (`FPX-051` says how many rows of the
  total arrived). Delete it and rerun the export; never aggregate a partial file.
- Node is always present where fpx is installed, so a `.mjs` aggregation step works on every
  machine. `jq` or Python are fine where they exist.
- A stable order across pages is the datasource's job. A datasource that declares `$orderby`
  takes it through the params file; `$top`/`$skip` belong to `--all` and are refused inside it.
- `fpx run script.sh` checks that fpx is ready (URL, identity or token, manifest) before
  running the script, and refuses with `FPX-070` listing every failed check.

Inline JSON (`--params '{"a": 1}'`) is fine in bash for one short key. In PowerShell 5.1 the
inner quotes must be escaped as `\"`; in Git Bash they must **not** be. When in doubt, use `-D`.

## When a call fails

| You see | It means | Do |
|---|---|---|
| `FPX-AUTH-002` | Nobody signed in, or no terminal to sign in at | `fpx use … --login` from a terminal |
| `FPX-061` with `401` | Signed in against the wrong tenant, or the tenant has not consented | Re-run `fpx use` with `--account`/`--tenant-id`; `fpx auth consent --tenant-id <tenant>` for the admin URL |
| `FPX-061` with `403` | Signed in, but your account has no **app role** assignment on the app's backend registration | An admin assigns you a role in Entra; nothing to change in fpx |
| `FPX-061` with `500` on the manifest | The app failed before routing — typically its roles lookup could not reach the Datex Studio API | Check the app's own log and the API it depends on |
| `FPX-AUTH-030` | The sign-in reached the corporate tenant, not the provisioned `wavelength<org>.onmicrosoft.com` one | `fpx login --tenant-id <tenant>` with the tenant `dxs agent url` printed |
| `FPX-021` | No app scope for this app | Pass `--app-scope` on `fpx use` |
| `FPX-023` | The manifest lists the command but the app did not generate it | Fix the agent's command in Studio and redeploy |
| `FPX-051` | An export stopped short of the total | Delete the file, rerun |

The full list is [references/error-codes.md](references/error-codes.md).

## The three tenant prerequisites

A freshly deployed Agent application answers `401`/`403` until all three hold. They are
one-time, per application, done by admins, not by fpx, and run in the target tenant:

1. **Pre-authorize the CLI client** `9640be1f-31b2-4970-85a1-2fc78fab9731` on the app's backend
   registration — Entra portal, backend app registration → **Expose an API** → **Add a client
   application** → that client id → tick `access_as_user`. Without this, token acquisition for
   the backend scope fails before a single request is sent.
2. **Admin consent for the app's backend registration**, in the organization's own tenant — the
   Manager's **Consent (admin only)** on the deployed application, run by an admin of that
   tenant. A Datex admin consenting in the Datex tenant does not satisfy this for a customer
   tenant.
3. **An app role assignment for every caller** on the backend registration. A `403` from
   `GET /api/$agent/manifest` means this one is missing, not a bug in the agent or fpx.

Customers whose users sign in against their **own corporate tenant** (rather than a
Datex-provisioned `wavelength<org>.onmicrosoft.com` one) have a separate, additional one-time
step: an admin there must also consent to the **CLI client itself** — it has no service
principal in that tenant until then, which is what `FPX-AUTH-030` reports. `fpx auth consent
--tenant-id <tenant>` prints that one URL (`/adminconsent?client_id=9640be1f-...`).

It does not consent the backend registration — that is step 2 above, a separate consent, run
from the Manager.

## Manifest and drift

```bash
fpx status
fpx --refresh commands
fpx manifest refresh
```

`fpx status` reports what fpx is pointed at and how fresh it is: `manifest_source`
(`file`/`app`/`cache`), `manifest_fresh`, `spec_version`, `branch_drift`, `package_drift`, and
the active `identity`.

- **Manifest cache.** The manifest and the app's OpenAPI spec share a 24h cache. `fpx use`,
  `fpx manifest refresh`, and the root `--refresh` flag (for `commands`, `manifest show`,
  `skills` and `profile`) refetch and replace it. Everything else — including `fpx --help` and
  building the commands themselves — reads the file or the cache only, never the network; a
  cached manifest is used however old it is.
- **`branch_drift`** compares the cached spec's branch with the manifest's `application.id`, so
  it flags a manifest that no longer matches the app the spec was built from. It compares ids
  only, so a same-branch redeploy that changed verbs still needs `fpx manifest refresh` to show
  up.
- **`package_drift`** lists every referenced module whose version differs between a **file**
  manifest and the cached **app** manifest — `null` unless both exist. It is how a hand-edited
  or saved manifest file that has fallen behind the deployment becomes visible.
- **Each command's `target`** (`{ path, appendVerb }`) is the URL contract fpx follows: POST to
  `path`, appending `/{verb}` only when `appendVerb` is true. The platform resolves it when it
  builds the manifest — never reconstruct a URL from the ref or module name yourself.

The full rules are fpx's own `docs/contracts.md` — contracts 01 (manifest → CLI), 02 (CLI →
app), 03 (spec/drift) and 06 (degradation).

## Identities

```bash
fpx auth status              # the active identity, its tenant and token expiry
fpx auth list                # every stored identity
fpx auth switch <tenant id, domain or identity key>
fpx auth logout --all
```

Each identity is stored under its tenant, so a Datex identity and a customer identity coexist.
fpx keeps state in `~/.fpx` (`FPX_HOME` moves it; use a throwaway one for experiments).

## Hosted use (a parent process hands fpx a token)

`FPX_TOKEN` (fixed) or `FPX_TOKEN_FILE` (re-read per call) supply the bearer; fpx checks its
audience and expiry and mints nothing. `FPX_APP_URL`, `FPX_APP_SCOPE` and `FPX_MANIFEST_FILE`
replace what `fpx use` would store. Only hand fpx a token inside a process tree you control.
