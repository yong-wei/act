## ADDED Requirements

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
