---
name: footprint-cli
description: |
  Use when RUNNING the Footprint CLI (`fp`) against a deployed generated Datex app —
  selecting an agent app, authenticating to the app backend, calling its commands, and
  diagnosing why a call returns 401/404/empty. Covers the generated app's real HTTP
  contract (POST /api/<module>/datasources/<ref>/<verb>, /functions/<ref>), datasource
  verbs being non-uniform, the SPA catch-all that makes a wrong non-API URL look like a
  200, branch-vs-deployment drift, and where the Swagger spec actually lives
  (/documentation/, not /docs). Triggers: "run fp", "fp use", "fp commands",
  "fp returns 401", "fp returns 404", "call the generated app", "does the app expose
  this datasource", "fp command not found", "agent app won't execute". For AUTHORING
  the agent configuration those commands come from, use `agent-creator`.
depends:
  - agent-creator
---

# Footprint CLI (`fp`) — operating a deployed agent app

`fp` is one generic CLI with no per-agent build: it fetches an **agent manifest** from a
Studio branch and materializes that manifest's aliases as commands, then executes them
against a **deployed generated app**. Two independent things must line up:

| Side | What it is | Where it comes from |
|---|---|---|
| Manifest | design-time: aliases → `type` + `ref` | Studio branch (`GET /applications/<branch>/agentconfigurations/referenceName/<ref>/manifest`) |
| App | runtime: the HTTP endpoints those refs resolve to | the generated app deployed into an environment |

A manifest command with `resolved: true` proves only that the config exists **on the
branch**. It does not prove the deployed app has that endpoint — the app may be built from
an older branch version. Check both (see *Verify app ↔ branch* below).

## CLI-first — no workarounds (hard rule)

`fp` is the **only sanctioned surface** for calling a deployed agent app. When it falls
short, **report the gap as a bug in `fp`, the agent configuration, or the generated app** —
do not route around it. A workaround that "gets the answer" hides a defect every later
session, and every hosted run of the same agent, will hit again.

- **Never reconstruct a call by hand.** No `curl`/`httpx` against `/api/...`, no pasted
  bearer token, no hand-built URL — even when a command is missing or erroring. If `fp`
  cannot make the call, that is the finding.
- **A 404, an empty result, or a `resolved: false` is evidence, not an obstacle.** Report
  which command, which ref, and what `fp status` said. Those three facts usually identify
  whether the bug is in the agent config, the deployment, or the CLI.
- **Do not paper over a wrong answer.** If a datasource returns rows that look wrong, or a
  count contradicts the total, say so with the raw output. `fp` is built so a failure cannot
  arrive disguised as data; a case where it does is a defect worth more than the task.
- **A missing command is an authoring gap, not a prompt to improvise.** If the agent has no
  command for what was asked, say which command would be needed and stop — do not substitute
  a different command that "roughly" answers it.
- **Report the error code.** Every `DXS-FP-*` code maps to one cause; quoting it turns a
  vague report into a fixable one.

## 0. First-run runbook

For a developer picking up `fp` for the first time. Nothing here involves creating an app
registration, editing one in the Azure portal, or copying a token out of a browser — if a
step seems to need that, the setup is wrong, not you.

```bash
dxs auth login <Organization>                             # 1. identity in the APP'S tenant - see §2
dxs source branch list --repo <repo> --status feature -n 10    # 2. pick the branch (never assume one)
fp use <agent> --branch <id> --env <env> --consent        # 3. select agent, resolve app, consent
fp status                                                 # 4. confirm app_url / app_version / spec
fp commands                                               # 5. the whole surface in one read
fp <command> -h                                           # 6. its parameters, before calling it
fp <command> --params '{...}' --top 10                    # 7. run
```

Prefer `fp commands` over `fp --help` when you are an agent: one table with every alias, its
module, ref, parameter docs and whether the branch could resolve it, instead of `-h` per
command. `fp --help` is the same surface grouped by module for a human to scan.

Step 1 is the step people get wrong: the identity must belong to the **tenant that owns the
app**, not your home tenant (§2). Step 3 needs the **environment**, not a URL, and the app must
actually be deployed there — `fp status` showing an `app_url` means the platform knows where the
app runs, a `target_warning` means it does not. `--consent` is idempotent: it probes for an
existing grant first and only prompts when one is missing, so it costs nothing to pass every
time.

## Command surface

Verified against the CLI; if these disagree with `fp --help`, the CLI wins and this file is
stale.

**Root** — `fp [OPTIONS] COMMAND`: `-a/--agent`, `-b/--branch`, `--mode [app|studio]`,
`--refresh`, `-O/--output [yaml|json|csv]`, `-f/--full`, `-s/--save`, `--force`,
`-v/--verbose`, `-q/--quiet`, `-h/--help`.

**Static commands**

| Command | Options |
|---|---|
| `fp use AGENT` | `-b/--branch`, `--mode`, `-e/--env`, `--org`, `--app`, `--app-url`, `--app-scope`, `--consent` |
| `fp status` | — (reports the selection, the cached spec and any branch drift) |
| `fp commands` | — (every agent command as one table) |
| `fp manifest show` / `fp manifest refresh` | — |
| `fp skills list` | — |
| `fp skills install` | `--dir` (default `.claude/skills`) |
| `fp profile show` | `--raw` (system prompt only, for piping) |

**Agent commands** (materialized from the manifest) come in two shapes — do not assume the
row-shaping flags exist on both:

| Shape | Options |
|---|---|
| datasource | `-p/--params`, `-D/--data-file`, `--top` (default 25), `--skip`, `--select`, `--verb` |
| function | `-p/--params`, `-D/--data-file` **only** |

A function returns whatever its outParams are, so there is nothing for `--top`/`--select` to
trim; passing them is an error, not a no-op.

`--verb` picks the datasource verb. **They are not uniform** — in a real app 24 of 137
datasources expose only `get`, and `fp` used to assume `getList` for everything, so those
answered 404 for reasons nobody could see. When a spec is cached the default is the verb the
deployed app actually exposes (`getList` > `get` > `getByKeys`) and `-h` lists the rest;
without one the default is `getList`, exactly as before. `getByKeys` is refused
(`DXS-FP-048`): the app exposes it, but `fp` has no flag for the `$keys` list it requires.

**`fp <command> -h` shows the parameters the app actually declares.** The codegen builds each
operation's swagger `requestBody` from the config's `inParams`, so the spec carries real
parameter names, JSON types and required-ness — listed under *Declared by the deployed app*,
beside the manifest's hand-written `paramsDoc`. Trust the declared list over `paramsDoc` when
they disagree; `paramsDoc` is prose an author typed and can go stale. A datasource declares its
parameters per verb, so the list changes with `--verb`. Nothing is validated client-side: a
cached spec one deploy behind would refuse a parameter the running app accepts.

## 1. Select the agent app

```bash
fp use <agent_ref> --branch <branch_id> --env <environment>     # resolves URL + scope
fp status                                                        # what is selected, and where it points
fp --help                                                        # the materialized command tree
```

`--env` resolves the deployed app's base URL and backend OAuth scope from the platform's
deployment registry (environment component definitions) — never type a URL by hand and
never guess one. `--app-url` stays available as an explicit override and skips resolution.
Selection is persisted in `~/.datex/fp.yaml`; the manifest is cached 24h in
`~/.datex/agents/` — `fp --refresh` or `fp manifest refresh` after editing the agent config,
or your new alias will not appear.

```bash
fp profile show --raw          # the agent's system prompt (pipe into a harness)
fp skills list                 # owned skills the manifest carries
fp skills install              # write them as SKILL.md into the harness skills dir
```

## 2. Authenticate to the app backend

### Where the app's identities come from

Nobody creates these by hand. When an application definition is provisioned on Azure, the
Studio API mints **three** registrations through Microsoft Graph
(`ProvisionApplicationDefinitionOnAzureCommandHandler` → `AzureManagementService`), from a
fixed template:

| Registration | Name pattern | Holds |
|---|---|---|
| Frontend / client | `<prefix>-<org>-<app>-client` | pre-authorized on the backend for its delegated scopes |
| **Backend (the API)** | `<prefix>-<org>-<app>-app` | identifier `api://<appId>`; **exposes** scope `access_as_user` and app role `access_as_daemon` |
| **Backend test (daemon)** | `<prefix>-<org>-<app>-api-test` | a client secret, and **declares** the `access_as_daemon` role on the backend |

So both caller kinds already exist on every generated app — there is nothing to add in the
portal. What matters is picking the right **client**:

- The backend registration *exposes* the role. Asking it for a token for itself
  (client-credentials with the backend's own id + secret, e.g. via
  `/documentation/login/getToken`) returns a token with the correct `aud` and **no `roles`
  claim** — an app is not granted its own app roles. Always 401.
- The backend-test registration is the one *granted* the role. Its client id + secret are the
  credentials an unattended caller should use.

Known gap: those backend-test credentials are stored on the application definition but are
**not exposed by the Studio API** (`ApplicationDefinitionDto` omits every `AzAppReg*` field).
Codegen reads them straight from the database when it builds the app. Until the API surfaces
them — or the agent manifest carries a `target` block — an unattended `fp` has no supported
way to fetch its own credential, and that is a platform gap to report, not something to solve
locally with copied tokens.

### Which caller do you need?

Both work. Pick by *who is running the agent*, because the choice changes what the app sees,
not just how the token is minted:

| Runtime | Token | Backend builds | Sees |
|---|---|---|---|
| A human at a terminal (Claude Code + dxs) | delegated, `access_as_user` | `Caller.isUser = true` — `oid`, `preferred_username`, `groups` | exactly what that user sees: their roles, their operation assignments |
| Unattended (hosted harness, `trigger: schedule`) | app-only, `access_as_daemon` | `Caller.isDaemon = true` — `integratorId = appid`, no user identity | an integrator surface; role/permission behaviour differs from any human's |

> **Daemon is not reachable through `fp` today.** The row above describes what the *backend*
> accepts, not what the CLI can do. `fp` has no daemon path at all: `--mode` offers only
> `app`/`studio`, `trigger` is unread, and the backend-test credential is stored on the
> application definition but omitted from every API response — so an unattended agent cannot
> fetch its own. Treat unattended operation as unavailable until the credential is exposed;
> do not design an agent around it.

For an agent answering questions **on behalf of a person**, delegated is the semantically
correct choice — a daemon token silently answers with a different permission surface than the
user would get, which is a correctness problem, not just an auth one. Reach for daemon
credentials only when there is genuinely no user.

The delegated path is not blocked by design: the backend's `access_as_user` scope is declared
`Type = "User"` (user-consentable, no tenant admin required) and the registration is
`SignInAudience = AzureADMultipleOrgs`. What is missing today is authorization of the *dxs CLI
client* against the app's API — provisioning pre-authorizes only the frontend registration
(`PreAuthorizeFrontendForBackend`). Adding the CLI's app id to the backend's
`PreAuthorizedApplications` next to the frontend would make delegated `fp` work on every
generated app with no consent prompt at all. That is the fix to ask for; do not work around it
per-app.

### What the backend accepts

The generated backend protects `/api/*` with `passport-azure-ad` bearer validation, audience
`api://<AZ_CLIENT_ID>`, and accepts exactly **two** kinds of caller:

| Caller | Token claim | Must carry | Typical source |
|---|---|---|---|
| Delegated user | `appidacr`/`azpacr` = `0` | scope **`access_as_user`** | the app's own Angular MSAL login |
| Daemon / app-only | `appidacr`/`azpacr` = `1` | app role **`access_as_daemon`** | client-credentials |

Anything else is rejected as "Unsupported authentication method" — a bare 401 with no body.

### The working recipe (verified end to end)

Two rules decide whether delegated auth works:

1. **Log in as a user of the app's tenant.** The backend pins `issuer` to its own tenant
   (`AZ_TENANT_ID`, taken from the owning organization). A token from any other tenant is
   rejected even when `aud`, `appidacr` and `scp` are all correct — including a Datex staff
   token against a customer app. `dxs auth login <Organization>` creates an identity in that
   tenant; `get_access_token_for_scopes` then redeems against that tenant's authority.
   Registration *ownership* is irrelevant here: generated-app registrations are created in the
   Datex tenant and appear in the customer tenant as Enterprise Applications — that is normal
   multi-tenant design and is not the cause of any 401.
2. **Consent once per user, per tenant, per app** — `fp use … --env <env> --consent` — until
   the CLI is pre-authorized on the backend (below). The scope is `access_as_user`, declared
   `Type = "User"`, so the user grants it themselves: no tenant admin, and no Datex IT for a
   customer tenant. The grant is persisted in the tenant, so it is genuinely one-time — every
   later `fp` call mints its token silently.

After those two steps `fp` works with **no copied token and no code change** — rule 2 is
`fp use … --consent`. If you find yourself trying to paste a token from a browser or a
`/documentation/login/getToken` call, you have skipped rule 1 or rule 2.

`fp` mints the token itself, from the scope resolved by `fp use --env` (or
`DXS_FP_APP_SCOPE`), falling back to the plain dxs token when no app scope is known. There is
deliberately **no env var for pasting a token in**: a hand-pasted token hides the two things
that decide whether a call works — which tenant issued it, and whether the caller consented —
so failures stop being explainable.

```bash
fp use <agent> --branch <id> --env <env> --consent   # once per user, per tenant, per app
fp <command> --params '{...}'                        # silent from here on
```

`--consent` runs the device-code flow through `consent_for_scopes`, the public counterpart to
`get_access_token_for_scopes` — the same machinery dxs already uses to consent DevOps and CRM
at login. It requests `api://<app>/access_as_user` (a concrete scope: `/.default` cannot
trigger dynamic consent), while silent acquisition afterwards keeps using `/.default`.

**Do not add new token plumbing to get past an auth failure.** Every auth failure below is
configuration, not code:

| Symptom | Meaning | Fix |
|---|---|---|
| `AADSTS65001 … has not consented` on `fp <cmd>` | this user has never consented to this app's API | `fp use … --env <env> --consent` (one-time; no admin — the scope is user-consentable) |
| `DXS-AUTH-007 Unable to acquire token` | same cause, seen before the request leaves the CLI | same fix |
| `DXS-FP-021` (no app scope) | `fp use` never resolved a backend scope, so no app token can be minted. `fp` refuses rather than sending the Studio API's token, which the app rejects as the wrong audience | re-run `fp use <agent> --branch <id> --env <env>`; check `fp status` shows `app_scope` |
| `DXS-FP-049` (unreadable envelope) | a `200` carrying `totalCount` but no rows key `fp` recognises — never reported as a row | compare the app version with this CLI's; `fp <cmd> -O json` to see the raw shape |
| `DXS-FP-API-401` / bare `401` with no body on `/api/...` | token audience is right but the caller kind is not accepted — missing `access_as_user` scope or `access_as_daemon` role | see *Decode before you guess* below |
| `401` on `/documentation/swagger` | the spec endpoint is bearer-protected too | send the same token, or read the spec from the app's build output in a local dev checkout |

### Decode before you guess

A 401 from `/api/*` carries no body, so never theorize about it — decode the token with the
CLI and read three claims:

```bash
dxs auth debug-jwt --token "$(cat token.txt)"
```

| Claim | Verdict |
|---|---|
| `aud` ≠ `api://<app client id>` | wrong resource entirely — the token was minted for something else |
| `appidacr`/`azpacr` = `1` and **no `roles`** | client-credentials token, registration has no `access_as_daemon` app role → always 401 |
| `appidacr`/`azpacr` = `0` and `scp` lacks `access_as_user` | delegated token without the required scope → always 401 |

A client-credentials token minted from the app's own `/documentation/login/getToken` looks
perfect (`aud` correct, signed, unexpired) and is still rejected: that endpoint takes whatever
client id + secret you hand it, and the backend's own credentials can never carry the backend's
own app role. Switch **client**, don't edit the registration — use the backend-test
credentials for unattended callers, or a delegated user token carrying `access_as_user` (what
the app's Angular and Swagger UI logins produce).

## 3. Call commands

Parameters are one flat JSON object — the same names the datasource/function declares as
inParams. There is no per-parameter flag.

```bash
fp waves --params '{"statusIds":[1,2]}' --top 10 --select Id,Description
fp wave-orders --params '{"waveId":1042}' --top 25
fp wave-progress --params '{"filters":{"wave_ids":[1042]}}'
fp <command> -D params.json            # same thing from a file
```

- `--top` (default **25**) is sent to the server as `$top`; `--skip` pages. **Datasource
  commands only** — a function command rejects them.
- `--select` is a **client-side projection applied after the response** — it shrinks context,
  it does not reduce what the server computes. Datasource commands only.
- When the row count hits `--top`, the envelope carries `truncation_hint`. Say so in your
  answer instead of presenting a capped list as complete.
- On Windows/Git Bash, single-quote any `--params` containing `$`.

Read `fp <command> -h` before the first call to any command: its epilog prints the declared
parameters (`Parameters: …`) and the underlying config (`Executes: datasource Waves/ds_…`).
That is faster and cheaper than probing the backend.

A healthy response is a `rows:` list plus metadata carrying `command`, `ref`, `top` and —
when capped — `truncation_hint`. Two things observed in practice:

- **`--select` trims top-level keys only.** `--select Id,LookupCode` is cheap;
  `--select OrderLookups` returns that key's *entire nested tree* (orders → projects → owners
  → classes). Naming a navigation property is not a saving.
- **A row's `Id` is not always the entity you think.** In the Waves module, "orders ready to
  wave" rows are *shipments*: row `Id: 603655` is a shipment whose order id is `139660`, found
  at `OrderLookups[].OrderId`. Feeding the row id to an order-keyed command returns nothing —
  silently, since an empty result is not an error. Check what the datasource's `paths.entitySet`
  actually is before assuming.

## 4. The backend contract (do not rediscover this)

```
POST /api/<module>/datasources/<ref>/getList     -> { "result": [ … ], "totalCount": n }
POST /api/<module>/datasources/<ref>/get         -> { "result": { … } }
POST /api/<module>/datasources/<ref>/getByKeys   -> { "result": … }
POST /api/<module>/functions/<ref>               -> { "<outParamName>": … , … }
```

- `<module>` comes from the manifest `ref`: bare `ds_x` → module **`app`**; `Waves/ds_x` →
  module `Waves`. Package-owned configs (e.g. `Utilities`) follow the same rule.
- Request body = flat inParams **plus** `$top`, `$skip`, `$orderby`, `$filter`.
  - `$orderby`: `[{ "column": "<declared column>", "order": "asc"|"desc" }]`
  - `$filter`: a nested `{ "operator": "and"|"or", "operands": [ … ] }` tree, typed per
    datasource.
  - `fp` currently sends only `$top`/`$skip` — `$orderby`/`$filter` are not exposed as flags.
- Datasources return `result` (+ `totalCount`); functions return **their outParams by name**
  — there is no `result` wrapper on a function response. `fp` surfaces `totalCount` as
  `metadata.total_count`, so the truncation hint reads `showing 3 of 56` rather than guessing.
- A **single-result** datasource answers `{"result": {...}}` — an object, not a list. `fp`
  unwraps it into one row; the envelope is never the row.
- `204 No Content` is a documented response: empty result, not an error.
- Every `/api/*` route requires `Authorization: Bearer <token>`.

## 5. Traps

**A 200 does not mean the page exists — but `/api/*` is the exception.** The generated app
serves the Angular SPA as a catch-all, so unmatched **non-API** paths return `200 text/html`:
`/docs`, `/api-docs` and `/swagger.json` all "succeed" and all return the SPA shell. Probing
those by status code tells you nothing — check `content-type`.

Unmatched **`/api/*`** routes are different: the Express router has its own not-found handler
and returns a real `404`. So a datasource whose verb the app does not expose fails honestly
(`DXS-FP-API-404`), not as a fake row. `fp` still guards the HTML case (`DXS-FP-047`) because
an app URL pointing at the wrong host, or a proxy in between, can put a web page where JSON
belongs.

**Swagger lives at `/documentation/`.**

| Path | What |
|---|---|
| `/documentation/` | Swagger UI |
| `/documentation/swagger` | the OpenAPI 3 spec (bearer-protected) |
| `/documentation/login/` | the app's own token page |

**Verify app ↔ branch before trusting a run.** The spec's `info.version` is
`1.<applicationDefinitionId>.<branchId>` — e.g. `1.601.73442` is branch 73442. In a local dev
checkout the same value is in the backend's generated `constants.ts` (`APP_ID`). If it does
not match the branch you authored the agent on, the app is stale: the manifest can be green
while the endpoint 404s.

**Aliases are the CLI surface; refs are Studio's.** Skill and prompt text should name
`wave-orders`, never `Waves/ds_get_shipments_by_waveId`. `fp <cmd> -h` maps one to the other.

**Command missing from `fp --help`?** The manifest is cached for 24h — `fp --refresh --help`.
If it is still absent, the alias is missing or the entry's `type` is unknown; check
`fp manifest show`. (Root flags are read before the command tree is built, so `--refresh`,
`--agent` and `--branch` all take effect on the same invocation.)

**A command marked `[unresolved on the branch]`** in `fp --help` will refuse to run
(`DXS-FP-023`). The manifest reports `resolved: false` when the branch has no config with that
ref — the agent configuration names something that was renamed or deleted. Fix the agent
config, not the call.

**A `DXS-FP-API-500` is the app's failure, not the agent's.** `fp` now reduces it for you:
`message` carries only the app's first line — e.g. `mongodb+srv URI cannot have port number`
from a `$db`-backed function whose storage connection string is misconfigured — and the rest
goes to `details.body_excerpt` with `url` and `status_code`. Report the message and stop;
do not lift the stack out of `details` into an answer.

**Do not hand-roll `curl` to work around a missing `fp` flag.** The CLI is the sanctioned
surface; a gap (e.g. no `$orderby`) is a CLI bug to report, not something to bypass. Bypassing
also skips the envelope, the `--top` cap, and the truncation hint.

## 6. Preflight: is the app in step with the branch?

Two questions, both answered by commands rather than a hand-rolled script.

**Was the app built from this branch?** `fp use` fetches the deployed app's OpenAPI spec once
and keeps its `info.version` (`1.<appDefId>.<branchId>`). `fp status` then reports:

```yaml
spec_cached: true
spec_version: 1.601.73442
spec_operations: 256
branch_drift: the deployed app was built from branch 73442, but the agent manifest is on
  branch 73441
```

`branch_drift` absent means they agree. Present means the app predates (or postdates) the
agent config — republish the app; do not edit the agent to match a stale deployment.

**Does the app expose what each command needs?** `fp commands` lists every alias with its ref
and whether the branch resolved it, and `fp <command> -h` names the verbs the deployed app
exposes for that datasource. A command whose route is missing from the deployment answers
`DXS-FP-API-404` when you call it, which is honest but late; the two commands above tell you
first.

The spec is cached per app URL (including port) under `~/.datex/appspecs/`, reduced to what
`fp` actually uses — roughly 21 KB against a ~670 KB document. It is refreshed by `fp use`,
never during `fp --help`: command construction reads the cache only, so help works offline,
unauthenticated, and with no spec at all.
