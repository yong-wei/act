## ADDED Requirements

### Requirement: Authoring second pass reduces the editor state machine
Against commit `f79f1836fd57dce483d01194e627ef36d929d637`, the second pass SHALL reduce the 103,947-byte `assignment-editor-workspace.tsx` implementation to an after total of at most 93,552 bytes. The after total SHALL include the workspace file plus every new production file and positive byte delta in an existing production file that receives code extracted from it. The pass MUST preserve the existing Assignment API, request payloads, CAS versions, idempotency identities, immutable published revisions, teacher approval, and accessibility behavior.

#### Scenario: Equivalent client states are consolidated
- **WHEN** two editor branches represent the same server-backed lifecycle state and have equivalent request, recovery, and focus behavior
- **THEN** the implementation MAY replace them with one explicit local representation
- **AND** focused tests SHALL prove unchanged visible state and mutation ordering.

#### Scenario: Mutation semantics differ
- **WHEN** save, generation, validation, or publication paths differ in endpoint, payload, CAS, idempotency, permission, or recovery behavior
- **THEN** the paths SHALL remain distinct
- **AND** the change SHALL not hide them behind a generic action executor.

#### Scenario: Completion is measured
- **WHEN** the pass is proposed for completion
- **THEN** before/after evidence SHALL show an after total of at most 93,552 bytes with editor, conflict, AI-draft, validation, publication, and accessibility tests passing
- **AND** pure file extraction or renamed wrappers SHALL not count as reduction.
