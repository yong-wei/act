## ADDED Requirements

### Requirement: Adaptive path center satisfies student entry quality
The adaptive path center SHALL satisfy student entry-surface quality gates as a task-first learning atlas route.

#### Scenario: Student opens adaptive path center
- **WHEN** a student opens `/assessment/adaptive-practice`
- **THEN** the first viewport SHALL show a usable learning-path task, current learning context where available, and at most one dominant next action on mobile
- **AND** it SHALL preserve adjacent learning navigation without exposing operations data center or engineering diagnostics.
