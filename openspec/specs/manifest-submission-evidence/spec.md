# manifest-submission-evidence Specification

## Purpose
Define the shared submission evidence contract for manifest-driven interactive lessons, including durable answer envelopes, scoreable objective evidence, and report-facing evidence quality counts.
## Requirements
### Requirement: Manifest submissions use a shared evidence envelope
The system SHALL provide a shared submission path for manifest-driven interactive lessons that emits a versioned evidence envelope for student responses.

#### Scenario: Shared controller emits v2 evidence
- **WHEN** a manifest lesson page submits a student response through the shared controller
- **THEN** the emitted event payload MUST include `schemaVersion`, step id, interaction kind, answer digest, attempt identity, and submitted timestamp
- **AND** the schema version MUST distinguish rich evidence from legacy submit envelopes.

#### Scenario: Extra lesson evidence is namespaced
- **WHEN** a course page needs to include parameter snapshots, simulation results, or training results
- **THEN** the shared submission path MUST allow structured extra evidence without changing the base submit schema
- **AND** the extra evidence MUST remain associated with the submitted step.

### Requirement: Submitted answers are durable outside mutable state
The system SHALL persist submitted answer evidence in immutable submission records.

#### Scenario: StudentStepResponse preserves answers
- **WHEN** a student submits objective or subjective manifest activity cards
- **THEN** the corresponding `StudentStepResponse.responseData` MUST include submitted card ids and submitted values or a structured answer digest
- **AND** post-class analysis MUST NOT require mutable `StudentState.data.responses` to recover the submitted attempt.

#### Scenario: Resubmits preserve attempts
- **WHEN** a student submits the same step more than once
- **THEN** every attempt MUST remain distinguishable by attempt key or client event id
- **AND** later attempts MUST NOT overwrite earlier immutable response rows.

### Requirement: Objective evidence is scoreable
The system SHALL derive objective scoring evidence from the submitted manifest response and reference answers when available.

#### Scenario: Objective answer produces score context
- **WHEN** a submitted objective card can be matched to a reference answer
- **THEN** the evidence envelope MUST include per-card answered state, submitted answer, reference value, correctness, correct count, and objective total
- **AND** `LearningFact.score` SHOULD be populated from the normalized objective score.

#### Scenario: Unsupported scoring is explicit
- **WHEN** an interaction lacks objective reference answers or uses a response kind that cannot be scored automatically
- **THEN** the envelope MUST mark scoring as unsupported or subjective
- **AND** the system MUST NOT silently store a zero score that looks like a failed objective response.

### Requirement: Reports expose evidence quality
The system SHALL expose whether session submissions are evidence-rich, partial, or legacy-only.

#### Scenario: Report counts evidence quality
- **WHEN** a class session report is generated
- **THEN** it MUST include counts for evidence-rich submissions, legacy submit envelopes, and submissions with scoreable objective evidence
- **AND** the report MUST avoid presenting legacy-only rows as full answer diagnostics.

### Requirement: Early unit response pages use manifest submission evidence
The system SHALL route response-producing steps in 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 through the shared manifest submission evidence path.

#### Scenario: Early unit submit uses shared controller
- **WHEN** a student submits a response-producing step in 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, or 3-4
- **THEN** the student page SHALL submit through `useManifestSubmissionController`
- **AND** the emitted event payload SHALL use the `manifest-submission-v2` evidence envelope.

#### Scenario: Direct lesson submit bypass is removed
- **WHEN** migrated early unit student pages are inspected
- **THEN** they SHALL NOT call `trackCourseEvent` directly with `COURSE_EVENT_TYPES.LESSON_SUBMIT` or `COURSE_EVENT_TYPES.LESSON_RESUBMIT`
- **AND** no lesson-local wrapper SHALL preserve the old direct-submit behavior.

#### Scenario: Custom early unit evidence is preserved
- **WHEN** a migrated early unit submits parameter, calculation, simulation, or workspace output
- **THEN** the shared submission path SHALL include that output as structured extra evidence associated with the manifest step
- **AND** post-class analysis SHALL NOT depend only on mutable student state to recover the submitted result.
