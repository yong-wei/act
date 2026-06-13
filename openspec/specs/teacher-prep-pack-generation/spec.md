# teacher-prep-pack-generation Specification

## Purpose
Define how governed diagnosis, evidence summaries, path outcomes, grading summaries, and ResourceNode metadata become reviewable teacher prep packs for upcoming lessons. Prep packs keep generated interventions in a draft state until teacher approval, separate export from automatic insertion eligibility, and preserve privacy by carrying only aggregate or redacted evidence.
## Requirements
### Requirement: Prep packs convert diagnosis into teacher actions
The system SHALL generate reviewable teacher prep packs from governed class diagnosis and evidence, and prep packs SHALL be accessible from teacher diagnosis surfaces as reviewable interventions.

#### Scenario: Prep pack is generated
- **WHEN** a teacher generates a prep pack from class diagnosis
- **THEN** each candidate SHALL include source diagnosis evidence, target class or lesson context, insertion target, evidence citations, expected learner impact, and teacher review state
- **AND** candidate interventions SHALL include title, item type, affected population, evidence basis, estimated time, confidence, and methodology notes
- **AND** unsupported candidates SHALL become draft-resource requests that require review.

#### Scenario: Candidate has no source support
- **WHEN** an intervention candidate cannot be tied to governed diagnosis, ResourceNode metadata, lesson context, grading summary, or path evidence
- **THEN** it SHALL be marked as draft-request or excluded from automatic insertion.

### Requirement: Teacher review gates publication
Prep packs SHALL require teacher review before they affect students or class sessions, and teacher review SHALL provide visible approve, reject, edit, preview, activate, rollback, and archive states.

#### Scenario: Teacher reviews a prep item
- **WHEN** a teacher opens a prep-pack review surface
- **THEN** the UI SHALL show candidate rationale, source evidence, insertion target, runtime diff, allowed actions, and current lifecycle state
- **AND** only approved items SHALL be eligible for activation.

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
Course enhancement packs SHALL require teacher activation before affecting student runtime and SHALL remain reversible, scoped, auditable, and non-mutating.

#### Scenario: Pack is activated
- **WHEN** a teacher activates an approved enhancement pack
- **THEN** active overlay items SHALL be scoped to the intended class, class session, lesson, and insertion anchors
- **AND** only approved items with valid insertion targets SHALL be merged into authorized class or session runtime
- **AND** student runtime output SHALL retain only opaque pack id, item id, activation metadata, and renderable resource metadata
- **AND** teacher audit output MAY retain source evidence references when explicitly requested
- **AND** the base runtime manifest SHALL NOT be mutated.

#### Scenario: Pack is rolled back
- **WHEN** a teacher rolls back an active enhancement pack
- **THEN** overlay items SHALL disappear from the merged runtime view
- **AND** activation, rollback, and impact evidence history SHALL remain auditable.

### Requirement: Enhancement impact is traceable
Activated enhancement packs SHALL be linkable to subsequent learning evidence and teacher feedback, and prep-pack impact SHALL be available to effect-report and teacher reflection workflows.

#### Scenario: Post-class evidence is collected
- **WHEN** learners interact with activated overlay items
- **THEN** the system SHALL record impact evidence linked to pack id, item id, lesson/session scope, and source diagnosis
- **AND** generated learning evidence SHALL reference the pack item where safe
- **AND** teacher reports SHALL be able to compare post-activation evidence with the diagnosis that motivated the pack
- **AND** effect-report code SHALL be able to aggregate impact without raw private evidence.
