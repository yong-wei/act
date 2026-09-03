## ADDED Requirements

### Requirement: Assessment persistence remains the only attempt evidence writer
Assessment persistence SHALL call the domain-owned attempt/evidence adapter and the existing canonical Learning Record writer. A migration MUST NOT add a direct `LearningFact` write beside an outbox path or preserve process-memory/legacy adapter authority for path-owned attempts.

#### Scenario: Durable submission writes evidence
- **WHEN** a path-owned adaptive answer is accepted and scored
- **THEN** the Assessment transaction SHALL persist the durable answer and one normalized evidence/write intent
- **AND** a worker retry SHALL converge on the same result without double counting

#### Scenario: Legacy adapter is still referenced
- **WHEN** a production Assessment route or worker still imports the old data-governance adapter
- **THEN** the migration SHALL keep the old path and fail its deletion gate
- **AND** it SHALL not introduce a forwarding writer that hides the unresolved caller
