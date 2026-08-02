## ADDED Requirements

### Requirement: Student-scoped traceable input
The system SHALL attribute only an incorrect adaptive-assessment answer owned by the authenticated student and SHALL verify the answer, session, item reference, question identity, immutable question snapshot, and item content hash before writing a result.

#### Scenario: Authorized traceable wrong answer
- **WHEN** the authenticated student requests attribution for their incorrect answer whose session and immutable item snapshot are internally consistent
- **THEN** the system evaluates the reviewed answer-time attribution evidence

#### Scenario: Unauthorized answer
- **WHEN** the requested answer is not owned by the authenticated student
- **THEN** the system returns no attribution and writes no attribution record

#### Scenario: Untraceable snapshot
- **WHEN** ownership is valid but the session, question, item version, answer key, or immutable snapshot cannot be verified
- **THEN** the system returns no attribution and writes no attribution record

#### Scenario: Correct answer
- **WHEN** the authenticated answer is correct
- **THEN** the system returns no wrong-answer attribution and writes no attribution record

### Requirement: Governed deterministic attribution
The system SHALL derive attribution only from reviewed graph-node identifiers and controlled misconception tags preserved in the answer-time item-reference snapshot, and SHALL apply a versioned deterministic rule.

#### Scenario: One reviewed node and one controlled tag
- **WHEN** a traceable wrong answer has exactly one reviewed graph-node identifier and one controlled misconception tag
- **THEN** the system records state `ATTRIBUTED`, confidence `1`, that node and tag, attribution version `wrong-answer-attribution.v1`, and no follow-up action

#### Scenario: Ambiguous reviewed candidates
- **WHEN** a traceable wrong answer has multiple reviewed graph-node or misconception candidates
- **THEN** the system records state `UNCERTAIN`, confidence `0.5`, the candidates, a limitation, and action `MANUAL_REVIEW`

#### Scenario: Missing semantic binding
- **WHEN** a traceable reviewed wrong-answer snapshot lacks a graph-node or misconception binding
- **THEN** the system records state `UNCERTAIN`, confidence `0`, a limitation, and action `REPEAT_PRACTICE`

### Requirement: Immutable idempotent persistence
The system SHALL persist at most one immutable attribution for each answer and attribution version, including the verified student, session, item reference, question, content hash, candidates, evidence summary, evidence references, confidence, limitations, state, action, and version.

#### Scenario: Repeated attribution request
- **WHEN** the same answer is attributed repeatedly with the same attribution version
- **THEN** the system returns the same persisted attribution without changing its contents

### Requirement: Privacy-safe projection
The system MUST project attribution through an explicit field allowlist and MUST NOT persist or publicly project raw answers, answer keys, prompts, option text, explanations, parser text, private conversation, or arbitrary ungoverned metadata.

#### Scenario: Attributed public result
- **WHEN** an `ATTRIBUTED` record is projected
- **THEN** the result includes its factual knowledge-node and misconception attribution, evidence summary, evidence references, confidence, version, state, limitations, and action

#### Scenario: Uncertain public result
- **WHEN** an `UNCERTAIN` record is projected
- **THEN** the factual attribution field is null and the result exposes only candidate identifiers, evidence summary, evidence references, confidence, version, state, limitations, and action

#### Scenario: Sensitive source material
- **WHEN** the underlying answer-time snapshot contains raw instructional or response material
- **THEN** none of that source material appears in the persisted attribution or public projection
