# teacher-diagnosis-generation-governance Specification

## Purpose
在教师诊断生成调用模型前，以确定性、可审计且隐私安全的方式判断是否值得形成新的正式报告，并约束普通生成、强制生成、并发与重试的身份边界。
## Requirements
### Requirement: Generation eligibility is determined without side effects

The system SHALL provide an authorized preflight for a class or current student scope. Preflight SHALL NOT call a model, create a generation job, write a report, or modify governed evidence.

#### Scenario: First formal diagnosis
- **WHEN** the teacher requests preflight for an authorized scope with no formal report
- **THEN** the system SHALL return `first-generation` and permit ordinary generation when eligible governed input exists.

#### Scenario: No eligible input is available
- **WHEN** the current generator cannot read any eligible governed input for the scope
- **THEN** the system SHALL return `unavailable` and SHALL NOT permit ordinary or forced generation.

#### Scenario: Refresh without evidence change
- **WHEN** the page or report list is refreshed without an eligible input or version change
- **THEN** the system SHALL return the same deterministic eligibility result without writing durable state.

### Requirement: Preflight reports effective changes by governed category

The system SHALL compare current eligible assignment, assessment, learning-behavior, risk, and eligibility inputs with the previous formal report. A source that is not integrated into the diagnosis evidence contract SHALL be marked unavailable and SHALL NOT be counted as new evidence. An integrated source with no qualifying results SHALL be available with a zero count rather than represented as unavailable.

#### Scenario: New governed evidence arrives
- **WHEN** an eligible assignment, assessment, risk, competency, or knowledge-progress input changes after the previous report
- **THEN** preflight SHALL return `new-evidence`, identify the changed governed categories, and permit ordinary generation.

#### Scenario: Unrelated or ineligible fact arrives
- **WHEN** only a page event, unrelated learning fact, unsupported risk type, non-member evidence, or unavailable source changes
- **THEN** preflight SHALL NOT report new diagnosis evidence or permit ordinary generation.

#### Scenario: Generator or deterministic rule changes
- **WHEN** the generator version or preflight rule version differs from the previous formal report
- **THEN** preflight SHALL return `version-change`, identify the changed version, and permit ordinary generation.

#### Scenario: Reviewed assignment results arrive
- **WHEN** a class member has a submitted assignment whose student equals its frozen student, whose audience class equals its frozen class, whose audience and submission reference the same revision, and whose published revision, reviewed total and review timestamp are at or before the evidence cutoff
- **THEN** preflight SHALL include only its structured outcome, revision content hash and audit identity
- **AND** SHALL NOT include the original answer, attachment, reviewer comment or raw grading payload.

#### Scenario: Reviewed assignment lineage drifts
- **WHEN** a reviewed assignment submission has a student, frozen student, audience class, frozen class, audience revision, submission revision, or related revision that does not agree with the requested class scope
- **THEN** preflight SHALL exclude it from the governed input
- **AND** persistence SHALL reject a report reference to it.

#### Scenario: Class-bound assessment results arrive
- **WHEN** an assessment session has a valid class-assessment binding whose class and content digest match the frozen session data
- **THEN** preflight SHALL include its aggregate score and completion identity for that class
- **AND** SHALL NOT count ordinary adaptive-practice sessions without the binding as class assessment coverage.

### Requirement: Ordinary generation suppresses duplicate formal snapshots

The server SHALL rerun the deterministic eligibility check when accepting a generation request. The same teacher, subject, scope, eligible input identity, generator version, and rule version SHALL produce at most one ordinary generation identity even under concurrent requests.

#### Scenario: No effective change since previous report
- **WHEN** ordinary generation is requested with the same eligible input and versions as the previous formal report
- **THEN** the server SHALL reject the request as `no-effective-change`
- **AND** SHALL NOT create a job, call a model, or write a report.

#### Scenario: Concurrent ordinary requests
- **WHEN** multiple ordinary requests race for the same effective input identity
- **THEN** the system SHALL create or return one active logical job
- **AND** SHALL NOT create duplicate formal reports.

#### Scenario: Retry retains original identity
- **WHEN** a failed or timed-out job is retried
- **THEN** the retry SHALL retain the original cutoff, input summary, input identity, versions, reason, and predecessor reference.

### Requirement: Forced generation is explicit and auditable

An authorized teacher MAY force generation when preflight reports no effective change, but MUST provide a non-empty reason. The forced job and formal report SHALL bind the teacher, reason, previous report, evidence cutoff, input summary, input identity, generator version, rule version, and generation reason.

#### Scenario: Teacher forces an unchanged diagnosis
- **WHEN** an authorized teacher submits a valid force reason for an unchanged eligible scope
- **THEN** the system SHALL create one forced generation job with `teacher-forced` as its generation reason
- **AND** the resulting report SHALL retain the complete audit binding.

#### Scenario: Force reason is missing
- **WHEN** a forced generation request omits or supplies a blank reason
- **THEN** the server SHALL reject it without creating a job or report.

#### Scenario: Force generation executes
- **WHEN** a forced generation completes or fails
- **THEN** it SHALL NOT mutate risk flags, learner portraits, knowledge progress, assignments, assessments, or other evidence truth sources.

### Requirement: Preflight and lifecycle projections are role-safe

The system SHALL expose preflight and generation lifecycle data only to the owning teacher and only for an authorized class or current member. Public projections SHALL contain aggregate category counts and audit metadata, not raw evidence payloads or identities of other students. Persisted report source coverage SHALL include deterministic assignment and assessment inclusion, missing, evidence and scored counts when those sources are integrated.

#### Scenario: Unauthorized scope is requested
- **WHEN** a non-teacher, non-owner, or teacher targeting a non-member requests preflight or generation
- **THEN** the server SHALL fail closed without exposing status, counts, predecessor metadata, or evidence details.

#### Scenario: Teacher reads a class preflight
- **WHEN** the owning teacher requests a class-scoped preflight
- **THEN** the response SHALL use aggregate change counts and availability states
- **AND** SHALL NOT expose student identifiers or raw evidence values.

#### Scenario: Teacher reads an integrated class report
- **WHEN** the owning teacher reads a completed report that includes assignment or assessment outcomes
- **THEN** the history surface SHALL display each source's aggregate inclusion and missing counts
- **AND** SHALL NOT show raw answer content, option keys, files, feedback text or student identifiers.

### Requirement: Model-bound outcome rows use report-local learner aliases

The provider-facing projection of frozen assignment submissions and class-bound assessment sessions SHALL NOT contain a real student user identifier. It SHALL use an opaque learner alias that is valid only for the current report attempt, while preserving an identical alias for the same learner across those two source families within that one provider request. The server-side frozen input and persistence validation remain the authority for real user-to-evidence associations.

#### Scenario: Provider receives reviewed outcomes for multiple learners
- **WHEN** a diagnosis provider request includes one or more eligible reviewed assignment submissions or class-bound assessment sessions
- **THEN** every model-bound outcome row SHALL include only a report-local learner alias rather than the student's real user identifier
- **AND** the serialized governed tool results SHALL not include a real student user identifier from either outcome source.

### Requirement: Completion feedback does not dominate report history

The teacher interface SHALL present preflight before generation, keep active and failed lifecycle feedback visible, and make completed generation feedback collapsible by default after the report history refreshes.

#### Scenario: Generation completes
- **WHEN** a diagnosis job reaches completed state and report history refreshes
- **THEN** the completion feedback SHALL remain available in a collapsed control
- **AND** the new formal report SHALL be selectable from history.

### Requirement: Empty structured provider output has a bounded governed recovery

When a teacher-diagnosis structured provider request finishes without output,
the system SHALL make at most one fallback request for a plain JSON object
using the same frozen governed input and a distinct provider idempotency
identity. The system SHALL parse and validate the fallback result through the
existing diagnosis schema, evidence-provenance, scope, and cutoff checks before
persisting a report.

#### Scenario: Fallback yields a valid diagnosis

- **WHEN** the structured provider request has no output and the plain JSON
  fallback returns a valid diagnosis result
- **THEN** the worker SHALL complete the existing job and atomically persist one
  report
- **AND** it SHALL retain the existing frozen evidence cutoff and governed tool
  audit boundary

#### Scenario: Neither strategy yields a usable result

- **WHEN** the structured provider request has no output and the fallback
  returns no parseable or valid JSON result
- **THEN** the worker SHALL not persist a partial report
- **AND** it SHALL record `diagnosis-provider-empty-output` as a retryable
  generation failure

#### Scenario: Other model calls use their existing behavior

- **WHEN** a provider-runtime consumer does not explicitly opt into diagnosis
  empty-output recovery
- **THEN** it SHALL retain its existing structured-output behavior

### Requirement: Provider generation window is strictly inside the task window

The teacher-diagnosis worker SHALL use a task deadline that is strictly later
than the provider generation window. The provider window SHALL cover the
structured request and at most one JSON fallback. The worker SHALL retain
time after the provider window for validation, persistence, and attempt
status. The queue lock duration SHALL cover the complete task window.

#### Scenario: Budget constants are loaded

- **WHEN** diagnosis generation timeout constants are read
- **THEN** the provider generation window SHALL be strictly less than the
  worker task window
- **AND** the BullMQ lock duration SHALL be at least the task window

#### Scenario: Provider finishes near its window

- **WHEN** the structured provider returns or fails near the provider window
- **THEN** the worker SHALL still have remaining time to persist completion
  or a retryable failure
- **AND** it SHALL NOT record `diagnosis-generation-timeout` solely because
  the provider window equals the task window

### Requirement: JSON fallback spends remaining provider budget

When structured output is empty and diagnosis opted into JSON fallback, the
fallback SHALL use the remaining provider generation window. It SHALL NOT
reset to a full independent timeout. If no remaining time exists, the worker
SHALL skip fallback and record `diagnosis-provider-empty-output`.

#### Scenario: Structured request leaves remaining time

- **WHEN** the structured request finishes without output and remaining
  provider time is greater than zero
- **THEN** the system SHALL make at most one JSON fallback using that
  remaining time
- **AND** the fallback SHALL abort when the provider window elapses

#### Scenario: Structured request consumes the provider window

- **WHEN** the structured request ends with no remaining provider time
- **THEN** the system SHALL NOT start a JSON fallback
- **AND** it SHALL record `diagnosis-provider-empty-output` as retryable

#### Scenario: Provider window abort is not a task timeout

- **WHEN** the structured provider request is aborted at the provider
  generation window
- **THEN** the worker SHALL record `diagnosis-provider-empty-output` as a
  retryable failure
- **AND** it SHALL NOT record `diagnosis-generation-timeout`

