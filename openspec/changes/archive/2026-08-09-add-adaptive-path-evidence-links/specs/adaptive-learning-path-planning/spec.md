## ADDED Requirements

### Requirement: Recommendation provenance preserves student-safe event references
The planner SHALL attach event references only when a governed event can be proven to support the target judgment used by the candidate path. Each reference MUST contain a stable event type, occurrence time, student-readable summary, and student-safe navigation action, and MUST exclude internal identifiers and raw evidence payloads.

#### Scenario: Governed events support a candidate path judgment
- **WHEN** target-scoped learning events contribute to a deficit or capability judgment used by a candidate path
- **THEN** the persisted recommendation provenance includes at most three most-recent student-safe event references for that target
- **AND** each reference identifies the affected judgment and the path nodes or resources selected from it

#### Scenario: Recent event did not participate in planning
- **WHEN** a recent learning event is not part of the target-scoped evidence used by the planner
- **THEN** the event is not included in recommendation provenance

#### Scenario: Only aggregate or restricted evidence is available
- **WHEN** a target judgment is backed only by aggregate snapshots, feature caches, restricted AI evidence, or unresolvable source references
- **THEN** recommendation provenance contains no fabricated event reference
- **AND** records an explicit limitation that event-level evidence cannot be verified

#### Scenario: Student-safe provenance is serialized
- **WHEN** candidate path provenance is persisted or returned to a student consumer
- **THEN** it does not expose database IDs, LearningFact IDs, source log IDs, source event IDs, raw answers, private conversations, reason codes, fingerprints, raw evidence JSON, or model prompts

### Requirement: Adopted node selection basis preserves event references
When a candidate path is adopted, the system SHALL project the candidate's student-safe event references onto each affected node's historical selection basis and SHALL retain them as execution state changes.

#### Scenario: Candidate with event references is adopted
- **WHEN** a student selects a candidate path whose recommendation provenance links events to specific nodes
- **THEN** each affected selected node stores those references in its historical selection basis

#### Scenario: Selected node later completes or becomes locked
- **WHEN** execution state changes after the path was adopted
- **THEN** the node retains the event references that explained its original selection

#### Scenario: Legacy path has no event references
- **WHEN** an adopted path predates event-reference support
- **THEN** the node explanation remains available through its existing aggregate or legacy fallback contract
- **AND** no event reference is inferred from the current learner portrait
