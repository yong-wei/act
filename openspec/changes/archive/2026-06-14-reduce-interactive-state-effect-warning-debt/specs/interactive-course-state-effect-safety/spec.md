## ADDED Requirements

### Requirement: Interactive warning-level state synchronization is reduced safely
Interactive course remediation SHALL reduce warning-level state/effect diagnostics without weakening course identity semantics.

#### Scenario: Child component reports user progress to a parent
- **WHEN** progress, reveal, answer, or tracking state changes because of a user action
- **THEN** the child SHALL report the change from the user action or explicit state owner
- **AND** it SHALL NOT rely on a render-following effect that pushes derived live state to the parent.

#### Scenario: Progress and submission reporting is refactored
- **WHEN** warning remediation changes progress, completion, score, release, analytics, or submission evidence reporting
- **THEN** emitted payload shape, score meaning, completion state, and submission evidence semantics SHALL remain unchanged
- **AND** representative tests SHALL prove event emission count and timing do not introduce missing, duplicate, or stale reports.

#### Scenario: Component receives equivalent state for the same identity
- **WHEN** a component receives new object identities representing the same step, activity, resource, and viewer
- **THEN** touched local learner or teacher state SHALL remain stable.

### Requirement: Interactive warning remediation records scoped evidence
Interactive warning cleanup SHALL record exactly which warning rules and files were targeted.

#### Scenario: Developer validates a warning cleanup batch
- **WHEN** the owned-surface React Doctor warning summary is captured
- **THEN** the report SHALL show the targeted rule/file counts before and after the batch
- **AND** non-target warning families SHALL remain advisory.
