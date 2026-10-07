#!/usr/bin/env bash
# install-skills.sh — link every skill in this directory into a .claude/skills/ farm.
# Bash equivalent of install-skills.ps1 (symlinks instead of junctions). stdlib only. Idempotent.
#
# Usage (paths relative to the skill suite folder, this directory):
#   ./install-skills.sh                       # user scope: ~/.claude/skills
#   ./install-skills.sh --target /path/to/dir # project or custom scope
#   tooling/install-skills.sh --source skills/datex-studio      # upstream layout (skills live beside tooling/)
#
# Project scope example (from a repo that vendors this suite in a folder of its own):
#   <suite folder>/install-skills.sh --target "$(pwd)/.claude/skills"

set -euo pipefail

target=""
source=""
FORCE=0
relinked=0
while [ $# -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=1
      shift
      ;;
    --source)
      source="$2"
      shift 2
      ;;
    --source=*)
      source="${1#--source=}"
      shift
      ;;
    --target)
      target="$2"
      shift 2
      ;;
    --target=*)
      target="${1#--target=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

suite_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "$source" ]; then
  suite_root="$(cd "$source" && pwd)"
elif ! ls "$suite_root"/*/SKILL.md >/dev/null 2>&1 && [ -d "$suite_root/../skills/datex-studio" ]; then
  suite_root="$(cd "$suite_root/../skills/datex-studio" && pwd)"   # upstream layout: tooling/ beside skills/
fi

if [ -z "$target" ]; then
  target="$HOME/.claude/skills"
fi

mkdir -p "$target"

linked=0
skipped=0

for dir in "$suite_root"/*/; do
  name="$(basename "$dir")"
  case "$name" in
    *-workspace) continue ;;   # eval artifacts, not skills
  esac
  [ -f "${dir}SKILL.md" ] || continue

  link="$target/$name"
  abs="$(cd "$dir" && pwd -P)"          # absolute: the target dir may live outside this repo
  if [ -L "$link" ]; then
    if [ "$(readlink -f "$link")" = "$abs" ]; then
      skipped=$((skipped + 1)); continue   # already points here
    fi
    if [ "$FORCE" = 1 ]; then
      rm "$link"; ln -s "$abs" "$link"; relinked=$((relinked + 1)); continue
    fi
    echo "NOTE: $name is linked elsewhere ($(readlink "$link")); pass --force to re-point it." >&2
    skipped=$((skipped + 1)); continue
  fi
  if [ -e "$link" ]; then
    echo "WARNING: $name exists at target as a REAL directory - not touching it." >&2
    continue
  fi
  ln -s "$abs" "$link"
  linked=$((linked + 1))
done

echo "Linked $linked skill(s) into $target ($skipped already linked, ${relinked:-0} re-pointed)."
echo "Prerequisites: dxs CLI on PATH; python 3.10+ (pip install pyyaml for skill validation)."
echo "Optional save-gate hook: see component-validator/scripts/INSTALL.md"
