# dxs CLI Release Checklist

**Run this whenever the `dxs` CLI cuts a release.** The skills in this repo document a CLI they
don't ship with, so every CLI release is a chance for them to go quietly stale. Issues #30, #33 and
#34 were all this drift caught late, in batches, after the skills had been wrong for a while. The
point of the checklist is to catch each one at the release that caused it, when the blast radius is
one change instead of seventeen files.

Record the CLI version you checked against, so the next run knows where to start.

## 1. Behavior drift — did a command the skills use change what it *does*?

Read the CLI's release notes and diff, and pay attention to changes that are invisible in a
command's spelling: **exit codes**, output shape, renamed or removed flags, new required arguments,
new gates.

```bash
dxs --version
# From the CLI checkout:
git -C <datex-studio-cli> log --oneline <last-checked-version>..HEAD
```

For each changed command, find its call sites here:

```bash
find skills -name '*.md' | xargs grep -n "dxs <command>"
```

**Document the new semantics once**, in the shared library skill that owns the pattern — usually
[`datex-studio-shared/configuration-roundtrip.md`](../skills/datex-studio/datex-studio-shared/configuration-roundtrip.md)
— and link to it from the call sites. Do not restate it in every skill; that is how #33 happened.

**Verify the behavior against the CLI source, not the release note.** The note describes intent; the
source describes what shipped. Checking the source for #30 is what surfaced `dxs function validate`
still exiting 0 while its three sibling commands had moved to exit 1 — an asymmetry the note did not
mention and the more dangerous half of the change.

**Ask what an agent will conclude, not just whether the docs are accurate.** A command that starts
failing where it used to succeed reads to an agent as a broken tool unless a skill says otherwise.
Accuracy is not sufficient; the skill has to pre-empt the wrong inference.

## 2. Enumeration drift — did a generated table gain rows?

These tables are generated from the platform or the CLI. Regenerate and diff; never hand-patch a row.

| Artifact | Regenerate with |
|---|---|
| `configurationTypeId` table in [`datex-studio-conventions/file-format.md`](../skills/datex-studio/datex-studio-conventions/file-format.md#configurationtypeid-reference) | `dxs api GET /configurationtypes` + `dxs configuration types` |

A new config type usually also means a new row in the **"Not yet covered (roadmap)"** section of
[README.md](../README.md).

When you add a generated artifact, add it to this table and record its command above the table in
the doc itself — a table nobody knows how to regenerate is a table that goes stale.

## 3. Boilerplate drift — did a rule change in one place and not in its copies?

The repo's DRY invariant says shared content lives once in a library skill and is linked. Where that
has slipped, a rule can change in the library doc while copies of it in the creator skills do not —
the reader is then pointed at a doc and handed advice that contradicts it (#33).

After changing any rule in `datex-studio-shared/`, `datex-studio-conventions/`, or
`datex-studio-runtime/`, grep for the sentence that repeats it:

```bash
find skills -name '*.md' | xargs grep -n "<distinctive phrase from the rule>"
```

If the grep returns more than the library doc itself, either delete the copies in favor of the
existing link, or fix every one. A partial fix is worse than none: it leaves the corpus disagreeing
with itself with no way to tell which copy is current.

## 4. Links still resolve

```bash
find skills docs README.md CLAUDE.md -name '*.md' | while read -r f; do
  d=$(dirname "$f")
  grep -oE '\]\(([^)#]+\.md)(#[^)]*)?\)' "$f" | sed -E 's/^\]\(//; s/(#[^)]*)?\)$//' | while read -r t; do
    case "$t" in /*|http*) continue;; esac
    [ -f "$d/$t" ] || echo "BROKEN: $f -> $t"
  done
done | sort -u
```

## Done means

- Every changed command's semantics are documented once and linked, not copy-pasted.
- Every generated table matches its regeneration command's current output.
- No rule disagrees with its own copies.
- No broken relative links.
- The CLI version checked against is recorded (in the commit message or this file's history).
