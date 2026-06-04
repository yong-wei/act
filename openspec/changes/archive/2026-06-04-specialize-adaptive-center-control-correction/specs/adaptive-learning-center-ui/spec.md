## ADDED Requirements

### Requirement: Adaptive center specializes the control-correction learning path
The adaptive learning center SHALL provide a complete student-facing surface for the `control-correction` goal.

#### Scenario: Student opens the control-correction center
- **WHEN** a student opens the adaptive learning center with `goal=control-correction`
- **THEN** the page SHALL show the learner's control-correction competency state, current path status, next action, readiness gate, evidence timeline, citation access, and Konling support according to available feature flags
- **AND** each personalized claim SHALL expose confidence or evidence-limit metadata when applicable.

#### Scenario: Student enters from an existing adaptive route
- **WHEN** a student enters from homepage, cockpit, profile, adaptive practice, or a contextual recommendation
- **THEN** the center SHALL preserve the route intent for practice, learner-state review, path execution, or evidence review
- **AND** it SHALL not lose the original task intent during migration.

#### Scenario: Control-correction data is incomplete
- **WHEN** learner state, path, questions, citations, or evidence are unavailable, stale, low-confidence, or feature-flagged off
- **THEN** the surface SHALL render a branded actionable fallback with recovery or adjacent actions
- **AND** it SHALL NOT show a blank task area.

### Requirement: Control-correction center supports path execution launches
The adaptive learning center SHALL launch control-correction ResourceNodes while preserving path context.

#### Scenario: Student launches a node
- **WHEN** the student opens a knowledge, exercise, simulation, Arena, reflection, or AI-intervention node from the path map or next-action card
- **THEN** the launch target SHALL carry the owning path id, node id, goal id, and route intent where supported
- **AND** returning to the center SHALL restore the same path context unless the path was recalculated.
