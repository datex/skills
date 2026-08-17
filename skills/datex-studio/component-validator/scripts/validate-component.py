"""
PostToolUse hook: validates component JSON files after Edit/Write.

Checks:
  1. description is present (not null, not empty)
  2. description is <= 100 characters
  3. JSON is valid (not corrupted by edit)

Exit codes:
  0 = pass (or not a component file — skip silently)
  2 = blocking validation failure (stderr sent to Claude)
"""

import json
import sys
import os

COMPONENT_SUFFIXES = (
    "-footprintFlow.json",
    "-flow.json",
    "-customType.json",
    "-footprintDatasource.json",
    "-datasource.json",
    "-selector.json",
    "-grid.json",
    "-form.json",
    "-editor.json",
    "-hub.json",
    "-storage.json",
    "-backendTest.json",
)


def main():
    # Read hook input from stdin
    try:
        hook_input = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # Can't parse input — skip silently

    # Extract file path from tool input
    tool_input = hook_input.get("tool_input", {})
    file_path = tool_input.get("file_path") or tool_input.get("path") or ""

    if not file_path:
        sys.exit(0)

    # Only validate component files
    if not any(file_path.endswith(suffix) for suffix in COMPONENT_SUFFIXES):
        sys.exit(0)

    # Check file exists
    if not os.path.isfile(file_path):
        sys.exit(0)

    # Validate JSON integrity
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"JSON parse error in {file_path}: {e}", file=sys.stderr)
        json.dump(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "message": f"BLOCKED: JSON is corrupt in {os.path.basename(file_path)}: {e}",
                }
            },
            sys.stdout,
        )
        sys.exit(2)

    errors = []

    # Validate description
    desc = data.get("description")
    basename = os.path.basename(file_path)

    if desc is None or desc == "":
        errors.append(
            f"{basename}: description is {'null' if desc is None else 'empty'}. "
            f"Every component must have a non-null, non-empty description."
        )
    elif len(desc) > 100:
        errors.append(
            f"{basename}: description is {len(desc)} characters (max 100). "
            f'Current: "{desc}"'
        )

    if errors:
        msg = "Component validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
        print(msg, file=sys.stderr)
        json.dump(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "message": f"BLOCKED: {msg}",
                }
            },
            sys.stdout,
        )
        sys.exit(2)

    # All good
    sys.exit(0)


if __name__ == "__main__":
    main()
