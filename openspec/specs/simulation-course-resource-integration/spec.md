## Purpose

Define how eligible virtual simulations and Arena workbench activities participate in the DB BOPPPS course-resource chain while preserving standalone simulation access.
## Requirements
### Requirement: Simulations can be registered as course resources
The system SHALL allow eligible standalone virtual simulations to be registered as `SIMULATION_APP` course resources with stable registry ids.

#### Scenario: Lesson item references simulation resource
- **WHEN** a DB BOPPPS lesson item references an eligible simulation resource id
- **THEN** the renderer SHALL launch the registered simulation without requiring a component path in the lesson plan

### Requirement: Course config selects scene or task
The system SHALL allow registry default config, `TeachingResource.config`, and `LessonItem.overrideConfig` to select scene id, scenario id, Arena task id, launch mode, telemetry policy, and governance context where applicable.

#### Scenario: Teacher configures a simulation lesson item
- **WHEN** a teacher creates or clones a lesson item with simulation override config
- **THEN** the resource SHALL launch with the configured scene or task and preserve governance context

#### Scenario: Config values overlap
- **WHEN** registry default config, `TeachingResource.config`, and `LessonItem.overrideConfig` provide overlapping simulation fields
- **THEN** the system SHALL resolve them in the order registry default config, then `TeachingResource.config`, then `LessonItem.overrideConfig`

### Requirement: Standalone routes remain available
The system SHALL preserve existing standalone `/simulations/*` routes while adding course-resource launch support.

#### Scenario: Student opens standalone simulation route
- **WHEN** a student opens a standalone simulation route
- **THEN** the route SHALL remain available and record standalone launch context rather than course/class/session context

#### Scenario: Student opens the simulation catalog
- **WHEN** a student opens `/simulations`
- **THEN** the page SHALL be the canonical standalone simulation catalog.
- **AND** it SHALL NOT expose model deployment status, task-chain status, preparing/open model counts, or model file paths as student-facing availability truth.
- **AND** existing `/simulations/*` scene deep links SHALL remain reachable.

### Requirement: Course-launched simulation emits learning evidence context
The system SHALL attach course, class, and session context to simulation learning evidence when launched from a DB BOPPPS lesson.

#### Scenario: Course-launched simulation completes
- **WHEN** a student completes a course-launched simulation
- **THEN** the resulting evidence SHALL include available course/class/session context

#### Scenario: Session context is missing
- **WHEN** a simulation resource is launched without class or session context
- **THEN** the resulting evidence SHALL be marked as standalone or context-limited instead of inventing course-bound context

### Requirement: Course-launched simulations participate in progress events
The system SHALL allow lesson-engine launched `SIMULATION_APP` resources to emit progress and completion events through the shared resource event boundary when the simulation reports meaningful completion.

#### Scenario: Simulation reports completion
- **WHEN** a course-launched simulation reports completion
- **THEN** the lesson engine SHALL be able to record resource progress or completion with the resolved resource id, scene id, and launch context

### Requirement: Simulation catalog follows Product Design handoff
The simulation catalog SHALL use `artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md` as the design source of truth and SHALL use concept 1 as the bounded visual/layout reference according to the handoff's adopted and rejected guidance.

#### Scenario: Student opens the simulation catalog
- **WHEN** a student opens `/simulations`
- **THEN** the page SHALL present an AppShell-continuous catalog with breadcrumb, virtual simulation title, search or filter controls, category or mode controls, and efficient simulation browsing
- **AND** the browsing experience SHALL expose simulation name, preview, control topic, difficulty, course/task fit, recent or continuation context where available, and launch action
- **AND** the page SHALL NOT expose model deployment status, model version state, model file path, preparing/open model counts, or role switching as primary student information.

#### Scenario: Product Design source is reviewed
- **WHEN** the catalog implementation is reviewed
- **THEN** review evidence SHALL reference `design-handoff.md` and `concepts/concept-1-platform-continuity.png`
- **AND** the evidence SHALL explain which accepted catalog elements are implemented and which rejected concept details remain absent.

#### Scenario: Virtual lab compatibility entry renders
- **WHEN** `/virtual-lab` is preserved as a compatibility entry
- **THEN** it SHALL follow exactly one handoff-approved role: redirect to `/simulations`, render as a model-library subpage under the `/simulations` information architecture, or render as a compatibility entry that fully reuses the `/simulations` catalog structure and data contract
- **AND** it SHALL NOT present open counts, task state, resource availability, launch actions, or entry semantics that conflict with `/simulations`
- **AND** implementation evidence SHALL identify which of the three handoff-approved compatibility roles was chosen.

### Requirement: Simulation catalog inherits platform handoff navigation contracts
Virtual simulation catalog surfaces SHALL inherit the handoff's merged platform navigation decisions rather than introducing simulation-local navigation variants.

#### Scenario: Student uses the simulation catalog shell
- **WHEN** a student opens `/simulations` or its `/virtual-lab` compatibility entry
- **THEN** the top-right shell area SHALL remain user-center oriented rather than showing a student/teacher role switch
- **AND** the left navigation SHALL support the handoff-approved collapsed icon rail and expanded text state without leaving nonresponsive side whitespace
- **AND** the shared Konling dock SHALL remain a single bottom-right entry that does not duplicate into a local assistant column or obscure catalog content.

### Requirement: Simulation learning mission semantics follow accepted handoff scope
Simulation course or mission surfaces SHALL apply concept 3 only for accepted task-chain, evidence, next-action, and resource-continuity semantics.

#### Scenario: Course-launched or task-launched simulation renders
- **WHEN** a simulation surface has course, task, Arena, or evidence context
- **THEN** it SHALL show current objective, task step or mission state, evidence or submission state, and next action where data exists
- **AND** it SHALL preserve AppShell continuity and the shared Konling dock
- **AND** it SHALL NOT add a page-local student/teacher role switch or duplicate assistant region.

#### Scenario: Control Workbench mission sample renders
- **WHEN** `/interactive-learning/control-workbench` or a course-embedded simulation resource is used as the Concept 3 acceptance sample
- **THEN** it SHALL show the current learning objective, task chain or current step, evidence or submission status, next learning action, and the shared Konling entry from the same course/task/resource context when that data exists
- **AND** if complete mission data is not available, it SHALL degrade to teaching-facing resource context, current objective, and next action copy without rendering fake task progress, placeholder evidence counts, or static decorative mission UI
- **AND** visual evidence SHALL prove the sample remains integrated with the shared simulation shell and does not create a separate role-based studio.

