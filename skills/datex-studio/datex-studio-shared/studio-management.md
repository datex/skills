# Studio Management

Auto-manage Studio lifecycle: check if running, start if needed, clean up when done.

## Check Status

```bash
dxs studio status
```

- **If running** (returns successfully): reuse it, just open the report.
- **If NOT running** (fails with "No studio server running"): start it in the background.

## Start in Background

Use your tool's `run_in_background` parameter (Bash tool with `run_in_background: true`). This avoids shell-specific syntax like `&` or `Start-Process`.

```bash
# Start Studio in background (use run_in_background: true on the Bash tool)
dxs studio --no-browser
```

After starting, **verify Studio is ready** before opening a report:

```bash
# Wait for Studio to be ready (retry a few times if needed)
dxs studio status
```

Then open the report:

```bash
dxs studio open <folder>/report.rdlx-json
```

Tell the user Studio is running and they can preview changes at the URL shown.

## Cleanup

If you started Studio yourself in the background, stop it after your workflow is complete (deploy & verify done):

```bash
dxs studio stop
```

If `dxs studio stop` is not available, use the lockfile PID:

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
