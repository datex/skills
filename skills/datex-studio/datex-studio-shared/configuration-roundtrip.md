# Configuration Round-Trip Pattern

> Shared reference for Datex Studio component-creator skills that fetch, modify, and push back configurations via `dxs configuration`. Documents the corrected round-trip pattern that avoids the destructive `get -O envelope.json | update -D envelope.json` silent-wipe bug discovered in the Phase 0d smoke test (see `datex-studio-cli` repo's `docs/superpowers/specs/2026-05-28-configuration-roundtrip-documentation-design.md`).

## The pattern

When modifying an existing configuration on a branch:

```bash
# 1. Fetch the existing configuration (writes the full server envelope to file)
dxs configuration get <type> <id> -b <branch> -O envelope.json

# 2. CRITICAL: extract the inner body. Never pipe the envelope directly to upsert.
jq .json envelope.json > body.json

# 3. Edit body.json per the rules in the relevant creator skill's references/<type>.md

# 4. Push the modified inner body (upsert resolves create-vs-update by referenceName)
dxs configuration upsert <type> -b <branch> -D body.json

# 5. (Optional) Validate before pushing in step 4
dxs configuration validate <type> -b <branch> -D body.json
```

## The bug this avoids

`dxs configuration get -O envelope.json` writes the full server response shape (id, json, jsonString, version, modifiedDate, …). `dxs configuration upsert -D` expects only the inner `json` body. Piping the envelope directly results in the server silently wiping the configuration's content (Phase 0d smoke test on hub 655 — toolbar/flows/onInitFlowConfig all reset to null).

The corrected docstring on `dxs configuration get -O` (committed `c4aea9c` in `datex-studio-cli`) tells users to extract `.json` before passing to `upsert -D`. The `jq .json envelope.json > body.json` step in the pattern above is the recommended extraction; `python -c "import json,sys;json.dump(json.load(open(sys.argv[1]))['json'],open(sys.argv[2],'w'))" envelope.json body.json` works equivalently on systems without `jq`.

## Creating new configurations

For a new configuration (no existing id):

```bash
# 1. Build body.json from scratch per the rules in the creator skill's references/
# 2. (Optional) Validate
dxs configuration validate <type> -b <branch> -D body.json
# 3. Upsert (same command — with no existing config on the branch, it takes the create path)
dxs configuration upsert <type> -b <branch> -D body.json
```

No round-trip extraction needed — there's no envelope to unwrap.

## Type identifiers

The dxs CLI normalizes type names to lowercase, no hyphens. Reference table:

| Component | configurationTypeId | CLI type identifier |
|---|---|---|
| hub | 2 | `hub` |
| grid | 3 | `grid` |
| editor | 4 | `editor` |
| form | 5 | `form` |
| datasource | 6 | `datasource` |
| selector | 7 | `selector` |
| function (flow) | 9 | `function` |
| storage | 17 | `storage` |
| action (footprintFlow) | 18 | `footprintflow` |
| footprintDatasource | 19 | `footprintdatasource` |
| customType (interface/enum) | 22 | `customtype` |
| backendTest | 24 | `backendtest` |

## Consumers

This reference is linked from every Datex Studio component-creator skill that uses the `dxs configuration` lifecycle. Skills should add this file to `depends:`:

```yaml
depends:
  - datex-studio-shared
  # ... other deps
```
