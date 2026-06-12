# teacher-prep-pack-generation Specification

## Purpose
Define how governed diagnosis, evidence summaries, path outcomes, grading summaries, and ResourceNode metadata become reviewable teacher prep packs for upcoming lessons. Prep packs keep generated interventions in a draft state until teacher approval, separate export from automatic insertion eligibility, and preserve privacy by carrying only aggregate or redacted evidence.
## Requirements
### Requirement: Prep packs convert diagnosis into teacher actions
The system SHALL generate reviewable teacher prep packs from governed class diagnosis and evidence.

#### Scenario: Prep pack is generated
- **WHEN** a teacher requests a prep pack for an upcoming class or learning goal
- **THEN** the system SHALL produce candidate interventions with title, item type, affected population, evidence basis, insertion target, estimated time, confidence, and methodology notes.

#### Scenario: Candidate has no source support
- **WHEN** an intervention candidate cannot be tied to governed diagnosis, ResourceNode metadata, lesson context, grading summary, or path evidence
- **THEN** it SHALL be marked as draft-request or excluded from automatic insertion.

### Requirement: Teacher review gates publication
Prep packs SHALL require teacher review before they affect students or class sessions.

#### Scenario: Teacher approves a prep item
- **WHEN** a teacher approves a prep-pack item
- **THEN** the item SHALL become eligible for insertion, export, or scheduling according to its target type.

#### Scenario: Teacher rejects a prep item
- **WHEN** a teacher rejects a prep-pack item
- **THEN** the rejection SHALL be recorded as feedback for future generation
- **AND** the item SHALL NOT be published or inserted.

### Requirement: Prep packs preserve privacy
Prep-pack payloads SHALL expose only privacy-safe aggregate or scoped evidence.

#### Scenario: Prep pack includes student evidence
- **WHEN** a prep-pack item references student evidence
- **THEN** it SHALL use aggregate counts, scoped summaries, stable references, or redacted evidence capsules
- **AND** it SHALL NOT expose raw answer bodies, private Konling memory, hidden Arena internals, or raw high-frequency traces.

### Requirement: Prep packs can become runtime enhancement overlays
Approved teacher prep-pack items SHALL be persistable as course enhancement packs that overlay course runtime without mutating base content.

#### Scenario: Enhancement pack is created
- **WHEN** a teacher chooses to prepare runtime insertion from approved prep-pack items
- **THEN** the system SHALL persist pack id, teacher id, class id, goal id, lesson id, source diagnosis, evidence references, insertion targets, item payloads, status, and timestamps
- **AND** draft or rejected prep-pack items SHALL NOT be eligible for activation.

#### Scenario: Enhancement pack is previewed
- **WHEN** a teacher previews an enhancement pack
- **THEN** the preview SHALL show insertion points, generated or linked resources, evidence basis, estimated time, privacy scope, and runtime diff
- **AND** the preview SHALL not publish content to students.

### Requirement: Runtime overlays are teacher-activated and reversible
Course enhancement packs SHALL require teacher activation before affecting student runtime and SHALL remain reversible.

#### Scenario: Pack is activated
- **WHEN** a teacher activates an enhancement pack
- **THEN** only approved items with valid insertion targets SHALL be merged into authorized class or session runtime
- **AND** student runtime output SHALL retain only opaque pack id, item id, activation metadata, and renderable resource metadata
- **AND** teacher audit output MAY retain source evidence references when explicitly requested.

#### Scenario: Pack is rolled back
- **WHEN** a teacher rolls back or archives an enhancement pack
- **THEN** student runtime SHALL stop displaying the overlay
- **AND** the base course manifest and authoring content SHALL remain unchanged.

### Requirement: Enhancement impact is traceable
Activated enhancement packs SHALL be linkable to subsequent learning evidence and teacher feedback.

#### Scenario: Post-class evidence is collected
- **WHEN** students interact with content inserted by an enhancement pack
- **THEN** generated learning evidence SHALL reference the pack item where safe
- **AND** teacher reports SHALL be able to compare post-activation evidence with the diagnosis that motivated the pack.
