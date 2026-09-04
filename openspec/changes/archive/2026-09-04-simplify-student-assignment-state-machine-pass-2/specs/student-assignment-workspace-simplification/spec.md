## ADDED Requirements

### Requirement: Student second pass reduces the workspace state machine
Against commit `f79f1836fd57dce483d01194e627ef36d929d637`, the second pass SHALL reduce the 75,547-byte `student-assignment-workspace.tsx` implementation to an after total of at most 67,992 bytes. The after total SHALL include the workspace file plus every new production file and positive byte delta in an existing production file that receives code extracted from it. The pass MUST preserve Assignment API payloads, request order, attachment integrity and order, conflict recovery, focus behavior, attempt identity, idempotency, and released-result privacy.

#### Scenario: Equivalent busy or response states are consolidated
- **WHEN** two client paths have the same server state, cancellation, retry, error, and focus semantics
- **THEN** they MAY use one explicit state representation or pure derivation
- **AND** tests SHALL prove unchanged user-visible state and request ordering.

#### Scenario: Endpoint-specific semantics differ
- **WHEN** draft, upload, attachment mutation, submit, or resubmit paths differ in ordering, conflict codes, idempotency, or recovery
- **THEN** those paths SHALL remain explicit
- **AND** the change SHALL not route them through a generic action executor.

#### Scenario: Preview ownership is simplified
- **WHEN** duplicate preview URL state and ref bookkeeping is removed
- **THEN** creation, replacement, failure, and unmount cleanup SHALL remain deterministic
- **AND** no URL SHALL be leaked or revoked before its active consumer releases it.

#### Scenario: Completion is measured
- **WHEN** the pass is proposed for completion
- **THEN** before/after evidence SHALL show an after total of at most 67,992 bytes with workspace, attachment, attempt, privacy/result, and accessibility tests passing
- **AND** file movement or renamed wrappers SHALL not count as reduction.
