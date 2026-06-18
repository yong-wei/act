## ADDED Requirements

### Requirement: Path-launched resources write completion through the path execution contract
Every path-launched resource category SHALL write governed execution completion before it can advance dependent path state.

#### Scenario: Simple interactive resource completes
- **WHEN** a path-launched interactive resource, knowledge card, reflection, or non-complex lesson activity completes
- **THEN** the system SHALL write a `completed` execution event for the owning path and node
- **AND** the event SHALL include resource type, completion timestamp, idempotency key, and privacy-safe evidence references where available.

#### Scenario: Complex resource completes
- **WHEN** a path-launched adaptive assessment, simulation, control workbench, or Arena node completes
- **THEN** the system SHALL write a `completed` execution event with the typed outcome reference required by that node type
- **AND** dependent path nodes SHALL not advance until that reference is bound or the path policy explicitly permits preview or pending evidence.

#### Scenario: Completion is replayed or reviewed
- **WHEN** a student reviews, continues, or returns to an already completed node
- **THEN** the system SHALL record a distinct review, continued-interaction, or return activity
- **AND** it SHALL NOT count the original node completion a second time.

### Requirement: Latest path recovery uses path truth before generated defaults
Adaptive path recovery SHALL restore selected or completed path rounds from path persistence before showing generated defaults.

#### Scenario: Active path is recoverable
- **WHEN** a student has an active path round and opens the path center without a path id
- **THEN** the system SHALL read the latest authorized active path round for the requested or supported default goal
- **AND** it SHALL return enough structure for the UI to render selected option, current node, completed nodes, alternatives, and evidence timeline.

#### Scenario: Completed path is recoverable
- **WHEN** the latest authorized path round is completed
- **THEN** the system SHALL return the completed path structure and summary fields needed for a learner-visible completion view
- **AND** it SHALL NOT collapse the completed path into only a generic history event.

#### Scenario: Learner-state read model is stale
- **WHEN** learner-state path context is missing, stale, or temporarily unavailable but a recent authorized path round exists
- **THEN** latest path recovery SHALL still be able to restore the selected path from `LearningPath` persistence
- **AND** the system SHALL expose the read-model limitation separately from the path execution truth.
