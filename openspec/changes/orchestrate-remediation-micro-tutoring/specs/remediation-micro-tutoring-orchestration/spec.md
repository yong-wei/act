## ADDED Requirements

### Requirement: Learner-triggered owned orchestration
The system SHALL create or retrieve remediation orchestration only when an authenticated learner explicitly requests an attribution owned by that learner.

#### Scenario: Owner requests remediation
- **WHEN** an authenticated learner requests remediation for their governed wrong-answer attribution
- **THEN** the system creates or returns the idempotent orchestration result for that attribution and orchestrator version

#### Scenario: Another learner requests remediation
- **WHEN** an authenticated learner requests remediation for an attribution they do not own
- **THEN** the system returns a not-found or forbidden response without disclosing whether the attribution exists

### Requirement: Immutable idempotent orchestration result
The system SHALL persist at most one immutable orchestration result for each wrong-answer attribution and orchestrator version, with status `AVAILABLE` or `UNAVAILABLE`.

#### Scenario: Concurrent retry
- **WHEN** the same learner request is processed more than once for the same attribution and orchestrator version
- **THEN** all requests resolve to the same stored result without rewriting its payload

#### Scenario: Uncertain attribution
- **WHEN** the governed attribution is not uniquely `ATTRIBUTED`
- **THEN** the system persists an `UNAVAILABLE` result containing only a controlled reason, a governed generic practice path and version information

### Requirement: Deterministic governed remediation resources
The system SHALL select only learner-visible resources with explicit immutable versions, estimated duration and governed semantic bindings, ordered by exact knowledge-node and misconception match, then knowledge-node match, then prerequisite match, with stable tie-breaking.

#### Scenario: Multiple eligible resources
- **WHEN** multiple resources are eligible for the same attribution and catalog revision
- **THEN** the system selects the same ordered minimal resource set on every orchestration

#### Scenario: No governed resource
- **WHEN** no accessible resource has complete governed metadata for the attributed node, misconception or prerequisite path
- **THEN** the system persists a sanitized `UNAVAILABLE` result and does not persist candidate resource references

### Requirement: Existing governed validation question
The system SHALL use an existing accessible assessment item that differs from the original question, targets the same canonical knowledge node, and declares either an isomorphic/variant relationship or the same misconception tag. The system MUST NOT generate or rewrite the formal validation question.

#### Scenario: Governed variant exists
- **WHEN** an eligible version-bound variant or isomorphic assessment item exists
- **THEN** the available task references that item ID and content hash without exposing its answer or explanation

#### Scenario: No validation item exists
- **WHEN** no eligible existing validation item satisfies the semantic and version requirements
- **THEN** the system persists a sanitized `UNAVAILABLE` result instead of generating a question

### Requirement: Verifiable five-to-ten-minute task
An `AVAILABLE` orchestration result SHALL contain a clear governed learning goal, a deterministic resource set, one validation question reference and a total estimated duration from 5 through 10 minutes inclusive.

#### Scenario: Minimal valid combination
- **WHEN** governed resource and validation durations permit one or more combinations within the time budget
- **THEN** the system stores the first deterministic minimal combination and its exact total duration

#### Scenario: No valid duration combination
- **WHEN** all otherwise eligible combinations fall outside 5 through 10 minutes or lack governed duration metadata
- **THEN** the system stores an `UNAVAILABLE` result and does not fabricate an estimate

### Requirement: Authorization and drift fail closed
The system SHALL validate resource and validation-item access during creation and retrieval, and SHALL verify stored resource versions and question content hashes during retrieval.

#### Scenario: Access is revoked after creation
- **WHEN** a learner reads a stored task after access to a referenced resource or item has been revoked
- **THEN** the system returns a sanitized unavailable projection without resource or question details and does not rewrite the historical result

#### Scenario: Referenced content drifts
- **WHEN** a stored resource version or validation-item content hash no longer matches the current governed record
- **THEN** the system returns a sanitized unavailable projection identifying reference drift without returning stale content

### Requirement: Sensitive data exclusion
The learner-facing orchestration projection SHALL NOT contain raw answers, option payloads, correct answers, explanations, private teacher data or rejected candidate metadata.

#### Scenario: Successful task projection
- **WHEN** the system returns an available micro-tutoring task
- **THEN** the response contains only the goal, duration, learner action references, governed version identifiers and validation-question reference

#### Scenario: Unavailable projection
- **WHEN** orchestration or retrieval fails closed
- **THEN** the response contains only the controlled unavailable reason, generic practice path and orchestration version
