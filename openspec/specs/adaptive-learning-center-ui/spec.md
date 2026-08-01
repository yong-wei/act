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
The adaptive learning center SHALL display generated path options as comparable, actionable route choices where each option is a complete decision module and not a detached action target.

#### Scenario: Options are shown after generation
- **WHEN** generation succeeds
- **THEN** the UI SHALL show three comparable path options when distinct active, preparation, or locked-route structures are available
- **AND** each option SHALL show estimated duration, resource mix, current recommendation reason, readiness state, checkpoints, unlockable heavy nodes, expected result, and risk note
- **AND** each option SHALL keep its primary selection action, adjustment action, rejection action, and explanation action inside the same visual and DOM module as the option content.

#### Scenario: Student chooses an option
- **WHEN** the student selects, asks Konling to adjust, rejects, or asks why an option was recommended
- **THEN** the action SHALL be recorded through governed path activity
- **AND** the UI SHALL preserve other options as alternatives until a later recalculation or explicit dismissal.

#### Scenario: Desktop comparison is rendered
- **WHEN** the path-selection workspace renders on desktop
- **THEN** the options SHALL remain directly comparable through aligned fields, shared labels, and stable resource icons
- **AND** the UI SHALL NOT require the student to match a path column in one region with a separate action card or detached action strip in another region
- **AND** keyboard focus order SHALL move through each option's content and actions before moving to the next option.

### Requirement: Generation panel follows Product Design visual contract
The generation panel and comparison view SHALL be accepted against the Product Design visual sources.

#### Scenario: Visual QA is performed
- **WHEN** this change is implemented
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`
- **AND** it SHALL compare screenshots against `02-path-selection-comparison.png`
- **AND** it SHALL cite current-state screenshots or notes from `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/`
- **AND** it SHALL demonstrate that each path option's actions are attached to the same visual and DOM module as that option.

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

### Requirement: Path-launched resources return to the path center
The adaptive learning center SHALL provide a path-aware launch and return contract for every resource opened from a selected path.

#### Scenario: Student launches a path node
- **WHEN** the student starts a knowledge, interactive lesson, adaptive assessment, simulation, control workbench, Arena, reflection, external resource, or Konling node from the current path
- **THEN** the launch target SHALL receive a normalized path launch context containing source, goal id, path id, node id, route intent, return href, and resource type
- **AND** the visible resource destination SHALL have enough context to return to the same path execution workspace.

#### Scenario: Student uses the resource return control
- **WHEN** a resource or course runtime was opened from a valid path launch context
- **THEN** the visible return control SHALL read as `返回学习路径` or equivalent path-specific language
- **AND** it SHALL return to the adaptive path execution workspace for the same path and node.

#### Scenario: Resource is opened outside a path
- **WHEN** the same resource is opened from Interactive Learning, a course entry, or another non-path surface
- **THEN** the resource SHALL keep its normal contextual return target
- **AND** it SHALL NOT fabricate a path return when no path launch context exists.

### Requirement: Adaptive path center restores the learner's current journey
The adaptive path center SHALL treat the learner's selected path as the default journey object when the student returns to the center.

#### Scenario: Active path exists and no deep link is supplied
- **WHEN** an authenticated student opens `/assessment/adaptive-practice` without `pathId`, `nodeId`, or a path-specific intent
- **THEN** the page SHALL load the latest active path for the current user and supported goal where available
- **AND** it SHALL render the path execution/resume workspace before cold-start generation or preset goal choices.

#### Scenario: Completed path exists and no active path exists
- **WHEN** an authenticated student opens the path center and the latest path is completed
- **THEN** the page SHALL show a completed-path summary with path name, completed node count, completion time when available, evidence status, and next recommended action
- **AND** it SHALL keep `生成新路径` or `切换目标` as secondary actions.

#### Scenario: No path exists
- **WHEN** no active, fallback, or completed path can be read for the student
- **THEN** the page SHALL render the cold-start generation state with student-facing language
- **AND** it SHALL NOT imply that a previously selected path was lost.

### Requirement: Path execution shows durable completion effects after return
The adaptive path center SHALL show node completion and next-node advancement from governed path execution state after students return from launched resources or re-enter the center.

#### Scenario: Path node completion is recorded
- **WHEN** a path node writes a governed `completed` execution event
- **THEN** the path center SHALL mark that node as completed, show its evidence or result state, and make the next eligible node the visible current node
- **AND** completed-node review and continued interaction SHALL remain separate from the original completion.

#### Scenario: Completion result is still pending
- **WHEN** a path node reports local completion but the required path execution or typed result reference is not yet bound
- **THEN** the path center SHALL show `结果待同步` or equivalent student-facing pending language
- **AND** dependent nodes SHALL remain blocked or locked until the required path execution state is available.

#### Scenario: Student leaves and returns later
- **WHEN** the student leaves the path center after selecting or completing part of a path and later returns
- **THEN** the selected path, completed nodes, current node, evidence summary, and alternatives SHALL remain visible without requiring the original selection URL.

### Requirement: Adaptive path entrypoints follow the LearningGoal catalog
The adaptive learning center SHALL derive path generation entrypoints, goal selector options, labels, descriptions, route targets, and active-goal state from the registered `path-ready` LearningGoal catalog.

#### Scenario: Student opens generic path generation
- **WHEN** a student opens `/assessment/adaptive-practice` without a specific goal
- **THEN** the page SHALL render all registered `path-ready` LearningGoals as selectable generation targets
- **AND** the available target count SHALL match the backend LearningGoal catalog rather than a page-local hard-coded allow-list.

#### Scenario: Student changes the generation goal
- **WHEN** the student changes the learning goal in the generation panel
- **THEN** the active goal, URL query, stored generation parameters, latest-path lookup, path selection, path execution links, and return context SHALL use the selected LearningGoal id
- **AND** the page SHALL NOT coerce non-control-correction goals back to `control-correction`.

#### Scenario: Student views a non-control-correction path
- **WHEN** a generated or restored path belongs to any registered LearningGoal
- **THEN** the path map, current-node panel, completed-path summary, evidence review links, and generate-new-path actions SHALL display the owning LearningGoal metadata
- **AND** page state and helper behavior SHALL remain active-goal based rather than control-correction specific.

#### Scenario: Unknown goal is requested
- **WHEN** the route query names a goal id that is not present in the registered LearningGoal catalog
- **THEN** the page SHALL render a student-safe unavailable state or fall back to the generic path center
- **AND** it SHALL NOT generate a path, register a Konling context, or fetch latest paths for the unknown goal.

### Requirement: Dynamic LearningGoal entrypoints expose student-facing metadata
The adaptive learning center SHALL use LearningGoal metadata to explain every generation target before the student asks Konling or the planner to generate a path.

#### Scenario: Path-ready goal option renders
- **WHEN** a path-ready LearningGoal appears in the generation selector or entry surface
- **THEN** the option SHALL show student-facing title, description or completion meaning, learning intent, recommended phase, terminal-validation expectation, and any student-safe limitation where available
- **AND** the text SHALL come from the LearningGoal catalog projection rather than duplicated page literals.

#### Scenario: Current catalog is audited
- **WHEN** adaptive path center tests run against the current catalog
- **THEN** all nine current path-ready LearningGoals SHALL be visible through the generation entrypoint projection
- **AND** adding another path-ready LearningGoal without complete entrypoint metadata SHALL fail a catalog or UI contract test.

### Requirement: Student path intents shall render truthful recovery states
Adaptive path selection, execution, evidence review, and bad path contexts SHALL render truthful student-facing states instead of normal progress when the backing path or evidence is unavailable.

#### Scenario: `path-selection`, `path-execution`, or `evidence-review` is opened without a valid active path or evidence context
- **WHEN** `path-selection`, `path-execution`, or `evidence-review` is opened without a valid active path or evidence context
- **THEN** the page SHALL explain the missing context, preserve the intended action, and offer generation, evidence review, or return actions.

#### Scenario: a path node launches a resource
- **WHEN** a path node launches a resource
- **THEN** returning to the center SHALL restore path id, node id, goal id, completion state, and evidence summary when available.

### Requirement: Student learning work shall write back or explain limits
Student missions, adaptive practice, evidence review, growth recommendations, and portfolio actions SHALL either write governed completion evidence or show why writeback is unavailable.

#### Scenario: a student completes a task, practice, review, or portfolio action
- **WHEN** a student completes a task, practice, review, or portfolio action
- **THEN** the surface SHALL show completion state, evidence source, review state, and effect on later recommendations.

#### Scenario: evidence cannot be written or matched because of lessonId, sourceEventId, or slug mismatch
- **WHEN** evidence cannot be written or matched because of lessonId, sourceEventId, or slug mismatch
- **THEN** the UI SHALL expose a recovery state and the implementation SHALL avoid presenting fabricated completion.

### Requirement: Adaptive path generation shall explain readiness blockers
Adaptive path generation SHALL expose actionable readiness states when learner data, class binding, teacher binding, advisor permission, or services prevent generation.

#### Scenario: generation preconditions are missing
- **WHEN** a student opens path generation and class binding, teacher binding, learner state, advisor context, or evidence prerequisites are missing
- **THEN** the UI SHALL show the specific safe blocker category, a student-facing next action, and a staff-facing remediation path when applicable.
- **AND** it SHALL NOT display a normal path-generation action that can only fail with a generic retry message.

#### Scenario: generation dependency service fails
- **WHEN** learner-state, advisor-context, or planner support services return unavailable, forbidden, or retryable errors
- **THEN** the generation surface SHALL distinguish unavailable, forbidden, and retryable states.
- **AND** available citations, evidence summaries, or fallback learning suggestions SHALL remain visible at reduced personalization confidence.

### Requirement: Adaptive generation audit closure shall avoid archived path-execution scope
Adaptive generation readiness findings SHALL be closed only for precondition and service-error behavior, not for already archived path execution and recovery scope.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference readiness tests or UI evidence and SHALL explicitly avoid re-closing findings covered by `audit-remediation-student-path-evidence-loop-closure`.

### Requirement: Path execution uses a compact inline journey
The adaptive learning center SHALL render an active path as a compact ordered journey whose focused node expands in place with its details and actions.

#### Scenario: Student scans a long path
- **WHEN** an active path contains multiple completed, current, future, or locked nodes
- **THEN** the UI SHALL render compact node summaries connected by a continuous adaptive line
- **AND** the current and focused nodes SHALL remain identifiable without requiring the student to scroll to a separate detail panel.

#### Scenario: Student focuses a node
- **WHEN** the student activates a path node
- **THEN** that same node container SHALL expand to show its recommendation reason, estimated time, evidence, checkpoint or result state, and allowed actions
- **AND** another previously expanded node SHALL collapse.

#### Scenario: Path execution renders on a narrow viewport
- **WHEN** the execution workspace renders at a width from 320px to 375px
- **THEN** module titles, summaries, current-node labels, metrics, nodes, and actions SHALL reflow without single-character columns, overlap, clipping, or horizontal page scrolling.

### Requirement: Path nodes distinguish resource type from execution state
The adaptive learning center SHALL encode resource type and execution state as separate accessible visual dimensions.

#### Scenario: Mixed resource path renders
- **WHEN** a path contains knowledge, lesson, assessment, simulation, control-workbench, Arena, reflection, external-resource, or Konling nodes
- **THEN** each resource type SHALL use a stable low-saturation semantic tone limited to node markers, accent edges, icons, or soft local backgrounds together with a visible type label
- **AND** current, completed, skipped, blocked, and locked states SHALL use independent icons, labels, borders, or availability cues.

#### Scenario: Color information is unavailable
- **WHEN** a student cannot distinguish the resource or state colors
- **THEN** the icon, text label, state label, and control availability SHALL still identify both resource type and execution state.

### Requirement: Path execution prioritizes the active learning task
The path execution intent SHALL place the compact journey and current action before secondary summaries and management surfaces.

#### Scenario: Active path execution opens
- **WHEN** the route intent is `path-execution`
- **THEN** the page SHALL show a compact path heading, essential progress, and the journey before learning history, resource entry, or management modules
- **AND** it SHALL NOT repeat equivalent hero, recommendation, current-node, and six-card statistics as equal-priority regions.

### Requirement: Path-launched resources expose continuous journey controls
Every governed path node type admitted to execution SHALL use a defined continuous-journey behavior. Platform-owned destinations for `interactive_lesson`, `knowledge_card`, `textbook_section`, `slides`, `adaptive_quiz`, `control_workbench`, `simulation`, `arena_task`, `reflection`, `checkpoint`, and `konling` SHALL expose the shared journey control either on the destination page or in the owning path-center activity. `external_resource` SHALL use the governed external fallback. Any page rendered with a valid path launch context SHALL expose no more than one visible action whose normalized target and user-facing semantics are equivalent to `返回学习路径`.

#### Scenario: Resource is still incomplete
- **WHEN** a path-launched resource has not produced accepted completion evidence
- **THEN** `返回学习路径` SHALL remain available exactly once within the active journey action surface
- **AND** the next action SHALL be disabled or replaced by an explicit blocked or pending-result status.

#### Scenario: Ready action duplicates the return action
- **WHEN** the projected ready, completion, or recovery action resolves to the same normalized href and return semantics as the journey return action
- **THEN** the journey control SHALL render only the owned `返回学习路径` action
- **AND** it SHALL NOT render the equivalent projected action as a second control.

#### Scenario: Resource completion advances the path
- **WHEN** the server accepts completion evidence and returns a ready next action with a different normalized target
- **THEN** the resource surface SHALL enable a visible action naming the next node
- **AND** the student SHALL be able to enter that node without first returning to the path center.

#### Scenario: Path-center activity completes
- **WHEN** an adaptive assessment, checkpoint, reflection, or Konling activity is executed inside the path center
- **THEN** the owning node SHALL retain the same inline journey control and update its next action from the accepted completion response
- **AND** the student SHALL NOT need to close the activity and activate `开始学习` again.

#### Scenario: External resource cannot host journey controls
- **WHEN** an `external_resource` target leaves the platform
- **THEN** the platform SHALL keep the path center available while opening the external target in a separate browsing context
- **AND** returning to the path center SHALL refresh journey state and use governed explicit-access or completion evidence before enabling the next node without requiring another `开始学习` action.

#### Scenario: Owned destination lacks journey integration
- **WHEN** a platform-owned path target has not implemented the shared journey control or owning path-center behavior
- **THEN** the node SHALL NOT be presented as continuous-journey ready
- **AND** the UI SHALL expose a verifiable fallback or block execution rather than silently lose path context.

#### Scenario: Final node completes
- **WHEN** accepted completion leaves no further executable node
- **THEN** the journey control SHALL show path completion or terminal-validation status
- **AND** its primary continuation SHALL lead to the same path's summary rather than fabricate another node.

#### Scenario: Resource opens outside a path
- **WHEN** a destination page has no valid path launch context
- **THEN** its normal contextual return action SHALL remain available
- **AND** the page SHALL NOT fabricate or duplicate a `返回学习路径` action.

### Requirement: Student portrait surfaces render the canonical cumulative state
Student profile and growth surfaces SHALL render the canonical cumulative
portrait, overall diagnosis, last trend, last risk, cumulative evidence
summary, newest activity, and meaningful growth events from one learner-state
response.

#### Scenario: Learner has cumulative evidence without newer activity
- **WHEN** a learner with a valid cumulative portrait opens profile or growth without newer facts
- **THEN** the page SHALL display the existing portrait values, overall level, diagnosis, trend, risk, and evidence cutoff
- **AND** it SHALL NOT create an activity-window portrait, empty state, risk, trend, or diagnosis.

#### Scenario: Learner has partial dimension coverage
- **WHEN** a learner has valid evidence for only some portrait dimensions
- **THEN** the page SHALL display values for evidenced dimensions and identify missing dimensions separately
- **AND** it SHALL NOT render missing dimensions as zero or hide the entire portrait.

#### Scenario: Learner opens growth history
- **WHEN** meaningful cumulative growth events exist
- **THEN** the growth surface SHALL show those events in newest-first order with evidence type and occurrence time
- **AND** ordinary activity records SHALL remain available through the paginated evidence or activity view rather than being duplicated as growth events.

#### Scenario: Removed recent portrait route or control is requested
- **WHEN** a client requests a removed recent portrait API, query scope, route, or UI control
- **THEN** the system SHALL return an explicit unsupported-scope or removed-contract outcome
- **AND** it SHALL NOT silently render the cumulative portrait as if the recent request were accepted.

### Requirement: Learning portrait surfaces use explicit availability states
Student and teacher learning portrait surfaces SHALL preserve every available
section and explain unavailable sections with specific product-facing reasons
and actions.

#### Scenario: One section is unavailable
- **WHEN** portrait data exists but one of comparison, recommendation, growth, risk, or activity is unavailable
- **THEN** the page SHALL continue to render the available portrait and diagnosis sections
- **AND** the unavailable section SHALL show its specific reason and an applicable action instead of a generic `暂无`, `待生成`, or `无证据` message.

#### Scenario: Reconciliation is available
- **WHEN** the current user is allowed to reconcile the learner portrait
- **THEN** the page SHALL provide an update action and show queued, processing, completed, no-change, or failed status
- **AND** repeated activation SHALL reuse the idempotent learner-scoped task.

### Requirement: Teacher portrait surfaces render overall cumulative diagnosis
Teacher student-detail and class-insight surfaces SHALL use the canonical
cumulative contracts for their primary cards and SHALL present goal-specific
diagnoses only as subordinate drilldowns.

#### Scenario: Teacher opens a student detail
- **WHEN** an authorized teacher opens a current class member with cumulative portrait data
- **THEN** the page SHALL show overall level, seven-dimension coverage, strengths, improvement areas, last trend, last risk, cumulative evidence, growth summary, class comparisons where available, and evidence cutoff
- **AND** a control-correction diagnosis SHALL NOT replace the overall diagnosis.

#### Scenario: Teacher opens a class insight
- **WHEN** an authorized teacher opens a class containing members with cumulative portraits
- **THEN** the page SHALL show overall coverage, seven-dimension aggregates, trend distribution, risk distribution, strengths, improvement clusters, cumulative evidence summary, and member drilldowns
- **AND** members without a dimension SHALL be reported as missing rather than marked `累计口径不适用` or assigned zero.

### Requirement: Generated path comparison exposes ordered resource previews
The adaptive learning center SHALL present every generated, selectable path option as an ordered, read-only preview before the student chooses it. The preview SHALL use the planner-provided node order and node summaries, show the first four contiguous nodes by default, and allow the student to disclose the full route without launching a resource.

#### Scenario: Generated options include ordered node summaries
- **WHEN** the path center receives multiple generated options with ordered `nodeIds` and `nodeSummaries`
- **THEN** each formal comparison option SHALL show concrete resource title, resource type, single-node estimated time, and student-facing readiness state in the planner order
- **AND** the option SHALL reveal the remaining route through an in-module disclosure when it contains more than four nodes

#### Scenario: Generated option contains a locked node
- **WHEN** an ordered preview includes a locked node
- **THEN** the node SHALL show a student-facing locked state and its preparation or unlock condition
- **AND** the node SHALL remain non-startable until the student selects a path and receives an authorized execution context

#### Scenario: Historic path payload lacks usable node summaries
- **WHEN** an option lacks usable ordered node summaries
- **THEN** the comparison surface SHALL retain its other student-facing fields and explain that the detailed route is unavailable
- **AND** it SHALL NOT invent resource titles, order, or readiness details

### Requirement: Generated path comparison explains overlap and diversity limits
The adaptive learning center SHALL explain meaningful path differences from stable resource-node identity across the currently generated comparison set.

#### Scenario: A resource appears in all generated options
- **WHEN** the same `nodeId` occurs in every generated, selectable option
- **THEN** each occurrence SHALL be labelled “所有方案均包含”

#### Scenario: A resource appears in only one generated option
- **WHEN** a `nodeId` occurs in exactly one generated, selectable option
- **THEN** that occurrence SHALL be labelled “本方案特有”

#### Scenario: Existing planner data reports insufficient distinction
- **WHEN** existing planner diversity or limitation data establishes that available resources cannot produce meaningfully distinct options
- **THEN** the comparison region SHALL display “当前可用资源有限，推荐方案差异较小” in student-facing language
- **AND** students SHALL retain access to the route previews and path-selection actions

### Requirement: Starter examples are distinct from formal path comparisons
The adaptive learning center SHALL distinguish pre-generation starter examples from generated path options.

#### Scenario: The learner has no generated path options
- **WHEN** the path center displays starter learning approaches before a planner response
- **THEN** the UI SHALL identify them as examples rather than formal comparable paths
- **AND** it SHALL NOT apply generated-node ordering, overlap, uniqueness, or formal selection semantics to them

### Requirement: Adaptive path comparison exposes configuration fulfillment
The adaptive learning center SHALL render a student-safe configuration-fulfillment summary with generated path options. The summary SHALL identify which requested settings were applied, their planning effect where available, and which settings were unmet with an actionable reason; it SHALL not expose internal reason codes or raw free-text input.

#### Scenario: Generated options honor configuration
- **WHEN** path generation returns one or more options with fulfilled configuration entries
- **THEN** the comparison interface SHALL show the applied settings and their path effect in student-facing language
- **AND** the information SHALL remain associated with the generation result rather than only server diagnostics.

#### Scenario: Configuration or intent is unmet
- **WHEN** the planner returns an unmet configuration or unsupported free-text intent entry
- **THEN** the interface SHALL show a student-safe explanation and a corrective action where one exists
- **AND** it SHALL not claim that the unmet entry personalized the displayed options.

#### Scenario: Option count is reduced for lack of diversity
- **WHEN** the planner returns fewer than the preferred number of options because no meaningful alternative is feasible
- **THEN** the interface SHALL present the retained options as valid choices
- **AND** it SHALL explain the reduced count without rendering cosmetic placeholder options.

#### Scenario: Requested time is insufficient
- **WHEN** generation returns a minimum executable duration that exceeds the student's requested budget
- **THEN** the interface SHALL show the requested and minimum durations in student-facing language
- **AND** it SHALL offer an adjustment action without implying that the requested budget was silently changed.

### Requirement: Path difference actions display the compared path facts
The adaptive learning center SHALL render the server-owned structured result of an “解释差异” action inside the selected option's decision module and SHALL identify both compared paths.

#### Scenario: Student explains a non-recommended option
- **WHEN** a student requests an explanation for an option that is not the recommended option
- **THEN** the page SHALL compare it with the recommended option and show both path names
- **AND** the result SHALL render common nodes, each option's unique nodes, order differences, metrics, trade-offs and limitations supplied by the server.

#### Scenario: Student explains the recommended option
- **WHEN** a student requests an explanation for the recommended option
- **THEN** the page SHALL compare it with the next ordered candidate option and show both path names.

#### Scenario: Candidate path set changes
- **WHEN** path generation or revision changes the active path id or the ordered candidate node identities
- **THEN** the page SHALL remove explanations from the previous candidate path set
- **AND** it SHALL NOT present a stale result as a comparison of the new options.

#### Scenario: Difference result is read on a narrow viewport
- **WHEN** the structured explanation is displayed at a 320px viewport width
- **THEN** path names, node lists, metric labels, values, units, trade-offs and limitations SHALL remain readable without page-level horizontal overflow.

