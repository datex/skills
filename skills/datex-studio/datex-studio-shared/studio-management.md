# Studio Management

Auto-manage Studio lifecycle: check state, start if needed, reuse if already running, clean up when done.

## Check State

```bash
dxs studio status
```

**`dxs studio status` always exits 0** — it reports a *state*, it is not a pass/fail check. Never key off the exit code; read the `state` field of the output:

| `state` | Meaning | What to do |
|---|---|---|
| `idle` | Server up, no report open | **Reuse it** — go straight to `dxs studio open`. |
| `editing` | Server up, a report is open | **Reuse it** — `dxs studio open` will switch to your report. |
| `not_running` | No server, port free | **Start it** (see below). |
| `orphan` | Port bound but no lockfile | A server is up but unmanaged (e.g. the user launched it). Try `dxs studio open` — it falls back to probing the port. If that fails, see *Sandbox / reachability* below. |
| `unreachable` | Lockfile present but the server didn't answer | Found but not reachable from this shell. See *Sandbox / reachability* below. |

## Start in Background

Use your tool's `run_in_background` parameter (Bash tool with `run_in_background: true`). This avoids shell-specific syntax like `&` or `Start-Process`.

```bash
# Start Studio in background (use run_in_background: true on the Bash tool)
dxs studio --no-browser
```

After starting, **verify Studio is ready** (state `idle`) before opening a report:

```bash
dxs studio status
```

Then open the report:

```bash
dxs studio open <folder>/report.rdlx-json
```

Tell the user Studio is running and they can preview changes at the URL shown.

## Sandbox / reachability (Windows + agent shells)

If the user launched `dxs studio` in their own terminal and `dxs studio open` from the agent
fails with **"Found a studio server … but couldn't reach it"** (or `status` reports `unreachable`),
the agent's sandboxed shell can't open a loopback connection to the user's server. Don't start a
second instance — run the open command in the **user's** session via the `!` prefix:

```text
! dxs studio open <folder>/report.rdlx-json
```

`dxs studio open`/`close` accept `--port` to point at a server on a non-default port
(e.g. `dxs studio open report.rdlx-json --port 5060`).

## Cleanup

If you started Studio yourself in the background, stop it after your workflow is complete
(deploy & verify done). **Only stop a server you started** — never stop one the user launched.

```bash
dxs studio stop
```

`dxs studio stop` terminates only the server tracked by the lockfile and refuses to kill an
unmanaged process. If it is unavailable (older CLI), fall back to the lockfile PID:

```bash
python -c "
import json, os, signal, sys
lock = os.path.expanduser('~/.datex/studio.lock')
pid = json.load(open(lock))['pid']
try:
    os.kill(pid, signal.SIGTERM)
except OSError:
    pass  # already stopped or Windows — try taskkill fallback
"
```

On Windows, if `os.kill` fails, fall back to `taskkill /PID <pid> /F`.
