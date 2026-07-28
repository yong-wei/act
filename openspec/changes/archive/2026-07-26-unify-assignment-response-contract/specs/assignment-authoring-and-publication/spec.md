## MODIFIED Requirements

### Requirement: Publication binds authorized class audiences and policies
The system SHALL bind published assignment revisions to explicit class audiences, availability dates, due dates, late policy, unified response policy, and resubmission policy.
Every published question SHALL permit a response containing text, attachments, or both under the unified response contract; legacy response-type fields SHALL remain frozen only for historical audit and SHALL NOT restrict active authoring or student submission.

#### Scenario: Teacher publishes to managed classes
- **WHEN** a teacher selects classes they are authorized to manage and supplies a valid schedule
- **THEN** publication SHALL create audience records that preserve the assigned revision and policy snapshot
- **AND** the editor SHALL discover active managed classes from an authorized server projection rather than requiring internal class identifiers as free text.

#### Scenario: Teacher selects an unauthorized class
- **WHEN** a teacher attempts to publish to a class outside their authorized scope
- **THEN** the system SHALL reject publication before any audience receives the assignment.

#### Scenario: Legacy response type is present
- **WHEN** a frozen assignment revision contains `TEXT`, `FILE`, or another legacy response-type value
- **THEN** the server SHALL still accept text, supported attachments, or both under the unified response contract
- **AND** it SHALL preserve the original snapshot field, content hash, and historical submission associations for audit.

