# Datex Agent Skills: Catalog and Practical Uses

**Audience:** Datex developers and implementation teams  
**Format:** 24 slides with slide copy, speaker notes, and example prompts, followed by a complete catalog handout  
**Suggested duration:** 35–45 minutes, including discussion  
**Repository snapshot:** September 16, 2026

This presentation describes the skills documented in this repository. The inventory contains **43 skill entries: 40 Datex Studio skills and 3 Footprint skills**. Two Footprint entries are empty placeholders, leaving **41 entries with documented guidance**, including three shared reference libraries. Documentation coverage does not establish that every workflow has been tested against a particular environment or CLI version.

Use the **On slide** sections as slide content. **Speaker notes**, **Example prompt**, and **Sources** provide presenter material. The appendix is a reference handout rather than additional slides. Prompts use placeholders for organization, branch, connection, and work item identifiers.

---

## Slide 1: Datex Agent Skills

### On slide

**A catalog for building and maintaining Datex Studio applications**

- What each skill helps you accomplish
- Which skill fits a particular task
- How skills combine during implementation
- Where validation and release work fit

### Speaker notes

Datex Studio is the low-code platform behind Datex products. Footprint WMS adds warehouse domain concepts that implementation work must handle correctly. This catalog packages those platform and domain practices into instructions an agent can follow. The presentation focuses on choosing a useful starting point and understanding the output to expect.

### Sources

[Repository overview](../README.md), [training curriculum](training-curriculum.md)

---

## Slide 2: What a skill provides

### On slide

- A `SKILL.md` explains when to use the skill and how to perform the task.
- Reference files hold detailed contracts, patterns, and known pitfalls.
- Creator and editor skills guide implementation.
- Utility and audit skills answer questions or check work.
- Shared libraries provide guidance that other skills reuse.

### Speaker notes

A skill gives the agent a repeatable procedure and relevant context. The agent still needs tools, access, and project information to execute it. Some skills produce configuration changes, while others produce a requirements brief, findings, or release notes. Dependencies connect these procedures. A request to build a report can bring in requirements, schema, and datasource skills without the developer naming each one.

### Sources

[Repository guidance](../CLAUDE.md), [shared reference library](../skills/datex-studio/datex-studio-shared/SKILL.md)

---

## Slide 3: The catalog at a glance

### On slide

| Catalog group | Entries | Main purpose |
|---|---:|---|
| Component creators | 16 | Author UI, data, logic, reports, and tests |
| Component editors | 2 | Modify existing hubs and reports |
| Tailoring | 1 | Extend core components or create independent variants |
| Validators | 3 | Audit components, grids, and projects |
| Shared libraries | 3 | Supply platform rules and reference material |
| Utilities | 14 | Support discovery, implementation, checks, and documentation |
| Package orchestration | 1 | Propagate published package changes |
| Footprint | 3 | One domain reference skill and two empty placeholders |

### Speaker notes

These counts follow the repository's catalog groups. They total 40 Datex Studio entries plus 3 Footprint entries. The categories are organizational: for example, `component-wiring-check` performs an audit but appears under utilities. Several skills named “creator” also modify existing components. The empty `building-waves` and `slotting` entries do not yet provide usable procedures.

### Sources

[Catalog](../README.md#skill-catalog), [building-waves placeholder](../skills/footprint/building-waves/SKILL.md), [slotting placeholder](../skills/footprint/slotting/SKILL.md)

---

## Slide 4: How an implementation uses the catalog

### On slide

1. **Understand the request:** requirements, existing behavior, affected callers.
2. **Confirm the data:** domain meaning, schema, working queries.
3. **Build or change components:** choose the appropriate creator or editor.
4. **Verify the result:** component checks, wiring, tests, and application behavior.
5. **Prepare delivery:** review changes, draft documentation, update package consumers.

### Speaker notes

This is a navigation model, not a requirement to run every skill on every task. A label change needs much less investigation than a storage contract change. Datex Studio branches are the source of truth, accessed through `dxs`. Most configuration edits use a fetch, extract inner JSON, edit, validate, and upsert workflow. Reports and Custom Angular Components have specialized authoring procedures. Developers supply the intended outcome and confirm the working context.

### Sources

[Configuration round-trip](../skills/datex-studio/datex-studio-shared/configuration-roundtrip.md), [branch setup](../skills/datex-studio/datex-studio-shared/branch-setup.md), [training curriculum](training-curriculum.md)

---

## Slide 5: Requirements and existing behavior

### On slide

| Skill | Useful when you need… | Expected result |
|---|---|---|
| `requirements-gathering` | A clear specification from a description, mockup, or document | A structured requirements brief |
| `devops-requirements` | Requirements from an Azure DevOps work item | Relevant fields, rules, and attachment context |
| `codebase-research` | An explanation of existing branch behavior | An answer with sources and caveats |
| `impact-analysis` | Caller analysis before changing a contract | A list of affected direct callers and risks |

### Speaker notes

Requirements gathering records what fields mean as well as their names. DevOps extraction supplies work item evidence to that process. Codebase research answers focused questions without changing the branch. Impact analysis becomes relevant before renaming, removing, or tightening a contract. For storage changes, it distinguishes readers from writers and inspects affected write payloads. Its default scope is direct callers, not a complete transitive impact assessment.

### Example prompt

> On branch `<branch_id>`, explain how `<reference_name>` works and identify its direct callers before we change its required inputs.

### Sources

[requirements-gathering](../skills/datex-studio/requirements-gathering/SKILL.md), [devops-requirements](../skills/datex-studio/devops-requirements/SKILL.md), [codebase-research](../skills/datex-studio/codebase-research/SKILL.md), [impact-analysis](../skills/datex-studio/impact-analysis/SKILL.md)

---

## Slide 6: Footprint knowledge and data discovery

### On slide

| Skill | Question it helps answer |
|---|---|
| `footprint-entity-expert` | Which WMS entity and business rules represent this concept? |
| `schema-explorer` | Which properties, relationships, keys, and indexes exist on this connection? |
| `odata-execution` | Does the proposed query return the intended data? |

**Typical order:** domain guidance, schema confirmation, incremental query verification.

### Speaker notes

OData metadata describes structure. Footprint domain guidance adds meaning: historical shipped inventory, receiving tasks, owner navigation, status codes, and fixed versus catch weight calculations. Schema exploration then confirms the actual connection's fields, including customer extensions. Query verification adds filters and expansions incrementally. Customer-specific rules still need confirmation. The domain skill does not define every customer's exclusions or billing policy.

### Example prompt

> For connection `<connection_id>`, identify the data needed for a shipped-inventory report by owner. Verify the navigation paths and weight rules before creating a datasource.

### Sources

[footprint-entity-expert](../skills/footprint/footprint-entity-expert/SKILL.md), [schema-explorer](../skills/datex-studio/schema-explorer/SKILL.md), [odata-execution](../skills/datex-studio/odata-execution/SKILL.md)

---

## Slide 7: Data access and feature-owned state

### On slide

| Skill | What it helps build or define |
|---|---|
| `datasource-creator` | OData or flow datasources for the appropriate execution tier |
| `storage-creator` | Feature-owned settings, rules, snapshots, or other persisted state |
| `db-query` | Correct storage predicates and read/write patterns inside functions |
| `type-definition-creator` | Shared interfaces and enums |

### Speaker notes

Datasource creation makes two separate choices: the component variant determines its execution tier, while OData versus flow determines how it retrieves data. Storage holds feature-owned data outside the Footprint entity model. The `db-query` skill provides consultation on the `$db` API, including its fluent predicate syntax. The function creator owns the calling function's implementation. Type definitions give components a common contract, and tightening an existing contract calls for impact analysis.

### Example prompt

> On branch `<branch_id>`, add a feature-owned rules table and a datasource that exposes its rows to a grid. Use shared types where the same contract has multiple consumers.

### Sources

[datasource-creator](../skills/datex-studio/datasource-creator/SKILL.md), [storage-creator](../skills/datex-studio/storage-creator/SKILL.md), [db-query](../skills/datex-studio/db-query/SKILL.md), [type-definition-creator](../skills/datex-studio/type-definition-creator/SKILL.md)

---

## Slide 8: Functions, actions, and platform workflows

### On slide

| Skill | Best fit | Example |
|---|---|---|
| `function-creator` | Backend orchestration and storage access | Prepare data for a screen or wrap an action |
| `action-creator` | Server operations requiring a transaction | Apply related entity changes atomically |
| `footprint-workflows` | Logic invoked at a Footprint extension point | Customize allocation or status-change processing |

### Speaker notes

These skills describe different execution contracts. Functions provide the usual bridge between a UI and transactional actions. Action error handling matters because it affects commit and rollback behavior. A Footprint workflow plugs into a named platform slot and must follow that slot's input and output contract. Its signature is not an arbitrary function design. Runtime guidance explains which globals and calls are available in each context.

### Example prompt

> Implement the `<workflow_slot>` extension on branch `<branch_id>`. Discover its required signature and delegate reusable transactional logic to an action where appropriate.

### Sources

[function-creator](../skills/datex-studio/function-creator/SKILL.md), [action-creator](../skills/datex-studio/action-creator/SKILL.md), [footprint-workflows](../skills/datex-studio/footprint-workflows/SKILL.md), [calling conventions](../skills/datex-studio/datex-studio-runtime/calling-conventions.md)

---

## Slide 9: API routes and backend tests

### On slide

- **`endpoint-creator`:** expose flows or datasources through HTTP routes in an API Application.
- **`backend-test-creator`:** create or modify Mocha suites with setup, cleanup, and test-case flows.
- Endpoint work resolves the target implementation before wiring the route.
- Test work defines expected behavior and the fixtures needed to exercise it.

### Speaker notes

Endpoint creation can also modify or remove an existing endpoint. It checks that the branch belongs to an API Application. Backend tests provide a structured home for executable checks, including suite and per-test hooks. The skill documents limitations in runtime mocking. Although tests run at the function tier, raw `$db` access does not resolve in test-case code, so storage fixtures require a supporting function. Creating a test suite and successfully running it are distinct outcomes.

### Example prompt

> On API Application branch `<branch_id>`, expose `<flow_reference>` through an endpoint and add backend tests for its success and validation-failure behavior.

### Sources

[endpoint-creator](../skills/datex-studio/endpoint-creator/SKILL.md), [backend-test-creator](../skills/datex-studio/backend-test-creator/SKILL.md)

---

## Slide 10: Hubs, grids, and selectors

### On slide

| Skill | User experience it supports |
|---|---|
| `hub-creator` | A new page with filters, tabs, and toolbar actions |
| `grid-creator` | Tabular records with columns, filtering, sorting, and row actions |
| `selector-creator` | A datasource-backed dropdown or autocomplete |

**Useful together:** a hub filter selects an owner and passes that value to a grid.

### Speaker notes

These components depend on explicit contracts. A filter's value must reach the target grid through the correct parameters. A grid's datasource, result shape, and filter definitions must agree. Selectors need both list retrieval and selected-value lookup to work correctly. The skills capture these connections because the UI can appear to load while a filter or dropdown silently fails. Grid validation is required after every grid edit.

### Example prompt

> Create an inventory hub on branch `<branch_id>` with an owner selector and a grid filtered by that owner. Verify that changing the selector changes the grid results.

### Sources

[hub-creator](../skills/datex-studio/hub-creator/SKILL.md), [grid-creator](../skills/datex-studio/grid-creator/SKILL.md), [selector-creator](../skills/datex-studio/selector-creator/SKILL.md)

---

## Slide 11: Record editors and input forms

### On slide

| Need | Skill | Typical behavior |
|---|---|---|
| View or edit one existing entity | `editor-creator` | Load a record, enter edit mode, validate, save |
| Collect inputs for an operation | `form-creator` | Open a dialog, collect values, validate, return a payload |

**Examples:** shipment details use an editor. A dialog collecting a reason and effective date uses a form.

### Speaker notes

The distinction is the purpose of the screen. Editors bind to a single loaded entity and manage its view/edit lifecycle. Forms collect transient values and return them to a caller, often as part of a larger operation. Both skills cover initialization and validation rules. The caller must also handle cancellation and missing outputs correctly. Existing editors and forms use these same creator skills for modifications.

### Example prompt

> Add a dialog on branch `<branch_id>` that collects a reason before running `<operation>`. Keep confirmation disabled until the required inputs are valid.

### Sources

[editor-creator](../skills/datex-studio/editor-creator/SKILL.md), [form-creator](../skills/datex-studio/form-creator/SKILL.md)

---

## Slide 12: Custom UI and embedded content

### On slide

- **`custom-angular-component-creator`:** bespoke Angular screens, charts, and layouts with typed platform context.
- **`embed-creator`:** an iframe displaying an external URL or generated HTML.
- Custom Angular authoring uses the `dxs ng` preview and push workflow.
- Embeds fit content viewers and previews that need an iframe surface.

### Speaker notes

A Custom Angular Component provides control beyond the standard declarative components. Its authoring preview uses mocked data through typed datasource stubs. After push, the generated app uses the real datasource. A preview screenshot therefore establishes appearance, not live integration behavior. An embed has a narrower contract: its entire surface is an iframe. If the experience needs surrounding field controls or buttons, a form may be part of the composition.

### Example prompt

> Build a custom chart screen on branch `<branch_id>` using a typed datasource. Preview it with representative data, then verify the generated app against the real datasource.

### Sources

[custom-angular-component-creator](../skills/datex-studio/custom-angular-component-creator/SKILL.md), [embed-creator](../skills/datex-studio/embed-creator/SKILL.md)

---

## Slide 13: New and existing reports

### On slide

| Skill | Use it for… | Scope |
|---|---|---|
| `report-creator` | A new report | Requirements, data discovery, layout prototype, upload, and verification |
| `report-editor` | An existing report | Targeted changes based on the required depth |

**Report examples:** labels, pick slips, bills of lading, and activity reports.

### Speaker notes

The creator is the entry point for a complete new-report request and coordinates supporting skills. Its coverage check compares required fields with datasource outputs before final layout work. The editor first inspects the current report. It distinguishes wording and layout changes from adding an existing field, extending a datasource, or adding a new section. This keeps a small report change appropriately scoped while preserving existing bindings and metadata.

### Example prompts

> Build a receiving report from work item `<work_item_id>` on branch `<branch_id>` using connection `<connection_id>`.

> Add the existing owner-name field to `<report_reference>` and preserve its datasource bindings.

### Sources

[report-creator](../skills/datex-studio/report-creator/SKILL.md), [report-editor](../skills/datex-studio/report-editor/SKILL.md)

---

## Slide 14: Existing hubs and customer tailoring

### On slide

- **`hub-editor`:** add or change toolbar buttons and click flows on an existing hub.
- **`tailoring-overlay`:** extend a core component through `baseConfiguration`.
- A tailored component inherits its base and adds targeted overrides.
- A flattened `custom_` variant becomes an independent component copy.

### Speaker notes

Use the hub editor for focused toolbar and click-flow work, such as opening a report with the current filter values. Tailoring is useful when customer requirements extend a core grid or another supported component. It covers inherited fields, customization hooks, suppression, and enrichment datasources. Flattening changes the maintenance relationship: the independent copy carries its own complete definition. That decision deserves an explanation of why continued inheritance is no longer useful.

### Example prompt

> Add a customer-specific column to `<core_grid>` on branch `<branch_id>` using a tailoring overlay. Identify the datasource and validation changes needed.

### Sources

[hub-editor](../skills/datex-studio/hub-editor/SKILL.md), [tailoring-overlay](../skills/datex-studio/tailoring-overlay/SKILL.md)

---

## Slide 15: Scaffolding and shared platform guidance

### On slide

| Skill | Role |
|---|---|
| `component-scaffolder` | Create a minimum valid supported component and hand off to its creator |
| `datex-studio-shared` | Branch setup, configuration round-trips, report guidance, and design references |
| `datex-studio-conventions` | File formats, naming, defaults, and common checks |
| `datex-studio-runtime` | Execution tiers, runtime globals, controls, and scheduled jobs |

### Speaker notes

Scaffolding is useful when the immediate task is a valid starting component. A complete feature request normally starts with the relevant creator or orchestrator. The three libraries travel as installable skills so their relative references remain available. They serve as background references rather than standalone implementation workflows. Consult the relevant file when needed. They also document some component types and platform features that have no dedicated creator skill.

### Sources

[component-scaffolder](../skills/datex-studio/component-scaffolder/SKILL.md), [datex-studio-shared](../skills/datex-studio/datex-studio-shared/SKILL.md), [datex-studio-conventions](../skills/datex-studio/datex-studio-conventions/SKILL.md), [datex-studio-runtime](../skills/datex-studio/datex-studio-runtime/SKILL.md)

---

## Slide 16: Verification around an edit

### On slide

| Skill | Scope |
|---|---|
| `post-edit-verification` | Quick checks after a component edit, with escalation as needed |
| `component-validator` | A component's type-specific authoring rules |
| `grid-validator` | Grid-specific structure, rendering, filtering, and sorting rules |
| `component-wiring-check` | Contracts between referenced components |

**The checks answer different questions.** Valid JSON alone does not establish correct behavior.

### Speaker notes

Post-edit verification checks JSON parsing and the required description, including its 100-character limit. Component validation produces a findings list. Grid validation replaces the generic audit for grid-specific work and applies after every grid edit. Wiring checks follow references to detect module mismatches, missing or extra parameter bindings, and undeclared variables. The audit skills report issues for the implementation skill to fix. Custom Angular Components use their own preflight and preview procedure.

### Sources

[post-edit-verification](../skills/datex-studio/post-edit-verification/SKILL.md), [component-validator](../skills/datex-studio/component-validator/SKILL.md), [grid-validator](../skills/datex-studio/grid-validator/SKILL.md), [component-wiring-check](../skills/datex-studio/component-wiring-check/SKILL.md)

---

## Slide 17: Project validation and branch review

### On slide

| Skill | Main question | Output |
|---|---|---|
| `project-validator` | Do the selected branch components agree on types, schemas, and result shapes? | Findings grouped by validation category |
| `branch-code-reviewer` | Are the proposed changes correct and aligned with the work? | Findings by severity and a review verdict |

**Application verification remains part of completion.**

### Speaker notes

Project validation checks descriptions, schema/code alignment, type references, OData schema compatibility, and datasource result shapes. It reads a temporary export of the branch. Branch review examines the change set and dependencies, considering bugs, security, performance, maintainability, and work item alignment. Neither result by itself proves that a screen renders correctly or an operation satisfies the business requirement. Tests and running-application checks provide additional evidence.

### Example prompt

> Review branch `<branch_id>` against its linked work item and run project validation for the changed package. Separate blockers from warnings and identify behavior that still needs runtime verification.

### Sources

[project-validator](../skills/datex-studio/project-validator/SKILL.md), [branch-code-reviewer](../skills/datex-studio/branch-code-reviewer/SKILL.md), [training curriculum](training-curriculum.md)

---

## Slide 18: Commit messages and release notes

### On slide

| Skill | Starting information | Result |
|---|---|---|
| `commit-message-generator` | Pending changes on a feature branch | A commit message with work item traceability |
| `release-notes-generator` | An older and a newer release | Technical and customer release notes |
| `prospective-release-notes` | Organization, application, and date range | Release anchors, followed by generated notes |

### Speaker notes

Commit-message generation inspects actual changes and resolves their supporting ticket. It does not perform a Git commit. It can write the branch URL to a resolved CRM Project Task, so it has a documented side effect beyond drafting text. Release notes include changed dependencies, where much application functionality lives. The prospective skill compares published releases in the default application group and excludes Service Pack hotfix groups. Publication does not mean an environment has deployed the release, and the skill itself does not create a schedule.

### Example prompt

> Generate release notes for `<application>` in `<organization>` for `<date_range>`, including technical and customer versions.

### Sources

[commit-message-generator](../skills/datex-studio/commit-message-generator/SKILL.md), [release-notes-generator](../skills/datex-studio/release-notes-generator/SKILL.md), [prospective-release-notes](../skills/datex-studio/prospective-release-notes/SKILL.md)

---

## Slide 19: Propagating a published package change

### On slide

**`package-cascade` updates packages that consume a published package.**

1. Identify the published origin version and target organization.
2. Inspect the dependency plan and select the intended scope.
3. Re-pin and republish consuming packages in dependency order.
4. Report applications that still need an update.

**Applications remain a separate publication decision.**

### Speaker notes

This skill starts after the origin package has been published. It uses the CLI to calculate the graph and update order, then presents the plan before execution. It can update direct and transitive package consumers within the target organization. Cycles or version conflicts stop the process. Applications appear in the results as stale and are not automatically republished. This is a publishing workflow, while impact analysis examines callers within a branch.

### Example prompt

> Plan a cascade for published package `<package>` version `<version>` in `<organization>`. Show the consuming packages and affected applications before executing it.

### Sources

[package-cascade](../skills/datex-studio/package-cascade/SKILL.md)

---

## Slide 20: Walkthrough: a receiving activity report

### On slide

**Request:** a new report showing received units and weight by owner.

1. `report-creator` coordinates the work.
2. Requirements skills capture fields, rules, parameters, and layout.
3. Footprint guidance and schema discovery establish the data meaning and paths.
4. Datasource creation and query verification establish field coverage.
5. Report prototyping, validation, and real-data preview establish the result.

### Speaker notes

This is an illustrative workflow, not a completed implementation. The developer supplies the branch, connection, reporting period, and business definitions. The entity expert helps identify receiving tasks and weight rules. The data coverage check exposes missing fields before layout finalization. Customer-specific exclusions require explicit evidence. After the report works, `hub-editor` can add a launch button that passes the selected filters if that integration belongs in the requested scope.

### Example prompt

> Build a receiving activity report from work item `<work_item_id>` on branch `<branch_id>` using connection `<connection_id>`. Show units and weight by owner for a date range, and verify every required field before finalizing the layout.

### Sources

[Report orchestration](../skills/datex-studio/report-creator/SKILL.md#orchestration-model), [Footprint domain guidance](../skills/footprint/footprint-entity-expert/SKILL.md), [hub-editor](../skills/datex-studio/hub-editor/SKILL.md)

---

## Slide 21: Walkthrough: a customer-specific grid change

### On slide

**Request:** extend a core grid with an extra field and an operation.

1. Research the current grid and inspect affected contracts.
2. Use `tailoring-overlay` and `grid-creator` for the UI extension.
3. Add a datasource or input form where the requirement needs one.
4. Use a function and transactional action for the operation as appropriate.
5. Validate the grid and wiring, then test the behavior in the application.

### Speaker notes

This example shows how one customer request can cross UI, data, and backend boundaries. The grid's extra field might come from its existing datasource or require secondary enrichment. A form can collect operation inputs. A function can bridge to an action when the operation needs transactional changes. Run impact analysis before altering an existing contract. The final check must exercise the new column, filters, cancellation, and the operation's intended result.

### Example prompt

> Tailor `<core_grid>` on branch `<branch_id>` to show `<extra_field>` and add `<operation>`. Reuse the existing contracts where possible, and explain any required contract changes before applying them.

### Sources

[tailoring-overlay](../skills/datex-studio/tailoring-overlay/SKILL.md), [grid-creator](../skills/datex-studio/grid-creator/SKILL.md), [function-creator](../skills/datex-studio/function-creator/SKILL.md), [action-creator](../skills/datex-studio/action-creator/SKILL.md)

---

## Slide 22: Useful starting points for common requests

### On slide

| Your request | Start with |
|---|---|
| “Explain what this component currently does” | `codebase-research` |
| “Build a new report from this work item” | `report-creator` |
| “Add a column to an existing grid” | `grid-creator`, with tailoring guidance if inherited |
| “Find why a hub filter does not reach the grid” | `component-wiring-check` |
| “Check this branch before merge” | `branch-code-reviewer` and relevant validators |
| “Summarize published changes for last week” | `prospective-release-notes` |

### Speaker notes

Natural-language requests can identify the right skill, and naming a skill explicitly removes ambiguity. Give the business outcome as well as the component name. Use a creator as the starting point for an end-to-end build so it can bring in its supporting utilities. For investigation or review, state that scope directly. Include the identifiers needed to work on the intended branch and connection.

### Sources

[Catalog](../README.md#skill-catalog), [training curriculum](training-curriculum.md)

---

## Slide 23: Current coverage and boundaries

### On slide

- **Documented:** 40 Datex Studio entries and `footprint-entity-expert`.
- **Empty placeholders:** `building-waves` and `slotting`.
- **Reference coverage without dedicated creators:** cards, lists, and frontend flows.
- **Shared runtime guidance:** scheduled jobs and execution rules.
- **Other gaps remain:** for example, dedicated calendar and wizard creator skills.

### Speaker notes

An empty skill file does not provide an operational workflow. A reference document can provide useful implementation guidance even when no dedicated creator exists. The root README's roadmap still lists cards and lists as uncovered, but the current shared library contains both references. This presentation follows the files present in the repository. Likewise, the `slotting` placeholder does not erase the separate Footprint workflow guidance for a location-recommendation extension point. Those are different scopes.

### Sources

[building-waves](../skills/footprint/building-waves/SKILL.md), [slotting](../skills/footprint/slotting/SKILL.md), [shared reference index](../skills/datex-studio/datex-studio-shared/SKILL.md), [runtime reference index](../skills/datex-studio/datex-studio-runtime/SKILL.md), [roadmap](../README.md#not-yet-covered-roadmap)

---

## Slide 24: A well-scoped first task

### On slide

**A useful request names:**

- The business outcome and acceptance criteria
- The organization, feature branch, and relevant connection
- The target component or supporting work item
- The expected output and verification scope

**A useful completion report explains:** what changed, what was checked, and what remains unresolved.

### Speaker notes

The repository recommends installing the complete catalog with `npx skills add <repo-url> --all` so supporting skills and relative references remain available. A targeted installation needs its referenced dependencies, including the shared libraries. Authentication and access through `dxs` are separate prerequisites. For onboarding, begin with a focused investigation, then make a small change on a training branch and verify it in Studio. The linked appendix provides a quick lookup for all entries.

### Example prompt

> On branch `<branch_id>` in `<organization>`, use `report-editor` to update `<report_reference>` according to work item `<work_item_id>`. Use connection `<connection_id>`, preserve the existing bindings, and report the preview and validation results.

### Sources

[Installation guidance](../README.md#installation), [branch setup](../skills/datex-studio/datex-studio-shared/branch-setup.md), [training curriculum](training-curriculum.md)

---

## Appendix: Complete skill catalog

This handout includes every `SKILL.md` entry under `skills/` at the snapshot date. “Documented” describes the presence of instructions, not a certification of runtime behavior. The group counts match Slide 3. The two placeholders appear explicitly at the end.

### Component creators: 16

| Skill | Useful for | Main result or distinction |
|---|---|---|
| [action-creator](../skills/datex-studio/action-creator/SKILL.md) | Transactional entity operations and status changes | Server action with commit/rollback behavior |
| [backend-test-creator](../skills/datex-studio/backend-test-creator/SKILL.md) | Backend regression and behavior tests | Mocha suite with lifecycle hooks and test cases |
| [custom-angular-component-creator](../skills/datex-studio/custom-angular-component-creator/SKILL.md) | UI that needs bespoke Angular code | Typed component authored through `dxs ng` |
| [datasource-creator](../skills/datex-studio/datasource-creator/SKILL.md) | Supplying OData or computed results to consumers | Cloud or server-tier datasource, with the appropriate contract |
| [editor-creator](../skills/datex-studio/editor-creator/SKILL.md) | Viewing and editing a single entity | Record loading, validation, and save lifecycle |
| [embed-creator](../skills/datex-studio/embed-creator/SKILL.md) | External pages or generated HTML previews | Iframe-based component |
| [endpoint-creator](../skills/datex-studio/endpoint-creator/SKILL.md) | Exposing a flow or datasource as an HTTP API | Endpoint in an API Application |
| [footprint-workflows](../skills/datex-studio/footprint-workflows/SKILL.md) | Custom behavior at a Footprint extension point | Workflow implementation bound to a platform-defined slot |
| [form-creator](../skills/datex-studio/form-creator/SKILL.md) | Collecting and validating operation inputs | Form or dialog that returns values to its caller |
| [function-creator](../skills/datex-studio/function-creator/SKILL.md) | Backend orchestration, storage access, and UI bridges | New or modified function |
| [grid-creator](../skills/datex-studio/grid-creator/SKILL.md) | Tabular data, filters, sorting, and row interactions | New or modified grid and its data contracts |
| [hub-creator](../skills/datex-studio/hub-creator/SKILL.md) | A new container page with filters and tabs | Hub with wired component references |
| [report-creator](../skills/datex-studio/report-creator/SKILL.md) | Building a new printable report | RDLX-JSON report, supporting data, preview, and verification |
| [selector-creator](../skills/datex-studio/selector-creator/SKILL.md) | Entity or enum selection | Datasource-backed dropdown or autocomplete |
| [storage-creator](../skills/datex-studio/storage-creator/SKILL.md) | Persisting a feature's own settings, rules, or snapshots | Mongo-backed storage definition |
| [type-definition-creator](../skills/datex-studio/type-definition-creator/SKILL.md) | Shared data contracts and enumerated values | Interface or enum configuration |

### Component editors: 2

| Skill | Useful for | Main result or distinction |
|---|---|---|
| [hub-editor](../skills/datex-studio/hub-editor/SKILL.md) | Existing hub toolbar buttons and click flows | Focused hub update, including report launch wiring |
| [report-editor](../skills/datex-studio/report-editor/SKILL.md) | Existing report content, layout, or data changes | Incremental update at the required change depth |

### Tailoring: 1

| Skill | Useful for | Main result or distinction |
|---|---|---|
| [tailoring-overlay](../skills/datex-studio/tailoring-overlay/SKILL.md) | Customer extensions of core components | Inherited overlay or flattened independent custom variant |

### Validators: 3

| Skill | Useful for | Main result or distinction |
|---|---|---|
| [component-validator](../skills/datex-studio/component-validator/SKILL.md) | Auditing a supported individual component | Type-specific blockers, warnings, and nits |
| [grid-validator](../skills/datex-studio/grid-validator/SKILL.md) | Auditing a grid after any edit | Grid-specific findings, including filter and rendering contracts |
| [project-validator](../skills/datex-studio/project-validator/SKILL.md) | Checking a branch or selected project scope | Findings across five categories of cross-component consistency |

### Shared libraries: 3

| Skill | Useful for | Main result or distinction |
|---|---|---|
| [datex-studio-shared](../skills/datex-studio/datex-studio-shared/SKILL.md) | Operational procedures and common implementation references | Branch setup, round-trips, reports, design system, and additional component references |
| [datex-studio-conventions](../skills/datex-studio/datex-studio-conventions/SKILL.md) | Consistent component authoring | Naming, file format, defaults, and universal checks |
| [datex-studio-runtime](../skills/datex-studio/datex-studio-runtime/SKILL.md) | Correct behavior in each execution context | Runtime globals, call rules, controls, and scheduled-job guidance |

### Utilities: 14

| Skill | Useful for | Main result or distinction |
|---|---|---|
| [branch-code-reviewer](../skills/datex-studio/branch-code-reviewer/SKILL.md) | Assessing pending branch changes | Review findings, work item alignment, and a verdict |
| [codebase-research](../skills/datex-studio/codebase-research/SKILL.md) | Focused questions about existing configurations | Read-only answer with sources and caveats |
| [commit-message-generator](../skills/datex-studio/commit-message-generator/SKILL.md) | Describing a branch's changes with ticket traceability | Draft message, plus a CRM reverse-link update when applicable |
| [component-scaffolder](../skills/datex-studio/component-scaffolder/SKILL.md) | Starting a supported new component from its documented skeleton | Minimum valid branch component and handoff to its creator |
| [component-wiring-check](../skills/datex-studio/component-wiring-check/SKILL.md) | Diagnosing broken component references or value propagation | Read-only audit of modules, parameters, and variable declarations |
| [db-query](../skills/datex-studio/db-query/SKILL.md) | Correct `$db` storage access inside functions | Predicate and mutation guidance for a calling creator skill |
| [devops-requirements](../skills/datex-studio/devops-requirements/SKILL.md) | Extracting Azure DevOps requirements | Structured work item evidence and attachment context |
| [impact-analysis](../skills/datex-studio/impact-analysis/SKILL.md) | Preparing a contract-breaking change | Direct-caller analysis, including storage readers and writers |
| [odata-execution](../skills/datex-studio/odata-execution/SKILL.md) | Building or debugging an OData query | Incrementally verified query |
| [post-edit-verification](../skills/datex-studio/post-edit-verification/SKILL.md) | Checking a component immediately after an edit | JSON and description checks, plus appropriate audit escalation |
| [prospective-release-notes](../skills/datex-studio/prospective-release-notes/SKILL.md) | Release notes for a date range | Published release anchors and handoff to release-note generation |
| [release-notes-generator](../skills/datex-studio/release-notes-generator/SKILL.md) | Explaining changes between two releases | Technical and customer notes covering relevant dependencies |
| [requirements-gathering](../skills/datex-studio/requirements-gathering/SKILL.md) | Turning mixed source material into a usable specification | Requirements brief with field meaning, business rules, and layout needs |
| [schema-explorer](../skills/datex-studio/schema-explorer/SKILL.md) | Discovering connection-specific OData structure | Verified field, relationship, key, and index information |

### Package orchestration: 1

| Skill | Useful for | Main result or distinction |
|---|---|---|
| [package-cascade](../skills/datex-studio/package-cascade/SKILL.md) | Updating consumers of an already published package | Re-pinned and republished packages, with stale applications reported separately |

### Footprint: 3 entries, including 2 placeholders

| Skill | Status | Useful for |
|---|---|---|
| [building-waves](../skills/footprint/building-waves/SKILL.md) | Empty placeholder | No documented workflow yet |
| [footprint-entity-expert](../skills/footprint/footprint-entity-expert/SKILL.md) | Documented | WMS entity meaning, navigation, statuses, weight calculations, and other domain pitfalls |
| [slotting](../skills/footprint/slotting/SKILL.md) | Empty placeholder | No documented workflow yet |

### Additional reference coverage

These files expand the catalog's usefulness without adding separate skills to the count:

| Reference | Useful for |
|---|---|
| [Cards](../skills/datex-studio/datex-studio-shared/cards.md) | Repeated item UI, inline editing, and refresh behavior |
| [Lists](../skills/datex-studio/datex-studio-shared/lists.md) | Card-based collections and datasource/item wiring |
| [Frontend flows](../skills/datex-studio/datex-studio-shared/frontend-flows.md) | Browser-tier flow behavior and keyboard handling |
| [Scheduled jobs](../skills/datex-studio/datex-studio-runtime/scheduled-jobs.md) | Background execution and recurring job lifecycle |
| [Datex app design system](../skills/datex-studio/datex-studio-shared/design-system/README.md) | Styling hand-authored UI using the shared Datex design language |
| [Training curriculum](training-curriculum.md) | Hands-on learning beyond the catalog overview |
