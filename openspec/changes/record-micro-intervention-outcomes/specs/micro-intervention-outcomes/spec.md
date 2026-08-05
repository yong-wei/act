## ADDED Requirements

### Requirement: Server-created, append-only intervention identity
The system SHALL create a server-assigned intervention instance only for an authenticated learner's currently available remediation orchestration result. Each instance SHALL retain immutable attribution, task, resource, validation-version, and learner-session bindings; the learner session SHALL come from the owning wrong-answer attribution rather than a client value. A retry with the same event key SHALL return the original event result, while a later start request SHALL create an independent intervention history.

#### Scenario: Start and retry an intervention
- **WHEN** a learner starts the same available remediation task twice with the same start event key
- **THEN** the system returns one intervention instance and one recorded start event without rewriting it

#### Scenario: Start a new intervention
- **WHEN** the learner starts the same available remediation task with a new start event key
- **THEN** the system creates a separate intervention instance with its own event history

### Requirement: Version-bound, privacy-safe outcome evidence
The system SHALL record only server-validated resource-use, hint, completion, duration, and validation-answer facts for an intervention instance. Before accepting a validation answer, the system SHALL revalidate the remediation task and SHALL bind the result to its selected validation item, content hash, version, and learner session. Learner projections SHALL exclude answer keys, explanations, raw answer text, source-question identifiers, misconception tags, and teacher-private metadata.

#### Scenario: Submit the selected governed validation question
- **WHEN** a learner submits an option for the intervention's selected validation question after the task remains current and accessible
- **THEN** the system evaluates the option server-side, records the version-bound outcome idempotently, and returns only the learner-safe result

#### Scenario: Submit a stale or substituted question
- **WHEN** the stored task has drifted, access has been revoked, or the submitted question does not match the intervention snapshot
- **THEN** the system rejects the submission without recording a validation outcome or exposing protected assessment content

### Requirement: Governed next-step recommendation
The system SHALL derive a next-step recommendation only from the intervention's validated outcome and current governed planning relationships. A passing validation SHALL retain the pass outcome and recommend an eligible higher-order transfer practice when one exists; otherwise it SHALL return a controlled transfer-practice-unavailable recommendation. A failed validation SHALL recommend deterministic governed prerequisite nodes before falling back to a controlled tutoring/manual-practice recommendation. Recommendations SHALL NOT update mastery or the formal learning path.

#### Scenario: Pass with an eligible transfer practice
- **WHEN** a validation passes and a current learner-visible governed higher-order transfer practice is available for the attributed node
- **THEN** the projection contains that practice as the next step with an evidence-basis summary

#### Scenario: Pass without transfer practice
- **WHEN** a validation passes and no eligible governed higher-order transfer practice exists
- **THEN** the projection preserves the pass outcome and reports a controlled transfer-practice-unavailable recommendation

#### Scenario: Fail with prerequisite nodes
- **WHEN** a validation fails and governed prerequisite nodes are available for the attributed node
- **THEN** the projection recommends the deterministic prerequisite-node set without changing the learner's formal path

#### Scenario: Fail without prerequisite nodes
- **WHEN** a validation fails and no governed prerequisite node is available
- **THEN** the projection recommends the controlled tutoring/manual-practice fallback without inventing a node
