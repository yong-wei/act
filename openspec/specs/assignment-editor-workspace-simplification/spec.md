# assignment-editor-workspace-simplification Specification

## Purpose
TBD - created by archiving change simplify-assignment-editor-workspace. Update Purpose after archive.
## Requirements
### Requirement: The editor simplification is evidence-based

The implementation SHALL document the editor's callers, state transitions,
async side effects, error paths, and historical guards before editing.  Each
accepted transformation SHALL name the concrete duplication or control-flow
complexity it removes and its direct regression coverage.  Pure file splitting,
renaming, or formatting SHALL not qualify.

#### Scenario: A state path is simplified

- **WHEN** draft loading, saving, validation, conflict, or publication logic is
  changed
- **THEN** the before/after ledger SHALL identify the original path, the
  transformation, unchanged behavior, and test evidence
- **AND** request ordering and error semantics SHALL remain explicit.

#### Scenario: A proposed abstraction has no measured benefit

- **WHEN** an extraction only moves code or adds a wrapper
- **THEN** it SHALL be rejected as insufficient simplification
- **AND** no second Assignment state machine or facade SHALL be introduced.

### Requirement: Draft and published revision boundaries remain unchanged

The simplified editor SHALL continue to use the existing Assignment API and
preserve draft-only mutation, immutable published revisions/question snapshots,
version/CAS conflicts, idempotency, server-derived class audiences, validation,
and recoverable stale-context behavior.

#### Scenario: A draft save races with another edit

- **WHEN** the editor submits a stale draft version
- **THEN** the existing conflict result SHALL be surfaced without silent
  overwrite
- **AND** supported local input preservation and retry/reload actions SHALL
  remain available.

#### Scenario: A published revision is opened

- **WHEN** the editor loads a frozen/published revision
- **THEN** fields that would mutate its snapshot SHALL remain read-only or
  require the existing next-draft flow
- **AND** the simplified UI SHALL not invent a write path.

### Requirement: Teacher-directed AI authoring remains non-authoritative

AI-generated question, rubric, or guidance drafts SHALL remain visibly and
semantically provisional until the existing teacher approval and Assignment
publication flow accepts them.  The editor SHALL not treat AI output as a
published question, final score, or governance evidence.

#### Scenario: AI proposes rubric guidance

- **WHEN** an AI-assisted authoring action returns a draft
- **THEN** the editor SHALL show it as a draft and require the existing teacher
  review/approval action before persistence or publication
- **AND** the API SHALL remain the authority for revision and publication.

#### Scenario: AI generation fails or returns invalid output

- **WHEN** the provider is unavailable or output validation fails
- **THEN** the editor SHALL preserve the existing recoverable error state
- **AND** it SHALL not partially mutate a revision or hide the failure.

### Requirement: Editor UI states and accessibility are preserved

The simplification SHALL retain loading, empty, filtered-empty, validation,
stale, conflict, recoverable error, publication-blocked, and saved states,
including keyboard order, focus restoration, error association, and supported
narrow-viewport behavior.

#### Scenario: Validation blocks publication

- **WHEN** a question, rubric, audience, or policy is invalid
- **THEN** the editor SHALL identify the blocking field and preserve the current
  draft without publishing
- **AND** keyboard users SHALL be able to reach the error and recovery action.

#### Scenario: The editor is reopened after an error

- **WHEN** a recoverable load/save error is retried
- **THEN** the editor SHALL retain the existing safe local state behavior
- **AND** it SHALL not duplicate requests or reset unrelated fields.

### Requirement: Before/after metrics prove a net simplification

The change SHALL record before and after line count, component/function count,
branch/state-transition or equivalent complexity, duplicate-pattern inventory,
imports, and behavior/accessibility test results.  The record SHALL list
accepted, rejected, and deferred transformations and bind them to one source
revision.

#### Scenario: Simplification is reviewed

- **WHEN** the editor change is proposed for completion
- **THEN** focused editor, API-boundary, revision, AI, validation, and
  accessibility tests SHALL pass
- **AND** the record SHALL demonstrate reduced reasoning complexity beyond
  file movement.

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

