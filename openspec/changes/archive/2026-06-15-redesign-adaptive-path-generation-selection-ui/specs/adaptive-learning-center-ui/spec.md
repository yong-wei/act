## ADDED Requirements

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

## MODIFIED Requirements

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
