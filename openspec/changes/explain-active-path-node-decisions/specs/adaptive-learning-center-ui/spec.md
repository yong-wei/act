## ADDED Requirements

### Requirement: Activity path node details separate historical and current decisions
The adaptive learning center SHALL present a node's historical selection basis, latest confirmed adjustment, and current governed lock reason as distinct student-facing facts.

#### Scenario: Explained active node is expanded
- **WHEN** a student expands an activity-path node with a persisted selection basis and latest adjustment
- **THEN** the node details SHALL label and display “入选依据” and “最近调整” separately
- **AND** the details SHALL show only the most recent confirmed adjustment affecting that node rather than duplicating the complete correction history

#### Scenario: Legacy node lacks a selection projection
- **WHEN** a student expands an activity-path node without a persisted selection basis
- **THEN** the details SHALL state that node-level selection evidence was not recorded when the path was generated
- **AND** generic recommendation text SHALL NOT be presented as reconstructed historical evidence

#### Scenario: Node is currently locked
- **WHEN** a student expands a node whose current governed readiness is locked, evidence-needed, or needs-preparation
- **THEN** the details SHALL display a distinct “当前锁定原因” and the current student-safe unlock action from readiness
- **AND** the lock explanation SHALL update when governed readiness changes

#### Scenario: Node is not currently locked
- **WHEN** an expanded node is current, next, completed, or skipped without a governed lock state
- **THEN** the details SHALL NOT present a stale current-lock explanation

#### Scenario: Completed or skipped explained node is expanded
- **WHEN** a completed or skipped node remains in activity-path history
- **THEN** its historical selection basis and latest confirmed adjustment SHALL remain visible

#### Scenario: Node decision details render at supported viewports
- **WHEN** the activity-path node details render on desktop or at a 320px viewport
- **THEN** all decision labels, explanations, limitations, and actions SHALL remain readable without horizontal page overflow

### Requirement: Node decision explanations remain student-safe
The adaptive learning center SHALL NOT expose internal planning identifiers or raw evidence payloads in node decision explanations.

#### Scenario: Node decision explanation is displayed
- **WHEN** the UI renders selection, adjustment, or lock information
- **THEN** it SHALL omit internal node IDs, reason codes, fingerprints, raw evidence identifiers, and implementation details
- **AND** it SHALL preserve a clear limitation when the available historical projection is incomplete
