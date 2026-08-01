## ADDED Requirements

### Requirement: Companion-practice attempts preserve continuity provenance
The system SHALL persist companion-practice attempts through the existing adaptive assessment contract and SHALL retain immutable provenance identifying the continuity snapshot, target knowledge context, and available structured cause record.

#### Scenario: Companion-practice attempt is created
- **WHEN** the authenticated student starts the check question offered by a recent_mistake snapshot
- **THEN** the assessment attempt records the companion-practice origin and continuity snapshotId
- **THEN** the attempt records the governed target knowledge identity and any available structured cause identity

#### Scenario: Companion-practice submission is finalized
- **WHEN** the student's companion-practice answer is finalized by the existing assessment grading flow
- **THEN** the result enters the existing governed learning-fact write path
- **THEN** the continuity capability consumes the resulting evidence without writing a second fact

#### Scenario: Attempt request is retried
- **WHEN** the same companion-practice request is retried with the same idempotency identity
- **THEN** the existing attempt is returned or completed
- **THEN** no duplicate assessment attempt or learning fact is created

#### Scenario: Student answers only in chat
- **WHEN** a student provides free-text answer content in Konling without submitting an assessment attempt
- **THEN** no companion-practice result or learning fact is persisted
