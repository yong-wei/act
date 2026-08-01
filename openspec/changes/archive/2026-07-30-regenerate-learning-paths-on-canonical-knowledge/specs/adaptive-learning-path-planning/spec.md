## ADDED Requirements

### Requirement: Unfinished Legacy paths stop at authority cutover
Every unfinished path whose steps reference Legacy knowledge MUST stop execution at production authority cutover and remain available as an immutable historical record.

#### Scenario: Learner has an active Legacy path
- **WHEN** the cutover transaction runs
- **THEN** the path SHALL enter a read-only stopped state and no Legacy step SHALL execute afterward

### Requirement: Path goals survive without step mapping
The system SHALL preserve the declared learning goal or user intent of a stopped Legacy path without mapping its node sequence to Canonical Objects.

#### Scenario: Goal is preserved
- **WHEN** a stopped path contains a valid goal or intent
- **THEN** that goal SHALL remain available as input to later replanning while the Legacy steps remain historical

### Requirement: Canonical paths are independently regenerated
When a formal ActKG Teaching Projection is active, the planner SHALL generate a new path identity from the preserved goal, current cumulative portrait, version-matched CourseCoverage, reviewed KAQ bindings, and supported Canonical teaching relations. An engineering-only ReleaseSet without formal Teaching Projection MUST NOT satisfy this gate.

#### Scenario: Teaching semantics are ready
- **WHEN** all required Canonical planning inputs pass validation
- **THEN** the planner SHALL create a new path with Canonical IDs and versions and no inherited Legacy progress

#### Scenario: Teaching semantics are unavailable
- **WHEN** the released graph lacks a formal Teaching Projection or required teaching relations
- **THEN** the planner SHALL keep the goal pending and MUST NOT infer a path from engineering relations or Legacy fallback
