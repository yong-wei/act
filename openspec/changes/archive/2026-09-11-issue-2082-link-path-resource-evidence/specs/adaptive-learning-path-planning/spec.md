# Delta: adaptive-learning-path-planning

## MODIFIED Requirements

### Requirement: Path-launched resources write completion through the path execution contract
Every path-launched resource category SHALL write governed execution completion before it can advance dependent path state. Path-launched gradable events (gradable quiz, lesson step, governed simulation, control workbench) SHALL bind the completion to the owning LearningPathExecution with minimal governed evidence references carrying path, goal, and node attribution; self-reported completion without governed references SHALL NOT advance dependent path state.

#### Scenario: Simple interactive resource completes
- **WHEN** a path-launched interactive resource, knowledge card, reflection, or non-complex lesson activity completes
- **THEN** the system SHALL write a `completed` execution event for the owning path and node
- **AND** the event SHALL include resource type, completion timestamp, idempotency key, and privacy-safe evidence references where available.

#### Scenario: Gradable quiz or lesson step completes inside a path
- **WHEN** a path-launched gradable quiz or lesson step is submitted with a verifiable score
- **THEN** the owning LearningPathExecution SHALL persist minimal governed evidence references (source log or client event id plus governed completion result) carrying path id, goal id, and node id
- **AND** the references SHALL be traceable from the path center
- **AND** the score SHALL NOT be retained only as self-reported lift metadata without governed references.

#### Scenario: Complex resource completes
- **WHEN** a path-launched adaptive assessment, simulation, control workbench, or Arena node completes
- **THEN** the system SHALL write a `completed` execution event with the typed outcome reference required by that node type through the server-owned governed resolver
- **AND** simulation and control workbench pages SHALL parse the path launch context and submit through this write path rather than failing client-side
- **AND** dependent path nodes SHALL not advance until that reference is bound or the path policy explicitly permits preview or pending evidence.

#### Scenario: Completion is replayed or reviewed
- **WHEN** a student reviews, continues, or returns to an already completed node
- **THEN** the system SHALL record a distinct review, continued-interaction, or return activity
- **AND** it SHALL NOT count the original node completion a second time.

#### Scenario: Client-supplied path attribution is not trusted by itself
- **WHEN** a completion request carries client-declared path, goal, or node attribution
- **THEN** the server SHALL validate node membership and resource type against path persistence before binding any evidence reference
- **AND** forged or mismatched attribution SHALL be rejected without writing evidence.
