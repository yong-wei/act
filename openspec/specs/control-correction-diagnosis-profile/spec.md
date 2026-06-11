# control-correction-diagnosis-profile Specification

## Purpose
Define the governed indicator profile, reproducible snapshot contract, and
role-based access behavior for control-correction learning diagnosis.

## Requirements
### Requirement: Control-correction diagnosis uses governed indicators
The system SHALL define control-correction diagnosis through governed indicator definitions rather than page-local scoring or model-generated scores.

#### Scenario: Indicator definition is registered
- **WHEN** a control-correction diagnosis indicator is added
- **THEN** it SHALL declare dimension id, indicator id, source families, query spec, normalization policy, confidence policy, privacy visibility, materializer version, and fallback behavior
- **AND** definitions missing query spec or evidence threshold metadata SHALL fail validation.

#### Scenario: Control-correction dimensions are available
- **WHEN** the diagnosis profile is initialized
- **THEN** it SHALL include time-domain analysis, root-locus reasoning, frequency-domain margin analysis, method selection, constraint tradeoff, simulation validation, Arena transfer, reflection, and AI collaboration dimensions
- **AND** each dimension SHALL contain at least three registered indicators before the profile is marked report-ready.

### Requirement: Diagnosis snapshots are reproducible
The system SHALL materialize diagnosis snapshots from governed evidence using deterministic scoring and confidence policies.

#### Scenario: Indicator snapshot is materialized
- **WHEN** an indicator is calculated for a student or class scope
- **THEN** the snapshot SHALL store score, confidence, source coverage, evidence count, evidence window, materializer version, and limitations
- **AND** missing, stale, preview-only, or low-confidence sources SHALL lower confidence or mark the indicator unavailable instead of producing a precise high-confidence score.

#### Scenario: Report snapshot is materialized
- **WHEN** a diagnosis report is generated
- **THEN** it SHALL compose indicator snapshots into dimension scores, qualitative judgments, percentiles where cohort evidence allows, and evidence references
- **AND** the report SHALL preserve source windows and limitation reasons for every displayed dimension.

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
