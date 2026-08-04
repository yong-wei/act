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
The system SHALL select only resources whose existing ResourceNode/PlanningUnit projection is audited path-eligible, learner-visible, available, launchable, evidence-complete and bound to reviewed immutable version and duration metadata. Remediation-specific relevance tags MUST NOT independently grant eligibility. Eligible resources SHALL be ordered by exact knowledge-node and misconception match, then knowledge-node match, then prerequisite match, with stable tie-breaking.

#### Scenario: Multiple eligible resources
- **WHEN** multiple resources are eligible for the same attribution and catalog revision
- **THEN** the system selects the same ordered minimal resource set on every orchestration

#### Scenario: No governed resource
- **WHEN** no accessible resource has complete governed metadata for the attributed node, misconception or prerequisite path
- **THEN** the system persists a sanitized `UNAVAILABLE` result and does not persist candidate resource references

### Requirement: Existing governed validation question
The system SHALL discover existing assessment items from the production-written assessment-catalog semantic references, without requiring optional remediation metadata. The selected item SHALL differ from the original question, target the same canonical knowledge node, and have either an isomorphic/variant relationship or the same reviewed catalog misconception reference. Its persisted snapshot MUST be rebound to the current catalog snapshot and retain remediation authority, human semantic review, path eligibility, immutable content/version agreement, canonical learner launch and remediation-stage permission. Self-declared remediation metadata MUST NOT grant catalog authority or candidate existence, and the system MUST NOT generate or rewrite the formal validation question.

#### Scenario: Governed variant exists
- **WHEN** an eligible version-bound variant or isomorphic assessment item exists
- **THEN** the available task references that item ID and content hash without exposing its answer or explanation

#### Scenario: Production item has no remediation extension
- **WHEN** a production-persisted item has current remediation catalog authority and matching semantic references but no `remediationValidation` block
- **THEN** the system can select it through the canonical catalog contract and uses the governed adaptive-practice launch

#### Scenario: Current catalog authority changed
- **WHEN** a persisted item snapshot is revoked, replaced, content-drifted or no longer learner-launchable in the current catalog
- **THEN** the system rejects it during creation or retrieval

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
The learner-facing orchestration projection SHALL be constructed separately from the stored task snapshot and SHALL NOT contain the source question ID, internal knowledge-node ID, misconception tag, raw answers, option payloads, correct answers, explanations, private teacher data or rejected candidate metadata.

#### Scenario: Successful task projection
- **WHEN** the system returns an available micro-tutoring task
- **THEN** the response contains only the goal, duration, learner action references, governed version identifiers and validation-question reference

#### Scenario: Unavailable projection
- **WHEN** orchestration or retrieval fails closed
- **THEN** the response contains only the controlled unavailable reason, generic practice path and orchestration version
