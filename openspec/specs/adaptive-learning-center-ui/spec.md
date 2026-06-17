## Purpose

Define the unified student-facing adaptive learning center and migration compatibility for existing adaptive, AI, and profile surfaces.
## Requirements
### Requirement: Adaptive learning center unifies student adaptive surfaces
The system SHALL define a unified adaptive learning center UI contract for learner state, mastery, path visualization, evidence explanation, adaptive practice, and Konling support.

#### Scenario: Adaptive center contract is consumed
- **WHEN** a student-facing adaptive surface consumes the adaptive learning center contract
- **THEN** the contract SHALL expose overview, learner-state, mastery, current path, map, timeline, evidence explanation, practice, and Konling views according to available feature flags.

### Requirement: Existing adaptive routes remain compatible
The system SHALL keep existing adaptive and AI surfaces operational during migration.

#### Scenario: Legacy adaptive route is opened
- **WHEN** `/ai`, `/ai/copilot`, `/assessment/adaptive-practice`, or profile adaptive cards are opened during migration
- **THEN** the route SHALL either render the compatible legacy surface or route into the adaptive center without losing the original task intent.

### Requirement: Adaptive claims expose confidence and evidence limits
The system SHALL represent source coverage, confidence, privacy scope, and evidence limitations in product language for students and diagnostic language only for authorized teacher/admin surfaces.

#### Scenario: Path personalization is low confidence
- **WHEN** a path, recommendation, mastery state, or Konling intervention is based on weak or incomplete evidence
- **THEN** the student UI SHALL explain the next usable action and why personalization will improve later
- **AND** internal limiting reason codes SHALL NOT appear in the student path center.

### Requirement: Adaptive learning entry preserves route intent
The adaptive learning center SHALL preserve the intent of the route that opened it and render a complete commercial entry state for practice, learner state, path, and review.

#### Scenario: Student enters adaptive practice from homepage
- **WHEN** a student opens `/assessment/adaptive-practice` from homepage, cockpit, profile, or a contextual recommendation
- **THEN** the page SHALL preserve the practice intent
- **AND** it SHALL show available questions, a loading state, or an evidence-limited fallback instead of a blank task area.

### Requirement: Adaptive empty states are branded and actionable
Adaptive learning empty states SHALL be visually complete, student-facing, and actionable.

#### Scenario: No adaptive question can be rendered
- **WHEN** the adaptive question list is empty because of evidence coverage, network state, feature flags, or data readiness
- **THEN** the surface SHALL explain the state in student-facing language
- **AND** it SHALL provide recovery or adjacent actions such as retry, learner-state review, Interactive Learning, or profile evidence review.

### Requirement: Learner data surfaces share one product shell
The adaptive learning center SHALL provide a shared learner data shell for dashboard, profile, growth center, evidence, adaptive practice, and recommended path surfaces.

#### Scenario: Student opens a learner data route
- **WHEN** `/dashboard`, `/profile`, `/profile/growth`, `/profile/evidence`, `/assessment/adaptive-practice`, or a recommended path surface renders
- **THEN** the surface SHALL use consistent ability dimensions, evidence status, current path, recommendation, and next-action semantics
- **AND** it SHALL preserve route identity without presenting each page as a separate product.

### Requirement: Recommended paths render as staged learning routes
The adaptive learning center SHALL render recommendations as staged route nodes where path data is available.

#### Scenario: Recommended path exists
- **WHEN** a student has an active or recommended learning path
- **THEN** the UI SHALL show stage, node, priority, confidence or evidence limitation, expected effort, source context, and launch action
- **AND** it SHALL distinguish current node, completed nodes, blocked nodes, and optional alternatives.

### Requirement: Learner data empty states are actionable
The adaptive learning center SHALL render empty, stale, low-confidence, and no-data states as complete learner-facing states.

#### Scenario: Learner data is incomplete
- **WHEN** ability profile, evidence, path, recommendation, or practice data is missing or low confidence
- **THEN** the surface SHALL explain the limitation and provide adjacent actions such as start practice, review evidence, open Interactive Learning, or enter a simulation/Arena task where available.

### Requirement: Adaptive center specializes the control-correction learning path
The adaptive learning center SHALL support `control-correction` as one registered goal while defaulting to a generic path center that can generate paths for all registered learning goals.

#### Scenario: Student opens the control-correction center
- **WHEN** a student opens the adaptive learning center with `goal=control-correction`
- **THEN** the page SHALL show the learner's control-correction competency state, current path status, next action, evidence timeline, citation access, and Konling support according to available feature flags
- **AND** each personalized claim SHALL expose confidence or evidence-limit metadata in student-safe language.

#### Scenario: Student enters from an existing adaptive route
- **WHEN** a student enters from homepage, cockpit, profile, adaptive practice, or a contextual recommendation
- **THEN** the center SHALL preserve the route intent for practice, learner-state review, path execution, or evidence review
- **AND** it SHALL not lose the original task intent during migration.

#### Scenario: Control-correction data is incomplete
- **WHEN** learner state, path, questions, citations, or evidence are unavailable, stale, low-confidence, or feature-flagged off
- **THEN** the surface SHALL render a branded actionable fallback with recovery or adjacent actions
- **AND** it SHALL NOT show a blank task area or student-visible internal reason code.

#### Scenario: Student opens the adaptive path center
- **WHEN** a student opens `/assessment/adaptive-practice` without a specific goal
- **THEN** the page SHALL render the generic path generation and selection experience
- **AND** it SHALL NOT present control-correction as the only available path generation action.

### Requirement: Control-correction center supports path execution launches
The adaptive learning center SHALL launch control-correction ResourceNodes while preserving path context.

#### Scenario: Student launches a node
- **WHEN** the student opens a knowledge, exercise, simulation, Arena, reflection, or AI-intervention node from the path map or next-action card
- **THEN** the launch target SHALL carry the owning path id, node id, goal id, and route intent where supported
- **AND** returning to the center SHALL restore the same path context unless the path was recalculated.

### Requirement: Learner center prioritizes current path and next action
The adaptive learning center SHALL present learner record and pathway state as a guided next-action surface.

#### Scenario: Student opens learner center or adaptive practice
- **WHEN** dashboard, profile, growth, evidence, or adaptive practice entry renders
- **THEN** current path, next recommended action, confidence, and missing-evidence state SHALL be visible before secondary metrics
- **AND** repeated metric cards SHALL NOT be the only hierarchy.

### Requirement: Learner record shows evidence write-back from core learning work
The adaptive learning center SHALL show how core learning work contributes to learner record and next recommendations.

#### Scenario: Evidence from learning work is available
- **WHEN** interactive lesson submission, Arena official/preview result, simulation/Workbench completion, or adaptive practice submission is available
- **THEN** learner record surfaces SHALL present freshness, confidence, source scope, missing-source state, and next action
- **AND** unavailable evidence instrumentation SHALL be shown honestly rather than fabricated as complete progress.

### Requirement: Low evidence states are actionable
The adaptive learning center SHALL turn low confidence and missing source coverage into actionable states.

#### Scenario: Evidence is incomplete
- **WHEN** learner evidence is stale, partial, missing, or low confidence
- **THEN** the UI SHALL explain what is missing and where the learner or teacher can continue
- **AND** it SHALL NOT present fabricated precision.

### Requirement: Adaptive path generation is always actionable
The student-facing adaptive learning center SHALL provide a usable path generation state for every authenticated learner.

#### Scenario: Cold-start student opens adaptive learning
- **WHEN** a student without enough learning evidence opens `/assessment/adaptive-practice`
- **THEN** the page SHALL offer generic learning path generation and starter path options
- **AND** it SHALL use language such as `证据还少，先从入门路径开始，系统会随学习过程调整。`
- **AND** it SHALL NOT display no-path failure, readiness-gate internals, or raw diagnostic reason codes.

### Requirement: Student path payloads hide internal reason codes
Adaptive learning center UI SHALL convert internal readiness and diagnostic states into product language before rendering student surfaces.

#### Scenario: Planner returns internal diagnostics
- **WHEN** planner or Konling context includes internal states such as `missing-*`, `low-evidence`, `no-path`, `stage`, or `policyFamily`
- **THEN** student-facing UI SHALL render student-readable next actions and limitations
- **AND** those raw strings SHALL remain absent from visible text, accessible labels, and student JSON embedded in the page.

### Requirement: Adaptive path center renders the approved generation interface
The adaptive learning center SHALL render a generic path generation interface aligned with the accepted design handoff.

#### Scenario: Student opens path generation
- **WHEN** a student opens `/assessment/adaptive-practice`
- **THEN** the page SHALL identify itself as `自适应学习路径中心`
- **AND** the primary action SHALL be `生成学习路径`
- **AND** it SHALL show current goal, current node, learned time, estimated total time, weekly completion, and cold-start product language where applicable.

#### Scenario: Student configures path generation
- **WHEN** the generation panel is open
- **THEN** it SHALL offer learning goal, available time, difficulty rhythm, resource preference, checkpoint, external-resource, and natural-language input controls
- **AND** Konling SHALL remain the shared right-bottom floating dock rather than a page-local right rail.

### Requirement: Adaptive path options are comparable
The adaptive learning center SHALL render generated path options as comparable learning routes.

#### Scenario: Path options are returned
- **WHEN** path generation returns multiple options
- **THEN** the UI SHALL show at least two options and preferably three
- **AND** comparison fields SHALL include estimated time, matched resources, checkpoints, suitable scenario, recommendation reason, expected outcome, and stable resource icons.
- **AND** options SHALL remain visually comparable through a list, table, or information-grid structure.
- **AND** the UI SHALL NOT render path options as isolated marketing cards that prevent direct cross-path comparison.

#### Scenario: Student acts on an option
- **WHEN** a student selects, asks Konling to adjust, or declines a path option
- **THEN** the UI SHALL record the action through governed path activity
- **AND** selection history SHALL remain visible in student-facing language.

### Requirement: Adaptive path execution shows the complete route
The adaptive learning center SHALL render selected paths as complete executable learning routes.

#### Scenario: Active path is shown
- **WHEN** a student has selected or resumed a path
- **THEN** the UI SHALL show `当前学习路径`, the full path map, the current node marked as `当前节点`, elapsed time, estimated remaining time, estimated total time, completed nodes, checkpoint pass state, and weekly learning.

#### Scenario: Node detail is shown
- **WHEN** a student focuses a path node
- **THEN** the UI SHALL show node title, recommendation reason, launch action, estimated time, evidence to collect, and checkpoint criteria where applicable.

### Requirement: Completed and unfinished node actions are governed
The adaptive learning center SHALL distinguish completed-node review/continuation from unfinished-node start/skip.

#### Scenario: Completed node is opened
- **WHEN** a student opens a completed node
- **THEN** the UI SHALL offer `回顾`, `继续互动`, and `查看证据`
- **AND** continued interaction SHALL create new governed evidence without double-counting the original completion.

#### Scenario: Unfinished node is skipped
- **WHEN** a student attempts to skip an unfinished resource
- **THEN** the UI SHALL show `跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。`
- **AND** skip SHALL be recorded as path deviation while allowing later return.

### Requirement: Adaptive path history uses student-facing evidence language
The adaptive learning center SHALL render path history and evidence records in product language.

#### Scenario: Path history is shown
- **WHEN** a student opens path history or evidence record
- **THEN** the UI SHALL show completed nodes, elapsed time, time delta, checkpoint pass rate, review count, new evidence, and timeline events
- **AND** evidence states SHALL use `已记录`, `待复核`, `可用于推荐`, or `仅作参考`.

### Requirement: Adaptive path center uses a fluid workspace layout
The adaptive learning center SHALL use a responsive workspace layout rather than the old centered narrow page form.

#### Scenario: Desktop layout renders
- **WHEN** the path generation or comparison view renders on desktop
- **THEN** the primary content SHALL use the available AppShell workspace width with readable internal regions
- **AND** it SHALL NOT retreat into a fixed centered `max-w-*` style page that leaves the path workflow visually disconnected from the shell.

#### Scenario: Mobile layout renders
- **WHEN** the path generation or comparison view renders at 320px width
- **THEN** the UI SHALL reflow into task-first mobile panels, sheets, tabs, or vertical comparison sections
- **AND** it SHALL NOT squeeze a desktop table, sidebar, or multi-column workspace into the mobile viewport.

### Requirement: Generation and selection UI follows approved visual sources
The adaptive path generation and selection UI SHALL use the accepted handoff and concept images as visual QA inputs.

#### Scenario: Visual evidence is reviewed
- **WHEN** this UI change is accepted
- **THEN** evidence SHALL cite `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`
- **AND** it SHALL compare rendered browser screenshots against `01-path-generation-main.png`, `02-path-selection-comparison.png`, and `03-active-path-execution.png`
- **AND** an independent browser-capable visual subagent SHALL return PASS before completion.

### Requirement: Execution and history UI follows approved visual sources
The adaptive path execution and history UI SHALL use the accepted handoff and concept images as visual QA inputs.

#### Scenario: Visual evidence is reviewed
- **WHEN** this UI change is accepted
- **THEN** evidence SHALL cite `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`
- **AND** it SHALL compare rendered browser screenshots against `03-active-path-execution.png` and `04-history-evidence-record.png`
- **AND** an independent browser-capable visual subagent SHALL return PASS before completion.

### Requirement: Adaptive path center is accepted as one integrated product surface
The adaptive learning center SHALL pass integrated product QA across generation, selection, execution, history, evidence, and Konling states before the adaptive path redesign is considered complete.

#### Scenario: Integrated adaptive path surface is accepted
- **WHEN** all adaptive path child changes have been implemented
- **THEN** the center SHALL demonstrate cold-start generation, generic goal support, comparable path selection, full path execution, history/evidence record, shared Konling dock, student-safe language, and responsive light/dark layouts
- **AND** the final QA evidence SHALL compare the visible result to the accepted handoff and concept images.

### Requirement: Adaptive path center renders readiness gates in product language
The adaptive learning center SHALL show preparation, locked, and evidence-needed states without exposing internal readiness codes.

#### Scenario: Locked node is visible in a path option
- **WHEN** a generated path option includes a locked node
- **THEN** the UI SHALL label it with student-facing text such as `稍后解锁` or `Arena 暂未解锁`
- **AND** it SHALL show the preparation action required before unlock
- **AND** it SHALL NOT render internal strings such as `locked`, `low-resource-fallback`, `reasonCodes`, `policyBundle`, `missing-*`, or `terminal-validation-unavailable`.

#### Scenario: Current node is selected
- **WHEN** the selected path contains active and locked nodes
- **THEN** the path center SHALL mark exactly one eligible current node
- **AND** locked nodes SHALL be inspectable but not startable until readiness conditions are satisfied.

### Requirement: Adaptive path generation uses an editable task panel
The adaptive learning center SHALL open path generation in a focused editable task panel rather than presenting static page summaries as controls.

#### Scenario: Student opens generation
- **WHEN** a student activates `生成学习路径`, `请控灵调整`, or an empty-state generation action
- **THEN** the page SHALL open a desktop panel or mobile sheet for path generation
- **AND** the panel SHALL contain editable controls for learning goal, available time, difficulty rhythm, resource preferences, checkpoint density, external-resource permission, and natural-language intent.

#### Scenario: Student edits generation parameters
- **WHEN** the student changes any generation parameter
- **THEN** the generated request SHALL use the edited value
- **AND** the UI SHALL NOT require JSON, internal field names, or global chat input to modify path parameters.

### Requirement: Generated path options are selectable and comparable
The adaptive learning center SHALL display generated path options as comparable, actionable route choices.

#### Scenario: Options are shown after generation
- **WHEN** generation succeeds
- **THEN** the UI SHALL show three comparable path options when distinct active, preparation, or locked-route structures are available
- **AND** each option SHALL show estimated duration, resource mix, current recommendation reason, readiness state, checkpoints, unlockable heavy nodes, expected result, and risk note.

#### Scenario: Student chooses an option
- **WHEN** the student selects, asks Konling to adjust, rejects, or asks why an option was recommended
- **THEN** the action SHALL be recorded through governed path activity
- **AND** the UI SHALL preserve other options as alternatives until a later recalculation or explicit dismissal.

### Requirement: Generation panel follows Product Design visual contract
The generation panel and comparison view SHALL be accepted against the Product Design visual sources.

#### Scenario: Visual QA is performed
- **WHEN** this change is implemented
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`
- **AND** it SHALL compare screenshots against `01-path-generation-main.png` and `02-path-selection-comparison.png`
- **AND** it SHALL cite current-state screenshots from `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/`.

### Requirement: Adaptive path center renders complex-node result cards
The adaptive learning center SHALL render result cards for adaptive assessment, simulation, control workbench, and Arena path nodes.

#### Scenario: Result card is shown
- **WHEN** a completed complex node has a bound result reference
- **THEN** the path center SHALL show node name, completion status, score or attainment, key metrics, evidence source, review state, and effect on later path recommendations
- **AND** the card SHALL use student-facing evidence language.

#### Scenario: Result is missing
- **WHEN** a complex node lacks the required result binding
- **THEN** the path center SHALL show `结果待同步`
- **AND** it SHALL offer recovery actions such as `刷新结果` or `返回当前节点`
- **AND** it SHALL NOT advance the visible current node past a dependency that requires the missing result.

### Requirement: Path history includes complex-node outcomes
The adaptive learning center SHALL include complex-node outcomes in path history and evidence review.

#### Scenario: Evidence review is opened
- **WHEN** a student opens the history or evidence review state
- **THEN** adaptive assessment, simulation, control workbench, Arena, Konling intervention, skip, return, and continued-interaction records SHALL appear in one chronological student-facing timeline.

### Requirement: Adaptive path center isolates route-intent workspaces
The adaptive learning center SHALL render one primary workspace per route intent.

#### Scenario: Landing intent is opened
- **WHEN** a student opens `/assessment/adaptive-practice` without an intent
- **THEN** the page SHALL prioritize continuing the current path, generating a new path, or reviewing evidence
- **AND** it SHALL NOT render unselectable preset goals or all downstream states as the main scroll content.

#### Scenario: Path execution intent is opened
- **WHEN** a student opens `intent=path-execution` with a path id
- **THEN** the page SHALL render the selected path map, current node, node detail, and evidence summary as the primary workspace
- **AND** the generation panel SHALL be closed unless the student explicitly opens an adjustment action.

#### Scenario: Evidence review intent is opened
- **WHEN** a student opens `intent=evidence-review` with a path id
- **THEN** the page SHALL render path completion overview, timeline, selection or adjustment history, node results, Konling interventions, skip and return records, and evidence labels as the primary workspace.

### Requirement: Adaptive path center preserves path context across states
The adaptive learning center SHALL preserve selected path context while students move between generation, selection, execution, launched resources, and evidence review.

#### Scenario: Student selects a generated option
- **WHEN** the student selects a path option
- **THEN** the generation panel SHALL close
- **AND** the route SHALL enter path execution with the selected path id, selected option, current node, and alternatives available for later switching or review.

#### Scenario: Student returns from a resource
- **WHEN** a launched knowledge, exercise, simulation, workbench, Arena, or Konling activity returns to the path center
- **THEN** the same path id, node id, goal id, and route intent SHALL be restored unless the path was explicitly recalculated.

### Requirement: Adaptive path states use task-first responsive layouts
The adaptive path center SHALL provide desktop and mobile layouts tailored to each primary workspace.

#### Scenario: Desktop state renders
- **WHEN** landing, generation, selection, execution, or evidence review renders on desktop
- **THEN** the primary workspace SHALL use AppShell space with stable regions and no nested page-card layout.

#### Scenario: Mobile state renders
- **WHEN** landing, generation, selection, execution, or evidence review renders at 320px width
- **THEN** the UI SHALL use task-first panels, tabs, sheets, or vertical comparison sections
- **AND** controls and text SHALL not overlap or require desktop multi-column scanning.
