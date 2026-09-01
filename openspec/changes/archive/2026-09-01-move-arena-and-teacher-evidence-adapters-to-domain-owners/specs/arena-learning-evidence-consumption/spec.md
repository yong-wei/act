## ADDED Requirements

### Requirement: Arena summaries are consumed through the Arena owner port
Student profile and Teacher class insight consumers SHALL obtain official and preview Arena summaries from the Arena-owned server API or read port. Front ends and generic Learning Record code MUST NOT reconstruct official validity, weak metrics, method distribution or preview provenance from raw rows or markup.

#### Scenario: Profile reads mixed Arena evidence
- **WHEN** a student has official submissions and governed virtual training runs
- **THEN** the Arena owner port SHALL return separate official and preview/training summaries with source status and provenance
- **AND** training SHALL not alter official score, rank, valid rate or capability claims

#### Scenario: Class insight reads Arena evidence
- **WHEN** a teacher requests Arena evidence for an authorized class
- **THEN** the port SHALL aggregate only class-scoped persisted summaries
- **AND** it SHALL exclude other-class submissions and preserve independent learner counts

### Requirement: Arena evidence adapter removal preserves official authority
An old Arena evidence adapter SHALL be removed only after all profile, class, path and report callers use the Arena owner port and parity tests prove official/preview outputs equivalent.

#### Scenario: Legacy adapter has a remaining caller
- **WHEN** a production consumer still imports or invokes the old adapter
- **THEN** the deletion gate SHALL fail closed
- **AND** no second summary or Learning Record writer SHALL be introduced
