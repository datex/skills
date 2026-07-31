# Working with Claude Code in Datex Studio — Training Curriculum

A structured curriculum for training Datex staff to accomplish Datex Studio work **by directing Claude Code equipped with the agent skills in this repository**. The skills encode the platform mechanics — file formats, naming rules, CLI round-trips, component gotchas, validation gates. Trainees do not learn those mechanics by hand. They learn to:

- frame tasks so the right skill engages and the agent has what it needs,
- choose the right operating mode — real-time pairing vs. spec-first async execution — and set up the session (model, effort, permissions) to match,
- supply the context only a human has (branch, work item, business intent, domain semantics),
- respond well at the checkpoints where the agent stops for human judgment,
- review agent output critically instead of rubber-stamping it, and
- verify results where it counts: in the running Studio application.

**Audience:** Datex developers, analysts, and support engineers who will deliver Datex Studio changes through Claude Code. No prior Datex Studio authoring experience required. No JSON editing is taught — hand-editing component files is an anti-pattern in this workflow.

**Total duration:** ~4–5 training days full track. Role-based cuts at the end.

**Format:** every module lists your role vs. Claude's role, example prompts (the core courseware — phrasing is a skill), a lab, and a mastery check. All labs run against a dedicated training branch and org; the instructor supplies the branch ID.

---

## The division of labor (read first)

This table is the curriculum's thesis. Everything below elaborates it.

| Claude Code (with skills) handles | You handle |
|---|---|
| Component JSON formats, naming rules, IDs, defaults | Choosing what to build and why |
| The `dxs` CLI round-trip and source-control lock protocol | Confirming **which branch** (Claude never assumes one) |
| Schema discovery and OData query verification | Domain semantics the schema can't reveal ("owner" means shipper here) |
| Picking the right component type and skill for the task | Describing the *outcome* you want, not the implementation |
| Running validators and fixing blockers | Deciding what to do with warnings; approving plans; judging risk |
| Drafting commits, reviews, release notes | Final judgment, sign-off, and anything customer-facing |
| Knowing the platform's gotchas | Verifying the result actually works in Studio |
| Executing a refined ticket end to end, delegating legwork to subagents | Choosing the operating mode — pairing vs. async — and refining the ticket that makes async safe |

---

## Module 0 — Setup and first contact

**Duration:** ½ day · **Prerequisites:** none

### Learning objectives

1. Install and authenticate Claude Code; install the skills from this repo (`npx skills add <repo-url> --all`) and explain why `--all` matters: most skills depend on three shared library skills (`datex-studio-shared`, `datex-studio-conventions`, `datex-studio-runtime`) that must be installed alongside them.
2. Authenticate the `dxs` CLI and confirm the working context (organization, repository, API connection) — the one piece of environment setup the agent can check but you must own.
3. Set the permission mode to **auto** — the preferred mode for this workflow. Reviewing every individual permission request sounds safer but isn't: dozens of prompts a day produce alert fatigue, and a human who reflexively clicks "allow" is weaker protection than none. Safety here comes from the layers that actually get attention — everything lands on a feature branch (not production), validators gate the output, and you review outcomes — not from per-tool-call dialogs.
4. Choose model and effort deliberately (a brief intro — defaults are fine on day one): run your session, the *outer loop* that plans, orchestrates, and judges, on a strong model (Fable or Opus); switch with `/model`. Raise reasoning effort for planning-heavy or diagnosis-heavy work; leave it at default otherwise. Subagent model choice comes up in Module 1 — implementation legwork can run on lighter, faster models, while review deserves a strong one.
5. Understand how skills engage: Claude selects a skill from how you phrase the task; you can also name one explicitly ("use the report-editor skill to…"). Skimming the [README catalog](../README.md) tells you what's on the shelf.
6. Know the cardinal platform fact you must never violate: **components live on a branch, authored through the `dxs` CLI — there is no local file tree to hand-edit.** If you find yourself opening a JSON file in an editor, something has gone wrong.
7. Run a first end-to-end exchange and read the shape of an agent response (what it did, what it found, what it's asking you).

### Example prompts

> "What Datex Studio skills do you have available, and what does each do?"

> "Check my dxs setup — am I authenticated, and which org and connection am I pointed at?"

> "On branch `<id>`, list the components in the shipping module and give me a one-line summary of each." *(exercises read-only investigation — safe first contact)*

### Lab 0

1. Install Claude Code and the skills; verify the three library skills are present.
2. Set the permission mode to auto; confirm the session model with `/model`.
3. Run the setup-check prompt; fix whatever it reports with the instructor.
4. Run the read-only investigation prompt against the training branch; identify in the response: what the agent did, what it cited, and what it flagged as uncertain.

### Mastery check

The learner can explain to a colleague what `--all` protects against, why "just edit the JSON file" is never the answer, and why auto permission mode is — counterintuitively — the safer choice.

---

## Module 1 — The working model: you, Claude, and the branch

**Duration:** ½ day · **Prerequisites:** Module 0

The minimum platform mental model needed to *supervise* — deliberately shallow. Trainees learn what each component type is **for**, at recognition level, so they can ask for the right thing and sanity-check what comes back. They do not learn any component's internals. This module also establishes the two operating modes the rest of the curriculum assumes, and introduces how Claude scales itself with subagents.

### Learning objectives

1. Choose between the **two operating modes** deliberately — they trade *when* you spend your attention, not *whether*:
   - **Pair programming.** You and Claude work the task together in real time: you answer checkpoints as they arise, review each piece, and steer continuously. Best for exploratory work, unfamiliar areas, and anything where the requirements only become clear by looking at what exists.
   - **Spec-first, async.** You spend the effort *upfront* — potentially a few hours refining the DevOps (or Dynamics) ticket until it would survive implementation by a stranger — then start a fresh session and let Claude rip with a one-line kickoff: *"Implement work item #12345 on branch `<id>`."* Claude completes the work in the background; you come back to review the result, the validator output, and any decisions it parked. Best for well-understood work and batches of refined tickets. A vague ticket plus async mode produces confidently wrong output — the async payoff is earned in Module 2.
2. Recognize the component vocabulary by what the user sees and what it's for:
   - **Hub** — a top-level page: filter bar, tabs, toolbars. Where users land.
   - **Grid** — a list of rows (orders, inventory) inside a hub tab.
   - **Editor** — a screen to view/edit **one** thing (one order, one carrier).
   - **Form** — a popup that asks for input and comes back with answers.
   - **Selector** — a dropdown/autocomplete.
   - **Embed** — an iframe hosting an external page or generated HTML.
   - **Datasource** — where a screen's data comes from.
   - **Function / action** — backend logic; actions are the transactional kind.
   - **Storage** — feature-owned data that isn't a WMS entity.
   - **Report** — a printable/exportable RDLX document.
3. Know the standing checkpoints where Claude **will stop and ask**, and how to answer well:
   - **Branch confirmation.** Claude never assumes a branch ID. Have it ready; if unsure, ask Claude to list feature branches and pick with your team.
   - **Requirements ambiguity.** The skills instruct Claude to flag rather than guess. "Whatever you think" is a bad answer; a decision is a good answer.
   - **Plan approval.** Report changes and other multi-step work hard-gate on your approval of a plan. Read the plan — this is the cheap moment to redirect.
   - **Contract-change warnings.** Before renaming/removing anything other components (or external API consumers) depend on, Claude runs a caller analysis and presents it. You make the call.

   In pair mode you answer these live. In async mode, a well-refined ticket pre-answers most of them; whatever it doesn't answer, Claude resolves conservatively and flags in its report, or parks as a question — read those flags first when you come back.
4. Use **subagents, with a strong model as the outer loop**. Your session runs on a strong model (Fable/Opus) that plans and judges; on bigger builds, suggest that Claude fan the work out — implementation delegated to subagents per component, and an *independent* subagent doing code review so the reviewer isn't grading its own work. The skills already use subagents internally (validators run as read-only subagents; schema exploration is delegated to keep the conversation clean); asking explicitly on large tasks keeps the outer loop focused on orchestration and judgment instead of drowning in detail.
5. Understand *why* the agent is trustworthy on mechanics: each component type has a creator skill encoding its rules, validators audit the output, and the shared skills carry the platform conventions. (Optional deep-dive pointers for the curious — reading a creator's `SKILL.md` is the fastest way to see what the agent knows.)
6. Understand the verification hierarchy: agent self-checks < validator punch-lists < **you looking at the running screen in Studio**. The last one is never skipped for user-facing work.

### Example prompts

> "List the feature branches so I can pick the right one." *(the correct move when you don't know the branch — never guess)*

> "Before you build anything — walk me through your plan first."

> "Implement work item #12345 on branch `<id>`." *(the entire kickoff for a spec-first async run — everything else already lives in the ticket)*

> "This is a big build — use subagents to implement each component, and have an independent subagent review the result before you report back."

### Lab 1

1. Vocabulary drill from screenshots: shown ten Datex Studio screens/fragments, name the component type of each.
2. Checkpoint role-play: the instructor (as Claude) raises one branch question, one ambiguity, one contract-change warning; the learner answers each — graded on decisiveness and on *not* waving ambiguity through.
3. Mode-choice drill: given six task descriptions (a vague customer complaint, a crisply ticketed grid change, a batch of five refined tickets, an exploratory "why is this screen slow", …), pick pair vs. async for each and justify.

### Mastery check

Given five business requests ("we need a popup that asks for a reason code", "a page where CSRs see open orders per owner"), the learner names the component type(s) involved, states which checkpoint questions to expect for one of them, and picks the operating mode they'd run each in.

---

## Module 2 — Asking for work: requirements and context

**Duration:** ½ day · **Prerequisites:** Module 1

The single highest-leverage human skill in this workflow: giving the agent the right inputs. Claude runs a requirements-gathering step at the front of every build; your job is to feed it and then **review the brief it produces**.

### Learning objectives

1. Frame tasks by **outcome, not implementation**: "CSRs need to see which orders have been waiting more than N days, filterable by owner" beats "make a grid with a datediff column."
2. Point at sources instead of transcribing them: give the DevOps work item number and let Claude pull it (it knows to read the design fields, review relations without wandering, and ask before trusting stale attachments). Attach mockups directly.
3. Supply what only you know: business semantics ("in this report, *account* means the customer, not the billing account"), priorities, and scope limits ("just the summary tab, not the detail drill-in").
4. **Do not** paste SQL or assert field names from memory — Claude verifies every field against the live OData schema, and the skills treat SQL-vintage assumptions as a known error source. Your SQL is context, not specification; label it as such if you share it.
5. Review a requirements brief properly: check the semantic field mappings (this is where "owner→shipper" mistakes are caught), resolve every flagged ambiguity explicitly, confirm scope. An approved brief is the contract for the build.
6. For changes to *existing* things, have Claude investigate current state first and tell you what's there before deciding what to change.
7. **Invest in the ticket — the async payoff.** In spec-first mode (Module 1), the requirements work doesn't stay in a chat session — it goes *into the ticket*: explicit acceptance criteria, ambiguities resolved, semantic mappings recorded ("account = customer here"), target branch noted. A few hours refining tickets to that standard is what makes *"Implement work item #12345"* a safe one-line prompt. The refinement itself is work to pair with Claude on: have it read the ticket and list everything an implementer would still have to guess, then fix the ticket until that list is empty.

### Example prompts

> "Gather requirements for work item 45678 on branch `<id>`. Ask me about anything ambiguous before you plan the build."

> "Here's a mockup of the screen the customer wants *(attached)*. Build a requirements brief; note that 'client' in the mockup means the owner entity."

> "Before we change it — what does the current `shipment_status` hub actually contain, and what calls it?"

> "Read work item 45678 and list everything an implementer would still have to guess. Let's fix the ticket until that list is empty." *(spec-first refinement — the hours spent here buy the one-line kickoff later)*

> "Implement work item 45678 on branch `<id>`." *(a fresh session, after the ticket was refined — that's the whole prompt)*

### Lab 2

1. Given a training work item (seeded with one stale attachment and one ambiguous field name), drive Claude to a requirements brief; catch the stale attachment when Claude asks, and resolve the ambiguity with a decision.
2. Red-team a prepared brief containing one wrong semantic mapping; find it before approving.
3. Spec-first cycle: refine the training ticket with Claude until the "still have to guess" list is empty and write the results back into the ticket. In a fresh session, kick off the async implementation with the one-line prompt; while it runs, start refining a second ticket. Review the completed run against the ticket's acceptance criteria.

### Mastery check

The learner's approved brief survives the instructor's build without a single "wait, that's not what I meant" — and the learner can articulate why pasting SQL as a spec is dangerous. Their refined ticket's async run completes without a single parked question.

---

## Module 3 — Task playbooks: building screens and data

**Duration:** 1–1½ days · **Prerequisites:** Module 2

The core delivery module, organized by **task**, not by component internals. Each playbook: how to ask, what decisions Claude will surface, what "done" looks like, and how you verify. Throughout, Claude picks the component types, applies the conventions, and runs the appropriate validators — including the grid-specific and cross-component wiring checks — without being told; you'll see them in its reports.

### Playbook A — "This screen needs data" (datasources)

- **How to ask:** describe the data in business terms and where it will be used. Claude explores the schema, verifies paths against the live API, and chooses the datasource variant.
- **Decisions that come back to you:** none usually — but expect *questions* when a wanted field lives in a collection (Claude will propose flattening options with trade-offs) or when data volume implies paging behavior worth confirming.
- **Verify:** ask Claude to execute a sample query and show you rows; sanity-check them against reality.

### Playbook B — "I need a popup / an edit screen / a dropdown" (forms, editors, selectors)

- **How to ask:** by outcome — "a dialog that asks for a cancellation reason and confirms", "a screen to edit one carrier's details", "a dropdown of active warehouses".
- **Decisions that come back to you:** validation rules ("what makes this input invalid?"), which fields are editable vs. display-only, what happens on confirm.
- **Verify:** open it in Studio. Try to submit invalid input. Cancel and confirm both paths.

### Playbook C — "I need a list screen / a landing page" (grids, hubs)

- **How to ask:** describe rows, columns (business names — Claude maps them), filters, and actions ("a button on each row to open the editor"; "a toolbar button that opens the reason-code popup").
- **Decisions that come back to you:** column set and order, filter behavior, role gating ("who should see the admin tab?").
- **What you'll see Claude do:** compose the pieces (hub → grid → datasource → dialogs) in dependency order, and run wiring checks across the assembly — the composition seams are where the platform fails silently, and the skills know it.
- **Verify in Studio, specifically:** every filter actually filters; every button opens the right thing; the row data matches Playbook A's sample rows.

### Playbook D — "Change an existing screen"

- **How to ask:** name the screen and the outcome; let Claude investigate current state first (Module 2, objective 6). For screens that came from the core library, expect Claude to raise a tailoring decision — extend the core component or fork a custom copy — with trade-offs; that choice is yours (guideline: extension tracks core upgrades; forking freezes).
- **Verify:** the changed behavior *and* one adjacent behavior you didn't ask to change (regression sniff).

### Example prompts

> "On branch `<id>`, build a screen where CSRs see open sales orders for a selected warehouse, filterable by owner, with a toolbar button to export. Requirements brief is approved from earlier in this session."

> "Add a 'days waiting' column to the open-orders grid and make it sortable. Investigate the current grid first and tell me what feeds it."

> "The core receiving grid is almost right for this customer — we need two extra columns and to hide the cost column. What are my options?"

### Lab 3 (cumulative)

Direct Claude through a full slice from the Module 2 brief: datasource → dropdown → confirmation form → grid → hub. At each stage: answer the checkpoint questions, read the completion report, and verify in Studio before asking for the next piece. Finish with: "Run a final wiring check across everything we built today."

### Mastery check

The assembled hub works in Studio on first learner-led demo, and the learner can point to two moments where their checkpoint answer changed what got built.

---

## Module 4 — Task playbooks: backend logic and data

**Duration:** ½–1 day · **Prerequisites:** Module 3

### Playbook E — "Implement a business rule / transactional operation"

- **How to ask:** state the rule and its edge cases in business terms ("when an order is cancelled, release its allocations and write an audit row — all or nothing"). The *all-or-nothing* phrase matters: transactionality is a requirement you state, and it drives Claude's choice of machinery (you don't need to know the machinery's names).
- **Decisions that come back to you:** edge-case behavior ("what if allocations are already released?"), error-message wording, who may invoke it.
- **Verify:** ask Claude to walk you through the failure path, not just the happy path: "What happens, step by step, if the audit write fails?"

### Playbook F — "This feature needs its own data" (storage)

- **How to ask:** describe the records and their lifecycle. Expect one structural question with long-term consequences: which fields are truly *required* — the skills treat stored schemas as effectively append-only once shipped, so Claude will push back on speculative required fields. Err with Claude's caution.

### Playbook G — "Test it"

- **How to ask:** "Write backend tests for the cancellation action — cover the happy path, already-released allocations, and the audit-failure path." You supply the cases worth testing; Claude supplies the harness.

### Playbook H — "Rename / remove / change something other code uses"

- **How to ask:** just ask for the change — the *skills* enforce the safety step. Claude will run a caller analysis and present who depends on the thing, split into writers and readers where relevant. **Your job is to actually read it** and decide: proceed, stage the change, or coordinate with owning teams. This checkpoint exists because "no one uses that anymore" is the most expensive sentence in maintenance work.

### Playbook I — "Expose this to an external system" (API endpoints)

- **How to ask:** name the operation and the consumer. Changing or removing an existing endpoint triggers an explicit external-consumer warning — treat it like a production change, because it is.

### Example prompts

> "On branch `<id>`: when a shipment is short-picked, we need to flag the order and notify the owner — atomically. Walk me through your plan before building."

> "Rename `order_aging_days` to `days_since_allocation` wherever it's defined. Show me the impact before touching anything."

### Lab 4

1. Drive Playbook E end to end, including the failure-path walkthrough.
2. Drive Playbook H on an instructor-named field that *does* have callers; make and justify the proceed/stage/coordinate call.

### Mastery check

The learner never approves a contract change without restating, in their own words, who is affected and why it's safe (or how it's staged).

---

## Module 5 — Task playbooks: reports

**Duration:** 1 day · **Prerequisites:** Module 2 · **Parallelizable** with Modules 3–4; suitable standalone for report-focused staff

### Playbook J — "Build a report" (from a work item, a legacy SSRS report, or a description)

Reports are the most orchestrated build the skills perform, with the most human gates. Your role at each:

1. **Brief approval** — as Module 2.
2. **Coverage review** — before layout, Claude presents a table mapping every required field to a verified data path (or an explicit calculation). Fields it couldn't cover are flagged, not fudged. Review this table carefully; it is the last cheap moment to catch "that field doesn't exist in OData."
3. **Live layout iteration** — Claude prototypes in a running Studio session and the skills carry the Datex design language (palette, typography, table styling), so don't spend your feedback on fonts and colors; spend it on content, grouping, and layout. Iterate conversationally: "tighten the header", "group by carrier with subtotals", "the address block should match our other documents."
4. **Preview honesty** — sample-data preview is a convenience with known blind spots (certain cross-dataset expressions, barcodes, some formatting don't render in preview). **Sign-off happens against the deployed report in Studio with real data**, never against the preview.

### Playbook K — "Change an existing report"

Claude triages report changes into categories (from cosmetic label/style up through new data and new sections) and presents a plan for anything non-trivial. Small asks stay small — "change the title and bold the totals" won't spawn a project. Approve the plan before edits; for changes that need new data, expect a mini version of the coverage review.

### Example prompts

> "Build the shipment aging report from work item 45678 on branch `<id>`. It replaces the attached SSRS report — match its content, not its layout; use our standard design."

> "On the carrier-invoice report: move the totals above the line items and add the carrier's SCAC next to its name. Investigate the report first and tell me your plan."

### Lab 5

1. Drive Playbook J end to end; the coverage table is seeded with one uncoverable field — catch it and decide (drop, calculate, or escalate).
2. Drive one small and one data-adding change via Playbook K; observe the difference in ceremony.

### Mastery check

The learner signs off only after seeing the deployed report render with real data — and can name two things the preview can't be trusted to show.

---

## Module 6 — Reviewing agent output and recovering when things go wrong

**Duration:** ½ day · **Prerequisites:** Module 3

The skills bias Claude toward self-validation, but the human review layer is what makes the workflow safe. This module trains critical reading and symptom-driven recovery.

### Learning objectives

1. Read an agent completion report actively: What did it change? What did it validate, and how? What did it flag? A report with no caveats on non-trivial work deserves *more* scrutiny, not less.
2. Read validator punch-lists (Blockers / Warnings / Nits): blockers get fixed before anything ships — Claude does this unprompted; **warnings are yours to judge** — ask "explain warning 2 and what fixing it would touch" rather than reflexively saying "fix everything."
3. Request the right audit at the right time (Claude usually does this itself; you backstop):
   - after any grid work → the grid-specific audit;
   - after composing screens → the cross-component wiring audit;
   - before a merge/release → the whole-branch audit: *"Run a project-wide validation on branch `<id>` and give me the punch-list."*
4. Diagnose by symptom, not theory. The skills contain symptom→cause indexes for the platform's silent failure modes — a plain description of the misbehavior engages them:
   > "The owner dropdown on the new hub is empty — diagnose."
   > "The status filter doesn't actually filter the grid."
   > "The report deployed but renders completely blank."
   Resist pre-diagnosing ("I think the moduleId is wrong") — you'll anchor the agent on your guess.
5. Know the recovery moves: ask Claude to re-investigate from the branch (the branch is truth; a stale working file mid-conversation is a known trap — a fresh session re-fetches state cleanly); and know when to stop — repeated failed fixes on the same symptom is the signal to bring in a platform expert with the transcript, not to keep prompting.

### Lab 6

1. The instructor provides a branch with a seeded wiring defect and a seeded validator warning. Drive diagnosis of the defect purely by describing symptoms; then triage the warning (judge it, don't auto-fix it) and defend the call.
2. Run the pre-merge project-wide validation on the Module 3–4 branch; triage the full punch-list.

### Mastery check

In the seeded-defect exercise, the learner's first prompt describes the symptom without proposing a cause — and their warning triage includes a reason, not just a verdict.

---

## Module 7 — Shipping: review, commit, release notes

**Duration:** ½ day · **Prerequisites:** Modules 2 and 6

### Learning objectives

1. Request a structured branch review before merge: *"Review branch `<id>` against work item 45678."* Claude traces dependencies, reads diffs, and returns severity-tagged findings across bugs, quality, security, performance, and — most valuably — **alignment**: does the branch actually do what the work item asked? Your job: judge the findings, and read the alignment section against your own understanding of the requirement.
2. Have Claude draft the commit message: it mines the branch's actual changes and produces the standard Datex three-part format (title / description / release-notes body) that downstream tooling parses. Review for accuracy; **you** perform the actual commit — the skills deliberately stop short of it.
3. Generate release notes between two releases: Claude mines commits, work items, and config diffs (including dependency branches — where most of the substance hides) into Technical and Customer variants. Your job on the Customer variant: read it as a customer would; jargon and internal reference names slipping through is the classic failure.
4. Know that scheduled/unattended release-notes generation exists (anchor-picking for "what shipped this week" runs); operating it is an admin task outside this curriculum's scope.

### Example prompts

> "Review branch `<id>` against work item 45678. I care most about whether we actually satisfied the acceptance criteria."

> "Draft the commit message for branch `<id>`. Flag anything you'd want a reviewer to look at first."

> "Generate release notes from release branch `<from-id>` to `<to-id>` — both technical and customer versions."

### Lab 7

1. Full shipping pass on the training branch: review → judge findings → commit message → (instructor-simulated) commit → release notes between two instructor-named branches.
2. Edit the Customer release notes: the seeded draft contains two pieces of internal jargon — find and fix them.

### Mastery check

The learner catches the alignment gap seeded in the training branch (one acceptance criterion silently unmet) from the review output.

---

## Module 8 — Working effectively: patterns, anti-patterns, and limits

**Duration:** ½ day · **Prerequisites:** all prior (capstone-adjacent; also works as a standalone refresher)

### Learning objectives

1. **Prompt patterns that work** (recap with before/after examples from the labs):
   - Outcome over implementation; sources over transcriptions; decisions over deference at checkpoints.
   - One task per ask at natural seams (the agent sequences multi-component builds itself — but "build the whole module" in one breath removes your checkpoints).
   - "Investigate first, then propose" for anything touching existing work.
   - "Walk me through the plan / the failure path" as a standing habit for consequential changes.
   - Mode choice as a habit (Module 1): pair on exploratory or novel work; spec-first async on well-ticketed work — and refine the next tickets while an async run executes. That overlap is where the leverage compounds.
2. **Anti-patterns** (each traceable to a real failure mode in the skills' lore):
   - Hand-editing component JSON. Assuming a branch ID. Approving briefs, coverage tables, or impact reports unread. Signing off on preview instead of Studio. Pre-diagnosing symptoms. Treating "no callers, probably" as an impact analysis. Launching an async run from a vague ticket. Babysitting an async run prompt by prompt — if it needs steering, it needed pairing (or a better ticket).
3. **Trust calibration — where the skills are strong vs. where you slow down:**
   - *Strong:* everything in Modules 3–7 — the component types, validations, and workflows with dedicated skills.
   - *Slow down:* component types on the [README roadmap](../README.md#not-yet-covered-roadmap) with no skill yet (dashboards, widgets, notifications, workflows-as-configs, events, layouts) — Claude will attempt them from general knowledge without a skill's guardrails; treat output as a draft needing expert review, and say so in your ask: "There's no skill for this — be explicit about what you're unsure of."
   - *Slow down:* core-library tailoring decisions with long upgrade-path consequences (Module 3, Playbook D) — involve a platform expert on first encounters.
4. **Session hygiene:** long builds span sessions; state lives on the branch, so a fresh session that re-investigates is cheap and safe. Bring the work item and branch ID to every new session; don't rely on the agent remembering yesterday.
5. **Escalation:** what to hand a platform expert when you're stuck (branch ID, work item, the transcript, the symptom description) — and the cultural norm that escalating after two failed fix cycles is good judgment, not failure.

### Lab 8 — Capstone

A fresh work item, end to end, learner-driven, instructor observing silently: requirements → build (screens + one backend rule) → validation → Studio verification → review → commit message. Debrief scores the *direction* quality: checkpoint answers, verification rigor, prompt framing — not typing speed.

### Mastery check

Capstone debrief; pass requires catching the capstone's one seeded trap (an ambiguous field the work item never defines) at the requirements stage, not at demo time.

---

## Role-based cuts

| Audience | Modules | Duration |
|---|---|---|
| Full-scope developer | 0–8 | ~4–5 days |
| Report author / BI analyst | 0–2, 5, 6 (validation objectives 1–2 only), 8 | ~2½ days |
| Support / triage engineer | 0–2, 6, 8 | ~2 days |
| Reviewer / tech lead | 0–2, 6–8 | ~2½ days |
| Backend-focused developer | 0–4, 6–8 | ~4 days |

---

## Appendix — Where each skill appears

Trainees never invoke most skills by name — Claude selects them — but instructors and the curious can map curriculum moments to the skills behind them:

| Module / playbook | Skills engaged behind the scenes |
|---|---|
| 0 — setup, first contact | `codebase-research`, the three library skills (`datex-studio-shared` / `-conventions` / `-runtime`) |
| 1 — working model | `component-scaffolder` (the taxonomy), library skills |
| 2 — requirements | `requirements-gathering`, `devops-requirements`, `schema-explorer`, `odata-execution`, `codebase-research` |
| 3A — data | `datasource-creator`, `schema-explorer`, `odata-execution`, `type-definition-creator` |
| 3B — popups/edit screens/dropdowns | `form-creator`, `editor-creator`, `selector-creator`, `embed-creator` |
| 3C — lists/landing pages | `grid-creator`, `hub-creator`, `component-wiring-check`, `grid-validator` |
| 3D — change existing screens | `hub-editor`, `tailoring-overlay`, `codebase-research` |
| 4E/4G — business rules, tests | `function-creator`, `action-creator`, `backend-test-creator`, `footprint-workflows` (platform extension points) |
| 4F — feature data | `storage-creator`, `db-query` |
| 4H — contract changes | `impact-analysis` |
| 4I — external APIs | `endpoint-creator` |
| 5 — reports | `report-creator`, `report-editor`, the `report-authoring/` reference shelf in `datex-studio-shared` |
| 6 — review & recovery | `post-edit-verification`, `component-validator`, `grid-validator`, `component-wiring-check`, `project-validator` |
| 7 — shipping | `branch-code-reviewer`, `commit-message-generator`, `release-notes-generator`, `prospective-release-notes` |

Not covered: the Footprint-specific skills (`footprint-entity-expert` engages implicitly wherever WMS entities appear; `building-waves` and `slotting` are empty stubs), and roadmap component types with no skill yet (Module 8 teaches how to work safely without one).
