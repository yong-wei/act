## Purpose

在教师诊断生成调用模型前，以确定性、可审计且隐私安全的方式判断是否值得形成新的正式报告，并约束普通生成、强制生成、并发与重试的身份边界。

## ADDED Requirements

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

The system SHALL compare the current eligible generator input with the previous formal report and return category summaries for assignment, assessment, learning behavior, risk, and eligibility. A source not integrated into the diagnosis evidence contract SHALL be marked unavailable and SHALL NOT be counted as new evidence.

#### Scenario: New governed evidence arrives
- **WHEN** an eligible risk, competency, or knowledge-progress input changes after the previous report
- **THEN** preflight SHALL return `new-evidence`, identify the changed governed categories, and permit ordinary generation.

#### Scenario: Unrelated or ineligible fact arrives
- **WHEN** only a page event, unrelated learning fact, unsupported risk type, non-member evidence, or unavailable source changes
- **THEN** preflight SHALL NOT report new diagnosis evidence or permit ordinary generation.

#### Scenario: Generator or deterministic rule changes
- **WHEN** the generator version or preflight rule version differs from the previous formal report
- **THEN** preflight SHALL return `version-change`, identify the changed version, and permit ordinary generation.

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

The system SHALL expose preflight and generation lifecycle data only to the owning teacher and only for an authorized class or current member. Public projections SHALL contain aggregate category counts and audit metadata, not raw evidence payloads or identities of other students.

#### Scenario: Unauthorized scope is requested
- **WHEN** a non-teacher, non-owner, or teacher targeting a non-member requests preflight or generation
- **THEN** the server SHALL fail closed without exposing status, counts, predecessor metadata, or evidence details.

#### Scenario: Teacher reads a class preflight
- **WHEN** the owning teacher requests a class-scoped preflight
- **THEN** the response SHALL use aggregate change counts and availability states
- **AND** SHALL NOT expose student identifiers or raw evidence values.

### Requirement: Completion feedback does not dominate report history

The teacher interface SHALL present preflight before generation, keep active and failed lifecycle feedback visible, and make completed generation feedback collapsible by default after the report history refreshes.

#### Scenario: Generation completes
- **WHEN** a diagnosis job reaches completed state and report history refreshes
- **THEN** the completion feedback SHALL remain available in a collapsed control
- **AND** the new formal report SHALL be selectable from history.

