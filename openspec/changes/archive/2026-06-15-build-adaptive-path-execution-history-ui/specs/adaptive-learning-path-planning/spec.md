## ADDED Requirements

### Requirement: Path execution state distinguishes review, continuation, skip, and return
Path execution records SHALL preserve distinct learner actions for execution and history views.

#### Scenario: Completed node is continued
- **WHEN** a student continues interacting with a completed node
- **THEN** the system SHALL record a new governed interaction or evidence event
- **AND** it SHALL NOT count the node as newly completed a second time.

#### Scenario: Unfinished node is skipped
- **WHEN** a student skips an unfinished node
- **THEN** the system SHALL record a path deviation with prior node, skipped node, reason context where available, timestamp, and return eligibility
- **AND** the path SHALL allow the student to return later unless policy forbids the node.

#### Scenario: Checkpoint outcome is recorded
- **WHEN** a checkpoint passes, fails, is retried, or requires review
- **THEN** the system SHALL record outcome, evidence references, and next-action effect
- **AND** the history UI SHALL be able to show the result without exposing private raw answers.
