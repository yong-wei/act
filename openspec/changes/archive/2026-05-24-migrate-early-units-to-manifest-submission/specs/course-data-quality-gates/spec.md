## ADDED Requirements

### Requirement: Early runtime-first lessons are gated
The system SHALL include 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 in the runtime-first manifest submission gate inventory after migration.

#### Scenario: Early lesson missing from required inventory fails
- **WHEN** the course data-quality gate runs after early unit migration
- **THEN** `REQUIRED_RUNTIME_FIRST_GATE_LESSONS` SHALL include 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4
- **AND** the gate SHALL fail if any of those lessons is missing from `COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY`.

#### Scenario: Early lesson bypass is detected
- **WHEN** a migrated early unit student page directly emits a lesson submit event or lacks a manifest step getter
- **THEN** the gate SHALL fail with the lesson id and missing integration code
- **AND** the failure SHALL identify the bypass rather than allowing legacy evidence to pass as rich evidence.
