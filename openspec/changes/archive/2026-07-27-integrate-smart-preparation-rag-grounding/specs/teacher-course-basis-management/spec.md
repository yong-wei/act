## ADDED Requirements

### Requirement: Preparation resource-pack adoption invokes first-use freeze
The source service SHALL invoke the course-basis first-use freeze contract when uploaded document content is actually accepted into a preparation resource pack.

#### Scenario: Uploaded snippet is accepted
- **WHEN** a retrieved snippet from a mutable uploaded version is accepted as evidence for a knowledge point, goal, or generation input
- **THEN** the version SHALL be frozen atomically with the evidence binding
- **AND** the binding SHALL record the frozen content hash and stable anchor.

#### Scenario: Uploaded document is selected but unused
- **WHEN** a document is selected but contributes no accepted content
- **THEN** the selection SHALL NOT freeze the document version.
