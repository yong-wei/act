## ADDED Requirements

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
