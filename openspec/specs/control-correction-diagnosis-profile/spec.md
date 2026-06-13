# control-correction-diagnosis-profile Specification

## Purpose
Define the governed indicator profile, reproducible snapshot contract, and
role-based access behavior for control-correction learning diagnosis.
## Requirements
### Requirement: Control-correction diagnosis uses governed indicators
The diagnosis profile SHALL use governed indicator definitions and consume governed evidence sources that are relevant to the competition assistant story.

#### Scenario: Indicator definition is registered
- **WHEN** a control-correction diagnosis indicator is added
- **THEN** it SHALL declare dimension id, indicator id, source families, query spec, normalization policy, confidence policy, privacy visibility, materializer version, and fallback behavior
- **AND** definitions missing query spec or evidence threshold metadata SHALL fail validation.

#### Scenario: Indicator evidence is gathered
- **WHEN** diagnosis evidence is gathered for the competition baseline class or learner
- **THEN** eligible sources SHALL include document rubric grading, adaptive-practice answers, simulation or Arena summaries, learning-path execution or deviation records, and approved learning facts when available
- **AND** every source SHALL be filtered by goal or scope so unrelated course activity cannot inflate control-correction diagnosis.

### Requirement: Diagnosis snapshots are reproducible
Control-correction diagnosis snapshots SHALL remain reproducible and SHALL expose report-ready observations for competition assistant workflows.

#### Scenario: Indicator snapshot is materialized
- **WHEN** an indicator is calculated for a student, class, or report scope
- **THEN** the snapshot SHALL store score, confidence, source coverage, evidence count, evidence window, materializer version, and limitations
- **AND** stale, preview-only, low-confidence, missing, or sparse sources SHALL lower confidence or mark the indicator unavailable instead of producing a precise high-confidence score.

#### Scenario: Report snapshot is materialized
- **WHEN** the system materializes a control-correction diagnosis report snapshot
- **THEN** the snapshot SHALL include score, confidence, time window, limitations, and source version metadata for each reported dimension
- **AND** each report-ready dimension SHALL include observation records or observation payload entries with indicator key, evidence references, source family, and calculation window
- **AND** missing or sparse evidence SHALL be represented as a limitation instead of a fabricated score.

### Requirement: Percentiles are cohort-scoped and explicit
The system SHALL calculate class percentile and growth percentile only from authorized cohort snapshots.

#### Scenario: Class percentile is calculated
- **WHEN** a student report includes percentile data
- **THEN** the percentile SHALL be calculated from the authorized class cohort for the same indicator or dimension version
- **AND** the payload SHALL include effective sample size and fallback state.

#### Scenario: Growth percentile lacks history
- **WHEN** a student has no comparable prior snapshot
- **THEN** growth percentile SHALL be unavailable with a cold-start limitation
- **AND** the system SHALL NOT infer growth from a single current score.

### Requirement: Role-based diagnosis consumes report snapshots
Role-based diagnosis SHALL use diagnosis report snapshots when available.

#### Scenario: Student diagnosis view is requested
- **WHEN** a student opens a diagnosis view for control-correction
- **THEN** the role-based diagnosis layer SHALL project the latest authorized report snapshot with student-readable explanations, evidence references, and next actions.

#### Scenario: Snapshot is missing
- **WHEN** no current diagnosis report snapshot exists
- **THEN** the diagnosis layer MAY use its existing claim fallback
- **AND** it SHALL expose a missing-snapshot limitation rather than presenting fallback claims as fully quantified reports.
