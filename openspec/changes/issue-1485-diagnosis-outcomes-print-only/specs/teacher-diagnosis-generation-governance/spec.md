## MODIFIED Requirements

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

- **WHEN** a class member has a submitted assignment with a frozen class binding, published revision, reviewed total and review timestamp at or before the evidence cutoff
- **THEN** preflight SHALL include only its structured outcome, revision content hash and audit identity
- **AND** SHALL NOT include the original answer, attachment, reviewer comment or raw grading payload.

#### Scenario: Class-bound assessment results arrive

- **WHEN** an assessment session has a valid class-assessment binding whose class and content digest match the frozen session data
- **THEN** preflight SHALL include its aggregate score and completion identity for that class
- **AND** SHALL NOT count ordinary adaptive-practice sessions without the binding as class assessment coverage.

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
## ADDED Requirements

### Requirement: Model-bound outcome rows use report-local learner aliases

The provider-facing projection of frozen assignment submissions and class-bound assessment sessions SHALL NOT contain a real student user identifier. It SHALL use an opaque learner alias that is valid only for the current report attempt, while preserving an identical alias for the same learner across those two source families within that one provider request. The server-side frozen input and persistence validation remain the authority for real user-to-evidence associations.

#### Scenario: Provider receives reviewed outcomes for multiple learners

- **WHEN** a diagnosis provider request includes one or more eligible reviewed assignment submissions or class-bound assessment sessions
- **THEN** every model-bound outcome row SHALL include only a report-local learner alias rather than the student's real user identifier
- **AND** the serialized governed tool results SHALL not include a real student user identifier from either outcome source.
