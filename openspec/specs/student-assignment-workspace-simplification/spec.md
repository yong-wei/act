# student-assignment-workspace-simplification Specification

## Purpose
TBD - created by archiving change simplify-student-assignment-workspace. Update Purpose after archive.
## Requirements
### Requirement: Simplification is concrete and behavior-led

The implementation SHALL baseline callers, state transitions, async side
effects, error paths, and history before editing.  Each accepted change SHALL
remove identified duplication or control-flow complexity and name direct
regression evidence.  Pure file movement, renaming, or visual restyling SHALL
not satisfy the requirement.

#### Scenario: An upload or submit path is changed

- **WHEN** a student workspace mutation path is simplified
- **THEN** the before/after record SHALL identify the original path,
  transformation, unchanged semantics, and test
- **AND** request ordering, scope, and idempotency behavior SHALL remain clear.

#### Scenario: A wrapper only forwards calls

- **WHEN** a proposed helper merely forwards to another workspace or lifecycle
  state machine
- **THEN** it SHALL be rejected
- **AND** the client SHALL retain one Assignment public API path.

### Requirement: Student ownership and revision snapshots remain enforced

The simplified workspace SHALL consume the existing Assignment API and retain
authenticated student scope, frozen assignment/revision/question ownership,
immutable content snapshots, and server-derived attempt/resubmission rules.

#### Scenario: A student opens a historical assignment

- **WHEN** current class membership differs from the frozen submission owner
- **THEN** the workspace SHALL display only the student's authorized historical
  revision and attempts
- **AND** it SHALL not infer access or content from another class or revision.

#### Scenario: A revision changes while the page is open

- **WHEN** the server reports a stale revision or conflict
- **THEN** the workspace SHALL preserve the existing safe recovery behavior
- **AND** it SHALL not silently overwrite a newer snapshot.

### Requirement: Draft, attachment, and attempt lifecycles remain distinct

Simplification SHALL preserve local draft state, attachment preflight/sign/
finalize/read/order/integrity behavior, per-question submission state, durable
attempt identity, idempotency, and permitted resubmission transitions.  Live
client state SHALL not replace durable submission evidence.

#### Scenario: A file upload is interrupted

- **WHEN** an attachment upload or finalization fails or is retryable
- **THEN** the workspace SHALL show the existing pending/failed state and
  bounded retry path
- **AND** it SHALL not mark the question submitted or lose integrity metadata.

#### Scenario: A question is resubmitted

- **WHEN** a server-approved resubmission is submitted
- **THEN** a new durable attempt SHALL remain distinguishable from the prior
  attempt
- **AND** a repeated request with the same idempotency identity SHALL not create
  a duplicate attempt.

### Requirement: Result and feedback projections remain role-safe

The workspace SHALL preserve current approved-feedback and released-result
visibility, including frozen student ownership and successful derivative/asset
integrity checks.  It SHALL not expose reference answers, teacher rubric
internals, AI diagnostics, another student's data, or an unreleased score.

#### Scenario: Feedback is approved but not released

- **WHEN** a question has an approval snapshot without a successful student
  release
- **THEN** the student view SHALL retain the existing unavailable/limited state
- **AND** it SHALL not infer or render the approved teacher payload.

#### Scenario: A released result is read

- **WHEN** the authenticated owner reads a complete released result package
- **THEN** the workspace SHALL render only the existing student-safe fields
- **AND** an invalid or mismatched asset SHALL fail closed.

### Requirement: Workspace states and accessibility remain complete

The simplified workspace SHALL retain loading, empty, stale, conflict,
processing, upload failure, blocked, submitted, resubmission, history,
feedback, result, and recoverable-error states with existing focus, keyboard,
error-association, and responsive behavior.

#### Scenario: A recoverable request fails

- **WHEN** assignment load, save, upload, submit, or result read fails
- **THEN** the workspace SHALL expose the existing bounded retry/recovery
  action
- **AND** it SHALL not issue duplicate mutations or reset unrelated drafts.

#### Scenario: A student uses keyboard input

- **WHEN** the student navigates question, attachment, submit, history, and
  recovery controls without a pointer
- **THEN** focus order and accessible names SHALL remain usable at supported
  viewport sizes.

### Requirement: Before/after metrics prove net simplification

The change SHALL record before and after lines, components/functions,
branches/state transitions or equivalent complexity, duplicate request paths,
imports, and behavior/accessibility test results.  Accepted, rejected, and
deferred transformations SHALL be listed and bound to one source revision.

#### Scenario: The student workspace is reviewed

- **WHEN** completion is requested
- **THEN** focused workspace, Assignment API, asset, attempt, privacy, and
  accessibility tests SHALL pass
- **AND** the record SHALL show reduced reasoning complexity beyond extraction.

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

