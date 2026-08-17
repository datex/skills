# validate-component.py — harness-level save gate (optional install)

`validate-component.py` is a Claude Code **PostToolUse hook** that blocks Edit/Write saves of Datex Studio component JSON files when the JSON is corrupt or the `description` is missing/empty/>100 chars (the platform import limit). It is the harness-enforced floor under the [post-edit-verification](../../post-edit-verification/SKILL.md) skill's checks — the skill checks are the portable baseline; the hook catches saves the skill flow never sees.

## Install (per project)

1. Copy `validate-component.py` into the project, conventionally at `.claude/hooks/validate-component.py`.
2. Add to the project's `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python \"${CLAUDE_PROJECT_DIR}/.claude/hooks/validate-component.py\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

3. Verify: edit a component file to give it a >100-char `description`; the save must be blocked with a `BLOCKED: ... description is N characters (max 100)` message.

## Sync note

The copy here (`component-validator/scripts/validate-component.py`) is the **portable source**. If a repo-local installed copy (e.g. `.claude/hooks/validate-component.py`) is improved, mirror the change back here — the two must match.
