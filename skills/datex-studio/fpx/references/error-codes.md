# fpx error codes

Generated from `docs/contracts.md` ("Error registry") in the fpx repository, fpx 0.1.0.
Regenerate at every fpx release; never hand-edit a row:

```bash
sed -n '/^## Error registry/,/^## `fpx\/lib`/p' <fpx checkout>/docs/contracts.md | grep '^|'
```

| Code | Raised when |
|---|---|
| `FPX-000` | An unexpected failure that is not an fpx error — reported as an envelope with its message, never a stack trace. Also the code of a `fpx run` preflight check that failed that way. |
| `FPX-003` | Bad input: `--params`/`--data-file` not a JSON object or unreadable; `--top`/`--skip` not a non-negative integer; an unknown option on a flat endpoint; a positional argument to an agent command; `--all` without `--out`, or with `--skip`/`--top`, or with `$top`/`$skip` inside `--params`; `--out` unwritable or a write failed; `fpx run` with a missing script, an extension other than `.sh`/`.py`, or an interpreter that cannot start; `fpx update` from a local checkout or an installer that cannot start. |
| `FPX-010` | No Agent application URL — neither `FPX_APP_URL` nor a `fpx use` selection. |
| `FPX-011` / `012` | The request to the application could not be made (refused, reset, DNS) / it timed out after 60 s — for an `--all` page, after the retries ran out. |
| `FPX-021` | No app scope resolved and no token provided, so there is nothing to mint for — raised instead of sending any other token. Also `fpx login` with no scope to sign in for, naming `fpx use <agent-app-url> --app-scope <scope> --login` as the first-run path. |
| `FPX-022` | A token for the app scope could not be minted for a reason that is not already an fpx error; names `fpx login` and the tenant. |
| `FPX-023` | The application did not generate this command's configuration (`resolved: false`), or `Agent.call` was given an alias the manifest does not have. |
| `FPX-024` | `fpx commands` (or the `fpx run` preflight) with no manifest available. |
| `FPX-025` | The provided token is for another audience (or carries none: `no audience`) — names what it carries and what the app accepts, and reports its caller type and tenant. |
| `FPX-026` | The provided token has expired (beyond 60 s of leeway). `fpx` does not acquire one when a token was provided; the token holder must refresh it. |
| `FPX-027` | The provided token is not a decodable JWT — usually the whole JSON response was supplied instead of the access token. |
| `FPX-028` | `FPX_TOKEN_FILE` is set but the file is missing, unreadable or empty. Never falls through to minting. |
| `FPX-029` | The configuration exists, but this application does not expose it as an endpoint (`target: null`). Distinct from `023`: fix the application's endpoints and republish. |
| `FPX-030` | The OpenAPI spec is unreachable or timed out. |
| `FPX-031` | The spec endpoint answered a non-2xx status, or served something other than JSON (the web shell). |
| `FPX-032` | JSON that is not an OpenAPI document — or, on any call, a body that declared JSON and did not parse. |
| `FPX-033` | 401/403 on the spec — names `fpx login`; commands still work without it. |
| `FPX-034` | `--skip` or `--all` against an endpoint with no server paging (a flat endpoint). Refused rather than faked. |
| `FPX-035` | `--verb` against an endpoint whose verb was bound at build time. |
| `FPX-046` | A verb this deployment does not expose, naming the ones it does. |
| `FPX-047` | A 2xx that is not JSON. Never returned as a row. Names the URL and what can front it. |
| `FPX-048` | `getByKeys` — exposed by the app, but `fpx` has no flag for `$keys`. |
| `FPX-049` | A 2xx envelope with a `totalCount` but no recognizable rows key. Never returned as a row. |
| `FPX-051` | `--all` (or `pageAll`): the application returned N of T rows (`totalCount`) and then a short page — empty, or shorter than the page before it — so the export is incomplete. The CLI adds the rows written to `--out` and `partial: true`. |
| `FPX-060` | The manifest is not JSON, not an object, or its `commands` is not an array; or the manifest file cannot be read. |
| `FPX-061` | The agent manifest could not be fetched: unreachable, `404` "no agent" (the URL is not an Agent application), `401`/`403`, or any other non-2xx. |
| `FPX-070` | `fpx run` preflight failed; `details.checks` lists each check with its own code. |
| `FPX-API-{status}` | The application's own failure (HTTP ≥ 400). The message carries its first line; the body is in `details.body_excerpt`. |
| `FPX-AUTH-001` | Sign-in failed for a reason with no more specific mapping. |
| `FPX-AUTH-002` | Not signed in — no active identity. From a headless first `fpx use`, it names `fpx use … --login` and `fpx login --scope …`. |
| `FPX-AUTH-004` / `005` | The sign-in timed out — the device code expired, or the browser round passed `FPX_LOGIN_TIMEOUT_SECONDS` (default 300) — / was declined or cancelled. |
| `FPX-AUTH-010` | No stored identity matches the selector (lists the stored ones), or nothing to log out. |
| `FPX-AUTH-011` | The selector matches more than one stored identity (lists them). |
| `FPX-AUTH-016` | `fpx auth consent` without `--tenant-id` or `--domain`. |
| `FPX-AUTH-017` | A tenant-id or domain selector with a `--tenant-id` or `--domain` that names another domain or tenant — only a sign-in address combines with those flags. |
| `FPX-AUTH-021` | Microsoft Entra could not be reached to resolve a domain to its tenant. |
| `FPX-AUTH-022` | The selector is empty, or not a sign-in address, a domain or a tenant id (an organization name is not supported), or the domain has no Entra tenant. |
| `FPX-AUTH-023` | The active identity has no refresh token, or its refresh was refused — fails closed, naming the identity. |
| `FPX-AUTH-025` | Timed out waiting for the credentials store lock. |
| `FPX-AUTH-026` | The customer tenant has not approved the Datex apps — names `fpx auth consent --tenant-id`. |
| `FPX-AUTH-027` | No account for the user in that tenant (`AADSTS50020`/`50034`). In the Datex home tenant it names `fpx use … --account` and `--tenant-id <guid>`; in a foreign tenant `--tenant-id <guid>` from `dxs agent url`. |
| `FPX-AUTH-028` | The account that signed in is not the one requested, or could not be identified. Nothing was saved. |
| `FPX-AUTH-029` | The tenant's Conditional Access policy blocks the device-code flow (`AADSTS530036`); on a refresh the identity is removed. |
| `FPX-AUTH-030` | The sign-in reached a tenant with no Datex service principal (`AADSTS650052`) — names the tenant and the provisioned tenant shape. |
