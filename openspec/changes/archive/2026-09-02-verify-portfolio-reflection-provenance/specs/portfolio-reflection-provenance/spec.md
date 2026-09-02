## ADDED Requirements

### Requirement: Platform-verified reflection provenance is derived from a server-owned source identity

A portfolio reflection candidate or draft that claims a platform task, assignment, evidence item or other verified source SHALL derive its canonical source, assignment, intent and title from a bounded server-owned source identity. The server SHALL verify the authenticated learner's access before model execution and before persistence. URL or request display strings SHALL NOT independently establish verified provenance.

#### Scenario: Learner opens a valid platform reflection entry
- **WHEN** an authenticated learner opens a reflection entry containing an authorized source identity
- **THEN** the server SHALL resolve the canonical source fields and bounded reflection intent
- **AND** a saved draft SHALL retain that verified identity and canonical provenance unchanged.

#### Scenario: Learner forges provenance display text
- **WHEN** a learner changes URL or request `source`, `assignment`, `intent` or title text without a matching authorized source identity
- **THEN** the system SHALL reject the verified-provenance claim or classify the values as student-provided
- **AND** the values SHALL NOT be stored or displayed as platform-verified provenance.

#### Scenario: Learner references an unauthorized source identity
- **WHEN** a learner submits a real source identifier they are not authorized to use
- **THEN** the server SHALL fail closed before model execution or draft creation
- **AND** it SHALL NOT reveal the source's canonical metadata.

### Requirement: Free reflections identify student-provided provenance

The system MAY support a reflection without a platform source, but any learner-authored source, assignment, intent or title label SHALL be explicitly classified and presented as student-provided rather than platform-verified.

#### Scenario: Learner creates a free reflection
- **WHEN** a learner starts a reflection without an authorized platform source identity
- **THEN** the UI SHALL identify editable provenance labels as student-provided
- **AND** the saved draft SHALL preserve that classification after refresh.

#### Scenario: Student-provided draft is reopened
- **WHEN** the learner reopens a saved free-reflection draft
- **THEN** its content and student-provided provenance SHALL remain available to the owner
- **AND** the system SHALL NOT upgrade the provenance to verified or write it to formal learning evidence automatically.

### Requirement: Provenance classification is immutable after draft creation

Once a reflection draft is created, its source identity, provenance classification and canonical or student-provided source snapshot SHALL remain immutable; only the candidate content may be edited under the existing draft lifecycle.

#### Scenario: Learner attempts to rewrite provenance classification
- **WHEN** the owner updates a draft with changed source identity, provenance kind or source labels
- **THEN** the service SHALL reject the request and preserve the original provenance
- **AND** discard and user-scoped idempotency semantics SHALL remain unchanged.

