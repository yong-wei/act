## ADDED Requirements

### Requirement: Graph-driven artifacts carry version references
The system SHALL attach version references to persisted graph-driven artifacts.

#### Scenario: Path artifact is persisted
- **WHEN** a graph-driven path artifact or path round is created
- **THEN** it SHALL include LearningGoal package version, graph catalog version, resource registry or projection version, overlay version where used, planner version, generatedAt, and limitations
- **AND** the artifact SHALL remain explainable after later graph or resource changes.

#### Scenario: Overlay artifact is materialized
- **WHEN** learner, class, or resource coverage overlay data is materialized or persisted
- **THEN** it SHALL include graphVersion, source evidence or resource version refs where available, generatedAt, and limitation metadata.

#### Scenario: Konling graph grounding is emitted
- **WHEN** Konling emits graph-grounded path advice or resource advice
- **THEN** the grounding context SHALL include relevant goal, graph, resource, citation, overlay, and path version refs where available
- **AND** missing version refs SHALL be exposed as grounding limitations.

### Requirement: Stale artifacts remain explainable
The system SHALL mark stale or migrated artifacts with limitations rather than silently rewriting their basis.

#### Scenario: Graph version changes after path generation
- **WHEN** a user inspects a path artifact generated from an older graph version
- **THEN** the system SHALL be able to show the original version refs
- **AND** it SHALL mark current-version differences as stale or migrated context instead of reinterpreting the path as if it used the latest graph.

### Requirement: Production writeback requires version context
Version context SHALL be required before graph-driven evidence writes can affect governed overlays.

#### Scenario: Writeback lacks version refs
- **WHEN** a graph-driven path, overlay, or Konling grounding event lacks required graph or resource version refs
- **THEN** production overlay writeback SHALL be blocked or degraded
- **AND** the limitation SHALL be visible to authorized diagnostics.
